# Shared by the Task A scripts. Dot-source it; it only defines values and functions.

$LabRoot = Split-Path -Parent $PSScriptRoot
$TaskARoot = Join-Path $LabRoot "task-a"
$TranscriptRoot = Join-Path $LabRoot "runs\task-a"
$ResultsCsv = Join-Path $LabRoot "results\results.csv"

# Workspaces live outside this project. Claude Code, Codex and OpenCode all read
# instruction files from parent folders, so a workspace under this repo would pick
# up its CLAUDE.md and the run would no longer test the harness out of the box.
$RunRoot = "C:\invoice-work"
# Each run gets its own empty home folder, so nothing carries over between runs.
$ProfileRoot = "C:\invoice-home"

$ModelId = "claude-sonnet-5-5"

# The pinned installs come first, so an update elsewhere on the machine can't change a run.
function Get-ClaudePath {
    $Pinned = Join-Path $LabRoot "pins\node_modules\@anthropic-ai\claude-code\bin\claude.exe"
    if (Test-Path -LiteralPath $Pinned) { return $Pinned }
    return (Get-Command claude -ErrorAction SilentlyContinue).Source
}

function Get-CodexPath {
    $Pinned = Join-Path $LabRoot "pins\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe"
    if (Test-Path -LiteralPath $Pinned) { return $Pinned }
    $OnPath = Get-Command codex -ErrorAction SilentlyContinue
    if ($OnPath) { return $OnPath.Source }
    # Codex is reused from the VS Code extension, which isn't on PATH by default.
    $Found = Get-ChildItem -Path (Join-Path $HOME ".vscode\extensions") -Filter "codex.exe" -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "openai\.chatgpt-.*windows-x86_64" } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($Found) { return $Found.FullName }
    return $null
}

# The key comes from this terminal or from the lab's gitignored .env, and is never printed.
function Import-LabKey {
    if ($env:ANTHROPIC_API_KEY) { return }
    $File = Join-Path $LabRoot ".env"
    if (-not (Test-Path -LiteralPath $File)) { return }
    $Line = Get-Content -LiteralPath $File | Where-Object { $_ -match "^\s*ANTHROPIC_API_KEY\s*=" } | Select-Object -First 1
    if ($Line) { $env:ANTHROPIC_API_KEY = ($Line -replace "^\s*ANTHROPIC_API_KEY\s*=\s*", "").Trim().Trim('"') }
}

function Get-OpenCodePath {
    return (Join-Path $LabRoot "tools\opencode\opencode.exe")
}

# One real, one-token request before a round, because a key out of credit otherwise cuts a
# run off partway and wastes what it had spent. The key is never printed.
function Test-ApiCredit {
    $Body = @{ model = $ModelId; max_tokens = 1; messages = @(@{ role = "user"; content = "ok" }) } | ConvertTo-Json -Depth 4
    $Headers = @{ "x-api-key" = $env:ANTHROPIC_API_KEY; "anthropic-version" = "2023-06-01" }
    try {
        Invoke-RestMethod -Method Post -Uri "https://api.anthropic.com/v1/messages" -Headers $Headers -ContentType "application/json" -Body $Body | Out-Null
    } catch {
        $Details = "$($_.ErrorDetails.Message)"
        $Message = try { ($Details | ConvertFrom-Json).error.message } catch { "$($_.Exception.Message)" }
        throw "The API refused a test request, so no run was started: $Message"
    }
}

# Which files something reads during a run. NTFS updates a last-access time that's more than
# an hour old on the first read, so setting them all to 2001 catches reads no log shows, such
# as a script's. It works without admin rights, on Windows' default setting. The agent's own
# steps are untouched, and git doesn't use this time.
function Set-FilesUnread {
    param([Parameter(Mandatory = $true)][string]$Path)
    $Long = [datetime]::SpecifyKind([datetime]"2001-01-01", [DateTimeKind]::Utc)
    Get-ChildItem -LiteralPath $Path -Recurse -File -Force | Where-Object { $_.FullName -notmatch "\\\.git\\" } |
        ForEach-Object { $_.LastAccessTimeUtc = $Long }
}

