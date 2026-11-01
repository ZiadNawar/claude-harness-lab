[CmdletBinding()]
param(
    # Records the first request with no model and no sign-in. Free, not data.
    [switch]$CaptureRequest,
    [int]$TimeoutMinutes = 90,
    [int]$Port = 4000
)

# One Claude Code run of Level 3 on claude-opus-5-5 at high effort, on Ziad's subscription, not the
# API. Same build, task, grader and permissions as run-level.ps1. It changes the model, effort and
# billing route together, so it says nothing about harnesses: see protocol.md, "Level 3 verification".
# Its run id doesn't contain "-claude-", so the API spend guard doesn't count its notional cost.

$ErrorActionPreference = "Stop"
$Lab = Split-Path -Parent $PSScriptRoot
. (Join-Path $Lab "scripts\lib-task-a.ps1")
. (Join-Path $PSScriptRoot "level-3-isolation.ps1")

$OpusModel = "claude-opus-5-5"
$Level = 3
$LevelRoot = Join-Path $LabRoot "levels\level-$Level"
$Kind = "opus-subscription"
$Route = "native, high effort, edits accepted, allow-list for node, npm, git and reads, subscription sign-in"

# From this terminal or the lab's gitignored .env, and never printed. It stays in this process's
# environment, so it's never on disk in the run's home folder or logs.
$Token = $env:CLAUDE_CODE_OAUTH_TOKEN
if (-not $Token -and -not $CaptureRequest) {
    $File = Join-Path $LabRoot ".env"
    if (Test-Path -LiteralPath $File) {
        $Line = Get-Content -LiteralPath $File | Where-Object { $_ -match "^\s*CLAUDE_CODE_OAUTH_TOKEN\s*=" } | Select-Object -First 1
        if ($Line) { $Token = ($Line -replace "^\s*CLAUDE_CODE_OAUTH_TOKEN\s*=\s*", "").Trim().Trim('"') }
    }
    if (-not $Token) { throw "No subscription token. Run 'claude setup-token' and add CLAUDE_CODE_OAUTH_TOKEN=... to the lab's .env." }
}

# A leftover API key would take priority over the subscription and bill the API.
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", $null)
$env:CLAUDE_CODE_OAUTH_TOKEN = $Token

& (Join-Path $LabRoot "scripts\lock.ps1")
$Before = @(Get-LabProblems -Port $Port)
if ($Before.Count) { throw "Not starting, because the lab isn't clean: $($Before -join '; ')" }
$Marked = Set-AnswerCanaries

$Prompt = (Get-Content -Raw (Join-Path $LevelRoot "prompt.txt")).Trim()
$Claude = Get-ClaudePath
New-Item -ItemType Directory -Force -Path $TranscriptRoot, $RunRoot, $ProfileRoot | Out-Null
Enter-LabLock
Move-StrayRuns

