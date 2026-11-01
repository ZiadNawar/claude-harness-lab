# Task B: three candidate tickets

**Status (24 Oct, later): declined.** Ziad chose a past fix from a private repo of his own company instead (see `protocol.md`, Task B). These three stay as a fallback, for example if the private ticket turns out trivial or impossible in the pilot.

Ziad chose "propose 3 for me" on 24 Oct 2026 (action `harness-test-run`, step 2; `protocol.md`, Phase 1 revised). Each candidate is a real, merged fix from a public open-source repo. None is employer or client code.

How these were found: read-only GitHub queries (`gh search prs`, `gh pr view`, `gh pr diff`, `gh api`) on 24 Oct 2026. I didn't clone or run anything. **Unverified so far:** that each held-back test fails on the parent commit and passes on the fix, that installation works on native Windows, and the model's training cutoff. Run the verification steps at the end before the pilot.

All commands below are for PowerShell on native Windows with Python 3.12 or newer. In each case the grader is the fix commit's version of the test file, checked out on top of the agent's work after the run.

**Changed 25 Oct: don't give the agent a plain clone.** A clone checked out at the parent keeps the fix commit in its history, where `git log --all` finds the answer (`protocol.md`, Task B). Each recipe now builds the workspace with `scripts/new-task-workspace.ps1`, which leaves one commit and no remote, and applies the grader with `scripts/apply-grader.ps1`. Run them from the lab folder, and keep `..\task-b-ws\` outside the lab tree. The verification steps at the end (fails on parent, passes on fix) use a separate clone that the agent never sees.

## 1. CLI: Click progress bar stops short of 20/20 (recommended)

| | |
|---|---|
| Repo | https://github.com/pallets/click (CLI library; CI runs on Windows) |
| Ticket | https://github.com/pallets/click/issues/3571, opened 8 Jun 2026 |
| Fix | https://github.com/pallets/click/pull/3769, merged 15 Aug 2026 into `main` |
| Fix commit | `150d1071d69c5cdad7de78590013ffe56cf9e3bb` (merge commit) |
| Parent (start here) | `8b44edfff7d9a6c895fa804148c16b3a0bc9efb5` (first parent, `main` before the merge) |
| Files changed | `src/click/_termui_impl.py` +8/−0, `tests/test_termui.py` +31/−0, `CHANGES.md` +4/−0 |
| Held-back test | `tests/test_termui.py::test_progressbar_lands_on_final_position`, 12 parametrised cases (`update_min_steps` 1, 2, 3, 7, 20, 25 × drive `iterate` or `update`) |

**Ticket text.** Using `click.progressbar` with `show_pos=True` and an `update_min_steps` that doesn't divide the length leaves the bar short of completion: `range(20)` with `update_min_steps=7` ends at `14/20` instead of `20/20`. The percentage format shows 100%, so the position display is inconsistent. The issue gives a 6-line repro and the expected output, Click 8.4.1. It is symptom-only, with no root cause or fix suggestion, so **the issue body can be used as is.**

**Install and run the grader**
```powershell
.\scripts\new-task-workspace.ps1 -Source https://github.com/pallets/click -Commit 8b44edfff7d9a6c895fa804148c16b3a0bc9efb5 -Destination ..\task-b-ws\click
cd ..\task-b-ws\click
py -3.12 -m venv .venv; .venv\Scripts\python -m pip install -e . pytest
# after the agent's run (from the lab folder):
.\scripts\apply-grader.ps1 -Source https://github.com/pallets/click -FixCommit 150d1071d69c5cdad7de78590013ffe56cf9e3bb -Workspace ..\task-b-ws\click -Paths tests/test_termui.py
# then in ..\task-b-ws\click:
.venv\Scripts\python -m pytest tests/test_termui.py -k test_progressbar_lands_on_final_position
.venv\Scripts\python -m pytest tests   # existing suite stays green
```

