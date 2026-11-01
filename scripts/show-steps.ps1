[CmdletBinding()]
param(
    # A folder name in runs\task-a, such as a-claude-headless-1-20261031-101500.
    [Parameter(Mandatory = $true)][string]$RunId,
    # Characters shown per step; the full text stays in the logs.
    [int]$Width = 300
)

# Prints what an agent did, step by step, from the logs a run saved.
# OpenCode's interactive export isn't parsed yet: read its session-*.json directly.

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib-task-a.ps1")

$LogDir = Get-RunLogDir $RunId
if (-not (Test-Path -LiteralPath $LogDir)) { throw "No run called $RunId in $TranscriptRoot." }

function Write-Step {
    param([string]$Kind, $Text)
    $Flat = ("$Text" -replace '\s+', ' ').Trim()
    if ($Flat.Length -gt $Width) { $Flat = $Flat.Substring(0, $Width) + " ..." }
    Write-Output ("{0,-7} {1}" -f $Kind, $Flat)
}

function Read-Events {
    param([string]$Path)
    foreach ($Line in Get-Content -LiteralPath $Path -Encoding utf8) {
        try { $Line | ConvertFrom-Json } catch { }
    }
}

function Get-ContentText {
    param($Content)
    if ($Content -is [string]) { return $Content }
    return (@($Content | ForEach-Object { $_.text }) -join " ")
}

$Home2 = Join-Path $LogDir "home"
$CodexLog = Get-ChildItem -LiteralPath (Join-Path $Home2 ".codex\sessions") -Recurse -File -Filter *.jsonl -ErrorAction SilentlyContinue | Select-Object -First 1
$ClaudeLog = Get-ChildItem -LiteralPath (Join-Path $Home2 ".claude\projects") -Recurse -File -Filter *.jsonl -ErrorAction SilentlyContinue | Select-Object -First 1
$Transcript = Join-Path $LogDir "transcript.jsonl"

if ($CodexLog) {
    foreach ($Event in Read-Events $CodexLog.FullName) {
        if ($Event.type -eq "turn_context") {
            Write-Step "POLICY" "sandbox=$($Event.payload.sandbox_policy.type) approval=$($Event.payload.approval_policy)"
        }
        if ($Event.type -ne "response_item") { continue }
        $Item = $Event.payload
        switch ($Item.type) {
            "function_call" { Write-Step "CALL" "$($Item.name) $($Item.arguments)" }
            "custom_tool_call" { Write-Step "CALL" "$($Item.name) $($Item.input)" }
            "function_call_output" { Write-Step "RESULT" $(if ($Item.output -is [string]) { $Item.output } else { Get-ContentText $Item.output }) }
            "custom_tool_call_output" { Write-Step "RESULT" $Item.output }
            "message" { if ($Item.role -eq "assistant") { Write-Step "SAID" (Get-ContentText $Item.content) } }
        }
    }
} elseif ($ClaudeLog) {
    foreach ($Event in Read-Events $ClaudeLog.FullName) {
        if ($Event.type -notin "assistant", "user") { continue }
        foreach ($Block in @($Event.message.content)) {
            switch ($Block.type) {
                "tool_use" { Write-Step "CALL" "$($Block.name) $($Block.input | ConvertTo-Json -Compress -Depth 6)" }
                "tool_result" { Write-Step "RESULT" (Get-ContentText $Block.content) }
                "text" { if ($Event.type -eq "assistant") { Write-Step "SAID" $Block.text } }
            }
        }
    }
} elseif (Test-Path -LiteralPath $Transcript) {
    foreach ($Event in Read-Events $Transcript) {
        switch ($Event.type) {
            "tool_use" {
                Write-Step "CALL" "$($Event.part.tool) $($Event.part.state.input | ConvertTo-Json -Compress -Depth 6)"
                Write-Step "RESULT" "[$($Event.part.state.status)] $($Event.part.state.output)"
            }
            "text" { Write-Step "SAID" $Event.part.text }
            "error" { Write-Step "ERROR" ($Event.error | ConvertTo-Json -Compress -Depth 4) }
        }
    }
} else {
    Write-Output "No step log found in $LogDir."
}
