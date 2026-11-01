[CmdletBinding()]
param()

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Result = Join-Path $ProjectRoot "smoke-workspace\result.txt"

if (Test-Path $Result) {
    Remove-Item -LiteralPath $Result
    Write-Host "Removed smoke-workspace\result.txt."
} else {
    Write-Host "Smoke workspace is already clean."
}

