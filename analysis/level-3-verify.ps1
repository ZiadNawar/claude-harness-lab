[CmdletBinding()]
param(
    [ValidateSet("claude", "opencode", "codex")][string[]]$Conditions = @("claude", "opencode", "codex"),
    [int]$TimeoutMinutes = 90,
    [double]$BudgetUsd = 35
)

# Reruns Level 3 under the unchanged lock, one harness at a time, each in a new PowerShell
# process, and stops if anything could cross from one run to the next. It lives outside
# scripts\ because lock.json hashes that whole folder. See protocol.md, "Level 3 verification".

$ErrorActionPreference = "Stop"
$Lab = Split-Path -Parent $PSScriptRoot
. (Join-Path $Lab "scripts\lib-task-a.ps1")
. (Join-Path $PSScriptRoot "level-3-isolation.ps1")

$Comparison = Join-Path $LabRoot "results\level-3-comparison.md"
$FirstRuns = Join-Path $LabRoot "results\level-3-first-runs-comparison.md"
$Rerun = Join-Path $LabRoot "results\level-3-rerun-comparison.md"
if (-not (Test-Path -LiteralPath $FirstRuns)) { Copy-Item -LiteralPath $Comparison -Destination $FirstRuns }

try {
    foreach ($Condition in $Conditions) {
        $Before = @(Get-LabProblems)
        if ($Before.Count) { throw "Not starting $Condition, because the lab isn't clean: $($Before -join '; ')" }
        $Marked = Set-AnswerCanaries
        Write-Host "Starting $Condition with a clean lab; watching $Marked files that hold answers."
        $Known = @(Get-ChildItem -Directory -Path (Join-Path $TranscriptRoot "l3-$Condition-run-*") -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })

        & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $LabRoot "scripts\run-level.ps1") `
            -Level 3 -Conditions $Condition -TimeoutMinutes $TimeoutMinutes -BudgetUsd $BudgetUsd
        $Exit = $LASTEXITCODE

        $Reads = @(Get-AnswerReads)
        $RunId = @(Get-ChildItem -Directory -Path (Join-Path $TranscriptRoot "l3-$Condition-run-*") | Where-Object { $_.Name -notin $Known } | ForEach-Object { $_.Name }) | Select-Object -Last 1
        $After = @(Get-LabProblems)
        $Leak = if ($RunId -and (Test-Path -LiteralPath (Join-Path (Get-RunLogDir $RunId) "facts.json"))) { Get-RunLeakFacts $RunId } else { $null }
        Add-IsolationRecord ([pscustomobject]@{
            run_id = $RunId
            condition = $Condition
            checked_at = (Get-Date).ToUniversalTime().ToString("o")
            exit_code = $Exit
            answer_files_watched = $Marked
            answer_files_read = @($Reads)
            problems_after = @($After)
            key_in_log = $Leak.key_in_log
            outside_paths = $Leak.outside_paths
            outside_path_list = @($Leak.outside_path_list)
        })

        if ($Exit) { throw "$Condition's run ended with exit code $Exit. See the output above." }
        if ($After.Count) { throw "Stopped after ${Condition}, because the lab isn't clean: $($After -join '; ')" }
        if ($Reads.Count) { throw "Stopped after ${Condition}: $($Reads.Count) file(s) holding answers were read. See $IsolationReport." }
    }
} finally {
    # The rerun's table gets its own name, and the first runs' table stays where the note cites it.
    if ((Test-Path -LiteralPath $Comparison) -and ((Get-FileHash -LiteralPath $Comparison).Hash -ne (Get-FileHash -LiteralPath $FirstRuns).Hash)) {
        Copy-Item -LiteralPath $Comparison -Destination $Rerun -Force
        Copy-Item -LiteralPath $FirstRuns -Destination $Comparison -Force
    }
}
Write-Host "Done. Isolation record: $IsolationReport"
