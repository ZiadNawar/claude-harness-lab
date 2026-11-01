// Lists every file under a folder with its size, hash and times, so a run's real effect
// on the disk can be compared before and after, whatever the logs say. Git's own folder is
// left out, because it changes on any git command and its history is checked separately.
//
// usage: node file-inventory.mjs <folder> <out.json> [--no-hash]

import { createHash } from "node:crypto"
import { lstatSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const [root, out, flag] = process.argv.slice(2)
const hashing = flag !== "--no-hash"
const files = []

function visit(folder, prefix) {
  for (const name of readdirSync(folder).sort()) {
    if (prefix === "" && name === ".git") continue
    const path = join(folder, name)
    const relative = prefix + name
    if (lstatSync(path).isDirectory()) {
      visit(path, relative + "/")
      continue
    }
    // The times come first: hashing reads the file, and that would change its access time.
    const { size, mtimeMs, atimeMs } = statSync(path)
    const entry = { path: relative, size, mtimeMs, atimeMs }
    if (hashing) entry.sha256 = createHash("sha256").update(readFileSync(path)).digest("hex")
    files.push(entry)
  }
}

visit(root, "")
writeFileSync(out, JSON.stringify({ taken: new Date().toISOString(), files }, null, 1) + "\n")
