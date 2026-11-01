# Checks that nothing crosses from one Level 3 run to the next. Dot-source it after lib-task-a.ps1.
# These detect a leak; they don't prevent one: see protocol.md, "Level 3 verification".

$CanaryTime = [datetime]::SpecifyKind([datetime]"2001-01-01", [DateTimeKind]::Utc)
$IsolationReport = Join-Path $LabRoot "results\level-3-isolation-check.json"

# Files that hold answers. The lab itself doesn't read these during a run: the lock hashes only
# the fixture, prompt, hidden tests and grading, and the spend guard reads only each run's logs.
function Get-AnswerFiles {
    $Level = Join-Path $LabRoot "levels\level-3"
    $Roots = @(
        @(Get-ChildItem -Directory -Path (Join-Path $TranscriptRoot "l3-*") -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName "run\workspace" })
        @(Get-ChildItem -Directory -Path (Join-Path $LabRoot "results\traces\l3-*") -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
        @("reference", "alternative", "shallow", "mutants" | ForEach-Object { Join-Path $Level $_ })
        (Join-Path $LabRoot "..\..\research\2026-10-31-level-3")
    )
    foreach ($Root in $Roots) {
        if (Test-Path -LiteralPath $Root) {
            Get-ChildItem -LiteralPath $Root -Recurse -File -Force | Where-Object { $_.FullName -notmatch "\\\.git\\" }
        }
    }
    Get-ChildItem -Path (Join-Path $LabRoot "results\level-3-*.json") -File | Where-Object { $_.FullName -ne $IsolationReport }
    foreach ($File in (Join-Path $Level "DESIGN.md"), (Join-Path $Level "check.mjs"), (Join-Path $LabRoot "..\..\research\2026-10-31-level-3-pilot.md")) {
        if (Test-Path -LiteralPath $File) { Get-Item -LiteralPath $File }
    }
}

# A check that can't fail is no check, so prove a read changes the time on this disk first.
function Test-CanaryWorks {
    $File = Join-Path $TranscriptRoot ".canary-check"
    Set-Content -LiteralPath $File -Value "canary"
    try {
        (Get-Item -LiteralPath $File).LastAccessTimeUtc = $CanaryTime
        Get-Content -LiteralPath $File | Out-Null
        Start-Sleep -Seconds 2
        return ((Get-Item -LiteralPath $File).LastAccessTimeUtc -gt $CanaryTime.AddDays(1))
    } finally {
        Remove-Item -LiteralPath $File -ErrorAction SilentlyContinue
    }
}

function Set-AnswerCanaries {
    if (-not (Test-CanaryWorks)) { throw "A read doesn't change last-access times on this disk, so this check would see nothing." }
    # Only these are checked afterwards: the run's own new workspace and trace land in the same folders.
    $script:WatchedFiles = @(Get-AnswerFiles | ForEach-Object { $_.FullName })
    foreach ($File in $script:WatchedFiles) { (Get-Item -LiteralPath $File -Force).LastAccessTimeUtc = $CanaryTime }
    return $script:WatchedFiles.Count
}

function Get-AnswerReads {
    @($script:WatchedFiles | ForEach-Object { Get-Item -LiteralPath $_ -Force } | Where-Object { $_.LastAccessTimeUtc -gt $CanaryTime.AddDays(1) } |
        ForEach-Object { [pscustomobject]@{ file = $_.FullName; read_at = $_.LastAccessTimeUtc.ToString("o") } })
}

# Only what names the run folders, so nothing else on this machine is touched.
function Get-RunProcesses {
    @(Get-CimInstance Win32_Process | Where-Object {
        $_.ProcessId -ne $PID -and ($_.CommandLine -match "(?i)C:\\invoice-(work|home)" -or $_.ExecutablePath -match "(?i)C:\\invoice-(work|home)")
    })
}

# Returns what was wrong, so the caller can record it. An empty list means clean.
function Get-LabProblems {
    param([int]$Port = 4000)
    $Problems = @()
    foreach ($Root in $RunRoot, $ProfileRoot) {
        $Left = @(Get-ChildItem -LiteralPath $Root -Force -ErrorAction SilentlyContinue)
        if ($Left.Count) { $Problems += "$Root holds $($Left.Count) item(s)" }
    }
    foreach ($Process in Get-RunProcesses) { $Problems += "process $($Process.ProcessId) ($($Process.Name)) names a run folder" }
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { $Problems += "port $Port is still in use" }
    if (Test-Path -LiteralPath (Join-Path $TranscriptRoot ".active")) { $Problems += "another lab script's marker is present" }
    return $Problems
}

function Add-IsolationRecord {
    param([Parameter(Mandatory = $true)]$Record)
    $All = @()
    # Windows PowerShell's ConvertFrom-Json hands back an array as one item, so unroll it.
    if (Test-Path -LiteralPath $IsolationReport) { $All = @(Get-Content -Raw -LiteralPath $IsolationReport | ConvertFrom-Json | ForEach-Object { $_ }) }
    $All += $Record
    ConvertTo-Json -InputObject @($All) -Depth 6 | Set-Content -LiteralPath $IsolationReport -Encoding utf8
}

# What the score step found about one finished run.
function Get-RunLeakFacts {
    param([Parameter(Mandatory = $true)][string]$RunId)
    $LogDir = Get-RunLogDir $RunId
    $Facts = Get-Content -Raw -LiteralPath (Join-Path $LogDir "facts.json") | ConvertFrom-Json
    $Outside = Join-Path $LogDir "outside-paths.txt"
    return [pscustomobject]@{
        key_in_log = $Facts.key_in_log
        outside_paths = $Facts.outside_paths
        outside_path_list = @(if (Test-Path -LiteralPath $Outside) { Get-Content -LiteralPath $Outside })
    }
}
