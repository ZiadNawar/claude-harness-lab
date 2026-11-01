[CmdletBinding()]
param(
    [int]$Port = 4000
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LiteLLM = Join-Path $ProjectRoot ".venv\Scripts\litellm.exe"
$Config = Join-Path $ProjectRoot "config\litellm.yaml"

if (-not (Test-Path $LiteLLM)) {
    throw "LiteLLM is not installed. Run .\scripts\setup.ps1 first."
}
if (-not $env:ANTHROPIC_API_KEY) {
    throw "Set ANTHROPIC_API_KEY in this terminal first."
}
if (-not $env:LITELLM_API_KEY) {
    throw "Set LITELLM_API_KEY to a local gateway password first."
}

Write-Host "Starting LiteLLM on http://127.0.0.1:$Port"

# LiteLLM's CLI maps the generic DEBUG environment variable to its --debug
# boolean option. Some development shells set DEBUG=release, which is not a
# valid boolean, so hide that unrelated value only while the gateway runs.
$PreviousDebugValue = $env:DEBUG
Remove-Item Env:DEBUG -ErrorAction SilentlyContinue
try {
    & $LiteLLM --config $Config --host 127.0.0.1 --port $Port
} finally {
    if ($null -ne $PreviousDebugValue) {
        $env:DEBUG = $PreviousDebugValue
    }
}

