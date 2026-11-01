// Enqueues a record over the 64 MiB limit in docs/wal-format.md, on the fixture, the reference and
// each solution. Two agents wrote a test for this and the reference fails both, so this checks
// whether a defect exists that the design notes don't list.
//
// usage: node level-3-oversized.mjs      writes results/level-3-oversized.json
//        node level-3-oversized.mjs <claude run> <opencode run> <codex run> <output name>      for other runs

import { cpSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const lab = join(dirname(fileURLToPath(import.meta.url)), "..")
const level = join(lab, "levels", "level-3")
const referenceTree = mkdtempSync(join(tmpdir(), "level-3-reference-"))
cpSync(join(level, "fixture"), referenceTree, { recursive: true })
cpSync(join(level, "reference"), referenceTree, { recursive: true })
const alternativeTree = mkdtempSync(join(tmpdir(), "level-3-alternative-"))
cpSync(join(level, "fixture"), alternativeTree, { recursive: true })
cpSync(join(level, "alternative"), alternativeTree, { recursive: true })
const workspace = (id) => join(lab, "runs", "task-a", id, "run", "workspace")
const [
  claudeRun = "l3-claude-pilot-1-20261031-160903",
  opencodeRun = "l3-opencode-run-2-20261031-164519",
  codexRun = "l3-codex-run-3-20261031-164519",
  outputName = "level-3-oversized",
] = process.argv.slice(2)
const versions = {
  fixture: join(level, "fixture"),
  reference: referenceTree,
  alternative: alternativeTree,
  claude: workspace(claudeRun),
  opencode: workspace(opencodeRun),
  codex: workspace(codexRun),
}

const out = {}
for (const [name, root] of Object.entries(versions)) {
  const { openQueue } = await import(pathToFileURL(join(root, "src", "index.mjs")).href)
  const dir = mkdtempSync(join(tmpdir(), "level-3-oversized-"))
  const log = join(dir, "wal.log")
  const result = {}
  const queue = openQueue(dir, { compactAfterBytes: 0 })
  queue.enqueue("x", "before")
  const sizeBefore = statSync(log).size
  try {
    queue.enqueue("x", "b".repeat(65 * 1024 * 1024))
    result.enqueue = "accepted"
  } catch (error) {
    result.enqueue = `${error.name}: ${String(error.message).slice(0, 100)}`
  }
  result.logGrewBytes = statSync(log).size - sizeBefore
  try {
    queue.enqueue("x", "after")
    result.nextEnqueue = "ok"
  } catch (error) {
    result.nextEnqueue = `${error.name}: ${String(error.message).slice(0, 100)}`
  }
  try {
    queue.close()
  } catch (error) {
    result.close = error.name
  }
  try {
    const again = openQueue(dir)
    result.reopened = again.listJobs().map((job) => (job.payload.length > 20 ? `${job.payload.length} chars` : job.payload))
    again.close()
  } catch (error) {
    result.reopened = `refused: ${error.name}: ${String(error.message).slice(0, 100)}`
  }
  out[name] = result
  console.log(name, JSON.stringify(result))
  rmSync(dir, { recursive: true, force: true })
}
rmSync(referenceTree, { recursive: true, force: true })
rmSync(alternativeTree, { recursive: true, force: true })
writeFileSync(join(lab, "results", `${outputName}.json`), `${JSON.stringify(out, null, 2)}\n`)