# After a run has moved to the log folder: the shared trace, then a copy of what the write-up
# needs in results\, which can be published. Raw logs stay in runs\, and the copy is skipped
# if a key's value is anywhere in it.
function Save-RunTrace {
    param(
        [Parameter(Mandatory = $true)][string]$RunId,
        [Parameter(Mandatory = $true)][string]$Condition
    )
    $LogDir = Get-RunLogDir $RunId
    & node (Join-Path $PSScriptRoot "trace-run.mjs") $LogDir $Condition
    if ($LASTEXITCODE) { throw "No trace for $RunId. Its raw logs are in $LogDir." }

    $Secrets = @(Get-ChildItem Env: | Where-Object { $_.Name -match "KEY|TOKEN|SECRET|PASSWORD" -and $_.Value.Length -ge 12 } | ForEach-Object { $_.Value })
    foreach ($Secret in $Secrets) {
        foreach ($File in @(Get-ChildItem -LiteralPath (Join-Path $LogDir "trace") -File)) {
            if (Select-String -LiteralPath $File.FullName -SimpleMatch $Secret -Quiet) {
                Write-Host "  A key's value is in $RunId's trace, so it wasn't copied to results\. Read it before sharing."
                return
            }
        }
    }
    $Copy = Join-Path $LabRoot "results\traces\$RunId"
    New-Item -ItemType Directory -Force -Path $Copy | Out-Null
    Copy-Item -Path (Join-Path $LogDir "trace\*") -Destination $Copy -Force
    foreach ($Name in "facts.json", "manifest.json", "final.diff", "files-before.json", "files-after.json", "files-home.json", "hidden-tests.txt", "visible-tests.txt") {
        $File = Join-Path $LogDir $Name
        if (Test-Path -LiteralPath $File) { Copy-Item -LiteralPath $File -Destination $Copy -Force }
    }
}

# One hash for a folder: every file's relative path and contents, in a fixed order.
function Get-TreeHash {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return "missing" }
    $Root = (Resolve-Path -LiteralPath $Path).Path
    $Lines = @(Get-ChildItem -LiteralPath $Root -Recurse -File -Force | Where-Object { $_.FullName -notmatch "\\node_modules\\" } |
        ForEach-Object { "{0}:{1}" -f $_.FullName.Substring($Root.Length).Replace("\", "/"), (Get-FileHash -LiteralPath $_.FullName).Hash } |
        Sort-Object -CaseSensitive)
    $Bytes = [Text.Encoding]::UTF8.GetBytes(($Lines -join "`n"))
    return ([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($Bytes)) -replace "-", "")
}

# What defines the experiment, and what it ran on.
function Get-LabState {
    $Python = Join-Path $LabRoot ".venv\Scripts\python.exe"
    $Tasks = [ordered]@{
        "task-a" = [ordered]@{ folder = Get-TreeHash (Join-Path $LabRoot "task-a") }
    }
    # A level joins the lock once its grader has been checked: grading.json marks that.
    foreach ($Level in @(Get-ChildItem -LiteralPath (Join-Path $LabRoot "levels") -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "grading.json") } | Sort-Object Name)) {
        $Tasks[$Level.Name] = [ordered]@{
            fixture = Get-TreeHash (Join-Path $Level.FullName "fixture")
            prompt = (Get-FileHash -LiteralPath (Join-Path $Level.FullName "prompt.txt")).Hash
            hidden = Get-TreeHash (Join-Path $Level.FullName "hidden")
            grading = (Get-FileHash -LiteralPath (Join-Path $Level.FullName "grading.json")).Hash
        }
    }
    return [ordered]@{
        model = $ModelId
        harness = [ordered]@{
            claude = [ordered]@{ version = Get-HarnessVersion "claude"; sha256 = (Get-FileHash -LiteralPath (Get-ClaudePath)).Hash }
            codex = [ordered]@{ version = Get-HarnessVersion "codex"; sha256 = (Get-FileHash -LiteralPath (Get-CodexPath)).Hash }
            opencode = [ordered]@{ version = Get-HarnessVersion "opencode"; sha256 = (Get-FileHash -LiteralPath (Get-OpenCodePath)).Hash }
            litellm = [ordered]@{
                version = (& $Python -c "from importlib.metadata import version; print(version('litellm'))").Trim()
                requirements = (Get-FileHash -LiteralPath (Join-Path $LabRoot "requirements.lock.txt")).Hash
            }
        }
        lab = [ordered]@{
            scripts = Get-TreeHash (Join-Path $PSScriptRoot "")
            litellm_config = Get-TreeHash (Join-Path $LabRoot "config")
            pins = (Get-FileHash -LiteralPath (Join-Path $LabRoot "pins\package-lock.json")).Hash
        }
        tasks = $Tasks
        host = [ordered]@{
            windows = [Environment]::OSVersion.Version.ToString()
            node = (& node --version).Trim()
            git = (& git --version).Trim()
            python = (& $Python --version).Trim()
        }
    }
}