$Allowed = @("Bash(node *)", "Bash(npm *)", "Bash(git *)", "Bash(ls *)", "Bash(cat *)", "Bash(mkdir *)",
    "PowerShell(node *)", "PowerShell(npm *)", "PowerShell(git *)", "PowerShell(Get-*)", "PowerShell(Select-*)")

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RunId = if ($CaptureRequest) { "l3-opus-capture-1-$Stamp" } else { "l3-opus-high-subscription-1-$Stamp" }
$Base = Save-Environment
$Recorder = $null
try {
    # The same setup as New-LevelRun in run-level.ps1.
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
    $LogDir = Get-RunLogDir $RunId
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    & node (Join-Path $LabRoot "scripts\file-inventory.mjs") $Workspace (Join-Path $LogDir "files-before.json")
    Set-FilesUnread -Path $Workspace

    $Empty = Join-Path $TranscriptRoot "empty-stdin.txt"
    Set-Content -LiteralPath $Empty -Value "" -NoNewline
    $Stdout = Join-Path $LogDir "transcript.jsonl"
    $Stderr = Join-Path $LogDir "stderr.log"
    $Outside = '"' + ($Prompt -replace '"', '\"' -replace '\r?\n', ' ') + '"'
    $HarnessArgs = @("-p", $Outside, "--model", $OpusModel, "--effort", "high", "--output-format", "stream-json", "--verbose", "--strict-mcp-config",
        "--permission-mode", "acceptEdits", "--allowedTools") + @($Allowed | ForEach-Object { "`"$_`"" })
    Save-RunManifest -RunId $RunId -Executable $Claude -HarnessArgs $HarnessArgs -Prompt $Outside

    if ($CaptureRequest) {
        $CaptureRoot = Join-Path $LabRoot "results\first-requests\level-3-opus"
        New-Item -ItemType Directory -Force -Path $CaptureRoot | Out-Null
        $Capture = Join-Path $CaptureRoot "claude.jsonl"
        if (Test-Path -LiteralPath $Capture) { Remove-Item -LiteralPath $Capture }
        $Recorder = Start-Process -FilePath "node" -ArgumentList "`"$(Join-Path $LabRoot 'scripts\recording-model.mjs')`"", "$Port", "`"$Capture`"" -WindowStyle Hidden -PassThru
        $RecorderHandle = $Recorder.Handle
        Start-Sleep -Seconds 2
        $TimeoutMinutes = 1
    }

    Set-HarnessIsolation -Harness "claude" -RunId $RunId
    # Set-HarnessIsolation clears tokens. Put back only this one. Connectors on his account stay
    # out, and the agent's own commands don't inherit the token.
    if ($CaptureRequest) {
        # Not a key: nothing goes further than the recorder on this machine.
        $env:ANTHROPIC_API_KEY = "capture-only-not-a-key"
        $env:ANTHROPIC_BASE_URL = "http://127.0.0.1:$Port"
    } else {
        $env:CLAUDE_CODE_OAUTH_TOKEN = $Token
    }
    $env:ENABLE_CLAUDEAI_MCP_SERVERS = "false"
    $env:CLAUDE_CODE_SUBPROCESS_ENV_SCRUB = "1"

    $Clock = [Diagnostics.Stopwatch]::StartNew()
    $Process = Start-Process -FilePath $Claude -ArgumentList $HarnessArgs -WorkingDirectory $Workspace `
        -RedirectStandardInput $Empty -RedirectStandardOutput $Stdout -RedirectStandardError $Stderr `
        -WindowStyle Hidden -PassThru
    $Handle = $Process.Handle
    Restore-Environment $Base

    # The harness's first event says how it signed in. An API route stops here, before it costs money.
    if (-not $CaptureRequest) {
        for ($Wait = 0; $Wait -lt 120 -and -not $Process.HasExited; $Wait += 2) {
            $Init = Select-String -LiteralPath $Stdout -Pattern '"apiKeySource":"([^"]*)"' -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($Init) {
                if ($Init.Matches[0].Groups[1].Value -ne "none") {
                    & taskkill /PID $Process.Id /T /F 2>&1 | Out-Null
                    throw "Stopped: this run signed in with $($Init.Matches[0].Groups[1].Value), not the subscription."
                }
                break
            }
            Start-Sleep -Seconds 2
        }
    }

    $Finished = $Process.WaitForExit($TimeoutMinutes * 60 * 1000)
    if (-not $Finished) { & taskkill /PID $Process.Id /T /F 2>&1 | Out-Null }
    $Clock.Stop()
    $ExitCode = $(if ($Finished) { $Process.ExitCode } else { "timeout" })

    if ($CaptureRequest) {
        Move-RunToLog $RunId
        Write-Host "Recorded the first request in $Capture. Not data."
        return
    }

    & (Join-Path $LabRoot "scripts\score-level.ps1") -RunId $RunId -Level $Level -Kind $Kind -Condition "claude" `
        -Route $Route -HarnessVersion (Get-HarnessVersion "claude") -WallSeconds ([math]::Round($Clock.Elapsed.TotalSeconds, 1)) `
        -StoppedCleanly $Finished -ExitCode $ExitCode -Transcript $Stdout
    Move-RunToLog $RunId

    # score-level.ps1 is locked and writes the lab's model, so this row is corrected here. Nothing was billed.
    $FactsFile = Join-Path $LogDir "facts.json"
    $Facts = Get-Content -Raw -LiteralPath $FactsFile | ConvertFrom-Json
    $LoggedSource = $Facts.cost_source
    $Facts.model = $OpusModel
    $Facts.cost_source = "notional, subscription"
    $Facts | ConvertTo-Json | Set-Content -LiteralPath $FactsFile -Encoding utf8
    $Csv = Join-Path $LabRoot "results\levels.csv"
    $Lines = @(Get-Content -LiteralPath $Csv)
    $Last = $Lines[$Lines.Count - 1]
    if ($Last -notmatch [regex]::Escape($RunId)) { throw "The last row of levels.csv isn't $RunId." }
    $Lines[$Lines.Count - 1] = ($Last -replace "`"$ModelId`"", "`"$OpusModel`"") -replace "`"$([regex]::Escape($LoggedSource))`"", "`"notional, subscription`""
    $Lines | Set-Content -LiteralPath $Csv -Encoding ascii

    Save-RunTrace -RunId $RunId -Condition "claude"

    $Reads = @(Get-AnswerReads)
    $After = @(Exit-LabLock; Get-LabProblems -Port $Port)
    $Leak = Get-RunLeakFacts $RunId
    Add-IsolationRecord ([pscustomobject]@{
        run_id = $RunId
        condition = "claude, $OpusModel, high, subscription"
        checked_at = (Get-Date).ToUniversalTime().ToString("o")
        exit_code = $ExitCode
        answer_files_watched = $Marked
        answer_files_read = @($Reads)
        problems_after = @($After)
        key_in_log = $Leak.key_in_log
        outside_paths = $Leak.outside_paths
        outside_path_list = @($Leak.outside_path_list)
    })
    Write-Host "Done: $RunId. hidden $($Facts.hidden_pass)/$($Facts.hidden_total), answer files read: $($Reads.Count), problems after: $($After.Count)."
} finally {
    Restore-Environment $Base
    if ($Recorder) { & taskkill /PID $Recorder.Id /T /F 2>&1 | Out-Null }
    [Environment]::SetEnvironmentVariable("CLAUDE_CODE_OAUTH_TOKEN", $null)
    Exit-LabLock
}
