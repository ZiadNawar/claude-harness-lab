// Runs each agent's new tests against the untouched fixture, the reference and every agent's
// solution, in throwaway copies. A failure can mean a real bug or a test written around one
// design, so read the failing test before calling it either.
//
// usage: node level-3-cross-tests.mjs <scratch folder>      writes results/level-3-cross-tests.json

import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const lab = join(dirname(fileURLToPath(import.meta.url)), "..")
const scratch = process.argv[2]
if (!scratch) throw new Error("usage: node level-3-cross-tests.mjs <scratch folder>")
const level = join(lab, "levels", "level-3")
const runs = { claude: "l3-claude-pilot-1-20261031-160903", opencode: "l3-opencode-run-2-20261031-164519", codex: "l3-codex-run-3-20261031-164519" }
const workspace = (name) => join(lab, "runs", "task-a", runs[name], "run", "workspace")
const notGit = (path) => !/[\\/]\.git([\\/]|$)/.test(path)

// The test files each agent created, from the comparison of its files before and after.
const created = {}
for (const [name, id] of Object.entries(runs)) {
  const summary = JSON.parse(readFileSync(join(lab, "runs", "task-a", id, "trace", "summary.json"), "utf8"))
  created[name] = summary.disk.created.filter((path) => path.startsWith("test/"))
}
const everyCreated = [...new Set(Object.values(created).flat())]

const targets = {
  fixture: [join(level, "fixture")],
  reference: [join(level, "fixture"), join(level, "reference")],
  claude: [workspace("claude")],
  opencode: [workspace("opencode")],
  codex: [workspace("codex")],
}

const matrix = {}
for (const [target, sources] of Object.entries(targets)) {
  matrix[target] = {}
  for (const author of Object.keys(runs)) {
    const copy = join(scratch, `cross-${target}-${author}`)
    rmSync(copy, { recursive: true, force: true })
    mkdirSync(copy, { recursive: true })
    for (const source of sources) cpSync(source, copy, { recursive: true, filter: notGit })
    for (const path of everyCreated) rmSync(join(copy, path), { force: true })
    for (const path of created[author]) cpSync(join(workspace(author), path), join(copy, path))
    const files = created[author].filter((path) => !path.includes("/helpers/"))
    // A test can hang on a solution it wasn't written for, so each test gets its own limit.
    const run = spawnSync("node", ["--test", "--test-reporter=tap", "--test-timeout=60000", ...files], { cwd: copy, encoding: "utf8", timeout: 600000 })
    const text = run.stdout ?? ""
    const count = (label) => Number(new RegExp(`^# ${label} (\\d+)`, "m").exec(text)?.[1] ?? 0)
    matrix[target][author] = {
      pass: count("pass"),
      fail: count("fail"),
      cancelled: count("cancelled"),
      timedOut: run.error?.code === "ETIMEDOUT",
      failing: [...text.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map((match) => match[1].trim()).filter((name) => !name.endsWith(".mjs")),
    }
    console.log(`${author}'s tests on ${target}: ${matrix[target][author].pass} pass, ${matrix[target][author].fail} fail`)
    rmSync(copy, { recursive: true, force: true })
  }
}

const diffs = {}
for (const name of Object.keys(runs)) {
  const lines = existsSync(join(lab, "runs", "task-a", runs[name], "final.diff")) ? readFileSync(join(lab, "runs", "task-a", runs[name], "final.diff"), "utf8").split(/\r?\n/) : []
  const tracked = lines.filter((line) => line.startsWith("diff --git")).map((line) => /^diff --git a\/(.+?) b\//.exec(line)?.[1]).filter(Boolean)
  const added = (prefix) => {
    let inside = false
    let total = 0
    for (const line of lines) {
      if (line.startsWith("diff --git")) inside = line.startsWith(`diff --git a/${prefix}`)
      else if (inside && line.startsWith("+") && !line.startsWith("+++")) total += 1
    }
    return total
  }
  diffs[name] = {
    added: lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length,
    removed: lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length,
    addedInSrc: added("src/"),
    addedInDocs: added("docs/"),
    trackedFilesChanged: tracked,
    testFilesCreated: created[name],
  }
}

writeFileSync(join(lab, "results", "level-3-cross-tests.json"), `${JSON.stringify({ matrix, diffs }, null, 2)}\n`)
console.log(JSON.stringify({ matrix, diffs }, null, 1))
