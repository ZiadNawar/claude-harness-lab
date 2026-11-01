// Why did one harness score differently on the same task? Six solutions split on whether they
// look past bad bytes for a later valid record, and on whether cancelled jobs count as finished.
// This tests that reading by changing only those rules, in throwaway copies, and regrading.
// It also runs each Claude Code run's own tests on the other run's solution. No model is involved.
//
// usage: node level-3-two-runs.mjs <scratch folder>      writes results/level-3-two-runs.json
//        node level-3-two-runs.mjs <scratch folder> cross      redoes only the cross-tests

import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const lab = join(dirname(fileURLToPath(import.meta.url)), "..")
const [scratch, only] = process.argv.slice(2)
if (!scratch) throw new Error("usage: node level-3-two-runs.mjs <scratch folder>")
const hidden = join(lab, "levels", "level-3", "hidden")
const workspace = (id) => join(lab, "runs", "task-a", id, "run", "workspace")
const notGit = (path) => !/[\\/]\.git([\\/]|$)/.test(path)

const claude1 = "l3-claude-pilot-1-20261031-160903"
const claude2 = "l3-claude-run-1-20261101-102116"
const opencode2 = "l3-opencode-run-2-20261101-103817"
const codex1 = "l3-codex-run-3-20261031-164519"

function patch(root, file, from, to) {
  const path = join(root, file)
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n")
  if (!text.includes(from)) throw new Error(`${file} doesn't contain the text this patch replaces: ${from.slice(0, 60)}`)
  writeFileSync(path, text.replace(from, to))
}

// The rule under test, added to frame.mjs. Bytes that aren't a good frame are damage if a valid
// frame follows them, and a cut-off write if none does.
const lookAhead = `
function validFrameFollows(bytes, pos) {
  for (let at = bytes.indexOf(0xad, pos + 1); at !== -1; at = bytes.indexOf(0xad, at + 1)) {
    if (bytes[at + 1] === 0xfb && decodeFrameAt(bytes, at).ok) return true;
  }
  return false;
}

/**
 * Walks frames`

const cancelledFinished = (root) => patch(root, "src/retention.mjs", "new Set(['done', 'dead'])", "new Set(['done', 'dead', 'cancelled'])")

function addLookAheadToClaude1(root) {
  patch(root, "src/frame.mjs", "\n/**\n * Walks frames", lookAhead)
  patch(
    root,
    "src/frame.mjs",
    `      const lastFrame = decoded.end === bytes.length;
      if (decoded.reason !== 'partial' && !lastFrame) {
        throw`,
    `      if (validFrameFollows(bytes, pos)) {
        throw`,
  )
  patch(
    root,
    "src/frame.mjs",
    "const needed = bytes.length - pos >= 6 ? FRAME_OVERHEAD + bytes.readUInt32LE(pos + 2) : FRAME_OVERHEAD;",
    "const needed = bytes.length - pos >= 6 ? Math.min(FRAME_OVERHEAD + bytes.readUInt32LE(pos + 2), FRAME_OVERHEAD + MAX_PAYLOAD) : FRAME_OVERHEAD;",
  )
}

// The other way round: Claude Code's second run, with its look-ahead replaced by the first run's rule.
function removeLookAheadFromClaude2(root) {
  patch(
    root,
    "src/wal.mjs",
    "      if (this.#validFrameAfter(end, size)) {",
    `      const head = this.ops.read(this.file, end, FRAME_OVERHEAD);
      const wholeLastFrame = head.length === FRAME_OVERHEAD && end + FRAME_OVERHEAD + head.readUInt32LE(2) === size;
      if (tail.reason !== 'partial' && !(wholeLastFrame && (tail.reason === 'bad-checksum' || tail.reason === 'bad-payload'))) {`,
  )
}

function addLookAheadToOpenCode2(root) {
  patch(root, "src/frame.mjs", "\n/**\n * Walks frames", lookAhead)
  patch(
    root,
    "src/frame.mjs",
    `      const atEnd = decoded.reason === 'bad-checksum' && decoded.next === bytes.length;
      if (decoded.reason !== 'partial' && !atEnd) {`,
    `      const atEnd = final || (decoded.reason === 'bad-checksum' && decoded.next === bytes.length);
      if (final ? validFrameFollows(bytes, pos) : decoded.reason !== 'partial' && !atEnd) {`,
  )
}

function addLookAheadToCodex1(root) {
  patch(root, "src/frame.mjs", "\n/**\n * Walks frames", lookAhead)
  patch(root, "src/frame.mjs", "      if (!decoded.tail) {\n        throw", "      if (atEof ? validFrameFollows(bytes, pos) : !decoded.tail) {\n        throw")
}

const variants = [
  { name: "Claude Code 1, as it finished", run: claude1 },
  { name: "Claude Code 1 + look-ahead", run: claude1, change: addLookAheadToClaude1 },
  { name: "Claude Code 1 + cancelled counts as finished", run: claude1, change: cancelledFinished },
  { name: "Claude Code 1 + both", run: claude1, change: (root) => (addLookAheadToClaude1(root), cancelledFinished(root)) },
  { name: "Claude Code 2, as it finished", run: claude2 },
  { name: "Claude Code 2 with Claude Code 1's rule instead of look-ahead", run: claude2, change: removeLookAheadFromClaude2 },
  { name: "Claude Code 2 without cancelled as finished", run: claude2, change: (root) => patch(root, "src/retention.mjs", "new Set(['done', 'dead', 'cancelled'])", "new Set(['done', 'dead'])") },
  { name: "OpenCode 2, as it finished", run: opencode2 },
  { name: "OpenCode 2 + look-ahead", run: opencode2, change: addLookAheadToOpenCode2 },
  { name: "Codex 1, as it finished", run: codex1 },
  { name: "Codex 1 + look-ahead", run: codex1, change: addLookAheadToCodex1 },
]

