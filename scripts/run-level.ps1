[CmdletBinding()]
param(
    # A folder in levels\: level-2, level-3 or level-4.
    [Parameter(Mandatory = $true)][ValidateSet(2, 3, 4)][int]$Level,
    # One Claude Code run, to check the task is neither trivial nor impossible. Not data.
    [switch]$Pilot,
    # Records what each harness first sends the model, with no model and no key. Free, not data.
    [switch]$CaptureRequests,
    # One run per condition, read in full (Ziad, 31 Oct).
    [int]$Rounds = 1,
    # Which harnesses to run, when a level doesn't need all three.
    [ValidateSet("claude", "opencode", "codex")][string[]]$Conditions = @("claude", "opencode", "codex"),
    [int]$TimeoutMinutes = 30,
    # No new run starts once the logged and estimated spend reaches this.
    [double]$BudgetUsd = 25,
    [int]$Port = 4000,
    # Run even if something differs from lock.json. Report the differences with the results.
    [switch]$AllowDrift
)

# Levels 2-4 ask how far each harness gets on real work, so each one runs with enough
# permission to do the work, instead of Task A's defaults. The settings aren't equal
# and can't be: see protocol.md, "Levels".

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib-task-a.ps1")

$KeyFromTerminal = $env:ANTHROPIC_API_KEY
if ($CaptureRequests) {
    # Not a key: nothing goes further than the recorder on this machine.
    $env:ANTHROPIC_API_KEY = "capture-only-not-a-key"
    $TimeoutMinutes = 1
} else {
    Import-LabKey
}
if (-not $env:ANTHROPIC_API_KEY) { throw "Set ANTHROPIC_API_KEY in this terminal or in the lab's .env first." }

$LevelRoot = Join-Path $LabRoot "levels\level-$Level"
foreach ($Needed in "fixture", "prompt.txt", "hidden", "grading.json") {
    if (-not (Test-Path -LiteralPath (Join-Path $LevelRoot $Needed))) { throw "levels\level-$Level has no $Needed." }
}
$Prompt = (Get-Content -Raw (Join-Path $LevelRoot "prompt.txt")).Trim()
& (Join-Path $PSScriptRoot "lock.ps1") -AllowDrift:$AllowDrift

$OpenCode = Get-OpenCodePath
$Codex = Get-CodexPath
$Claude = Get-ClaudePath

New-Item -ItemType Directory -Force -Path $TranscriptRoot, $RunRoot, $ProfileRoot | Out-Null
Enter-LabLock
Move-StrayRuns

# All three routes ask for medium effort. Left alone, the requests differ: Claude Code sends
# medium, OpenCode sends no effort, and Codex through LiteLLM sends no thinking setting at all
# (seen with -CaptureRequests), so the "same model" wouldn't be configured the same way.
$ClaudeAllowed = @("Bash(node *)", "Bash(npm *)", "Bash(git *)", "Bash(ls *)", "Bash(cat *)", "Bash(mkdir *)",
    "PowerShell(node *)", "PowerShell(npm *)", "PowerShell(git *)", "PowerShell(Get-*)", "PowerShell(Select-*)")
