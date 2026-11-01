// Measures the traces can't give on their own, for the Level 3 write-up: where the time went,
// what actually reached the model, and what the disk-read column can and can't say.
// Kept out of scripts\ so the lock that the runs were made under still matches.
//
// usage: node level-3-measures.mjs            writes results/level-3-measures.json

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const lab = join(dirname(fileURLToPath(import.meta.url)), "..")
const stamp = "20261031-164519"
const runs = { claude: "l3-claude-pilot-1-20261031-160903", opencode: `l3-opencode-run-2-${stamp}`, codex: `l3-codex-run-3-${stamp}` }
const fixtureRoot = join(lab, "levels", "level-3", "fixture")

const jsonl = (path) => readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
const walk = (dir, prefix = "") =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name), `${prefix}${entry.name}/`) : [prefix + entry.name]))

// Short or common lines say nothing about which file was shown.
const meaningful = (line) => line.trim().length >= 25
const fixture = walk(fixtureRoot).map((path) => ({ path, lines: [...new Set(readFileSync(join(fixtureRoot, path), "utf8").split(/\r?\n/).filter(meaningful).map((line) => line.trim()))] }))
const owners = new Map()
for (const file of fixture) for (const line of file.lines) owners.set(line, (owners.get(line) ?? 0) + 1)
for (const file of fixture) file.own = file.lines.filter((line) => owners.get(line) === 1)

const out = {}
for (const [condition, id] of Object.entries(runs)) {
  const dir = join(lab, "runs", "task-a", id)
  const steps = jsonl(join(dir, "trace", "steps.jsonl"))
  const calls = steps.filter((step) => step.kind === "call")
  const facts = JSON.parse(readFileSync(join(dir, "facts.json"), "utf8").replace(/^﻿/, ""))

  // Time: tool execution against everything else, which is mostly waiting for the model.
  const timed = calls.filter((step) => step.at && step.finishedAt)
  const seconds = (step) => Math.max(0, Date.parse(step.finishedAt) - Date.parse(step.at)) / 1000
  const toolSeconds = timed.reduce((sum, step) => sum + seconds(step), 0)
  const longest = timed
    .map((step) => ({ seq: step.seq, seconds: Math.round(seconds(step)), what: (step.command ?? step.tool).slice(0, 110).replace(/\s+/g, " ") }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5)

  // What reached the model: a fixture file counts as shown when its own distinctive lines
  // appear in tool output. Matching content, not paths, covers cat loops and globs.
  const firstSeen = new Map()
  const seenLines = new Map()
  for (const step of calls) {
    if (!step.output) continue
    const shownLines = new Set(step.output.split(/\r?\n/).map((line) => line.replace(/^\s*\d+[\t→:|-]\s?/, "").trim()))
    for (const file of fixture) {
      const hits = file.own.filter((line) => shownLines.has(line))
      if (!seenLines.has(file.path)) seenLines.set(file.path, new Set())
      for (const line of hits) seenLines.get(file.path).add(line)
      if (hits.length >= 3 && !firstSeen.has(file.path)) firstSeen.set(file.path, step.seq)
    }
  }
  const shown = fixture.map((file) => ({
    path: file.path,
    firstStep: firstSeen.get(file.path) ?? null,
    share: file.own.length ? Math.round((100 * seenLines.get(file.path).size) / file.own.length) : null,
  }))
  const withShare = shown.filter((file) => file.share != null)

  // The disk-read column: when each unchanged file was first read, from inventory and manifest.
  const started = Date.parse(JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8").replace(/^﻿/, "")).started)
  const after = JSON.parse(readFileSync(join(dir, "files-after.json"), "utf8")).files
  const before = new Map(JSON.parse(readFileSync(join(dir, "files-before.json"), "utf8")).files.map((file) => [file.path, file]))
  const diskSeconds = after
    .filter((file) => before.get(file.path)?.sha256 === file.sha256)
    .map((file) => (file.atimeMs - started) / 1000)
    .sort((a, b) => a - b)

  const requests = readFileSync(join(dir, "trace", "requests.csv"), "utf8").split(/\r?\n/).slice(1).filter(Boolean).map((row) => row.replaceAll('"', "").split(","))
  const sum = (index) => requests.reduce((total, row) => total + Number(row[index] || 0), 0)
  const home = existsSync(join(dir, "files-home.json")) ? JSON.parse(readFileSync(join(dir, "files-home.json"), "utf8")).files : []
  const folders = {}
  for (const file of home) {
    const key = file.path.split("/").slice(0, 2).join("/")
    folders[key] = (folders[key] ?? 0) + 1
  }

  out[condition] = {
    id,
    wallSeconds: Number(facts.wall_seconds),
    toolSeconds: Math.round(toolSeconds),
    otherSeconds: Math.round(Number(facts.wall_seconds) - toolSeconds),
    longestSteps: longest,
    requestsInTrace: requests.length,
    traceTokens: { uncached: sum(2), cached: sum(3), cacheWrite: sum(4), output: sum(5) },
    factsTokens: { uncached: facts.input_tokens, cached: facts.cached_tokens, cacheWrite: facts.cache_write_tokens, output: facts.output_tokens },
    filesInFixture: fixture.length,
    filesShownToModel: shown.filter((file) => file.firstStep).length,
    notShown: shown.filter((file) => !file.firstStep).map((file) => file.path),
    firstShownOrder: shown.filter((file) => file.firstStep).sort((a, b) => a.firstStep - b.firstStep).slice(0, 12).map((file) => `${file.firstStep}:${file.path}`),
    averageShareOfDistinctiveLinesShown: Math.round(withShare.reduce((total, file) => total + file.share, 0) / withShare.length),
    diskFirstReadSeconds: diskSeconds.length ? { first: diskSeconds[0], median: diskSeconds[Math.floor(diskSeconds.length / 2)], last: diskSeconds.at(-1), count: diskSeconds.length } : null,
    homeFiles: home.length,
    homeMegabytes: Math.round(home.reduce((total, file) => total + file.size, 0) / 1048576),
    homeTopFolders: Object.entries(folders).sort((a, b) => b[1] - a[1]).slice(0, 6),
  }
}
const target = join(lab, "results", "level-3-measures.json")
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`)
console.log(JSON.stringify(out, null, 1))
