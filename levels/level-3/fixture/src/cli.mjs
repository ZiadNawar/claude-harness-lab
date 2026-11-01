#!/usr/bin/env node
// Operator tool.
//
//   node src/cli.mjs inspect <dir>        print every record in the log
//   node src/cli.mjs stats <dir>          print job counts
//   node src/cli.mjs compact <dir>        compact now
//   node src/cli.mjs tail <dir>           follow the log, keeping it open
//   node src/cli.mjs metrics <dir>        print operational numbers
//   node src/cli.mjs requeue <dir> <id>   give a dead job a fresh set of attempts
//   node src/cli.mjs cancel <dir> <id>    stop a job that has not finished

import fs from 'node:fs';
import path from 'node:path';
import { HEADER_SIZE, scanFrames } from './frame.mjs';
import { describeRecord, inspectLog } from './inspect.mjs';
import { openQueue } from './queue.mjs';
import { WAL_FILE } from './store.mjs';

function usage() {
  console.error('usage: cli.mjs <inspect|stats|compact|tail|metrics|requeue|cancel> <dir> [id]');
  process.exitCode = 2;
}

function inspect(dir) {
  const view = inspectLog(dir);
  console.log(`${view.file}: generation ${view.header.generation}, ${view.size} bytes`);
  for (const frame of view.frames) console.log(`${frame.offset}\t${describeRecord(frame.record)}`);
  if (view.tail) console.log(`${view.tail.offset}\tincomplete tail (${view.tail.reason}, ${view.tail.bytes} bytes)`);
}

function stats(dir) {
  const queue = openQueue(dir);
  console.log(JSON.stringify(queue.stats(), null, 2));
  queue.close();
}

function compact(dir) {
  const queue = openQueue(dir);
  console.log(JSON.stringify(queue.compact()));
  queue.close();
}

function metrics(dir) {
  const queue = openQueue(dir);
  console.log(JSON.stringify(queue.metrics(), null, 2));
  queue.close();
}

function requeue(dir, id) {
  const queue = openQueue(dir);
  console.log(JSON.stringify(queue.requeueDead(id)));
  queue.close();
}

function cancel(dir, id) {
  const queue = openQueue(dir);
  console.log(JSON.stringify(queue.cancel(id)));
  queue.close();
}

// Keeps a read handle on the log so that it sees every byte as it arrives.
function tail(dir) {
  const fd = fs.openSync(path.join(dir, WAL_FILE), 'r');
  let offset = HEADER_SIZE;
  const timer = setInterval(() => {
    const size = fs.fstatSync(fd).size;
    if (size <= offset) return;
    const bytes = Buffer.alloc(size - offset);
    fs.readSync(fd, bytes, 0, bytes.length, offset);
    const { frames, end } = scanFrames(bytes, offset);
    for (const frame of frames) console.log(describeRecord(frame.record));
    offset = end;
  }, 200);
  process.on('SIGINT', () => {
    clearInterval(timer);
    fs.closeSync(fd);
  });
}

const [command, dir, id] = process.argv.slice(2);
const commands = { inspect, stats, compact, tail, metrics, requeue, cancel };
if (!commands[command] || !dir) usage();
else commands[command](dir, id);
