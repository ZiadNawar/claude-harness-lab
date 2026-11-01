[CmdletBinding(DefaultParameterSetName = "Headless")]
param(
    # Setup check: smoke prompt in each harness. Not data.
    [Parameter(ParameterSetName = "Smoke", Mandatory = $true)][switch]$Smoke,
    # The 12 unattended runs: 3 per condition, in rotating order.
    [Parameter(ParameterSetName = "Headless")][switch]$Headless,
    # One run you drive yourself, to count permission prompts.
    [Parameter(ParameterSetName = "Interactive", Mandatory = $true)]
    [ValidateSet("claude", "opencode", "codex")][string]$Interactive,

    [int]$TimeoutMinutes = 10,
    [int]$Port = 4000,
    # Run even if something differs from lock.json. Report the differences with the results.
    [switch]$AllowDrift
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib-task-a.ps1")

if (-not $env:ANTHROPIC_API_KEY) {
    throw "Set ANTHROPIC_API_KEY in this terminal first. Use the lab key with the spending limit."
}

$OpenCode = Get-OpenCodePath
$Codex = Get-CodexPath
if (-not (Test-Path $OpenCode)) { throw "OpenCode is not installed. Run .\scripts\setup.ps1 first." }
if (-not $Codex) { throw "Codex was not found. Run .\scripts\setup.ps1 first." }
$Claude = Get-ClaudePath
if (-not $Claude) { throw "Claude Code was not found. Run .\scripts\setup.ps1 first." }
& (Join-Path $PSScriptRoot "lock.ps1") -AllowDrift:$AllowDrift

New-Item -ItemType Directory -Force -Path $TranscriptRoot, $RunRoot, $ProfileRoot | Out-Null
Enter-LabLock
Move-StrayRuns

function Get-Route {
    param([string]$Harness)
    if ($Harness -eq "codex") { return "Codex + LiteLLM + Claude" }
    return "native"
}

# Runs one harness unattended. A run past the time limit is killed, and the ledger
# records that it didn't stop by itself.
function Invoke-Unattended {
    param(
        [string]$Harness,
        [string]$RunId,
        [string]$Workspace,
        [string]$Prompt,
        [string[]]$ExtraArgs = @()
    )

    $LogDir = Get-RunLogDir $RunId
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    $Empty = Join-Path $TranscriptRoot "empty-stdin.txt"
    Set-Content -LiteralPath $Empty -Value "" -NoNewline
    $Stdout = Join-Path $LogDir "transcript.jsonl"
    $Stderr = Join-Path $LogDir "stderr.log"

    $Outside = '"' + ($Prompt -replace '"', '\"') + '"'
    switch ($Harness) {
        "claude" {
            $File = $Claude
            $HarnessArgs = @("-p", "--model", $ModelId, "--output-format", "stream-json", "--verbose", "--strict-mcp-config") + $ExtraArgs + @($Outside)
        }
        "opencode" {
            $File = $OpenCode
            $HarnessArgs = @("run", "--standalone", "--format", "json", "--model", "anthropic/$ModelId") + $ExtraArgs + @($Outside)
        }
        "codex" {
            $File = $Codex
            $HarnessArgs = @("exec", "--ignore-user-config", "--json", "--model", $ModelId, "--cd", "`"$Workspace`"") + (Get-CodexProviderArgs -Port $Port) + $ExtraArgs + @($Outside)
        }
    }

    Save-RunManifest -RunId $RunId -Executable $File -HarnessArgs $HarnessArgs -Prompt $Outside
    Set-HarnessIsolation -Harness $Harness -RunId $RunId
    try {
        $Clock = [Diagnostics.Stopwatch]::StartNew()
        $Process = Start-Process -FilePath $File -ArgumentList $HarnessArgs -WorkingDirectory $Workspace `
            -RedirectStandardInput $Empty -RedirectStandardOutput $Stdout -RedirectStandardError $Stderr `
            -WindowStyle Hidden -PassThru
        $Handle = $Process.Handle
        $Finished = $Process.WaitForExit($TimeoutMinutes * 60 * 1000)
        if (-not $Finished) { & taskkill /PID $Process.Id /T /F 2>&1 | Out-Null }
        $Clock.Stop()
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

# Harnesses change this terminal's environment while they run, so it's put back on the way out.
$OriginalEnvironment = Save-Environment
if (-not $env:LITELLM_API_KEY) { $env:LITELLM_API_KEY = "sk-local-lab-" + [guid]::NewGuid().ToString("N") }
$BaseEnvironment = Save-Environment

try {
    if ($PSCmdlet.ParameterSetName -eq "Smoke") {
        $Prompt = (Get-Content -Raw (Join-Path $LabRoot "smoke-prompt.txt")).Trim()
        # Setup check only: edits are allowed here, because the question is whether the
        # route works. Codex runs three times for the gateway check. On native Windows it
        # applies workspace-write only when a Windows sandbox is chosen; otherwise it
        # stays read-only and refuses commands.
        $CodexWrite = @("--sandbox", "workspace-write", "-c", "windows.sandbox=unelevated")
        $Plan = @(
            @{ Harness = "claude"; Extra = @("--permission-mode", "acceptEdits") },
            @{ Harness = "opencode"; Extra = @("--auto") },
            @{ Harness = "codex"; Extra = $CodexWrite },
            @{ Harness = "codex"; Extra = $CodexWrite },
            @{ Harness = "codex"; Extra = $CodexWrite }
        )
        $Gateway = Start-Gateway -Port $Port
        Restore-Environment $BaseEnvironment
        $Failures = 0
        try {
            $Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $Index = 0
            foreach ($Step in $Plan) {
                $Index++
                $RunId = "smoke-$Stamp-$Index-$($Step.Harness)"
                $Workspace = Join-Path (Get-RunDir $RunId) "workspace"
                New-Item -ItemType Directory -Force -Path $Workspace | Out-Null
                & git -C $Workspace init --quiet
                $Run = Invoke-Unattended -Harness $Step.Harness -RunId $RunId -Workspace $Workspace -Prompt $Prompt -ExtraArgs $Step.Extra
                $Result = Join-Path $Workspace "result.txt"
                $Ok = (Test-Path -LiteralPath $Result) -and ((Get-Content -Raw -LiteralPath $Result).Trim() -ceq "CLAUDE_HARNESS_OK")
                if (-not $Ok) { $Failures++ }
                Move-RunToLog $RunId
                Write-Host ("{0,-9} {1,-5} exit={2} {3}s  {4}" -f $Step.Harness, $(if ($Ok) { "PASS" } else { "FAIL" }), $Run.ExitCode, $Run.Seconds, $Run.Stdout)
            }
        } finally {
            Stop-Gateway -Process $Gateway
        }
        if ($Failures) { throw "$Failures smoke run(s) failed. Tell Claude; the logs are in runs\task-a." }
        Write-Host "All routes work. Next: .\scripts\run-task-a.ps1 -Headless"
        return
    }

    if ($PSCmdlet.ParameterSetName -eq "Interactive") {
        $Gateway = if ($Interactive -eq "codex") { Start-Gateway -Port $Port } else { $null }
        Restore-Environment $BaseEnvironment
        try {
            $RunId = "a-{0}-interactive-{1}" -f $Interactive, (Get-Date -Format "yyyyMMdd-HHmmss")
            $Workspace = (& (Join-Path $PSScriptRoot "new-task-a-run.ps1") -RunId $RunId) | Select-Object -Last 1
            $Version = Get-HarnessVersion $Interactive
            $LogDir = Get-RunLogDir $RunId
            New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
            $Prompt = (Get-Content -Raw (Join-Path $TaskARoot "prompt.txt")).Trim()
            Set-Clipboard -Value $Prompt

            Write-Host ""
            Write-Host "Task A, $Interactive, interactive. The prompt is on your clipboard: paste it as your first message."
            Write-Host "Every run starts as a fresh install. Accept setup screens (theme, API key, trust this folder), and don't count them."
            Write-Host "If Codex offers to set up a sandbox with Administrator permissions, don't approve it. Note it and tell Claude."
            Write-Host "The rule: answer every permission prompt with the 'yes, this once' option, and count each one."
            Write-Host "Don't type anything else. When the agent has finished, quit it to come back here."
            Write-Host ""

            Set-HarnessIsolation -Harness $Interactive -RunId $RunId
            Push-Location $Workspace
            $Clock = [Diagnostics.Stopwatch]::StartNew()
            try {
                switch ($Interactive) {
                    "claude" { & $Claude --model $ModelId --strict-mcp-config }
                    "opencode" {
                        & $OpenCode --standalone
                        # OpenCode keeps its session in a database, so the steps are exported as text.
                        $Sessions = (& $OpenCode session list --standalone --format json) -join "`n" | ConvertFrom-Json
                        foreach ($Session in $Sessions) {
                            & $OpenCode session export --standalone $Session.id | Set-Content -LiteralPath (Join-Path $LogDir "session-$($Session.id).json") -Encoding utf8
                        }
                    }
                    "codex" {
                        $ProviderArgs = Get-CodexProviderArgs -Port $Port
                        # Interactive Codex has no --ignore-user-config; CODEX_HOME keeps his config out.
                        & $Codex --no-daemon --model $ModelId --cd $Workspace @ProviderArgs
                    }
                }
            } finally {
                $Clock.Stop()
                Pop-Location
                Restore-Environment $BaseEnvironment
            }

            $Count = Read-Host "How many permission prompts did you get"
            $Stopped = Read-Host "Did it stop by itself, without you nudging it (y/n)"
            & (Join-Path $PSScriptRoot "score-task-a.ps1") -RunId $RunId -Harness $Interactive -Mode "interactive" `
                -Route (Get-Route $Interactive) -HarnessVersion $Version `
                -WallSeconds ([math]::Round($Clock.Elapsed.TotalSeconds, 1)) -PermissionPrompts $Count `
                -StoppedCleanly ($Stopped -match "^y")
            Move-RunToLog $RunId
        } finally {
            Stop-Gateway -Process $Gateway
        }
        return
    }

    # Headless: 3 rounds, with the order rotated so no condition always goes first.
    # Codex's default refuses every command on Windows without a sandbox, so a separate
    # configured row shows it doing the work. It's a different condition from the default.
    $Rounds = @(
        @("claude", "opencode", "codex", "codex-configured"),
        @("opencode", "codex-configured", "claude", "codex"),
        @("codex-configured", "codex", "opencode", "claude")
    )
    $CodexConfigured = @("--sandbox", "workspace-write", "-c", "windows.sandbox=unelevated", "-c", "sandbox_workspace_write.network_access=true")
    $Prompt = (Get-Content -Raw (Join-Path $TaskARoot "prompt.txt")).Trim()
    $Gateway = Start-Gateway -Port $Port
    Restore-Environment $BaseEnvironment
    try {
        $GatewayVersion = (& (Join-Path $LabRoot ".venv\Scripts\python.exe") -c "from importlib.metadata import version; print(version('litellm'))").Trim()
        $Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        for ($Round = 0; $Round -lt $Rounds.Count; $Round++) {
            foreach ($Condition in $Rounds[$Round]) {
                $Harness = $Condition -replace "-configured$", ""
                $Extra = @()
                $Route = Get-Route $Harness
                if ($Condition -eq "codex-configured") {
                    $Extra = $CodexConfigured
                    $Route = "$Route, unelevated sandbox, network on"
                }
                $RunId = "a-$Condition-headless-$($Round + 1)-$Stamp"
                Write-Host "Running $RunId ..."
                $Workspace = (& (Join-Path $PSScriptRoot "new-task-a-run.ps1") -RunId $RunId) | Select-Object -Last 1
                $Run = Invoke-Unattended -Harness $Harness -RunId $RunId -Workspace $Workspace -Prompt $Prompt -ExtraArgs $Extra
                & (Join-Path $PSScriptRoot "score-task-a.ps1") -RunId $RunId -Harness $Harness -Mode "headless" `
                    -Route $Route -HarnessVersion (Get-HarnessVersion $Harness) `
                    -GatewayVersion $(if ($Harness -eq "codex") { $GatewayVersion } else { "" }) `
                    -WallSeconds $Run.Seconds -StoppedCleanly $Run.Stopped -Transcript $Run.Stdout
                Move-RunToLog $RunId
            }
        }
    } finally {
        Stop-Gateway -Process $Gateway
    }
    Write-Host ""
    Write-Host "Done: 12 headless runs in results\results.csv. Tell Claude 'headless runs are done'."
} finally {
    Restore-Environment $OriginalEnvironment
    Exit-LabLock
}
