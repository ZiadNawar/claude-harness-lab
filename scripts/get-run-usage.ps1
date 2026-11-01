[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$LogDir,
    # claude, opencode, codex or codex-configured.
    [Parameter(Mandatory = $true)][string]$Condition
)

# Tokens and cost for one run, as each harness logged them. Codex logs no cost, so its
# figure is an estimate at rates worked out from OpenCode's logged costs for this model:
# about $2 per million input, $2.50 cache writes, $0.10 cached and $10 output. Check it
# against the console.

$Usage = [ordered]@{ Input = ""; Cached = ""; CacheWrite = ""; Output = ""; Cost = 0; Source = "none" }
$Transcript = Join-Path $LogDir "transcript.jsonl"

function Read-Events {
    param([string]$Path)
    foreach ($Line in Get-Content -LiteralPath $Path -Encoding utf8 -ErrorAction SilentlyContinue) {
        try { $Line | ConvertFrom-Json } catch { }
    }
}

if ($Condition -eq "claude") {
    $Result = @(Read-Events $Transcript | Where-Object { $_.type -eq "result" }) | Select-Object -Last 1
    if ($Result) {
        # A run that wakes itself up ends with several results. Each one's usage covers only
        # its own stretch; its cost and modelUsage are totals for the whole run.
        $Models = @($Result.modelUsage.PSObject.Properties | ForEach-Object { $_.Value })
        $Usage.Input = ($Models | ForEach-Object { $_.inputTokens } | Measure-Object -Sum).Sum
        $Usage.Cached = ($Models | ForEach-Object { $_.cacheReadInputTokens } | Measure-Object -Sum).Sum
        $Usage.CacheWrite = ($Models | ForEach-Object { $_.cacheCreationInputTokens } | Measure-Object -Sum).Sum
        $Usage.Output = ($Models | ForEach-Object { $_.outputTokens } | Measure-Object -Sum).Sum
        $Usage.Cost = [double]$Result.total_cost_usd
        $Usage.Source = "logged"
    }
} elseif ($Condition -eq "opencode") {
    $Export = Get-ChildItem -LiteralPath $LogDir -File -Filter "session-*.json" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($Export) {
        $Info = (Get-Content -Raw -LiteralPath $Export.FullName -Encoding utf8 | ConvertFrom-Json).info
        $Usage.Input = $Info.tokens.input
        $Usage.Cached = $Info.tokens.cache.read
        $Usage.CacheWrite = $Info.tokens.cache.write
        $Usage.Output = $Info.tokens.output
        $Usage.Cost = [double]$Info.cost
        $Usage.Source = "logged"
    }
} else {
    $Turns = @(Read-Events $Transcript | Where-Object { $_.type -eq "turn.completed" })
    if ($Turns.Count) {
        $TokensIn = ($Turns | ForEach-Object { $_.usage.input_tokens } | Measure-Object -Sum).Sum
        $Cached = ($Turns | ForEach-Object { $_.usage.cached_input_tokens } | Measure-Object -Sum).Sum
        $Written = ($Turns | ForEach-Object { $_.usage.cache_write_input_tokens } | Measure-Object -Sum).Sum
        $Output = ($Turns | ForEach-Object { $_.usage.output_tokens } | Measure-Object -Sum).Sum
        $Usage.Input = $TokensIn
        $Usage.Cached = $Cached
        $Usage.CacheWrite = $Written
        $Usage.Output = $Output
        # Codex's input count includes the cached and cache-written tokens.
        $Usage.Cost = [math]::Round((($TokensIn - $Cached - $Written) * 2 + $Written * 2.5 + $Cached * 0.1 + $Output * 10) / 1000000, 4)
        $Usage.Source = "estimate"
    }
}

[pscustomobject]$Usage
