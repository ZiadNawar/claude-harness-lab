[CmdletBinding()]
param(
    # A local clone or a clone URL. It is copied to a temporary folder first, so
    # a local clone's index and working tree are never touched.
    [Parameter(Mandatory = $true)][string]$Source,
    # The commit the agent starts from (the fix's parent).
    [Parameter(Mandatory = $true)][string]$Commit,
    # A new or empty folder for the agent's workspace.
    [Parameter(Mandatory = $true)][string]$Destination
)

# Builds a Task B workspace whose git history holds exactly one commit: the tree
# at $Commit. A plain "git clone; git checkout <parent>" keeps the fix commit
# reachable (git log --all, git show <fix>), so an agent could read the answer.
# Hodoscope's paper (arXiv 2604.11072) found that leak inflating Commit0 scores.

$ErrorActionPreference = "Stop"

function Invoke-Git {
    & git @args
    if ($LASTEXITCODE -ne 0) {
        throw "git $($args -join ' ') failed with exit code $LASTEXITCODE."
    }
}

if ((Test-Path $Destination) -and (Get-ChildItem -Force -LiteralPath $Destination | Select-Object -First 1)) {
    throw "Destination is not empty: $Destination"
}

$Temp = Join-Path $env:TEMP ("task-workspace-" + [guid]::NewGuid().ToString("N"))
$Clone = Join-Path $Temp "source"

try {
    Write-Host "Copying the source repository to a temporary folder..."
    Invoke-Git clone --quiet --no-checkout $Source $Clone

    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    $Destination = (Resolve-Path -LiteralPath $Destination).Path

    # Write the tree at $Commit into the workspace. Unlike git archive, this
    # keeps files marked export-ignore, so the existing test suite stays whole.
    Invoke-Git -C $Clone "--work-tree=$Destination" checkout $Commit -- .
    $SourceTree = (& git -C $Clone rev-parse "$Commit^{tree}").Trim()

    Invoke-Git -C $Destination init --quiet
    Invoke-Git -C $Destination add --all
    Invoke-Git -C $Destination -c user.name=harness-lab -c user.email=harness-lab@localhost commit --quiet -m "Task base"

    $CommitCount = (& git -C $Destination rev-list --all --count).Trim()
    if ($CommitCount -ne "1") {
        throw "Expected 1 commit in the workspace, found $CommitCount."
    }

    $WorkspaceTree = (& git -C $Destination rev-parse "HEAD^{tree}").Trim()
    if ($WorkspaceTree -ne $SourceTree) {
        Write-Warning "The workspace tree differs from $Commit (often line endings). Check git diff before the run."
    }
} finally {
    if (Test-Path $Temp) {
        Remove-Item -LiteralPath $Temp -Recurse -Force
    }
}

Write-Host "Workspace ready: $Destination (1 commit, no remote, no later history)."
