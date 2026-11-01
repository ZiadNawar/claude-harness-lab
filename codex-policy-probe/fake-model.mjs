// A stand-in for the model. It speaks just enough of the Responses API to ask Codex
// to run one fixed command, then reports what Codex answered. No model is called and
// nothing is billed, so every policy can be tested with the same exact commands.
//
// usage: node fake-model.mjs <port> <requests.jsonl>
// Each session's command comes from the prompt, written as: RUN<<<command>>>

import { appendFileSync } from "node:fs"
import { createServer } from "node:http"

const [port, logFile] = [Number(process.argv[2]), process.argv[3]]

const sse = (events) =>
  events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("")

const usage = { input_tokens: 1, input_tokens_details: { cached_tokens: 0 }, output_tokens: 1, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 2 }

const completed = (id) => ({ type: "response.completed", response: { id, usage } })

let counter = 0

createServer((request, response) => {
  if (request.method !== "POST") {
    response.writeHead(404).end()
    return
  }
  let raw = ""
  request.on("data", (chunk) => (raw += chunk))
  request.on("end", () => {
    const body = JSON.parse(raw)
    const items = body.input ?? []
    const text = JSON.stringify(items)
    const output = items.filter((item) => item.type === "function_call_output").pop()
    const command = text.match(/RUN<<<(.*?)>>>/)?.[1]?.replaceAll('\\"', '"').replaceAll("\\\\", "\\")
    const id = `resp-${++counter}`
    let events
    if (!output && command) {
      const sandbox = text.match(/sandbox_mode\S* is \S*?([a-z-]+)\S*?:/)?.[1]
      const approval = text.match(/Approval policy is currently ([a-z-]+)/)?.[1]
      const network = text.match(/Network access is ([a-z]+)/)?.[1]
      appendFileSync(logFile, JSON.stringify({ tools: (body.tools ?? []).map((tool) => tool.name ?? tool.type), sandbox, approval, network, command }) + "\n")
      events = [
        { type: "response.created", response: { id } },
        { type: "response.output_item.done", item: { type: "function_call", call_id: `call-${counter}`, name: "exec_command", arguments: JSON.stringify({ cmd: command, yield_time_ms: 20000 }) } },
        completed(id),
      ]
    } else {
      if (output) appendFileSync(logFile, JSON.stringify({ command, output: output.output }) + "\n")
      events = [
        { type: "response.created", response: { id } },
        { type: "response.output_item.done", item: { type: "message", role: "assistant", id: `msg-${counter}`, content: [{ type: "output_text", text: "done" }] } },
        completed(id),
      ]
    }
    response.writeHead(200, { "content-type": "text/event-stream" })
    response.end(sse(events))
  })
}).listen(port, "127.0.0.1")