- **Windows:** low risk. Click's CI runs a Windows job. The test patches `isatty` and writes to a `StringIO`, so it doesn't need a real terminal. There's no `AGENTS.md` or `CLAUDE.md` in the repo at the parent, so nothing confounds the matched policy.
- **Contamination:** medium-low. The issue (8 Jun 2026) is close to typical mid-2026 training cutoffs, but the fix (15 Aug) comes after them.
- **Difficulty:** easy to moderate. The agent has to find how pending steps accumulate under `update_min_steps` in `ProgressBar` and settle the remainder at the end. The grader drives the bar both by iterating and by `bar.update(1)`, so a patch to only one code path fails. Fix it at render time or in both paths and it passes, whatever the exact code.

## 2. Data: more-itertools `reversed(numeric_range(...))` changes values

| | |
|---|---|
| Repo | https://github.com/more-itertools/more-itertools (iterator/data library; no runtime dependencies) |
| Ticket | https://github.com/more-itertools/more-itertools/issues/1275, opened 12 Sep 2026 |
| Fix | https://github.com/more-itertools/more-itertools/pull/1276, merged 17 Sep 2026 into `master` |
| Fix commit | `8a930acd4fa0222af8209ae84806c18f260ee9a3` (merge commit) |
| Parent (start here) | `3ea9b009b19db0e01a83d51cee43e9935c0d657f` (first parent, `master` before the merge) |
| Files changed | `more_itertools/more.py` +4/−9, `tests/test_more.py` +19/−0, `docs/versions.rst` +1/−0 |
| Held-back tests | `tests/test_more.py::NumericRangeTests::test_reversed_preserves_float_values` and `::test_reversed_datetime_limits` |

**Ticket text.** `reversed(numeric_range(0.0, 1.0, 0.1))` returns 11 values instead of 10, ends at `-0.09999999999999998`, and differs from `list(...)[::-1]`. Reversing a datetime range that starts at `datetime.min` (or descends from `datetime.max`) raises `OverflowError`. The issue gives a repro, reproduced on Windows by the reporter. **Trim before use:** drop the last two paragraphs. One explains the cause and suggests the fix ("`__reversed__` currently constructs… Reading the original range's indexes in descending order appears to address both cases"). The other notes the report was prepared with OpenAI Codex. Keep the title, both repros and the expected results.

**Install and run the grader**
```powershell
.\scripts\new-task-workspace.ps1 -Source https://github.com/more-itertools/more-itertools -Commit 3ea9b009b19db0e01a83d51cee43e9935c0d657f -Destination ..\task-b-ws\more-itertools
cd ..\task-b-ws\more-itertools
py -3.12 -m venv .venv; .venv\Scripts\python -m pip install -e . pytest
# after the agent's run (from the lab folder):
.\scripts\apply-grader.ps1 -Source https://github.com/more-itertools/more-itertools -FixCommit 8a930acd4fa0222af8209ae84806c18f260ee9a3 -Workspace ..\task-b-ws\more-itertools -Paths tests/test_more.py
# then in ..\task-b-ws\more-itertools:
.venv\Scripts\python -m pytest tests/test_more.py -k "test_reversed_preserves_float_values or test_reversed_datetime_limits"
.venv\Scripts\python -m pytest tests
```

- **Windows:** low risk. It's pure Python with no compiled parts, and the reporter reproduced it on Windows. CI runs only on Ubuntu, so make a Windows baseline of the full suite at the parent first.
- **Contamination:** low. Both the issue and the fix are from September 2026.
- **Difficulty:** moderate once trimmed. There are two symptoms (float drift and datetime overflow), and the grader checks both, plus three float cases including a descending range. Patching only the stop arithmetic tends to fix one and miss the other.

## 3. Web: Starlette `GZipMiddleware` holds back the response start

| | |
|---|---|
| Repo | https://github.com/Kludex/starlette (ASGI web framework) |
| Ticket | https://github.com/Kludex/starlette/issues/3630, opened 5 Oct 2026 |
| Fix | https://github.com/Kludex/starlette/pull/3631, merged 13 Oct 2026 into `main` |
| Fix commit | `5b544ced7345d8b2315419ecaded4b52bffe6b76` (squash commit) |
| Parent (start here) | `96d5023c55b29224edb8d684868c49f681d079a9` |
| Files changed | `starlette/middleware/gzip.py` +3/−4, `tests/middleware/test_gzip.py` +26/−0 (the test also adds `import anyio` at the top) |
| Held-back test | `tests/middleware/test_gzip.py::test_gzip_sends_response_start_before_first_body_when_not_compressed` |

