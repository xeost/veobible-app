import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { Writable } from "node:stream";
import type http from "node:http";
import { once } from "node:events";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { AudioProjects } from "../audio-projects.js";
import { audioProjectHttp } from "../audio-project-http.js";
import { GenerationQueue } from "../generation-queue.js";
import { sharedAudioDirectory } from "../working-directories.js";
import { config } from "../engines/long/config.js";
import type { OriginalAudioState } from "../original-audio-schema.js";

const version = { id: 1, code: "rv1909", locale: "es", label: "Reina Valera" };
const projects = new AudioProjects();
await projects.create(version, "rv1909-v2");
const project = await projects.read("rv1909-v2", "genesis");
const queue = new GenerationQueue();
class Response extends Writable {
  status = 0;
  headers: Record<string, unknown> = {};
  chunks: Buffer[] = [];
  headersSent = false;
  writeHead(status: number, headers: Record<string, unknown>) {
    this.status = status;
    this.headers = headers;
    this.headersSent = true;
    return this;
  }
  _write(chunk: Buffer, _encoding: BufferEncoding, done: () => void) {
    this.chunks.push(Buffer.from(chunk));
    done();
  }
}
async function request(action = "", start = false, query = "", range?: string) {
  const res = new Response();
  const finished = once(res, "finish");
  await audioProjectHttp(
    { method: "POST", headers: { range } } as http.IncomingMessage,
    res as unknown as http.ServerResponse,
    new URL(
      `http://test/v1/audio-projects/rv1909-v2/genesis${action ? `/${action}` : ""}${query}`,
    ),
    async () => ({ project, outputEnvironment: "production", start }),
    queue,
    new Set(),
  );
  await finished;
  return {
    status: res.status,
    headers: res.headers,
    body: Buffer.concat(res.chunks),
  };
}
let detail = await request();
assert.deepEqual(JSON.parse(detail.body.toString()).originalChapters, []);
const original = path.join(sharedAudioDirectory, "rv1909", "01-genesis-1.mp3");
await fs.mkdir(path.dirname(original), { recursive: true });
await promisify(execFile)(config.ffmpegBin, [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:duration=30",
  original,
]);
const before = await fs.readFile(original);
detail = await request();
assert.deepEqual(JSON.parse(detail.body.toString()).originalChapters, [1]);
assert.equal(queue.pendingCount, 0);
let result = await request("original", false, "?chapter=1");
assert.equal(JSON.parse(result.body.toString()).status, "idle");
assert.equal(queue.pendingCount, 0);
result = await request("original", true, "?chapter=1");
assert.equal(result.status, 200);
let state: OriginalAudioState = JSON.parse(result.body.toString());
const deadline = Date.now() + 10000;
while (["queued", "running"].includes(state.status) && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 20));
  result = await request("original", false, "?chapter=1");
  state = JSON.parse(result.body.toString());
}
assert.equal(state.status, "done");
assert.equal(state.cues?.length, 31);
assert.ok(state.cues!.find((cue) => cue.reference === "1:1")!.end > 0);
assert.ok(
  state.cues!.find((cue) => cue.reference === "1:2")!.start >
    state.cues![0].start,
);
const jobs = queue.snapshot().length;
await request("original", true, "?chapter=1");
assert.equal(queue.snapshot().length, jobs);
const media = await request(
  "original-media",
  false,
  `?chapter=1&revision=${state.revision}`,
  "bytes=0-31",
);
assert.equal(media.status, 206);
assert.equal(media.headers["Content-Type"], "audio/mpeg");
assert.deepEqual(media.body, before.subarray(0, 32));
const missing = await request("original", true, "?chapter=2");
assert.equal(JSON.parse(missing.body.toString()).available, false);
assert.deepEqual(await fs.readFile(original), before);
console.log(
  "Original availability, opt-in alignment, chapter reuse and ranged playback passed.",
);