$ClaudeArgs = @("--permission-mode", "acceptEdits", "--allowedTools") + @($ClaudeAllowed | ForEach-Object { "`"$_`"" })
$Settings = @{
    "claude" = @{ Harness = "claude"; Route = "native, medium effort, edits accepted, allow-list for node, npm, git and reads"; Extra = $ClaudeArgs }
    "opencode" = @{ Harness = "opencode"; Route = "native, medium effort, default permissions"; Extra = @() }
    "codex" = @{ Harness = "codex"; Route = "Codex + LiteLLM + Claude, medium effort, unelevated sandbox, network off, prompt caching on"; Extra =@("--sandbox", "workspace-write", "-c", "windows.sandbox=unelevated", "-c", "model_reasoning_effort=medium") }
}

function New-LevelRun {
    param([string]$RunId)
    $RunDir = Get-RunDir $RunId
    $Workspace = Join-Path $RunDir "workspace"
    $Origin = Join-Path $RunDir "origin.git"
    New-Item -ItemType Directory -Force -Path $Workspace | Out-Null
    Copy-Item -Path (Join-Path $LevelRoot "fixture\*") -Destination $Workspace -Recurse -Force
    Get-ChildItem -LiteralPath (Join-Path $LevelRoot "fixture") -Force -File -Filter ".*" | Copy-Item -Destination $Workspace -Force
    & git init --quiet --bare --initial-branch=main $Origin
    & git -C $Workspace init --quiet --initial-branch=main
    & git -C $Workspace config user.name "dev"
    & git -C $Workspace config user.email "dev@localhost"
    & git -C $Workspace config core.autocrlf false
    & git -C $Workspace add --all
    & git -C $Workspace commit --quiet -m "Initial commit"
    & git -C $Workspace remote add origin $Origin
    & git -C $Workspace push --quiet origin main
    [pscustomobject]@{ base = (& git -C $Workspace rev-parse HEAD).Trim() } | ConvertTo-Json |
        Set-Content -LiteralPath (Join-Path $RunDir "baseline.json") -Encoding ascii
    # Last, because making the inventory reads every file.
    $LogDir = Get-RunLogDir $RunId
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    & node (Join-Path $PSScriptRoot "file-inventory.mjs") $Workspace (Join-Path $LogDir "files-before.json")
    Set-FilesUnread -Path $Workspace
    return $Workspace
}

function Invoke-LevelRun {
    param([string]$Condition, [string]$RunId, [string]$Workspace)

    $Setting = $Settings[$Condition]
    $LogDir = Get-RunLogDir $RunId
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    $Empty = Join-Path $TranscriptRoot "empty-stdin.txt"
    Set-Content -LiteralPath $Empty -Value "" -NoNewline
    $Stdout = Join-Path $LogDir "transcript.jsonl"
    $Stderr = Join-Path $LogDir "stderr.log"
    $Outside = '"' + ($Prompt -replace '"', '\"' -replace '\r?\n', ' ') + '"'

    switch ($Condition) {
        "claude" {
            $File = $Claude
            # The prompt comes first: --allowedTools takes every argument after it.
            $HarnessArgs = @("-p", $Outside, "--model", $ModelId, "--effort", "medium", "--output-format", "stream-json", "--verbose", "--strict-mcp-config") + $Setting.Extra
        }
        "opencode" {
            $File = $OpenCode
            $HarnessArgs = @("run", "--standalone", "--format", "json", "--model", "anthropic/$ModelId#medium") + $Setting.Extra + @($Outside)
        }
        "codex" {
            $File = $Codex
            $HarnessArgs = @("exec", "--ignore-user-config", "--json", "--model", $ModelId, "--cd", "`"$Workspace`"") + (Get-CodexProviderArgs -Port $Port) + $Setting.Extra + @($Outside)
        }
    }

    Save-RunManifest -RunId $RunId -Executable $File -HarnessArgs $HarnessArgs -Prompt $Outside
    Set-HarnessIsolation -Harness $Setting.Harness -RunId $RunId
    if ($CaptureRequests) {
        # Only the address changes, so each harness builds its normal first request.
        if ($Condition -eq "claude") { $env:ANTHROPIC_BASE_URL = "http://127.0.0.1:$Port" }
        if ($Condition -eq "opencode") {
            $OpenCodeConfig = Get-Content -Raw -LiteralPath $env:OPENCODE_CONFIG | ConvertFrom-Json
            $OpenCodeConfig | Add-Member -Force -NotePropertyName provider -NotePropertyValue ([pscustomobject]@{ anthropic = [pscustomobject]@{ options = [pscustomobject]@{ baseURL = "http://127.0.0.1:$Port/v1" } } })
            $OpenCodeConfig | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $env:OPENCODE_CONFIG -Encoding ascii
        }
    }
    try {
        $Clock = [Diagnostics.Stopwatch]::StartNew()
        $Process = Start-Process -FilePath $File -ArgumentList $HarnessArgs -WorkingDirectory $Workspace `
            -RedirectStandardInput $Empty -RedirectStandardOutput $Stdout -RedirectStandardError $Stderr `
            -WindowStyle Hidden -PassThru
        $Handle = $Process.Handle
        $Finished = $Process.WaitForExit($TimeoutMinutes * 60 * 1000)
        if (-not $Finished) { & taskkill /PID $Process.Id /T /F 2>&1 | Out-Null }
        $Clock.Stop()

        if ($Condition -eq "opencode") {
            # Its JSON output can miss the last step; the export holds the session's totals.
            Push-Location $Workspace
            try {
                $Sessions = (& $OpenCode session list --standalone --format json 2>$null) -join "`n" | ConvertFrom-Json
                foreach ($Session in $Sessions) {
                    & $OpenCode session export --standalone $Session.id 2>$null | Set-Content -LiteralPath (Join-Path $LogDir "session-$($Session.id).json") -Encoding utf8
                }
            } finally {
                Pop-Location
            }
        }
    } finally {
        Restore-Environment $BaseEnvironment
    }

    return [pscustomobject]@{
        Stdout = $Stdout
        Stopped = $Finished
        ExitCode = $(if ($Finished) { $Process.ExitCode } else { "timeout" })
        Seconds = [math]::Round($Clock.Elapsed.TotalSeconds, 1)
    }
}

$OriginalEnvironment = Save-Environment
if (-not $env:LITELLM_API_KEY) { $env:LITELLM_API_KEY = "sk-local-lab-" + [guid]::NewGuid().ToString("N") }
$BaseEnvironment = Save-Environment

