// Flips each byte of a log, on the reference and on each agent's Level 3 solution,
// and records whether the queue refuses the log or opens, and how many acknowledged jobs it
// still has. Damage that silently loses acknowledged jobs is what guarantee G4 forbids.
//
// usage: node level-3-damage-probe.mjs      writes results/level-3-damage-probe.json
//        node level-3-damage-probe.mjs <claude run> <opencode run> <codex run> <output name>      for other runs

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const lab = join(dirname(fileURLToPath(import.meta.url)), "..")
const level = join(lab, "levels", "level-3")
const referenceTree = mkdtempSync(join(tmpdir(), "level-3-reference-"))
cpSync(join(level, "fixture"), referenceTree, { recursive: true })
cpSync(join(level, "reference"), referenceTree, { recursive: true })
const [
  claudeRun = "l3-claude-pilot-1-20261031-160903",
  opencodeRun = "l3-opencode-run-2-20261031-164519",
  codexRun = "l3-codex-run-3-20261031-164519",
  outputName = "level-3-damage-probe",
] = process.argv.slice(2)
const versions = {
  reference: referenceTree,
  claude: join(lab, "runs", "task-a", claudeRun, "run", "workspace"),
  opencode: join(lab, "runs", "task-a", opencodeRun, "run", "workspace"),
  codex: join(lab, "runs", "task-a", codexRun, "run", "workspace"),
}

const out = {}
for (const [name, root] of Object.entries(versions)) {
  const { openQueue, ManualClock } = await import(pathToFileURL(join(root, "src", "index.mjs")).href)
  const dir = mkdtempSync(join(tmpdir(), "level-3-probe-"))
  const log = join(dir, "wal.log")
  const clock = () => new ManualClock(1_000)
  const seed = openQueue(dir, { clock: clock() })
  const names = ["alpha", "beta", "gamma", "delta"]
  for (const job of names) seed.enqueue("x", { name: job })
  seed.close()
  const bytes = readFileSync(log)

  const open = (image) => {
    writeFileSync(log, image)
    try {
      const queue = openQueue(dir, { clock: clock() })
      const kept = queue.listJobs().map((job) => job.payload.name)
      queue.close()
      return { kept }
    } catch (error) {
      return { refused: error.name }
    }
  }

  // Each frame: 2 magic, 4 length, 4 CRC, then the payload. Find frames from the magic bytes.
  const frames = []
  for (let at = 0; at + 10 <= bytes.length; ) {
    if (bytes[at] === 0xad && bytes[at + 1] === 0xfb) {
      const length = bytes.readUInt32LE(at + 2)
      frames.push({ start: at, end: at + 10 + length })
      at += 10 + length
    } else at += 1
  }

  const summary = (start, end) => {
    const results = { refused: 0, keptAll: 0, lost: {} }
    const examples = []
    for (let at = start; at < end; at += 1) {
      const damaged = Buffer.from(bytes)
      damaged[at] ^= 0xff
      const result = open(damaged)
      if (result.refused) results.refused += 1
      else if (result.kept.length === names.length) results.keptAll += 1
      else {
        const lost = names.length - result.kept.length
        results.lost[lost] = (results.lost[lost] ?? 0) + 1
        if (examples.length < 4) examples.push({ byteInFrame: at - start, kept: result.kept })
      }
    }
    return { bytes: end - start, ...results, examples }
  }

  out[name] = {
    frames: frames.length,
    "first record (3 acknowledged records after it)": summary(frames[0].start, frames[0].end),
    "second-last record (1 after it)": summary(frames.at(-2).start, frames.at(-2).end),
    "last record": summary(frames.at(-1).start, frames.at(-1).end),
    "4,096 zero bytes after the last record": open(Buffer.concat([bytes, Buffer.alloc(4096)])),
    "32 random bytes after the last record": open(Buffer.concat([bytes, Buffer.from("9f13c2a70e5b88d146aa20f7c3910ee4d25b7c60a1f38e94720cbd5613fe08aa", "hex")])),
    "last record cut in half": open(bytes.subarray(0, frames.at(-1).start + 20)),
  }
  rmSync(dir, { recursive: true, force: true })
}
rmSync(referenceTree, { recursive: true, force: true })
writeFileSync(join(lab, "results", `${outputName}.json`), `${JSON.stringify(out, null, 2)}\n`)
console.log(JSON.stringify(out, null, 1))
