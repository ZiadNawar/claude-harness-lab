// Holds the log open from another process, then compacts, on the reference and each solution.
// The hidden test "a compaction blocked for too long fails cleanly" requires the compaction to
// report failure. This checks what each solution does instead, with two kinds of holder:
// - node: fs.openSync, which on Windows lets others rename or delete the file (like `walq tail`)
// - no-delete: a .NET handle that doesn't share delete, as a stricter backup tool might
// Windows behaviour only.
//
// usage: node level-3-blocked-compaction.mjs      writes results/level-3-blocked-compaction.json
//        node level-3-blocked-compaction.mjs <claude run> <opencode run> <codex run> <output name>      for other runs

import { spawn, spawnSync } from "node:child_process"
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const lab = join(dirname(fileURLToPath(import.meta.url)), "..")
const level = join(lab, "levels", "level-3")
const referenceTree = mkdtempSync(join(tmpdir(), "level-3-reference-"))
cpSync(join(level, "fixture"), referenceTree, { recursive: true })
cpSync(join(level, "reference"), referenceTree, { recursive: true })
const workspace = (id) => join(lab, "runs", "task-a", id, "run", "workspace")
const [
  claudeRun = "l3-claude-pilot-1-20261031-160903",
  opencodeRun = "l3-opencode-run-2-20261031-164519",
  codexRun = "l3-codex-run-3-20261031-164519",
  outputName = "level-3-blocked-compaction",
] = process.argv.slice(2)
const versions = {
  reference: referenceTree,
  claude: workspace(claudeRun),
  opencode: workspace(opencodeRun),
  codex: workspace(codexRun),
}

const holders = {
  node: (path) => ["node", ["-e", `require("node:fs").openSync(${JSON.stringify(path)},"r");console.log("ready");setTimeout(()=>{},600000)`]],
  "no-delete": (path) => ["powershell", ["-NoProfile", "-Command", `$f=[IO.File]::Open('${path}','Open','Read','ReadWrite');Write-Output 'ready';Start-Sleep 600;$f.Close()`]],
}

function hold(kind, path) {
  const [command, args] = holders[kind](path)
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"] })
  return new Promise((resolve) => child.stdout.on("data", (data) => String(data).includes("ready") && resolve(child)))
}

// In its own process, because the holder has to be another process and a hang must not stop us.
function script(root, dir) {
  const url = pathToFileURL(join(root, "src", "index.mjs")).href
  return `
    const { openQueue } = await import(${JSON.stringify(url)})
    const queue = openQueue(${JSON.stringify(dir)})
    const out = {}
    const started = Date.now()
    try { queue.compact(); out.compact = "ok" } catch (error) { out.compact = error.code ?? error.name; out.message = String(error.message).slice(0, 160) }
    out.compactSeconds = (Date.now() - started) / 1000
    try { queue.enqueue("x", { name: "after" }); out.enqueue = "ok" } catch (error) { out.enqueue = error.code ?? error.name }
    out.jobs = queue.listJobs().map((job) => job.payload.name)
    queue.close()
    console.log(JSON.stringify(out))
  `
}

const out = {}
for (const [name, root] of Object.entries(versions)) {
  out[name] = {}
  const { openQueue } = await import(pathToFileURL(join(root, "src", "index.mjs")).href)
  for (const kind of Object.keys(holders)) {
    const dir = mkdtempSync(join(tmpdir(), "level-3-blocked-"))
    const seed = openQueue(dir)
    for (const job of ["alpha", "beta"]) seed.enqueue("x", { name: job })
    seed.close()
    const holder = await hold(kind, join(dir, "wal.log"))
    const run = spawnSync("node", ["--input-type=module", "-e", script(root, dir)], { encoding: "utf8", timeout: 180000 })
    const filesWhileHeld = readdirSync(dir)
    holder.kill()
    await new Promise((resolve) => setTimeout(resolve, 500))
    let reopened
    try {
      const queue = openQueue(dir)
      reopened = queue.listJobs().map((job) => job.payload.name)
      queue.close()
    } catch (error) {
      reopened = `refused: ${error.name}: ${String(error.message).slice(0, 120)}`
    }
    let result
    try {
      result = JSON.parse(run.stdout.trim().split(/\r?\n/).at(-1))
    } catch {
      result = { failed: run.error?.code ?? run.status, stderr: (run.stderr ?? "").slice(-300) }
    }
    out[name][kind] = { ...result, filesWhileHeld, filesAfter: readdirSync(dir), reopened }
    console.log(name, kind, JSON.stringify(out[name][kind]))
    rmSync(dir, { recursive: true, force: true })
  }
}
rmSync(referenceTree, { recursive: true, force: true })
writeFileSync(join(lab, "results", `${outputName}.json`), `${JSON.stringify(out, null, 2)}\n`)