# Saved with every run: exactly how the harness was started, and what lock it ran under.
# The prompt is in the task's own files, and no key is ever part of these arguments.
function Save-RunManifest {
    param(
        [Parameter(Mandatory = $true)][string]$RunId,
        [Parameter(Mandatory = $true)][string]$Executable,
        [string[]]$HarnessArgs = @(),
        [string]$Prompt = ""
    )
    $LogDir = Get-RunLogDir $RunId
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    $Shown = @($HarnessArgs | Where-Object { $_ -cne $Prompt })
    [pscustomobject]@{
        run_id = $RunId
        started = (Get-Date).ToUniversalTime().ToString("o")
        executable = Split-Path -Leaf $Executable
        arguments = $Shown
        locked = $(if (Test-Path -LiteralPath (Join-Path $LabRoot "lock.json")) { Get-Content -Raw -LiteralPath (Join-Path $LabRoot "lock.json") | ConvertFrom-Json } else { $null })
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $LogDir "manifest.json") -Encoding utf8
}

# Agents see their working folder, so the path must not say it's a test or name the harness.
function Get-RunKey {
    param([Parameter(Mandatory = $true)][string]$RunId)
    $Hash = [Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($RunId))
    return (($Hash[0..3] | ForEach-Object { $_.ToString("x2") }) -join "")
}

function Get-RunDir {
    param([Parameter(Mandatory = $true)][string]$RunId)
    return (Join-Path $RunRoot (Get-RunKey $RunId))
}

function Get-ProfileDir {
    param([Parameter(Mandatory = $true)][string]$RunId)
    return (Join-Path $ProfileRoot (Get-RunKey $RunId))
}

function Get-RunLogDir {
    param([Parameter(Mandatory = $true)][string]$RunId)
    return (Join-Path $TranscriptRoot $RunId)
}

function Save-Environment {
    $Saved = @{}
    Get-ChildItem Env: | ForEach-Object { $Saved[$_.Name] = $_.Value }
    return $Saved
}

function Restore-Environment {
    param([Parameter(Mandatory = $true)][hashtable]$Saved)
    @(Get-ChildItem Env:) | Where-Object { -not $Saved.ContainsKey($_.Name) } |
        ForEach-Object { [Environment]::SetEnvironmentVariable($_.Name, $null) }
    foreach ($Name in $Saved.Keys) { [Environment]::SetEnvironmentVariable($Name, $Saved[$Name]) }
}

