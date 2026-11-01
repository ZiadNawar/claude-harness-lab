[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$OpenCodeDir = Join-Path $ProjectRoot "tools\opencode"
$OpenCodeZip = Join-Path $env:TEMP "opencode-windows-x64.zip"
# OpenCode's download only offers the latest build; versioned URLs returned 404 (30 Oct).
# lock.ps1 compares the result with lock.json, so a newer build is reported, not hidden.
$OpenCodeUrl = "https://opencode.ai/update/api/latest/cli/opencode/opencode-windows-x64.zip"
$VenvDir = Join-Path $ProjectRoot ".venv"

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw "uv is required but was not found on PATH."
}

if (-not (Test-Path (Join-Path $OpenCodeDir "opencode.exe"))) {
    New-Item -ItemType Directory -Force -Path $OpenCodeDir | Out-Null
    Write-Host "Downloading the official OpenCode V2 Windows x64 binary..."
    Invoke-WebRequest -Uri $OpenCodeUrl -OutFile $OpenCodeZip
    Expand-Archive -LiteralPath $OpenCodeZip -DestinationPath $OpenCodeDir -Force
    Remove-Item -LiteralPath $OpenCodeZip -Force
} else {
    Write-Host "OpenCode is already present."
}

# uv and npm report progress on stderr, which isn't an error; their exit codes decide.
$ErrorActionPreference = "Continue"

if (-not (Test-Path $VenvDir)) {
    Write-Host "Creating the project-local Python environment..."
    & uv venv --python 3.14.0 $VenvDir
    if ($LASTEXITCODE -ne 0) { throw "Creating the Python environment failed." }
}

$Python = Join-Path $VenvDir "Scripts\python.exe"
# Pinned with hashes: PyPI releases 1.82.7 and 1.82.8 carried credential-stealing malware
# (GHSA-5mg7-485q-xm76). Re-check the advisories before changing this version.
Write-Host "Installing LiteLLM and its dependencies from requirements.lock.txt..."
& uv pip install --python $Python --require-hashes --no-deps -r (Join-Path $ProjectRoot "requirements.lock.txt")
if ($LASTEXITCODE -ne 0) { throw "The pinned Python install failed." }

Write-Host "Installing the pinned Claude Code and Codex builds..."
& cmd.exe /c "npm ci --prefix `"$(Join-Path $ProjectRoot 'pins')`" --no-audit --no-fund"
if ($LASTEXITCODE -ne 0) { throw "The pinned npm install failed." }

Write-Host "Setup complete. Run .\scripts\lock.ps1 next."

