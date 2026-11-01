// Calls the same public functions on the untouched fixture, the reference and each agent's
// solution. All three agents scored 140 of 140, so this checks readings of the ticket that the
// hidden tests don't separate. The ticket said to keep the public functions working.
//
// usage: node level-2-public-behaviour.mjs      writes results/level-2-public-behaviour.json

import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const lab = join(dirname(fileURLToPath(import.meta.url)), "..")
const stamp = "20261031-144742"
// reference\ holds only the files that differ from the fixture.
const referenceTree = mkdtempSync(join(tmpdir(), "level-2-reference-"))
cpSync(join(lab, "levels", "level-2", "fixture"), referenceTree, { recursive: true })
cpSync(join(lab, "levels", "level-2", "reference"), referenceTree, { recursive: true })

const versions = {
  fixture: join(lab, "levels", "level-2", "fixture"),
  reference: referenceTree,
  claude: join(lab, "runs", "task-a", `l2-claude-run-1-${stamp}`, "run", "workspace"),
  opencode: join(lab, "runs", "task-a", `l2-opencode-run-2-${stamp}`, "run", "workspace"),
  codex: join(lab, "runs", "task-a", `l2-codex-run-3-${stamp}`, "run", "workspace"),
}

const attempt = (call) => {
  try {
    return call()
  } catch (error) {
    return `throws: ${error.message}`
  }
}

const out = {}
for (const [name, root] of Object.entries(versions)) {
  const api = await import(pathToFileURL(join(root, "src", "index.mjs")).href)
  out[name] = {
    "settleCreditNote(1000, { openBalance: 200 })": attempt(() => api.settleCreditNote(1000, { openBalance: 200 })),
    "parseAmount('29.00', 'JPY')": attempt(() => api.parseAmount("29.00", "JPY")),
    "parseAmount('29', 'JPY')": attempt(() => api.parseAmount("29", "JPY")),
    "parseAmount('1.500', 'KWD')": attempt(() => api.parseAmount("1.500", "KWD")),
  }
}
rmSync(referenceTree, { recursive: true, force: true })
writeFileSync(join(lab, "results", "level-2-public-behaviour.json"), `${JSON.stringify(out, null, 2)}\n`)
console.log(JSON.stringify(out, null, 1))
