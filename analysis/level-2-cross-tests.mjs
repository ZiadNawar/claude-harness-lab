// Beyond the hidden tests: runs each agent's own regression tests against the other agents'
// solutions, in throwaway copies, and counts the size of each diff. Where all three score the
// same on the grader, this shows where their readings of the ticket still differ.
//
// usage: node level-2-cross-tests.mjs <scratch folder>      writes results/level-2-cross-tests.json

import { spawnSync } from "node:child_process"
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const lab = join(dirname(fileURLToPath(import.meta.url)), "..")
const scratch = process.argv[2]
if (!scratch) throw new Error("usage: node level-2-cross-tests.mjs <scratch folder>")
const stamp = "20261031-144742"
const runs = { claude: `l2-claude-run-1-${stamp}`, opencode: `l2-opencode-run-2-${stamp}`, codex: `l2-codex-run-3-${stamp}` }
const dirOf = (name) => join(lab, "runs", "task-a", runs[name])

const matrix = {}
for (const solution of Object.keys(runs)) {
  matrix[solution] = {}
  for (const tests of Object.keys(runs)) {
    const copy = join(scratch, `cross-${solution}-${tests}`)
    rmSync(copy, { recursive: true, force: true })
    mkdirSync(copy, { recursive: true })
    cpSync(join(dirOf(solution), "run", "workspace"), copy, { recursive: true, filter: (path) => !/[\\/]\.git([\\/]|$)/.test(path) })
    copyFileSync(join(dirOf(tests), "run", "workspace", "test", "regression-cases.mjs"), join(copy, "test", "regression-cases.mjs"))
    const run = spawnSync("node", ["--test", "--test-reporter=tap", "test/regression-cases.mjs"], { cwd: copy, encoding: "utf8", timeout: 120000 })
    const text = run.stdout ?? ""
    const count = (name) => Number(new RegExp(`^# ${name} (\\d+)`, "m").exec(text)?.[1] ?? 0)
    matrix[solution][tests] = {
      pass: count("pass"),
      fail: count("fail"),
      failing: [...text.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map((match) => match[1].trim()).filter((name) => !name.endsWith(".mjs")),
    }
    rmSync(copy, { recursive: true, force: true })
  }
}

const diffs = {}
for (const name of Object.keys(runs)) {
  const lines = readFileSync(join(dirOf(name), "final.diff"), "utf8").split(/\r?\n/)
  const added = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length
  const removed = lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length
  const files = {}
  for (const line of lines) {
    const match = /^diff --git a\/(.+?) b\//.exec(line)
    if (match) files[match[1]] = true
  }
  diffs[name] = { added, removed, trackedFilesChanged: Object.keys(files) }
}

const out = { matrix, diffs }
writeFileSync(join(lab, "results", "level-2-cross-tests.json"), `${JSON.stringify(out, null, 2)}\n`)
console.log(JSON.stringify(out, null, 1))
