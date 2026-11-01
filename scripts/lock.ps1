[CmdletBinding()]
param(
    # Records the current state as lock.json. Only do this on purpose, and say why in protocol.md.
    [switch]$Write,
    # Reports differences without failing, for someone reproducing with what they could get.
    [switch]$AllowDrift
)

# Checks that this machine is about to run the experiment that lock.json describes: the
# same harness builds, fixtures, prompts, graders and scripts. The model can't be locked:
# Anthropic's API gives no dated build of it, and its answers vary between runs, so a rerun
# reproduces the setup, not the result.

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib-task-a.ps1")

$LockFile = Join-Path $LabRoot "lock.json"
$State = Get-LabState

if ($Write) {
    $State | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $LockFile -Encoding ascii
    Write-Host "Wrote $LockFile"
    return
}

if (-not (Test-Path -LiteralPath $LockFile)) { throw "No lock.json. Run .\scripts\lock.ps1 -Write first." }
$Locked = Get-Content -Raw -LiteralPath $LockFile | ConvertFrom-Json

function Get-Flat {
    param($Node, [string]$Prefix = "")
    foreach ($Property in $Node.PSObject.Properties) {
        if ($Property.Value -is [pscustomobject]) {
            Get-Flat -Node $Property.Value -Prefix "$Prefix$($Property.Name)."
        } else {
            [pscustomobject]@{ Name = "$Prefix$($Property.Name)"; Value = "$($Property.Value)" }
        }
    }
}

$Now = @{}
Get-Flat ($State | ConvertTo-Json -Depth 6 | ConvertFrom-Json) | ForEach-Object { $Now[$_.Name] = $_.Value }
$Failures = 0
foreach ($Entry in Get-Flat $Locked) {
    $Current = $Now[$Entry.Name]
    if ($Current -ceq $Entry.Value) { continue }
    # A different host is worth saying out loud, but it doesn't change the experiment's definition.
    if ($Entry.Name -like "host.*") {
        Write-Host "note: $($Entry.Name) is '$Current'; the locked run used '$($Entry.Value)'."
    } else {
        Write-Host "DIFFERENT: $($Entry.Name) is '$Current'; lock.json says '$($Entry.Value)'."
        $Failures++
    }
}

if ($Failures -and -not $AllowDrift) {
    throw "$Failures locked item(s) differ, so this wouldn't be the same experiment. Fix them, or pass -AllowDrift and report the differences."
}
if ($Failures) { Write-Host "Continuing with $Failures difference(s). Report them with your results." } else { Write-Host "Matches lock.json." }
