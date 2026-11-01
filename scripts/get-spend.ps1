[CmdletBinding()]
param()

# Total spend so far, in dollars, across every run folder. It's a guard, not an invoice:
# Codex's part is an estimate, and a run that was killed may have logged nothing.

$LogRoot = Join-Path (Split-Path -Parent $PSScriptRoot) "runs\task-a"
$Total = 0.0
foreach ($Run in Get-ChildItem -LiteralPath $LogRoot -Directory -ErrorAction SilentlyContinue) {
    $Condition = switch -Regex ($Run.Name) {
        "-claude(-|$)" { "claude"; break }
        "-opencode(-|$)" { "opencode"; break }
        "-codex(-|$)" { "codex"; break }
        "-codex-configured(-|$)" { "codex"; break }
        default { "" }
    }
    if (-not $Condition) { continue }
    if ($Condition -eq "opencode" -and -not (Get-ChildItem -LiteralPath $Run.FullName -File -Filter "session-*.json" -ErrorAction SilentlyContinue)) {
        # Task A's unattended OpenCode runs logged steps, not a session export.
        foreach ($Line in Get-Content -LiteralPath (Join-Path $Run.FullName "transcript.jsonl") -Encoding utf8 -ErrorAction SilentlyContinue) {
            try {
                $Step = $Line | ConvertFrom-Json
                if ($Step.type -eq "step_finish") { $Total += [double]$Step.part.cost }
            } catch { }
        }
        continue
    }
    $Usage = & (Join-Path $PSScriptRoot "get-run-usage.ps1") -LogDir $Run.FullName -Condition $Condition
    $Total += [double]$Usage.Cost
}
return $Total
