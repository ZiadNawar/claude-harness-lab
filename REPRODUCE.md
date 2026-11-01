# Reproduce this experiment

Same model, same tasks, three harnesses. This page rebuilds the setup and reruns it. You'll get the same setup, but not necessarily the same results: the model's answers vary between runs. Levels 2-3 have one or two counted runs per condition, read in full, so they describe what happened and don't rank anything.

## What you need

- Windows 11 (native, not WSL). The Windows results don't describe other systems.
- Node 24, Git for Windows, [uv](https://docs.astral.sh/uv/) and an Anthropic API key with a spending limit. Task A cost about $2 here, including setup checks.
- `C:\invoice-work` and `C:\invoice-home` free. Runs happen there, outside any project, so no harness picks up instruction files from a parent folder.

**These agents run under your Windows account, without an OS sandbox around all of them.** Use a machine you're comfortable with, and read `protocol.md` first.

## Steps

```powershell
.\scripts\setup.ps1      # installs the pinned builds; no key needed
.\scripts\lock.ps1       # says whether this matches lock.json

$env:ANTHROPIC_API_KEY = "your-key"     # stays in this terminal, never on disk
.\scripts\run-task-a.ps1 -Smoke         # setup check, 5 small runs, not data
.\scripts\run-task-a.ps1 -Headless      # level 1: 12 unattended runs
.\scripts\run-task-a.ps1 -Interactive claude     # you drive these three and count prompts
.\scripts\run-task-a.ps1 -Interactive opencode
.\scripts\run-task-a.ps1 -Interactive codex
.\scripts\run-level.ps1 -Level 2 -CaptureRequests   # free, no key: what each harness sends first, saved locally
.\scripts\run-level.ps1 -Level 2        # hard: 3 runs, about $5.17 here, Codex's share estimated
.\scripts\run-level.ps1 -Level 3 -TimeoutMinutes 90 -BudgetUsd 35   # very hard: 3 runs, $9.47 here
```

Level 3's counted Claude Code run began as a pilot (`-Pilot -Conditions claude`), so compare with `node scripts\compare-level.mjs 3 pilot,run`; `protocol.md` explains why. A clean rerun needs only `run`.

The Level 3 checks in `analysis/` use no model and read `runs/task-a/`, which is gitignored. To check our runs rather than yours, unzip each `results/traces/<run id>/workspace.zip` to `runs/task-a/<run id>/run/workspace`. The run ids are written in the scripts, so change them for your own runs:

```powershell
node analysis\level-3-measures.mjs
node analysis\level-3-damage-probe.mjs
node analysis\level-3-blocked-compaction.mjs     # Windows only
node analysis\level-3-aside-crash.mjs
node analysis\level-3-oversized.mjs
node analysis\level-3-regrade.mjs <scratch folder> 5
node analysis\level-3-cross-tests.mjs <scratch folder>    # 30 minutes or more: some tests hang
```

The verification rerun on 1 Nov went through `.\analysis\level-3-verify.ps1`, which runs the same command one harness at a time and stops if a leak check fails. It cost $11.00 here. Its table is `results/level-3-rerun-comparison.md`, and `results/level-3-comparison.md` stays the first runs' table. `level-3-damage-probe`, `-regrade`, `-oversized` and `-blocked-compaction` take the three run ids and an output name, and `-aside-crash` takes the Codex run, an output name and that solution's moved-log file name; see the top of each script.

`node analysis\level-3-two-runs.mjs <scratch folder>` tests why scores differed: it regrades solutions with only the suspected rules changed, then runs Claude Code's two test suites on each other's solutions. No model, a few minutes.

`.\analysis\level-3-opus-subscription.ps1` is the one Opus 5.5 run on a subscription. Run `claude setup-token`, add `CLAUDE_CODE_OAUTH_TOKEN=...` to the lab's `.env`, and it signs in from an empty home folder. `-CaptureRequest` records its first request with no sign-in and no model. That run's result isn't published in this repo.

`-Rounds <n>` runs each condition more than once, if you want to see how much a result varies.

`run-level.ps1` stops starting new runs at about $25 by default; change that with `-BudgetUsd`. Only one of these scripts can run at a time, and a second is refused, because each moves leftover run folders aside when it starts.

The free Codex test needs no key: `.\codex-policy-probe\probe.ps1`.

## What's pinned

| Part | How | If it can't match |
|---|---|---|
| Claude Code, Codex | Exact versions and integrity hashes in `pins/package-lock.json` | The run stops |
| OpenCode | SHA-256 in `lock.json` | **See below** |
| LiteLLM and its Python dependencies | Hashes in `requirements.lock.txt` | The run stops |
| Fixtures, prompts, hidden tests, scripts | Hashes in `lock.json`; `.gitattributes` keeps them byte-exact | The run stops |
| Windows build, Node, Git, Python | Recorded in `lock.json` | You get a note, and the run continues |

Every run saves `manifest.json` beside its logs: the exact arguments and the lock it ran under.

## What can't be pinned

- **The model.** `claude-sonnet-5-5` is the only identifier, so Anthropic could change what's behind it. Record your run dates.
- **OpenCode's build.** Its download serves only the latest build, and the versioned URLs we tried returned 404. A new setup will probably get a newer version. `lock.ps1` will stop and name the difference; pass `-AllowDrift` to continue, and report the version you used.
- **`decimal.js` in Task A.** The agents install it themselves, so they get the registry's latest (10.6.0 here).
- **The network and the service.** Anthropic's API and the npm registry are outside the lab.

If anything differs, `-AllowDrift` runs anyway and tells you what changed. Report those differences with your results.

## Reading the results

- `results/results.csv` holds Task A's rows, and `results/levels.csv` holds levels 2-4.
- `results/level-<n>-comparison.md` puts one level's runs side by side.
- `results/traces/<run-id>/` holds each run in one format: `timeline.md` to read, `steps.jsonl` with every tool call in full, `commands.csv`, `files.csv`, `requests.csv`, `summary.json`, the disk inventories and the final diff. `node scripts\trace-run.mjs <run folder> <claude|opencode|codex>` rebuilds it from the raw logs in `runs\task-a\`.
- `results/first-requests/level-<n>/` holds what each harness sent before any work: system prompt and tool definitions. It isn't in this repo, because that's the harness vendors' text. `-CaptureRequests` recreates it for free, and the level comparisons keep the counts and tool names.
- `analysis/` holds extra measures for Level 2: what reached the model, each agent's tests on the others' solutions, and public-function behaviour. They read the local `runs\` folder, and their run ids are fixed to our runs, so change those for yours.
- `.\scripts\show-steps.ps1 -RunId <folder in runs\task-a>` shows what an agent did, step by step.
- `protocol.md` has the rules, which were fixed before the runs. Results describe behaviour, with no winner.

Level 4 is a private task and isn't part of this repo, so it can't be rerun from here.