# Keeps each harness away from his settings, hooks, skills, memory and other runs.
# It changes this session's environment, so callers restore it afterwards.
function Set-HarnessIsolation {
    param(
        [Parameter(Mandatory = $true)][string]$Harness,
        [Parameter(Mandatory = $true)][string]$RunId
    )

    # A terminal opened from inside a Claude Code session inherits its variables.
    @(Get-ChildItem Env:) | Where-Object { $_.Name -match "^(CLAUDECODE|CLAUDE_CODE_|CLAUDE_PID$|CLAUDE_EFFORT$|CLAUDE_AGENT_SDK)" } |
        ForEach-Object { [Environment]::SetEnvironmentVariable($_.Name, $null) }
    foreach ($Name in "ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN") {
        [Environment]::SetEnvironmentVariable($Name, $null)
    }
    # A VS Code terminal also hands out its git credentials this way.
    @(Get-ChildItem Env:) | Where-Object { $_.Name -match "^(VSCODE_|TERM_PROGRAM|GIT_ASKPASS$|SSH_ASKPASS$)" } |
        ForEach-Object { [Environment]::SetEnvironmentVariable($_.Name, $null) }

    # Secrets in his user environment would otherwise reach every agent. Each harness
    # keeps only the key it needs: Codex talks to the gateway, not to Anthropic.
    $Needed = if ($Harness -eq "codex") { "LITELLM_API_KEY" } else { "ANTHROPIC_API_KEY" }
    @(Get-ChildItem Env:) | Where-Object { $_.Name -match "KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL" -and $_.Name -ne $Needed } |
        ForEach-Object { [Environment]::SetEnvironmentVariable($_.Name, $null) }

    # ~ now means this run's empty folder: no ~/.claude, ~/.codex, ~/.agents, ~/.gitconfig, ~/.npmrc or ~/.ssh.
    $FakeHome = Get-ProfileDir $RunId
    $env:USERPROFILE = $FakeHome
    $env:HOME = $FakeHome
    $env:HOMEDRIVE = Split-Path -Qualifier $FakeHome
    $env:HOMEPATH = Split-Path -NoQualifier $FakeHome
    $env:APPDATA = Join-Path $FakeHome "AppData\Roaming"
    $env:LOCALAPPDATA = Join-Path $FakeHome "AppData\Local"
    $env:TEMP = Join-Path $FakeHome "Temp"
    $env:TMP = $env:TEMP
    New-Item -ItemType Directory -Force -Path $env:APPDATA, $env:LOCALAPPDATA, $env:TEMP | Out-Null
    # Git for Windows keeps his credential helper in its system config.
    $env:GIT_CONFIG_NOSYSTEM = "1"
    $env:GIT_TERMINAL_PROMPT = "0"

    switch ($Harness) {
        "claude" {
            $env:CLAUDE_CONFIG_DIR = Join-Path $FakeHome ".claude"
            $env:DISABLE_AUTOUPDATER = "1"
        }
        "opencode" {
            $env:XDG_DATA_HOME = Join-Path $FakeHome ".local\share"
            $env:XDG_CONFIG_HOME = Join-Path $FakeHome ".config"
            $env:XDG_CACHE_HOME = Join-Path $FakeHome ".cache"
            $env:XDG_STATE_HOME = Join-Path $FakeHome ".local\state"
            $env:OPENCODE_DB = Join-Path $FakeHome ".local\share\opencode.db"
            # Only names the model. The hardened opencode.jsonc is for Task B.
            $env:OPENCODE_CONFIG = Join-Path $FakeHome "opencode.jsonc"
            Copy-Item -LiteralPath (Join-Path $TaskARoot "opencode-defaults.jsonc") -Destination $env:OPENCODE_CONFIG
            $env:OPENCODE_DISABLE_AUTOUPDATE = "1"
            # OpenCode also reads Claude Code's instruction files and skills by default.
            $env:OPENCODE_DISABLE_CLAUDE_CODE = "1"
            $Git = Get-Command git -ErrorAction SilentlyContinue
            if ($Git) {
                $env:OPENCODE_GIT_BASH_PATH = Join-Path (Split-Path -Parent (Split-Path -Parent $Git.Source)) "bin\bash.exe"
            }
        }
        "codex" {
            $env:CODEX_HOME = Join-Path $FakeHome ".codex"
            New-Item -ItemType Directory -Force -Path $env:CODEX_HOME | Out-Null
        }
        default { throw "Unknown harness: $Harness" }
    }
}

# Something on Windows can hold a new folder open for a moment after a run. A plain rename
# either works or changes nothing, where Move-Item falls back to copying and leaves it half moved.
function Move-Folder {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Destination
    )
    for ($Try = 1; $Try -le 15; $Try++) {
        try {
            [IO.Directory]::Move($Path, $Destination)
            return
        } catch {
            if ($Try -eq 15) { throw }
            Start-Sleep -Seconds 2
        }
    }
}

# Finished runs leave the agents' reach, so the next run has nothing to find beside it.
function Move-RunToLog {
    param([Parameter(Mandatory = $true)][string]$RunId)
    $LogDir = Get-RunLogDir $RunId
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    Move-Folder -Path (Get-RunDir $RunId) -Destination (Join-Path $LogDir "run")
    if (Test-Path -LiteralPath (Get-ProfileDir $RunId)) {
        Move-Folder -Path (Get-ProfileDir $RunId) -Destination (Join-Path $LogDir "home")
    }
}

# Only one script may use the run folders at a time, because each sweeps leftovers on start.
function Enter-LabLock {
    $Marker = Join-Path $TranscriptRoot ".active"
    New-Item -ItemType Directory -Force -Path $TranscriptRoot | Out-Null
    if (Test-Path -LiteralPath $Marker) {
        $Holder = [int](Get-Content -Raw -LiteralPath $Marker)
        if ($Holder -ne $PID -and (Get-Process -Id $Holder -ErrorAction SilentlyContinue)) {
            throw "Another lab script is running (process $Holder). Wait for it to finish."
        }
    }
    Set-Content -LiteralPath $Marker -Value $PID -NoNewline
}