try {
    if ($CaptureRequests) {
        $CaptureRoot = Join-Path $LabRoot "results\first-requests\level-$Level"
        New-Item -ItemType Directory -Force -Path $CaptureRoot | Out-Null
        $Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        foreach ($Condition in "claude", "opencode", "codex") {
            $File = Join-Path $CaptureRoot "$Condition.jsonl"
            if (Test-Path -LiteralPath $File) { Remove-Item -LiteralPath $File }
            $Recorder = Start-Process -FilePath "node" -ArgumentList "`"$(Join-Path $PSScriptRoot 'recording-model.mjs')`"", "$Port", "`"$File`"" -WindowStyle Hidden -PassThru
            $Handle = $Recorder.Handle
            try {
                Start-Sleep -Seconds 2
                $RunId = "l$Level-$Condition-capture-1-$Stamp"
                Write-Host "Recording $Condition ..."
                $Workspace = New-LevelRun -RunId $RunId
                Invoke-LevelRun -Condition $Condition -RunId $RunId -Workspace $Workspace | Out-Null
                Move-RunToLog $RunId
            } finally {
                & taskkill /PID $Recorder.Id /T /F 2>&1 | Out-Null
            }
        }
        # The Codex route again, through the gateway, to see what reaches the API after translation.
        $File = Join-Path $CaptureRoot "codex-after-gateway.jsonl"
        if (Test-Path -LiteralPath $File) { Remove-Item -LiteralPath $File }
        $Recorder = Start-Process -FilePath "node" -ArgumentList "`"$(Join-Path $PSScriptRoot 'recording-model.mjs')`"", "4001", "`"$File`"" -WindowStyle Hidden -PassThru
        $Handle = $Recorder.Handle
        $Gateway = Start-Gateway -Port $Port -Config "litellm-capture.yaml"
        Restore-Environment $BaseEnvironment
        try {
            $RunId = "l$Level-codex-capture-2-$Stamp"
            Write-Host "Recording codex through the gateway ..."
            $Workspace = New-LevelRun -RunId $RunId
            Invoke-LevelRun -Condition "codex" -RunId $RunId -Workspace $Workspace | Out-Null
            Move-RunToLog $RunId
        } finally {
            Stop-Gateway -Process $Gateway
            & taskkill /PID $Recorder.Id /T /F 2>&1 | Out-Null
        }
        Write-Host "Done. What each harness sent is in $CaptureRoot."
        return
    }

    if (-not $Pilot) { Test-ApiCredit }

    $Plan = if ($Pilot) {
        ,@("claude")
    } else {
        $All = @(
            @("claude", "opencode", "codex"),
            @("opencode", "codex", "claude"),
            @("codex", "claude", "opencode")
        )
        for ($Round = 0; $Round -lt $Rounds; $Round++) { ,$All[$Round % 3] }
    }

    $Gateway = $null
    if (-not $Pilot) {
        $Gateway = Start-Gateway -Port $Port -Config "litellm-cached.yaml"
        Restore-Environment $BaseEnvironment
    }
    try {
        $Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $Kind = if ($Pilot) { "pilot" } else { "run" }
        for ($Round = 0; $Round -lt @($Plan).Count; $Round++) {
            foreach ($Condition in $Plan[$Round]) {
                if ($Condition -notin $Conditions) { continue }
                $Spent = & (Join-Path $PSScriptRoot "get-spend.ps1")
                if ($Spent -ge $BudgetUsd) {
                    throw "Stopped before the next run: about `$$([math]::Round($Spent, 2)) spent, and the limit is `$$BudgetUsd."
                }
                $RunId = "l$Level-$Condition-$Kind-$($Round + 1)-$Stamp"
                Write-Host "Running $RunId (about `$$([math]::Round($Spent, 2)) spent so far) ..."
                $Workspace = New-LevelRun -RunId $RunId
                $Run = Invoke-LevelRun -Condition $Condition -RunId $RunId -Workspace $Workspace
                & (Join-Path $PSScriptRoot "score-level.ps1") -RunId $RunId -Level $Level -Kind $Kind -Condition $Condition `
                    -Route $Settings[$Condition].Route -HarnessVersion (Get-HarnessVersion $Settings[$Condition].Harness) `
                    -WallSeconds $Run.Seconds -StoppedCleanly $Run.Stopped -ExitCode $Run.ExitCode -Transcript $Run.Stdout
                Move-RunToLog $RunId
                # No tokens means the harness never reached the model. That's a broken setup,
                # not a score, so the remaining runs would only repeat it.
                $Facts = Get-Content -Raw -LiteralPath (Join-Path (Get-RunLogDir $RunId) "facts.json") | ConvertFrom-Json
                if ($Facts.cost_source -eq "none" -or [double]$Facts.cost_usd -eq 0) {
                    throw "$RunId did no model work. See its transcript and stderr.log in runs\task-a, and don't count its row."
                }
                Save-RunTrace -RunId $RunId -Condition $Condition
                if ($Facts.kind -eq "cut-off") {
                    throw "$RunId ran out of credit partway, so it doesn't count. Add credit, then rerun."
                }
            }
        }
    } finally {
        Stop-Gateway -Process $Gateway
    }
    if (-not $Pilot) { & node (Join-Path $PSScriptRoot "compare-level.mjs") $Level }
    Write-Host "Done: level $Level. Results are in results\levels.csv and results\traces\."
} finally {
    Restore-Environment $OriginalEnvironment
    # A key read from .env stays out of the terminal afterwards.
    $env:ANTHROPIC_API_KEY = $KeyFromTerminal
    Exit-LabLock
}
