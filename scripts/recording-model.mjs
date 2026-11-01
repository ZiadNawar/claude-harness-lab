// A stand-in for the model that records exactly what a harness sends it, then refuses.
// That shows what each harness puts in front of the model before any work starts: its system
// prompt, its tool definitions and how it wraps the task. Nothing is forwarded and no key is
// needed, so it costs nothing.
//
// usage: node recording-model.mjs <port> <requests.jsonl>

import { appendFileSync } from "node:fs"
import { createServer } from "node:http"

const [port, logFile] = [Number(process.argv[2]), process.argv[3]]
const SECRET_HEADERS = new Set(["authorization", "x-api-key", "api-key", "cookie"])

createServer((request, response) => {
  const chunks = []
  request.on("data", (chunk) => chunks.push(chunk))
  request.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf8")
    let body = raw
    try {
      body = JSON.parse(raw)
    } catch {}
    const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => !SECRET_HEADERS.has(name)))
    appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), method: request.method, path: request.url, headers, body }) + "\n")
    const refusal = { type: "error", error: { type: "invalid_request_error", message: "Recording only: no model behind this address." } }
    response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify(refusal))
  })
}).listen(port, "127.0.0.1")
