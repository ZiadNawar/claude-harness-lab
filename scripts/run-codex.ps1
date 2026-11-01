[CmdletBinding()]
param(
    [switch]$Smoke,
    [int]$Port = 4000
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Workspace = Join-Path $ProjectRoot "smoke-workspace"
$PromptFile = Join-Path $ProjectRoot "smoke-prompt.txt"
$BaseUrl = "http://127.0.0.1:$Port/v1"

. (Join-Path $PSScriptRoot "lib-task-a.ps1")
$Codex = Get-CodexPath
if (-not $Codex) {
    throw "Codex was not found, on PATH or in the VS Code extension."
}
if (-not $env:LITELLM_API_KEY) {
    throw "Set LITELLM_API_KEY to the same value used by the LiteLLM terminal."
}

$ConfigArgs = @(
    '-c', 'model_provider="litellm"',
    '-c', 'model_providers.litellm.name="LiteLLM local"',
    '-c', "model_providers.litellm.base_url=`"$BaseUrl`"",
    '-c', 'model_providers.litellm.env_key="LITELLM_API_KEY"',
    '-c', 'model_providers.litellm.wire_api="responses"',
    '-c', 'model_providers.litellm.stream_idle_timeout_ms=7200000',
    '-c', 'model_providers.litellm.stream_max_retries=5',
    '-c', 'model_providers.litellm.request_max_retries=4',
    '-c', 'approval_policy="on-request"'
)

if ($Smoke) {
    $Prompt = (Get-Content -Raw $PromptFile).Trim()
    & $Codex exec --ignore-user-config --ephemeral --model "claude-sonnet-5-5" --cd $Workspace --sandbox workspace-write -c windows.sandbox=unelevated @ConfigArgs $Prompt
} else {
    & $Codex --no-daemon --model "claude-sonnet-5-5" --cd $Workspace --sandbox workspace-write --ask-for-approval on-request @ConfigArgs
}

