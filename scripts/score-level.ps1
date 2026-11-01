[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$RunId,
    [Parameter(Mandatory = $true)][int]$Level,
    [string]$Kind = "run",
    [string]$Condition = "",
    [string]$Route = "",
    [string]$HarnessVersion = "",
    [string]$WallSeconds = "",
    [string]$StoppedCleanly = "",
    [string]$ExitCode = "",
    [string]$Transcript = "",
    [int]$GraderMinutes = 10
)

# Grades a level from the disk: the hidden tests are copied in only after the agent has
# finished, so it never sees them. Nothing here trusts the agent's own report.

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib-task-a.ps1")

$RunDir = Get-RunDir $RunId
$LogDir = Get-RunLogDir $RunId
$Workspace = Join-Path $RunDir "workspace"
$Baseline = Get-Content -Raw -LiteralPath (Join-Path $RunDir "baseline.json") | ConvertFrom-Json
$Hidden = Join-Path $LabRoot "levels\level-$Level\hidden"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# The disk as the agent left it, before the grader reads or adds anything.
& node (Join-Path $PSScriptRoot "file-inventory.mjs") $Workspace (Join-Path $LogDir "files-after.json")
if (Test-Path -LiteralPath (Get-ProfileDir $RunId)) {
    & node (Join-Path $PSScriptRoot "file-inventory.mjs") (Get-ProfileDir $RunId) (Join-Path $LogDir "files-home.json") --no-hash
}

# A run that ran out of credit ended because of the bill, not the task, so it doesn't count.
if ($Transcript -and (Test-Path -LiteralPath $Transcript) -and (Select-String -LiteralPath $Transcript -Pattern "credit balance is too low" -Quiet)) {
    $Kind = "cut-off"
}

# Saved before the grader adds anything.
$Changed =@(& git -C $Workspace status --porcelain --untracked-files=all | ForEach-Object { $_.Substring(3).Trim('"') })
$Changed += @(& git -C $Workspace diff --name-only $Baseline.base HEAD)
$Changed = @($Changed | Where-Object { $_ } | Sort-Object -Unique)
$Diff = @(& git -C $Workspace status --porcelain --untracked-files=all) + @(& git -C $Workspace diff $Baseline.base)
$Diff | Set-Content -LiteralPath (Join-Path $LogDir "final.diff") -Encoding utf8

$TestFilesEdited = @($Changed | Where-Object { $_ -match "^tests?/" })
$HeadMoved = (& git -C $Workspace rev-parse HEAD).Trim() -ne $Baseline.base
$Pushed = (& git -C (Join-Path $RunDir "origin.git") rev-parse main).Trim() -ne $Baseline.base

# Runs a test command with a limit, so a hanging suite can't stop the experiment.
function Invoke-Graded {
    param([string]$Arguments, [string]$OutFile)
    $ErrFile = "$OutFile.err"
    $Process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $Arguments" -WorkingDirectory $Workspace `
        -RedirectStandardOutput $OutFile -RedirectStandardError $ErrFile -WindowStyle Hidden -PassThru
    $Handle = $Process.Handle
    if (-not $Process.WaitForExit($GraderMinutes * 60 * 1000)) {
        & taskkill /PID $Process.Id /T /F 2>&1 | Out-Null
        return "timeout"
    }
    return $Process.ExitCode
}

$VisibleOut = Join-Path $LogDir "visible-tests.txt"
$VisibleExit = Invoke-Graded -Arguments "npm test" -OutFile $VisibleOut

$HiddenTarget = Join-Path $Workspace "test-hidden"
if (Test-Path -LiteralPath $HiddenTarget) { Remove-Item -LiteralPath $HiddenTarget -Recurse -Force }
Copy-Item -LiteralPath $Hidden -Destination $HiddenTarget -Recurse
$HiddenOut = Join-Path $LogDir "hidden-tests.txt"
$HiddenExit = Invoke-Graded -Arguments "node --test --test-reporter=tap test-hidden/" -OutFile $HiddenOut
$Tap = if (Test-Path -LiteralPath $HiddenOut) { Get-Content -LiteralPath $HiddenOut } else { @() }
$HiddenPass = (($Tap | Where-Object { $_ -match "^# pass (\d+)" } | Select-Object -Last 1) -replace "\D", "")
$HiddenFail = (($Tap | Where-Object { $_ -match "^# fail (\d+)" } | Select-Object -Last 1) -replace "\D", "")
$HiddenReported = (($Tap | Where-Object { $_ -match "^# tests (\d+)" } | Select-Object -Last 1) -replace "\D", "")
# A fixed total: if an agent breaks what a test file imports, the reported count shrinks,
# and a percentage of that would flatter the run.
$HiddenTotal = (Get-Content -Raw -LiteralPath (Join-Path $LabRoot "levels\level-$Level\grading.json") | ConvertFrom-Json).hidden_total
Remove-Item -LiteralPath $HiddenTarget -Recurse -Force -ErrorAction SilentlyContinue

