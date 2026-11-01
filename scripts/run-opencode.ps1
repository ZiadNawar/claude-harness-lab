[CmdletBinding()]
param(
    [switch]$Smoke
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$OpenCode = Join-Path $ProjectRoot "tools\opencode\opencode.exe"
$Workspace = Join-Path $ProjectRoot "smoke-workspace"
$PromptFile = Join-Path $ProjectRoot "smoke-prompt.txt"
$GitCommand = Get-Command git -ErrorAction SilentlyContinue
$GitBash = if ($GitCommand) {
    $GitRoot = Split-Path -Parent (Split-Path -Parent $GitCommand.Source)
    Join-Path $GitRoot "bin\bash.exe"
} else {
    $null
}

# Keep OpenCode's database, logs, cache, and configuration inside this lab.
$env:XDG_DATA_HOME = Join-Path $ProjectRoot ".opencode\data"
$env:XDG_CONFIG_HOME = Join-Path $ProjectRoot ".opencode\config"
$env:XDG_CACHE_HOME = Join-Path $ProjectRoot ".opencode\cache"
$env:XDG_STATE_HOME = Join-Path $ProjectRoot ".opencode\state"
$env:OPENCODE_DB = Join-Path $ProjectRoot ".opencode\data\opencode.db"
$env:OPENCODE_CONFIG = Join-Path $ProjectRoot "opencode.jsonc"
$env:OPENCODE_DISABLE_AUTOUPDATE = "1"
if ($GitBash -and (Test-Path $GitBash)) {
    $env:OPENCODE_GIT_BASH_PATH = $GitBash
}

if (-not (Test-Path $OpenCode)) {
    throw "OpenCode is not installed. Run .\scripts\setup.ps1 first."
}
if (-not $env:ANTHROPIC_API_KEY) {
    throw "Set ANTHROPIC_API_KEY in this terminal first."
}
if (-not $GitBash -or -not (Test-Path $GitBash)) {
    throw "Git Bash is required by OpenCode on Windows but was not found."
}

Push-Location $Workspace
try {
    if ($Smoke) {
        $Prompt = (Get-Content -Raw $PromptFile).Trim()
        & $OpenCode run --standalone --model "anthropic/claude-sonnet-5-5" $Prompt
    } else {
        & $OpenCode --standalone
    }
} finally {
    Pop-Location
}

