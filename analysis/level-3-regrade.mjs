// Runs the hidden tests several times on each Level 3 solution, in throwaway copies. Some tests
// race real processes and file handles, so a single score could hold a flaky pass or fail.
// No model is involved, so this costs nothing.
//
// usage: node level-3-regrade.mjs <scratch folder> [repeats]      writes results/level-3-regrade.json
//        node level-3-regrade.mjs <scratch folder> <repeats> <claude run> <opencode run> <codex run> <output name>

import { spawnSync } from "node:child_process"
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const lab = join(dirname(fileURLToPath(import.meta.url)), "..")
const [
  scratch,
  repeats = "5",
  claudeRun = "l3-claude-pilot-1-20261031-160903",
  opencodeRun = "l3-opencode-run-2-20261031-164519",
  codexRun = "l3-codex-run-3-20261031-164519",
  outputName = "level-3-regrade",
] = process.argv.slice(2)
if (!scratch) throw new Error("usage: node level-3-regrade.mjs <scratch folder> [repeats]")
const level = join(lab, "levels", "level-3")
const workspace = (id) => join(lab, "runs", "task-a", id, "run", "workspace")
const notGit = (path) => !/[\\/]\.git([\\/]|$)/.test(path)

const versions = {
  reference: [join(level, "fixture"), join(level, "reference")],
  claude: [workspace(claudeRun)],
  opencode: [workspace(opencodeRun)],
  codex: [workspace(codexRun)],
}

const out = {}
for (const [name, sources] of Object.entries(versions)) {
  const copy = join(scratch, `regrade-${name}`)
  rmSync(copy, { recursive: true, force: true })
  mkdirSync(copy, { recursive: true })
  for (const source of sources) cpSync(source, copy, { recursive: true, filter: notGit })
  cpSync(join(level, "hidden"), join(copy, "test-hidden"), { recursive: true })
  const rounds = []
  for (let round = 0; round < Number(repeats); round += 1) {
    const run = spawnSync("node", ["--test", "--test-reporter=tap", "test-hidden/"], { cwd: copy, encoding: "utf8", timeout: 300000 })
    const text = run.stdout ?? ""
    const count = (label) => Number(new RegExp(`^# ${label} (\\d+)`, "m").exec(text)?.[1] ?? 0)
    rounds.push({ pass: count("pass"), fail: count("fail"), failing: [...text.matchAll(/^not ok \d+ - (.+)$/gm)].map((match) => match[1].trim()) })
    console.log(name, round + 1, rounds.at(-1).pass, rounds.at(-1).fail)
  }
  const tally = {}
  for (const round of rounds) for (const test of round.failing) tally[test] = (tally[test] ?? 0) + 1
  out[name] = { scores: rounds.map((round) => round.pass), failedInRepeats: tally }
  rmSync(copy, { recursive: true, force: true })
}
writeFileSync(join(lab, "results", `${outputName}.json`), `${JSON.stringify(out, null, 2)}\n`)
console.log(JSON.stringify(out, null, 1))
