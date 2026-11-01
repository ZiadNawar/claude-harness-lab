[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$OpenCode = Join-Path $ProjectRoot "tools\opencode\opencode.exe"
$LiteLLM = Join-Path $ProjectRoot ".venv\Scripts\litellm.exe"
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
. (Join-Path $PSScriptRoot "lib-task-a.ps1")
$Codex = Get-CodexPath
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

$Checks = @(
    [pscustomobject]@{ Name = "Claude Code"; Path = (Get-ClaudePath) },
    [pscustomobject]@{ Name = "Codex"; Path = $Codex },
    [pscustomobject]@{ Name = "OpenCode"; Path = $(if (Test-Path $OpenCode) { $OpenCode } else { $null }) },
    [pscustomobject]@{ Name = "LiteLLM"; Path = $(if (Test-Path $LiteLLM) { $LiteLLM } else { $null }) },
    [pscustomobject]@{ Name = "Git Bash"; Path = $(if ($GitBash -and (Test-Path $GitBash)) { $GitBash } else { $null }) }
)

$Checks | Format-Table -AutoSize

$Missing = $Checks | Where-Object { -not $_.Path }
if ($Missing) {
    throw "Missing prerequisites: $($Missing.Name -join ', '). Run .\scripts\setup.ps1."
}

Write-Host ""
Write-Host "Versions:"
& (Get-ClaudePath) --version
& $Codex --version
& $OpenCode --version
& $Python -c "from importlib.metadata import version; print('LiteLLM ' + version('litellm'))"

Write-Host ""
Write-Host "Credential status (values are never printed):"
Write-Host "ANTHROPIC_API_KEY: $([bool]$env:ANTHROPIC_API_KEY)"
Write-Host "LITELLM_API_KEY:  $([bool]$env:LITELLM_API_KEY)"