**Ticket text.** For responses the middleware won't compress (an excluded content type such as `text/event-stream`, an existing `Content-Encoding`, or status 206), `GZipMiddleware` still holds `http.response.start` until the first body chunk. So a silent SSE stream sends no status or headers, and outer instrumentation records requests with no status. The issue gives an anyio repro (actual `[]`, expected `['http.response.start']`). **Trim before use:** drop the paragraph that starts "Forwarding the start as soon as…" (the fix) and the "Tradeoff" paragraph that follows it (it describes the change). The first paragraph names the internal `initial_message`; keep it, because it reads as the bug description, but note that it helps.

**Install and run the grader**
```powershell
.\scripts\new-task-workspace.ps1 -Source https://github.com/Kludex/starlette -Commit 96d5023c55b29224edb8d684868c49f681d079a9 -Destination ..\task-b-ws\starlette
cd ..\task-b-ws\starlette
py -3.12 -m venv .venv; .venv\Scripts\python -m pip install -e ".[full]" pytest trio
# after the agent's run (from the lab folder):
.\scripts\apply-grader.ps1 -Source https://github.com/Kludex/starlette -FixCommit 5b544ced7345d8b2315419ecaded4b52bffe6b76 -Workspace ..\task-b-ws\starlette -Paths tests/middleware/test_gzip.py
# then in ..\task-b-ws\starlette:
.venv\Scripts\python -m pytest tests/middleware/test_gzip.py -k test_gzip_sends_response_start_before_first_body_when_not_compressed
.venv\Scripts\python -m pytest tests/middleware/test_gzip.py   # or the full suite, if the Windows baseline is green
```

- **Windows: the highest risk of the three.** CI runs only on Ubuntu (`.github/workflows/main.yml`), and pytest runs with `filterwarnings = error` and `--strict-config --strict-markers`, so a Windows-only warning fails tests. Make a Windows baseline at the parent first. Don't install `blockbuster` (it's optional, and the autouse fixture is skipped without it). The `full` extra needs `httpx2` from PyPI; its availability is unverified.
- **Confounder:** the repo has `AGENTS.md` (documentation-writing rules) and `AI_POLICY.md` at the root. Codex and OpenCode read `AGENTS.md`; Claude Code doesn't. Replace it with the lab's matched `AGENTS.md`, or delete both files, in every condition.
- **Contamination:** lowest. Both the issue and the fix are from October 2026.
- **Difficulty:** moderate to hard. The agent has to follow the ASGI message flow in an async middleware. The grader waits on an `anyio.Event` under `fail_after(1)`, so the unfixed code times out. Any fix that forwards the start before the body for an excluded content type passes; the 206 and `Content-Encoding` cases aren't graded.

## Recommendation

1. **Click #3571 (pick this one).** The ticket needs no trimming, the grader is behavioral and covers two code paths, CI already covers Windows, and the only dependency is pytest.
2. **more-itertools #1275 (backup).** It's the cleanest install and has low contamination risk, but it needs the hint paragraph trimmed. It may suit the pilot if Click turns out too easy.
3. **Starlette #3630 (only if Ziad wants a web example).** It's the most realistic and the least contaminated, but it carries the most Windows and `AGENTS.md` risk, and its ticket needs trimming.

Considered and set aside:
- **Starlette #3689** (WSGI `root_path`): a one-line fix, and the issue states the cause.
- **Starlette #3579** (`//` path): the grader hard-codes one of several valid encodings.
- **Click #3884:** no linked issue.
- **cachetools #440** and **tomlkit #546:** the issues spell out the fix.
- **uvicorn #3074:** the fix also changes dependencies.

## Verify before the pilot (Claude, after Ziad picks)

1. Check out the parent and install as above. Run the held-back test file from the fix commit and confirm the named test **fails**.
2. Check out the fix commit and confirm it **passes**.
3. Run the full suite at the parent on native Windows and save the result as the baseline for "existing suite stays green".
4. Save the trimmed ticket text as `tasks/task-b-ticket.md` in the lab, with the source issue URL.