function Exit-LabLock {
    Remove-Item -LiteralPath (Join-Path $TranscriptRoot ".active") -ErrorAction SilentlyContinue
}

# An interrupted run leaves its folders behind, where the next agent could find them.
function Move-StrayRuns {
    $Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    foreach ($Root in $RunRoot, $ProfileRoot) {
        if (-not (Test-Path -LiteralPath $Root)) { continue }
        foreach ($Stray in @(Get-ChildItem -LiteralPath $Root -Force)) {
            $Destination = Join-Path $TranscriptRoot "interrupted\$Stamp\$(Split-Path -Leaf $Root)"
            New-Item -ItemType Directory -Force -Path $Destination | Out-Null
            Move-Folder -Path $Stray.FullName -Destination (Join-Path $Destination $Stray.Name)
            Write-Host "Moved an interrupted run to $Destination"
        }
    }
}

function Get-CodexProviderArgs {
    param([int]$Port = 4000)
    return @(
        "-c", 'model_provider=litellm',
        "-c", 'model_providers.litellm.name=LiteLLM',
        "-c", "model_providers.litellm.base_url=http://127.0.0.1:$Port/v1",
        "-c", 'model_providers.litellm.env_key=LITELLM_API_KEY',
        "-c", 'model_providers.litellm.wire_api=responses',
        "-c", 'model_providers.litellm.stream_idle_timeout_ms=7200000',
        "-c", 'model_providers.litellm.stream_max_retries=5',
        "-c", 'model_providers.litellm.request_max_retries=4'
    )
}

function Get-HarnessVersion {
    param([Parameter(Mandatory = $true)][string]$Harness)
    switch ($Harness) {
        "claude" { return ((& (Get-ClaudePath) --version) | Select-Object -First 1) }
        "opencode" { return ((& (Join-Path $LabRoot "tools\opencode\opencode.exe") --version) | Select-Object -First 1) }
        "codex" { return ((& (Get-CodexPath) --version) | Select-Object -First 1) }
    }
}

function Test-GatewayUp {
    param([int]$Port = 4000)
    $Client = New-Object System.Net.Sockets.TcpClient
    try {
        $Client.Connect("127.0.0.1", $Port)
        return $true
    } catch {
        return $false
    } finally {
        $Client.Close()
    }
}

# Starts LiteLLM for the Codex route if it isn't already listening, and returns the
# process so the caller can stop what it started.
function Start-Gateway {
    param(
        [int]$Port = 4000,
        [string]$Config = "litellm.yaml"
    )
    if (-not $env:ANTHROPIC_API_KEY) { throw "Set ANTHROPIC_API_KEY in this terminal first." }
    if (-not $env:LITELLM_API_KEY) { $env:LITELLM_API_KEY = "sk-local-lab-" + [guid]::NewGuid().ToString("N") }
    if (Test-GatewayUp -Port $Port) {
        throw "Something is already listening on port $Port. Close it first, so the gateway uses this terminal's keys."
    }
    New-Item -ItemType Directory -Force -Path $TranscriptRoot | Out-Null
    $Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $ErrorLog = Join-Path $TranscriptRoot "litellm-$Stamp.err.log"
    # LiteLLM prints a Unicode banner, which crashes its startup when the output goes to
    # a file under Windows' default cp1252 encoding.
    $env:PYTHONUTF8 = "1"
    $env:PYTHONIOENCODING = "utf-8"
    $Process = Start-Process -FilePath (Join-Path $LabRoot ".venv\Scripts\litellm.exe") `
        -ArgumentList "--config", "`"$(Join-Path $LabRoot "config\$Config")`"", "--host", "127.0.0.1", "--port", "$Port" `
        -RedirectStandardOutput (Join-Path $TranscriptRoot "litellm-$Stamp.out.log") `
        -RedirectStandardError $ErrorLog `
        -WindowStyle Hidden -PassThru
    $Handle = $Process.Handle
    for ($Second = 0; $Second -lt 60; $Second++) {
        if (Test-GatewayUp -Port $Port) { return $Process }
        if ($Process.HasExited) {
            throw "LiteLLM stopped during startup. See $ErrorLog."
        }
        Start-Sleep -Seconds 1
    }
    Stop-Gateway -Process $Process
    throw "LiteLLM didn't start within 60 seconds. See $ErrorLog."
}

function Stop-Gateway {
    param($Process)
    if ($Process -and -not $Process.HasExited) {
        & taskkill /PID $Process.Id /T /F | Out-Null
    }
}
