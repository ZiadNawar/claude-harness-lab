[CmdletBinding()]
param([int]$Port = 4010)

# Which commands does Codex let run, under which settings? A scripted fake model asks
# for each command in turn, in a fresh Task A workspace. No key, no model, no cost.
# Each row reads three things: what Codex answered, the applied policy, and the disk.

$ErrorActionPreference = "Stop"
. (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\lib-task-a.ps1")

$Codex = Get-CodexPath
$Out = Join-Path $PSScriptRoot "results"
New-Item -ItemType Directory -Force -Path $Out, $RunRoot, $ProfileRoot | Out-Null
Enter-LabLock
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Log = Join-Path $Out "requests-$Stamp.jsonl"
$Csv = Join-Path $Out "probe-$Stamp.csv"

$Policies = @(
    @{ Name = "no flags (Task A default)"; Args = @() },
    @{ Name = "--sandbox workspace-write"; Args = @("--sandbox", "workspace-write") },
    @{ Name = "workspace-write + unelevated"; Args = @("--sandbox", "workspace-write", "-c", "windows.sandbox=unelevated") },
    @{ Name = "read-only + unelevated"; Args = @("--sandbox", "read-only", "-c", "windows.sandbox=unelevated") },
    @{ Name = "workspace-write + unelevated + network"; Args = @("--sandbox", "workspace-write", "-c", "windows.sandbox=unelevated", "-c", "sandbox_workspace_write.network_access=true") }
)
# marker: a file the command should create if it truly ran, checked on disk afterwards.
$Commands = @(
    @{ Name = "list files"; Cmd = "cmd.exe /c dir" },
    @{ Name = "read a file"; Cmd = "Get-Content README.md" },
    @{ Name = "git status"; Cmd = "git status --short" },
    @{ Name = "node version"; Cmd = "node --version" },
    @{ Name = "npm test"; Cmd = "npm test" },
    @{ Name = "npm install"; Cmd = "npm install decimal.js"; Marker = "node_modules\decimal.js\package.json" },
    @{ Name = "npm install, cache in workspace"; Cmd = "npm install decimal.js --cache .npm-cache"; Marker = "node_modules\decimal.js\package.json" },
    @{ Name = "write in workspace"; Cmd = "Set-Content probe-write.txt ok"; Marker = "probe-write.txt" },
    @{ Name = "write outside workspace"; Cmd = "Set-Content ..\shared\probe-outside.txt ok"; Marker = "..\shared\probe-outside.txt" },
    @{ Name = "read .env"; Cmd = "Get-Content .env" },
    @{ Name = "read outside workspace"; Cmd = "Get-Content ..\shared\rounding-policy.md" }
)

$env:FAKE_MODEL_KEY = "sk-probe-not-a-real-key"
$Baseline = Save-Environment
$Node = (Get-Command node).Source
$Server = Start-Process -FilePath $Node -ArgumentList "`"$(Join-Path $PSScriptRoot 'fake-model.mjs')`"", $Port, "`"$Log`"" -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 1
$Provider = @(
    "-c", 'model_provider=probe', "-c", 'model_providers.probe.name=probe',
    "-c", "model_providers.probe.base_url=http://127.0.0.1:$Port/v1",
    "-c", 'model_providers.probe.env_key=FAKE_MODEL_KEY',
    "-c", 'model_providers.probe.wire_api=responses',
    "-c", 'model_providers.probe.stream_max_retries=0', "-c", 'model_providers.probe.request_max_retries=0'
)

$Rows = @()
try {
    foreach ($Policy in $Policies) {
        foreach ($Command in $Commands) {
            $RunId = "probe-$Stamp-$($Rows.Count)"
            $Workspace = (& (Join-Path $LabRoot "scripts\new-task-a-run.ps1") -RunId $RunId) | Select-Object -Last 1
            $Before = (Get-Content -LiteralPath $Log -ErrorAction SilentlyContinue | Measure-Object).Count

            Set-HarnessIsolation -Harness codex -RunId $RunId
            $env:FAKE_MODEL_KEY = $Baseline["FAKE_MODEL_KEY"]
            Push-Location $Workspace
            $Prompt = "RUN<<<$($Command.Cmd)>>>"
            $Previous = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            & $Codex exec --ignore-user-config --ephemeral --json --model probe --cd $Workspace @Provider @($Policy.Args) $Prompt 2>$null | Out-Null
            $CodexExit = $LASTEXITCODE
            $ErrorActionPreference = $Previous
            Pop-Location
            Restore-Environment $Baseline

            $Entries = @(Get-Content -LiteralPath $Log -ErrorAction SilentlyContinue | Select-Object -Skip $Before | ForEach-Object { $_ | ConvertFrom-Json })
            $Asked = $Entries | Where-Object { $_.PSObject.Properties.Name -contains "sandbox" } | Select-Object -First 1
            $Answer = $Entries | Where-Object { $_.PSObject.Properties.Name -contains "output" } | Select-Object -Last 1
            $Text = "$($Answer.output)"
            # The exit line comes first: a command's own output can contain the word "rejected".
            $Verdict = if (-not $Answer) { "no answer" } elseif ($Text -match "Process exited with code (-?\d+)") { "ran, exit $($Matches[1])" } elseif ($Text -match "rejected: blocked by policy") { "refused by Codex" } elseif ($Text -match "Rejected") { "refused (other)" } else { "see text" }
            $MarkerOnDisk = if ($Command.Marker) { Test-Path -LiteralPath (Join-Path $Workspace $Command.Marker) } else { "" }

            $Rows += [pscustomobject]@{
                policy = $Policy.Name
                applied_sandbox = $Asked.sandbox
                applied_approval = $Asked.approval
                applied_network = $Asked.network
                command = $Command.Name
                verdict = $Verdict
                codex_exit = $CodexExit
                effect_on_disk = $MarkerOnDisk
                output = ($Text -replace '\s+', ' ').Substring(0, [math]::Min(700, ($Text -replace '\s+', ' ').Length))
            }
            Write-Host ("{0,-30} {1,-16} {2,-25} {3,-18} {4}" -f $Policy.Name, "$($Asked.sandbox)/$($Asked.approval)", $Command.Name, $Verdict, $MarkerOnDisk)
            Remove-Item -LiteralPath (Get-RunDir $RunId), (Get-ProfileDir $RunId) -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
} finally {
    Stop-Process -Id $Server.Id -Force -ErrorAction SilentlyContinue
    Restore-Environment $Baseline
    Remove-Item Env:FAKE_MODEL_KEY -ErrorAction SilentlyContinue
    Exit-LabLock
}
$Rows | Export-Csv -LiteralPath $Csv -NoTypeInformation -Encoding utf8
Write-Host "Saved $Csv"