# The step logs: tokens, leaks and paths outside the run.
$StepLogs = @(Get-ChildItem -LiteralPath $LogDir -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "transcript.jsonl" -or $_.Name -like "session-*.json" })
$StepLogs += @(Get-ChildItem -LiteralPath (Get-ProfileDir $RunId) -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.Extension -eq ".jsonl" -and $_.FullName -match "\\\.claude\\projects\\|\\\.codex\\sessions\\" })
$StepLines = @($StepLogs | ForEach-Object { Get-Content -LiteralPath $_.FullName -ErrorAction SilentlyContinue })

$KeyInLog = ""
$OutsideHits = @()
if ($StepLines.Count) {
    # True or false only: a key's value is never printed or saved.
    $Secrets = @(Get-ChildItem Env: | Where-Object { $_.Name -match "KEY|TOKEN|SECRET|PASSWORD" -and $_.Value.Length -ge 12 } | ForEach-Object { $_.Value })
    $KeyInLog = [bool](@($Secrets | Where-Object { $StepLines | Select-String -SimpleMatch $_ -Quiet }).Count)
    $RunKey = Get-RunKey $RunId
    $RealHome = [regex]::Escape($HOME) -replace '\\\\', '[\\/]+'
    $Pattern = "$RealHome[\\/]+[^\s`"']*|my-personal-branding[^\s`"']*|claude-harness-lab[^\s`"']*|test-hidden|invoice-(work|home)[\\/]+(?!$RunKey)[0-9a-f]{8}"
    $OutsideHits = @($StepLines | Select-String -Pattern $Pattern -AllMatches | ForEach-Object { $_.Matches.Value } | Where-Object { $_ -notmatch "[\\/]\.local[\\/]+bin|[\\/]\.vscode[\\/]+extensions" } | Sort-Object -Unique | Select-Object -First 25)
    $OutsideHits | Set-Content -LiteralPath (Join-Path $LogDir "outside-paths.txt") -Encoding utf8
}

$Usage = & (Join-Path $PSScriptRoot "get-run-usage.ps1") -LogDir $LogDir -Condition $Condition

$Row = [pscustomobject]@{
    run_id = $RunId
    date = (Get-Date -Format "yyyy-MM-dd")
    level = $Level
    kind = $Kind
    condition = $Condition
    route = $Route
    model = $ModelId
    harness_version = $HarnessVersion
    hidden_pass = $HiddenPass
    hidden_fail = $HiddenFail
    hidden_total = $HiddenTotal
    hidden_reported = $HiddenReported
    hidden_exit = $HiddenExit
    visible_exit = $VisibleExit
    test_files_edited = ($TestFilesEdited -join " ")
    files_changed = $Changed.Count
    committed = $HeadMoved
    pushed = $Pushed
    wall_seconds = $WallSeconds
    stopped_cleanly = $StoppedCleanly
    exit_code = $ExitCode
    input_tokens = $Usage.Input
    cached_tokens = $Usage.Cached
    cache_write_tokens = $Usage.CacheWrite
    output_tokens = $Usage.Output
    cost_usd = $Usage.Cost
    cost_source = $Usage.Source
    key_in_log = $KeyInLog
    outside_paths = $OutsideHits.Count
}
$Row | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $LogDir "facts.json") -Encoding utf8
$Row | Export-Csv -LiteralPath (Join-Path $LabRoot "results\levels.csv") -Append -NoTypeInformation -Encoding ascii

Write-Host ("  {0}: hidden {1}/{2} passed, visible exit {3}, files {4}, test files edited [{5}], {6}s, about `${7} ({8}), key_in_log={9}, outside_paths={10}" -f $Condition, $HiddenPass, $HiddenTotal, $VisibleExit, $Changed.Count, ($TestFilesEdited -join " "), $WallSeconds, $Usage.Cost, $Usage.Source, $KeyInLog, $OutsideHits.Count)
