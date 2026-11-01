[CmdletBinding()]
param(
    # The same source given to new-task-workspace.ps1.
    [Parameter(Mandatory = $true)][string]$Source,
    # The fix commit whose version of the test files is the grader.
    [Parameter(Mandatory = $true)][string]$FixCommit,
    # The agent's workspace, after the run.
    [Parameter(Mandatory = $true)][string]$Workspace,
    # Test files to copy from the fix commit, relative to the repository root.
    [Parameter(Mandatory = $true)][string[]]$Paths
)

# Copies the held-back test files from the fix commit into a finished
# workspace. The workspace has no fix commit in its history (see
# new-task-workspace.ps1), so "git checkout <fix> -- <test>" inside it can't work.

$ErrorActionPreference = "Stop"

function Invoke-Git {
    & git @args
    if ($LASTEXITCODE -ne 0) {
        throw "git $($args -join ' ') failed with exit code $LASTEXITCODE."
    }
}

$Workspace = (Resolve-Path -LiteralPath $Workspace).Path
$Temp = Join-Path $env:TEMP ("task-grader-" + [guid]::NewGuid().ToString("N"))
$Clone = Join-Path $Temp "source"

try {
    Invoke-Git clone --quiet --no-checkout $Source $Clone
    Invoke-Git -C $Clone "--work-tree=$Workspace" checkout $FixCommit -- @Paths
} finally {
    if (Test-Path $Temp) {
        Remove-Item -LiteralPath $Temp -Recurse -Force
    }
}

Write-Host "Grader files copied into $Workspace from $FixCommit"
