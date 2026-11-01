// Turns one run's raw logs into a single trace format shared by all three harnesses:
// every step the model took, every tool call with its full input and output, every file
// touched, every command run and every request's tokens. The raw logs stay the source.
//
// usage: node trace-run.mjs <run log folder> <claude|opencode|codex>
// Writes <run log folder>/trace/: steps.jsonl, commands.csv, files.csv, requests.csv,
// harness-context.json, summary.json and timeline.md.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const [logDir, condition] = process.argv.slice(2)
if (!logDir || !["claude", "opencode", "codex"].includes(condition)) {
  throw new Error("usage: node trace-run.mjs <run log folder> <claude|opencode|codex>")
}

const stripBom = (text) => text.replace(/^﻿/, "")
const readJson = (path) => JSON.parse(stripBom(readFileSync(path, "utf8")))
const readJsonl = (path) =>
  stripBom(readFileSync(path, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })

function walk(folder) {
  if (!existsSync(folder)) return []
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const flatten = (content) => {
  if (content == null) return ""
  if (typeof content === "string") return content
  if (Array.isArray(content)) return content.map((part) => part.text ?? part.output ?? "").join("\n")
  return JSON.stringify(content)
}
const isoFromMs = (ms) => (ms ? new Date(ms).toISOString() : "")

// ---------------------------------------------------------------- one parser per harness

function parseClaude() {
  const events = readJsonl(join(logDir, "transcript.jsonl"))
  const steps = []
  const byCall = new Map()
  const requests = new Map()
  const denials = new Map()
  let context = {}
  let ending = {}
  let thinkingBlocks = 0
  let thinkingWithText = 0

  for (const event of events) {
    if (event.subtype === "init") context = event
    if (event.subtype === "permission_denied") denials.set(event.tool_use_id, event)
    if (event.type === "result") ending = event
    if (event.type === "assistant") {
      const { usage, id } = event.message
      if (usage) {
        // A message arrives once per content block, so the last usage for an id is the full one.
        requests.set(id, {
          at: event.timestamp,
          uncached: usage.input_tokens,
          cached: usage.cache_read_input_tokens,
          cacheWrite: usage.cache_creation_input_tokens,
          output: usage.output_tokens,
        })
      }
      for (const block of event.message.content) {
        if (block.type === "text") steps.push({ kind: "said", at: event.timestamp, text: block.text })
        if (block.type === "thinking") {
          thinkingBlocks++
          if (block.thinking) {
            thinkingWithText++
            steps.push({ kind: "thinking", at: event.timestamp, text: block.thinking })
          }
        }
        if (block.type === "tool_use") {
          const step = { kind: "call", at: event.timestamp, tool: block.name, input: block.input, subagent: event.parent_tool_use_id ?? undefined }
          byCall.set(block.id, step)
          steps.push(step)
        }
      }
    }
    if (event.type === "user" && Array.isArray(event.message?.content)) {
      for (const block of event.message.content) {
        if (block.type !== "tool_result") continue
        const step = byCall.get(block.tool_use_id)
        if (!step) continue
        step.output = flatten(block.content)
        step.error = Boolean(block.is_error)
        step.finishedAt = event.timestamp
        const meta = (event.tool_result_meta ?? []).find((item) => item.id === block.tool_use_id)
        if (meta?.non_execution_kind) step.notExecuted = meta.non_execution_kind
      }
    }
  }
  for (const [id, denial] of denials) {
    const step = byCall.get(id)
    if (step) step.blocked = { by: "harness-permission", reason: denial.decision_reason_type, message: denial.message }
  }

  const { uuid, session_id, ...offered } = context
  return {
    steps,
    requests: [...requests.values()],
    workspace: context.cwd,
    context: { source: "stream-json init event", ...offered },
    reasoning: { blocks: thinkingBlocks, withVisibleText: thinkingWithText },
    ending: { reason: ending.terminal_reason, isError: ending.is_error, turns: ending.num_turns, finalText: ending.result, apiMs: ending.duration_api_ms, ms: ending.duration_ms },
  }
}

function parseCodex() {
  const sessions = walk(join(logDir, "home", ".codex", "sessions")).filter((path) => path.endsWith(".jsonl"))
  if (!sessions.length) throw new Error("No Codex session log.")
  const events = readJsonl(sessions[0])
  const steps = []
  const byCall = new Map()
  const requests = []
  const context = { source: "Codex session log" }
  let reasoningBlocks = 0
  let reasoningWithText = 0
  let finalText = ""

  for (const event of events) {
    const item = event.payload ?? {}
    if (event.type === "session_meta") Object.assign(context, { base_instructions: item.base_instructions, cli_version: item.cli_version, context_window: item.context_window, model_provider: item.model_provider, cwd: item.cwd })
    if (event.type === "world_state") context.world_state = item.state
    if (event.type === "turn_context") {
      context.approval_policy = item.approval_policy
      context.sandbox_policy = item.sandbox_policy
      context.permission_profile = item.permission_profile
      context.model = item.model
    }
    if (item.type === "token_count" && item.info?.last_token_usage) {
      const usage = item.info.last_token_usage
      const cached = usage.cached_input_tokens ?? 0
      const written = usage.cache_write_input_tokens ?? 0
      // Codex's input count includes the cached and cache-written tokens.
      requests.push({ at: event.timestamp, uncached: usage.input_tokens - cached - written, cached, cacheWrite: written, output: usage.output_tokens })
    }
    if (item.type === "task_complete") finalText = item.last_agent_message ?? finalText
    if (event.type !== "response_item") continue
    if (item.type === "message") {
      if (item.role === "assistant") steps.push({ kind: "said", at: event.timestamp, text: flatten(item.content) })
      else (context.instructions_sent ??= []).push({ role: item.role, text: flatten(item.content) })
    }
    if (item.type === "reasoning") {
      reasoningBlocks++
      const text = (item.summary ?? []).map((part) => part.text).join("") || flatten(item.content)
      if (text) {
        reasoningWithText++
        steps.push({ kind: "thinking", at: event.timestamp, text })
      }
    }
    if (item.type === "function_call" || item.type === "custom_tool_call") {
      let input = item.input ?? item.arguments
      try {
        input = JSON.parse(input)
      } catch {
        input = { raw: input }
      }
      const step = { kind: "call", at: event.timestamp, tool: item.name, input }
      byCall.set(item.call_id, step)
      steps.push(step)
    }
    if (item.type === "function_call_output" || item.type === "custom_tool_call_output") {
      const step = byCall.get(item.call_id)
      if (!step) continue
      step.output = flatten(item.output)
      step.finishedAt = event.timestamp
      if (/rejected: blocked by policy/.test(step.output)) step.blocked = { by: "harness-policy", message: "rejected: blocked by policy" }
    }
  }
  const transcript = existsSync(join(logDir, "transcript.jsonl")) ? readJsonl(join(logDir, "transcript.jsonl")) : []
  const failed = transcript.find((event) => event.type === "turn.failed")
  return {
    steps,
    requests,
    workspace: context.cwd,
    context,
    reasoning: { blocks: reasoningBlocks, withVisibleText: reasoningWithText },
    ending: { reason: failed ? "turn.failed" : "turn.completed", isError: Boolean(failed), finalText },
  }
}

function parseOpenCode() {
  const exports = readdirSync(logDir).filter((name) => /^session-.*\.json$/.test(name))
  const session = exports.length ? readJson(join(logDir, exports[0])) : null
  const hasSteps = session?.messages?.some((message) => message.type === "assistant")
  return hasSteps ? parseOpenCodeExport(session) : parseOpenCodeStream(session)
}

function parseOpenCodeExport(session) {
  const steps = []
  const requests = []
  let reasoningBlocks = 0
  let reasoningWithText = 0
  let finalText = ""
  for (const message of session.messages) {
    if (message.type !== "assistant") continue
    const at = isoFromMs(message.time?.completed ?? message.time?.created)
    if (message.tokens) {
      requests.push({ at, uncached: message.tokens.input, cached: message.tokens.cache?.read ?? 0, cacheWrite: message.tokens.cache?.write ?? 0, output: message.tokens.output, cost: message.cost })
    }
    for (const block of message.content ?? []) {
      if (block.type === "text") {
        steps.push({ kind: "said", at, text: block.text })
        finalText = block.text
      }
      if (block.type === "reasoning") {
        reasoningBlocks++
        if (block.text) {
          reasoningWithText++
          steps.push({ kind: "thinking", at, text: block.text })
        }
      }
      if (block.type === "tool") {
        const state = block.state ?? {}
        const output = flatten(state.content ?? state.output ?? state.error)
        const step = { kind: "call", at: isoFromMs(block.time?.created) || at, finishedAt: isoFromMs(block.time?.completed), tool: block.name, input: state.input, output, error: state.status === "error" }
        if (state.metadata?.exit != null) step.exitCode = state.metadata.exit
        steps.push(step)
      }
    }
  }
  return {
    steps,
    requests,
    workspace: session.info?.location?.directory,
    context: { source: "OpenCode session export", ...session.info },
    reasoning: { blocks: reasoningBlocks, withVisibleText: reasoningWithText },
    ending: { reason: session.info?.outcome, isError: session.info?.outcome !== "succeeded", finalText },
  }
}

// Task A's unattended runs kept only this stream, and it can miss the last step.
function parseOpenCodeStream(session) {
  const events = readJsonl(join(logDir, "transcript.jsonl"))
  const steps = []
  const requests = []
  let finalText = ""
  let workspace
  for (const event of events) {
    const at = isoFromMs(event.timestamp)
    const part = event.part ?? {}
    if (event.type === "text") {
      steps.push({ kind: "said", at, text: part.text })
      finalText = part.text
    }
    if (event.type === "step_finish" && part.tokens) {
      requests.push({ at, uncached: part.tokens.input, cached: part.tokens.cache?.read ?? 0, cacheWrite: part.tokens.cache?.write ?? 0, output: part.tokens.output, cost: part.cost })
    }
    if (event.type === "tool_use") {
      const state = part.state ?? {}
      workspace ??= /^(.*?[\\/]workspace)([\\/]|$)/i.exec(state.input?.path ?? "")?.[1]
      const step = { kind: "call", at: isoFromMs(state.time?.start) || at, finishedAt: isoFromMs(state.time?.end), tool: part.tool, input: state.input, output: flatten(state.output ?? state.error), error: state.status === "error" }
      if (state.metadata?.exit != null) step.exitCode = state.metadata.exit
      steps.push(step)
    }
  }
  return {
    steps,
    requests,
    workspace,
    context: { source: "OpenCode event stream; no session export, so the last step may be missing", ...session?.info },
    reasoning: { blocks: 0, withVisibleText: 0 },
    ending: { reason: session?.info?.outcome ?? "not recorded", isError: false, finalText },
  }
}

// ---------------------------------------------------------------- files and commands

const parsed = { claude: parseClaude, opencode: parseOpenCode, codex: parseCodex }[condition]()

const readInventory = (name) => (existsSync(join(logDir, name)) ? readJson(join(logDir, name)).files : null)
const before = readInventory("files-before.json")
const after = readInventory("files-after.json")
const started = existsSync(join(logDir, "manifest.json")) ? readJson(join(logDir, "manifest.json")).started : null

const known = new Set([...(before ?? []), ...(after ?? [])].map((file) => file.path))
if (!known.size) {
  // Runs from before the inventories: the final workspace is the best list there is.
  const root = join(logDir, "run", "workspace")
  for (const path of walk(root)) {
    const relativePath = path.slice(root.length + 1).replaceAll("\\", "/")
    if (!relativePath.startsWith(".git/") && !relativePath.startsWith("node_modules/")) known.add(relativePath)
  }
}
const knownByLength = [...known].sort((a, b) => b.length - a.length)

const workspacePrefix = (parsed.workspace ?? "").replaceAll("\\", "/").toLowerCase()
function normalisePath(path) {
  const flat = String(path).replaceAll("\\", "/").replace(/^\.\//, "")
  if (workspacePrefix && flat.toLowerCase() === workspacePrefix) return "."
  if (workspacePrefix && flat.toLowerCase().startsWith(workspacePrefix + "/")) return flat.slice(workspacePrefix.length + 1)
  return flat
}
const isOutside = (path) => /^([a-z]:\/|\/|~)/i.test(path) || path.startsWith("../")

const SHELL_TOOLS = new Set(["Bash", "PowerShell", "bash", "shell", "exec_command"])
const commandOf = (input) => {
  const value = input?.command ?? input?.cmd
  return Array.isArray(value) ? value.join(" ") : value
}

// What a shell segment does to the files it names. This reads the command's words, so it's
// an inference: a script's own reads don't appear here, and files-after.json covers those.
function verbOf(segment) {
  const text = segment.trim()
  if (/^(rm|del|Remove-Item|ri)\b/i.test(text)) return "delete"
  if (/^(mv|Move-Item|Rename-Item|git mv)\b/i.test(text)) return "move"
  if (/\bsed\s+-i\b|^(Set-Content|Add-Content|Out-File|tee)\b|\|\s*(Set-Content|Add-Content|Out-File|tee)\b|(^|[^0-9>-])>>?\s*[^&\s]/i.test(text)) return "write"
  if (/^(python\d?|py|node|deno|bun|tsx)\b/i.test(text)) return /--test|^node\s+[^-]/.test(text) ? "execute" : "script"
  if (/^(grep|rg|findstr|Select-String|sls)\b/i.test(text)) return "search"
  if (/^(cat|type|gc|Get-Content|head|tail|less|more|sed|awk|wc|nl|Format-Hex)\b/i.test(text)) return "read"
  if (/^git\s+(add|commit|stash|checkout|restore|reset)\b/.test(text)) return "git-write"
  if (/^git\b/.test(text)) return "git-read"
  if (/^(ls|dir|Get-ChildItem|gci|find|tree)\b/i.test(text)) return "list"
  return "mentioned"
}

function actionsFromCommand(command) {
  const actions = []
  const seen = new Set()
  const flat = command.replaceAll("\\", "/")
  for (const segment of flat.split(/;|&&|\|\||\r?\n/)) {
    let rest = segment
    for (const path of knownByLength) {
      if (!rest.includes(path)) continue
      rest = rest.replaceAll(path, " ")
      const key = `${path}|${segment}`
      if (seen.has(key)) continue
      seen.add(key)
      actions.push({ action: verbOf(segment), path, inferred: true })
    }
    // Paths the command names outside the workspace. A relative "../" only counts when the
    // command itself reads or lists it: in an edit script it's usually an import in the code.
    const verb = verbOf(segment)
    const relativeCounts = ["read", "list", "search", "write", "delete", "move"].includes(verb)
    for (const match of segment.matchAll(/(?:^|[\s"'=(])((?:[a-zA-Z]:\/|\.\.\/|\.\.$|~\/)[^\s"'|;)]*)/g)) {
      if (match[1].startsWith("..") && !relativeCounts) continue
      actions.push({ action: verb, path: match[1], inferred: true })
    }
  }
  return actions
}

function actionsFromPatch(patch) {
  const verbs = { Update: "edit", Add: "create", Delete: "delete" }
  return [...String(patch).matchAll(/^\*\*\* (Update|Add|Delete) File: (.+)$/gm)].map((match) => ({ action: verbs[match[1]], path: match[2].trim() }))
}

function actionsFromCall(step) {
  const input = step.input ?? {}
  const tool = step.tool.toLowerCase()
  const path = input.file_path ?? input.filePath ?? input.notebook_path ?? input.path
  if (SHELL_TOOLS.has(step.tool)) return actionsFromCommand(commandOf(input) ?? "")
  if (tool === "apply_patch") return actionsFromPatch(input.raw ?? input.patchText ?? input.input ?? input.patch ?? "")
  if (tool === "read") return path ? [{ action: /^Read directory/.test(step.output ?? "") ? "list" : "read", path, detail: input.offset != null || input.limit != null ? `offset ${input.offset ?? 0}, limit ${input.limit ?? "all"}` : undefined }] : []
  if (tool === "edit" || tool === "notebookedit" || tool === "multiedit") return path ? [{ action: "edit", path }] : []
  if (tool === "write") return path ? [{ action: "write", path }] : []
  if (tool === "glob" || tool === "grep") return [{ action: "search", path: path ?? ".", detail: input.pattern }]
  return []
}

const isTestCommand = (command) => /\bnpm\s+(run\s+)?t(est)?\b|\bnode\b[^;|&]*--test\b/.test(command ?? "")

function testCounts(output) {
  const count = (name) => {
    const matches = [...String(output).matchAll(new RegExp(`^\\s*(?:#|ℹ)\\s*${name}\\s+(\\d+)`, "gm"))]
    return matches.length ? Number(matches.at(-1)[1]) : null
  }
  const pass = count("pass")
  const fail = count("fail")
  return pass == null && fail == null ? null : { pass, fail }
}

function exitCodeOf(step) {
  if (step.exitCode != null) return step.exitCode
  const output = step.output ?? ""
  const match = /^Exit code (-?\d+)/m.exec(output) ?? /Process exited with code (-?\d+)/.exec(output)
  if (match) return Number(match[1])
  if (step.notExecuted || step.blocked) return null
  return step.error ? null : 0
}

let sequence = 0
for (const step of parsed.steps) {
  step.seq = ++sequence
  if (step.kind !== "call") continue
  step.actions = actionsFromCall(step)
  for (const action of step.actions) {
    action.path = normalisePath(action.path)
    if (isOutside(action.path)) action.outside = true
  }
  step.outputChars = (step.output ?? "").length
  if (SHELL_TOOLS.has(step.tool)) {
    step.command = commandOf(step.input)
    step.exit = exitCodeOf(step)
    if (isTestCommand(step.command)) step.tests = testCounts(step.output) ?? { pass: null, fail: null }
    if (!step.blocked && /\bEPERM\b|Access to the path .* is denied|Access is denied|UnauthorizedAccess|operation not permitted/i.test(step.output ?? "")) {
      step.blocked = { by: "os-denied", message: /.*(EPERM|denied|UnauthorizedAccess|not permitted).*/i.exec(step.output)?.[0]?.trim().slice(0, 300) }
    }
  }
}

const calls = parsed.steps.filter((step) => step.kind === "call")
const commands = calls.filter((step) => step.command !== undefined)

// One row per file: what the model did through tools, and what the disk says happened.
const files = new Map()
const fileRow = (path) => {
  if (!files.has(path)) files.set(path, { path, read: 0, edit: 0, write: 0, create: 0, delete: 0, search: 0, list: 0, inferred: 0, firstStep: "", lastStep: "", readDetail: new Set(), outside: isOutside(path) })
  return files.get(path)
}
for (const step of calls) {
  if (step.notExecuted || step.blocked?.by === "harness-policy" || step.blocked?.by === "harness-permission") continue
  for (const action of step.actions) {
    const row = fileRow(action.path)
    if (action.inferred) row.inferred++
    else if (action.action in row) row[action.action]++
    if (action.detail && action.action === "read") row.readDetail.add(action.detail)
    row.firstStep ||= step.seq
    row.lastStep = step.seq
    ;(row.inferredActions ??= new Set())
    if (action.inferred) row.inferredActions.add(action.action)
  }
}

const NEVER_READ_BEFORE = Date.UTC(2002, 0, 1)
if (before || after) {
  const beforeMap = new Map((before ?? []).map((file) => [file.path, file]))
  const afterMap = new Map((after ?? []).map((file) => [file.path, file]))
  for (const path of new Set([...beforeMap.keys(), ...afterMap.keys()])) {
    const row = fileRow(path)
    const old = beforeMap.get(path)
    const now = afterMap.get(path)
    row.disk = !old ? "created" : !now ? "deleted" : old.sha256 !== now.sha256 ? "modified" : "unchanged"
    row.sizeBefore = old?.size ?? ""
    row.sizeAfter = now?.size ?? ""
    // Each file's last-access time was set to 2001 before the run, and NTFS updates a time
    // that's over an hour old on a read. So this catches reads no tool call shows, including
    // by scripts and by the harness itself. Its time isn't always the first read: in Level 2,
    // files printed in the first seconds showed a later time. A write updates it too, so it
    // only says something about files left unchanged, and only whether they were read.
    if (row.disk === "unchanged") {
      row.diskRead = now.atimeMs >= NEVER_READ_BEFORE
      if (row.diskRead && started) row.diskReadSeconds = Math.round((now.atimeMs - Date.parse(started)) / 100) / 10
    }
  }
}

// ---------------------------------------------------------------- output

const outDir = join(logDir, "trace")
mkdirSync(outDir, { recursive: true })

const csv = (rows, columns) =>
  [columns.join(","), ...rows.map((row) => columns.map((column) => `"${String(row[column] ?? "").replaceAll('"', '""').replace(/\r?\n/g, " ")}"`).join(","))].join("\n") + "\n"

writeFileSync(join(outDir, "steps.jsonl"), parsed.steps.map((step) => JSON.stringify(step)).join("\n") + "\n")
writeFileSync(join(outDir, "harness-context.json"), JSON.stringify(parsed.context, null, 2) + "\n")

const fileRows = [...files.values()]
  .map((row) => ({ ...row, readDetail: [...row.readDetail].join("; "), inferredActions: [...(row.inferredActions ?? [])].join(" ") }))
  .sort((a, b) => (a.firstStep || 1e9) - (b.firstStep || 1e9) || a.path.localeCompare(b.path))
writeFileSync(join(outDir, "files.csv"), csv(fileRows, ["path", "disk", "sizeBefore", "sizeAfter", "read", "readDetail", "edit", "write", "create", "delete", "search", "list", "inferred", "inferredActions", "diskRead", "diskReadSeconds", "firstStep", "lastStep", "outside"]))
writeFileSync(join(outDir, "commands.csv"), csv(commands.map((step) => ({ ...step, testPass: step.tests?.pass, testFail: step.tests?.fail, blockedBy: step.blocked?.by, blockedMessage: step.blocked?.message })), ["seq", "at", "finishedAt", "tool", "command", "exit", "testPass", "testFail", "blockedBy", "blockedMessage", "outputChars"]))
const requestRows = parsed.requests.map((request, index) => ({ n: index + 1, ...request, contextTokens: (request.uncached ?? 0) + (request.cached ?? 0) + (request.cacheWrite ?? 0) }))
writeFileSync(join(outDir, "requests.csv"), csv(requestRows, ["n", "at", "uncached", "cached", "cacheWrite", "output", "contextTokens", "cost"]))

const tally = (values) => {
  const counts = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}
const onlyIn = (test) => fileRows.filter(test).map((row) => row.path)
const inventoried = Boolean(before && after)
const summary = {
  condition,
  workspace: parsed.workspace,
  ending: { ...parsed.ending, finalText: undefined },
  steps: parsed.steps.length,
  toolCalls: calls.length,
  toolsUsed: tally(calls.map((step) => step.tool)),
  said: parsed.steps.filter((step) => step.kind === "said").length,
  reasoning: parsed.reasoning,
  requests: parsed.requests.length,
  peakContextTokens: Math.max(0, ...requestRows.map((row) => row.contextTokens)),
  outputCharsReturnedToModel: calls.reduce((sum, step) => sum + step.outputChars, 0),
  commands: commands.length,
  testRuns: commands.filter((step) => step.tests).map((step) => ({ seq: step.seq, exit: step.exit, ...step.tests })),
  blocked: calls.filter((step) => step.blocked).map((step) => ({ seq: step.seq, tool: step.tool, by: step.blocked.by, message: step.blocked.message, command: step.command })),
  filesReadThroughATool: onlyIn((row) => row.read > 0),
  filesEditedThroughATool: onlyIn((row) => row.edit + row.write + row.create > 0),
  filesNamedInShellCommands: onlyIn((row) => row.inferred > 0),
  outsidePathsTouched: onlyIn((row) => row.outside),
  disk: inventoried
    ? {
        inventoried: true,
        created: onlyIn((row) => row.disk === "created"),
        modified: onlyIn((row) => row.disk === "modified"),
        deleted: onlyIn((row) => row.disk === "deleted"),
        filesBefore: before.length,
        unchangedFiles: onlyIn((row) => row.disk === "unchanged").length,
        unchangedAndReadOnDisk: onlyIn((row) => row.diskRead).length,
        neverReadOnDisk: onlyIn((row) => row.disk && row.diskRead === false),
        readOnDiskButNotThroughATool: onlyIn((row) => row.diskRead && row.read === 0 && row.inferred === 0),
      }
    : { inventoried: false, note: "This run predates the file inventories, so disk changes and disk reads aren't available." },
  limits: [
    "Reasoning text is not in these logs unless reasoning.withVisibleText is above 0: the harness logs it empty or encrypted.",
    "filesNamedInShellCommands comes from reading the command's words, so it's inferred.",
    "A disk read counts reads by anything in the process tree, including the harness itself, not only what reached the model.",
    "Reads outside the workspace are visible only when a command names the path.",
  ],
  finalText: parsed.ending.finalText,
}
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n")

const clip = (text, limit) => {
  const value = String(text ?? "").trim()
  return value.length > limit ? `${value.slice(0, limit)}\n... [${value.length - limit} more characters in steps.jsonl]` : value
}
const fence = (text) => "```text\n" + text.replaceAll("```", "'''") + "\n```"
const timeline = [`# Timeline: ${logDir.split(/[\\/]/).pop()}`, "", "Every step in order. Long outputs are clipped here; `steps.jsonl` holds them in full.", ""]
for (const step of parsed.steps) {
  if (step.kind === "said") timeline.push(`## ${step.seq}. Said`, "", step.text ?? "", "")
  if (step.kind === "thinking") timeline.push(`## ${step.seq}. Reasoning`, "", step.text ?? "", "")
  if (step.kind === "call") {
    const flags = [step.blocked ? `BLOCKED by ${step.blocked.by}` : "", step.error ? "error" : "", step.exit != null ? `exit ${step.exit}` : ""].filter(Boolean).join(", ")
    timeline.push(`## ${step.seq}. ${step.tool}${flags ? ` (${flags})` : ""}`, "")
    timeline.push(fence(clip(step.command ?? JSON.stringify(step.input, null, 2), 2000)), "")
    if (step.output) timeline.push(fence(clip(step.output, 1500)), "")
  }
}
writeFileSync(join(outDir, "timeline.md"), timeline.join("\n"))

console.log(`  trace: ${parsed.steps.length} steps, ${calls.length} tool calls, ${commands.length} commands, ${calls.filter((step) => step.blocked).length} blocked, ${fileRows.length} files`)
