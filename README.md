# Claude Harness Lab

To rebuild and rerun the experiment, see [REPRODUCE.md](REPRODUCE.md).

This project runs the same Claude model on the same local tasks through three harnesses, on native Windows 11:

1. **Claude Code -> Anthropic**
2. **OpenCode -> Anthropic** (native Anthropic provider)
3. **Codex -> LiteLLM -> Anthropic** (Responses API translated to Anthropic)

The third route is deliberately labelled `Codex + LiteLLM + Claude`. LiteLLM is part of that experimental condition, so results from it should not be presented as a native Codex-to-Anthropic integration.

## Results and status

- Every run's trace is in `results/traces/`, and each level's runs are side by side in `results/level-<n>-comparison.md`. `protocol.md` has the rules and when each was set.
- Each condition ran only a few times, and the model's answers vary between runs, so the results describe what happened and don't rank the harnesses.
- Claude Code started all of these runs and the Codex policy probe at my request, on my machine, with my key.
- Known issue: the generated tables overcount blocked steps (the tracer counts the word EPERM in output as a block) and record Codex's 10-second yields as passing test runs. Hand-checked Level 3 blocks: Claude Code 11 and 13, OpenCode 0 and 0. A tracer fix is in progress.
- Not done: the three interactive Task A runs, Task B and Level 4. Level 4 and Task B use private code, which isn't in this repo.

## What is installed locally

- `tools/opencode/opencode.exe`: project-local OpenCode binary
- `.venv/`: project-local Python environment containing LiteLLM
- `pins/node_modules/`: the pinned Claude Code and Codex builds. If they're missing, the scripts fall back to a copy on the machine, and `lock.ps1` reports the difference.

All three generated locations are ignored by Git. No API keys are written to disk by these scripts; the one optional token, for the Opus run in REPRODUCE.md, goes in an ignored `.env` you create yourself.
OpenCode's database, logs, cache, and configuration are redirected into the ignored `.opencode/` directory as well.

Versions are pinned in [lock.json](lock.json): Claude Code `2.1.310`, Codex CLI `0.162.0-alpha.17.2`, OpenCode `2.1.1`, and LiteLLM `1.106.1`.

## One-time setup

From PowerShell in this directory:

```powershell
.\scripts\setup.ps1
.\scripts\check-prereqs.ps1
```

`setup.ps1` downloads OpenCode and installs LiteLLM, Claude Code and Codex at their pinned versions, but does not make a model request.

## Add credentials for the current terminal

Create an Anthropic API key in the Anthropic Console, then export it only in the terminal where you will run the test:

```powershell
$env:ANTHROPIC_API_KEY = "your-key"
$env:LITELLM_API_KEY = "sk-local-lab-key"
```

`LITELLM_API_KEY` is a local gateway password that you choose. It is not an Anthropic key.

## Test OpenCode directly

Interactive:

```powershell
.\scripts\run-opencode.ps1
```

Automated smoke test:

```powershell
.\scripts\run-opencode.ps1 -Smoke
```

## Test Claude through Codex

Start the gateway in terminal 1:

```powershell
$env:ANTHROPIC_API_KEY = "your-key"
$env:LITELLM_API_KEY = "sk-local-lab-key"
.\scripts\start-litellm.ps1
```

Then, in terminal 2, export the same local gateway key and run Codex:

```powershell
$env:LITELLM_API_KEY = "sk-local-lab-key"
.\scripts\run-codex.ps1
```

Automated smoke test:

```powershell
.\scripts\run-codex.ps1 -Smoke
```

The scripts pass configuration as command-line overrides. They do not edit your global Codex configuration.

## Run Task A yourself

Use a normal PowerShell terminal, not one started by an agent. The key stays in that terminal; the scripts never write it to disk.

```powershell
cd claude-harness-lab
$env:ANTHROPIC_API_KEY = "your-lab-key"
.\scripts\run-task-a.ps1 -Smoke                  # setup check, 5 small runs, not data
.\scripts\run-task-a.ps1 -Headless               # 12 unattended runs
.\scripts\run-task-a.ps1 -Interactive claude     # you drive it and count the prompts
.\scripts\run-task-a.ps1 -Interactive opencode
.\scripts\run-task-a.ps1 -Interactive codex
```

To read what an agent did: `.\scripts\show-steps.ps1 -RunId <folder name in runs\task-a>`.

Each script starts and stops LiteLLM by itself when Codex needs it, and puts this terminal's environment back when it ends. Results go to `results/results.csv`; every run's steps, final workspace and checks go to `runs/task-a/<run-id>/` (local only). Workspaces sit in `C:\invoice-work\` and each run's empty home in `C:\invoice-home\`; both are empty between runs. This limits leaks but isn't an OS sandbox. The rules are in [protocol.md](protocol.md), under "As built".

## The Codex policy probe

What does Codex let run, under which settings? A scripted fake model asks for one fixed command at a time, so no model, gateway or key is involved. It costs nothing, though the `npm install` rows use the network. It takes about 4 minutes.

```powershell
cd codex-policy-probe
.\probe.ps1
```

Results go to `codex-policy-probe/results/`. **Don't run it while a Task A run is active:** `run-task-a.ps1` moves any folder it finds in the run folders aside when it starts, and that would pull the probe's folders out from under it.

## Before comparing results

`smoke-workspace/` is only a connectivity smoke test. It proves that the model can inspect and edit a workspace through each harness. Do not use it as evidence that one harness is better.

For the actual comparison, copy a fresh task fixture for every run, use the same prompt and model ID, save the transcript, and record any permission prompts or human interventions. The protocol is in [protocol.md](protocol.md).

## Current model

The project is pinned to Anthropic's Claude Sonnet 5.5 API model ID, `claude-sonnet-5-5`. To try another model, change it everywhere together, then record that with `.\scripts\lock.ps1 -Write`, because it's a different experiment:

- `config/` (the LiteLLM files and `codex-claude.example.toml`)
- `opencode.jsonc` and `task-a/opencode-defaults.jsonc`
- `scripts/lib-task-a.ps1`, `scripts/run-codex.ps1` and `scripts/run-opencode.ps1`

## Sources

- [OpenCode V2 installation](https://dev.opencode.ai/v2/docs)
- [OpenCode providers](https://dev.opencode.ai/v2/docs/providers/)
- [LiteLLM Codex CLI setup](https://docs.litellm.ai/docs/proxy/client_setup/codex_cli)
- [LiteLLM proxy quick start](https://docs.litellm.ai/docs/proxy/quick_start)
- [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Claude Sonnet 5.5 model reference](https://platform.claude.com/docs/en/models/sonnet-5-5/overview)

## Licence

[MIT](LICENSE) for this repo's own scripts, tasks and results. Harness text quoted in the traces and the probe's logs stays under its owners' terms.