function grade(root) {
  const run = spawnSync("node", ["--test", "--test-reporter=tap", "test-hidden/"], { cwd: root, encoding: "utf8", timeout: 300000 })
  const text = run.stdout ?? ""
  const count = (label) => Number(new RegExp(`^# ${label} (\\d+)`, "m").exec(text)?.[1] ?? 0)
  return { pass: count("pass"), fail: count("fail"), failing: [...text.matchAll(/^not ok \d+ - (.+)$/gm)].map((match) => match[1].trim()) }
}

// The same flips as level-3-damage-probe.mjs, on the first of four records.
async function lengthFlips(root) {
  const { openQueue, ManualClock } = await import(pathToFileURL(join(root, "src", "index.mjs")).href)
  const dir = mkdtempSync(join(tmpdir(), "level-3-two-runs-"))
  const log = join(dir, "wal.log")
  const clock = () => new ManualClock(1_000)
  const seed = openQueue(dir, { clock: clock() })
  for (const name of ["alpha", "beta", "gamma", "delta"]) seed.enqueue("x", { name })
  seed.close()
  const bytes = readFileSync(log)
  const start = bytes.indexOf(Buffer.from([0xad, 0xfb]))
  const end = start + 10 + bytes.readUInt32LE(start + 2)
  let refused = 0
  let silentLoss = 0
  for (let at = start; at < end; at += 1) {
    const damaged = Buffer.from(bytes)
    damaged[at] ^= 0xff
    writeFileSync(log, damaged)
    try {
      const queue = openQueue(dir, { clock: clock() })
      if (queue.listJobs().length < 4) silentLoss += 1
      queue.close()
    } catch {
      refused += 1
    }
  }
  rmSync(dir, { recursive: true, force: true })
  return { flips: end - start, refused, silentLoss }
}

const report = join(lab, "results", "level-3-two-runs.json")
const out = only === "cross" && existsSync(report) ? JSON.parse(readFileSync(report, "utf8")) : { variants: {}, crossTests: {} }
out.crossTests = {}
mkdirSync(scratch, { recursive: true })
let index = 0
for (const variant of only === "cross" ? [] : variants) {
  index += 1
  const root = join(scratch, `variant-${index}`)
  rmSync(root, { recursive: true, force: true })
  cpSync(workspace(variant.run), root, { recursive: true, filter: notGit })
  variant.change?.(root)
  cpSync(hidden, join(root, "test-hidden"), { recursive: true })
  const graded = grade(root)
  out.variants[variant.name] = { ...graded, firstRecordFlips: await lengthFlips(root) }
  console.log(variant.name, graded.pass, graded.fail, JSON.stringify(out.variants[variant.name].firstRecordFlips))
  rmSync(root, { recursive: true, force: true })
}

// Each run's own test suite, on its own solution and on the other run's. Tests that import
// helpers or internals missing from the other solution fail for that reason, so names matter here.
const pairs = [
  ["own tests of Claude Code 1, on Claude Code 1", claude1, claude1],
  ["own tests of Claude Code 2, on Claude Code 2", claude2, claude2],
  ["own tests of Claude Code 1, on Claude Code 2", claude1, claude2],
  ["own tests of Claude Code 2, on Claude Code 1", claude2, claude1],
]
for (const [name, tests, solution] of pairs) {
  const root = join(scratch, `cross-${index++}`)
  rmSync(root, { recursive: true, force: true })
  cpSync(workspace(solution), root, { recursive: true, filter: notGit })
  rmSync(join(root, "test"), { recursive: true, force: true })
  cpSync(join(workspace(tests), "test"), join(root, "test"), { recursive: true })
  // These folders have no entry file, so name each test file, as the project's npm test does.
  const files = readdirSync(join(root, "test")).filter((file) => file.endsWith(".mjs")).map((file) => `test/${file}`)
  const run = spawnSync("node", ["--test", "--test-reporter=tap", "--test-timeout=60000", ...files], { cwd: root, encoding: "utf8", timeout: 600000 })
  const text = run.stdout ?? ""
  const count = (label) => Number(new RegExp(`^# ${label} (\\d+)`, "m").exec(text)?.[1] ?? 0)
  out.crossTests[name] = {
    finished: run.error ? false : true,
    pass: count("pass"),
    fail: count("fail"),
    cancelled: count("cancelled"),
    failing: [...text.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map((match) => match[1].trim()).filter((test) => !/\.mjs$/.test(test)),
  }
  console.log(name, JSON.stringify({ ...out.crossTests[name], failing: out.crossTests[name].failing.length }))
  rmSync(root, { recursive: true, force: true })
}

writeFileSync(report, `${JSON.stringify(out, null, 2)}\n`)
console.log("Wrote results/level-3-two-runs.json")
