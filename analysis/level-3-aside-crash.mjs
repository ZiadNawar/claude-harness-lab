// Codex's compaction moves the old log aside when a handle blocks the rename, which leaves a moment
// with no wal.log. Its run never tested a crash there, so this builds the on-disk states a crash
// would leave and opens them. It models files on disk, not a real kill or power loss.
//
// usage: node level-3-aside-crash.mjs      writes results/level-3-aside-crash.json
//        node level-3-aside-crash.mjs <codex run> <output name> <aside file name>      for another run,
//        because each solution picks its own name for the moved log

import { copyFileSync, mkdtempSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const lab = join(dirname(fileURLToPath(import.meta.url)), "..")
const [codexRun = "l3-codex-run-3-20261031-164519", outputName = "level-3-aside-crash", asideName = "wal.log.old"] = process.argv.slice(2)
const root = join(lab, "runs", "task-a", codexRun, "run", "workspace")
const { openQueue } = await import(pathToFileURL(join(root, "src", "index.mjs")).href)
const names = ["alpha", "beta"]

function seeded() {
  const dir = mkdtempSync(join(tmpdir(), "level-3-aside-"))
  const queue = openQueue(dir)
  for (const name of names) queue.enqueue("x", { name })
  queue.close()
  return dir
}

const open = (dir) => {
  try {
    const queue = openQueue(dir)
    const jobs = queue.listJobs().map((job) => job.payload.name)
    queue.enqueue("x", { name: "after" })
    const next = queue.listJobs().map((job) => job.payload.name)
    queue.close()
    return { jobs, afterEnqueue: next, files: readdirSync(dir) }
  } catch (error) {
    return { refused: `${error.name}: ${String(error.message).slice(0, 120)}`, files: readdirSync(dir) }
  }
}

const out = {}
// Crash after the old log moved aside, before the new one went in.
let dir = seeded()
renameSync(join(dir, "wal.log"), join(dir, asideName))
out["old log aside, no wal.log"] = open(dir)
rmSync(dir, { recursive: true, force: true })

// Same, with the finished compacted file still waiting beside it.
dir = seeded()
copyFileSync(join(dir, "wal.log"), join(dir, "wal.log.compact"))
renameSync(join(dir, "wal.log"), join(dir, asideName))
out["old log aside, temp file waiting, no wal.log"] = open(dir)
rmSync(dir, { recursive: true, force: true })

// Crash after the new log went in, before the old one was removed.
dir = seeded()
copyFileSync(join(dir, "wal.log"), join(dir, asideName))
out["new log in place, old log still aside"] = open(dir)
rmSync(dir, { recursive: true, force: true })

writeFileSync(join(lab, "results", `${outputName}.json`), `${JSON.stringify(out, null, 2)}\n`)
console.log(JSON.stringify(out, null, 1))
