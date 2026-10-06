import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { renderSchema } from "./protocol.js";
import { z } from "zod";
const toolRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
if (fs.existsSync(path.join(toolRoot, ".env")))
  process.loadEnvFile(path.join(toolRoot, ".env"));
const { render, inspection, projectDir, sourceDir } =
  await import("./pipeline.js");
const token = process.env.VIDEO_API_TOKEN;
if (!token || token.length < 32)
  throw new Error("VIDEO_API_TOKEN must contain at least 32 characters");
const origins = new Set(
  (
    process.env.DASHBOARD_ORIGINS ??
    "http://127.0.0.1:3003,http://localhost:3003"
  )
    .split(",")
    .map((s) => s.trim()),
);
type Job = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  stage: string;
  lastCallbackStatus?: string;
  callbackError?: string;
  result?: unknown;
  error?: string;
};
const readingSources = new Map<
  string,
  { kind: string; sections: { file: string }[] }
>();
const jobs = new Map<string, Job>();
const active = new Map<string, string>();
const json = (res: http.ServerResponse, status: number, value: unknown) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
};
async function body(req: http.IncomingMessage) {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}
const analysisSchema = renderSchema
  .pick({ kind: true, version: true, passage: true, settings: true })
  .extend({ projectId: z.string().uuid() });
const idSchema = z.string().uuid();
let queue = Promise.resolve();
const server = http.createServer(async (req, res) => {
  try {
    const authorization = Buffer.from(req.headers.authorization ?? "");
    const expected = Buffer.from(`Bearer ${token}`);
    if (
      authorization.length !== expected.length ||
      !timingSafeEqual(authorization, expected)
    )
      return json(res, 401, { error: "Unauthorized" });
    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.pathname === "/health")
      return json(res, 200, {
        ok: true,
        service: "veobible-video-generator",
        videoProjectProtocolVersion: 1,
        active: active.size,
      });
    if (url.pathname === "/v1/analyze" && req.method === "POST") {
      const input = analysisSchema.parse(await body(req));
      const result = await inspection(input);
      readingSources.set(input.projectId, {
        kind: input.kind,
        sections: result.sections,
      });
      return json(res, 200, result);
    }
    if (url.pathname === "/v1/jobs" && req.method === "POST") {
      const input = renderSchema.parse(await body(req));
      if (!origins.has(new URL(input.callback.url).origin))
        return json(res, 400, { error: "Callback origin not allowed" });
      if (jobs.has(input.id)) return json(res, 202, jobs.get(input.id));
      if (active.has(input.projectId))
        return json(res, 409, { error: "Project already active" });
      if (active.size >= 20)
        return json(res, 503, { error: "Render queue is full" });
      const job: Job = { id: input.id, status: "queued", stage: "Queued" };
      jobs.set(job.id, job);
      active.set(input.projectId, job.id);
      const notify = async () => {
        const status = job.status;
        try {
          const response = await fetch(input.callback.url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${input.callback.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(job),
            signal: AbortSignal.timeout(10000),
          });
          if (response.ok) {
            job.lastCallbackStatus = status;
            job.callbackError = undefined;
          } else {
            job.callbackError = `HTTP ${response.status}`;
            console.warn(`Callback ${job.id}: HTTP ${response.status}`);
          }
        } catch (error) {
          job.callbackError =
            error instanceof Error ? error.message : String(error);
          console.warn(
            `Callback ${job.id} unavailable; dashboard polling will reconcile`,
          );
        }
      };
      queue = queue
        .then(async () => {
          job.status = "running";
          job.stage = "Starting";
          void notify();
          try {
            job.result = await render(input, (stage) => {
              job.stage = stage;
              void notify();
            });
            job.status = "done";
            job.stage = "Complete";
          } catch (error) {
            job.status = "failed";
            job.stage = "Failed";
            job.error = error instanceof Error ? error.message : String(error);
            console.error(`Job ${job.id}: ${job.error}`);
          } finally {
            active.delete(input.projectId);
            await notify();
            setTimeout(() => jobs.delete(job.id), 86400000).unref();
          }
        })
        .catch((error) => console.error("Queue error", error));
      return json(res, 202, job);
    }
    if (parts[1] === "jobs" && parts[2] && req.method === "GET") {
      const id = idSchema.parse(parts[2]);
      return jobs.has(id)
        ? json(res, 200, jobs.get(id))
        : json(res, 404, { error: "Job not found; API may have restarted" });
    }
    if (
      parts[1] === "projects" &&
      parts[3] === "media" &&
      req.method === "GET"
    ) {
      const id = idSchema.parse(parts[2]);
      const kind = z
        .enum(["short", "long"])
        .parse(url.searchParams.get("kind"));
      const asset = z
        .union([
          z.enum(["video", "thumbnail", "intro", "outro"]),
          z.string().regex(/^reading-\d+$/),
        ])
        .parse(parts[4]);
      const reading = readingSources.get(id);
      if (asset.startsWith("reading-") && reading?.kind !== kind)
        return json(res, 404, { error: "Analyze the passage first" });
      const file = asset.startsWith("reading-")
        ? reading?.sections[Number(asset.slice(8))]?.file
        : asset === "intro" || asset === "outro"
          ? path.join(sourceDir(kind, id), `${asset}.wav`)
          : path.join(
              projectDir(kind, id),
              asset === "video" ? "video.mp4" : "thumbnail.jpg",
            );
      if (!file) return json(res, 404, { error: "Audio section not found" });
      let stat;
      try {
        stat = await fsp.stat(file);
      } catch {
        return json(res, 404, {
          error: "Media not found. Regenerate from saved D1 settings.",
        });
      }
      const range = req.headers.range;
      let start = 0,
        end = stat.size - 1;
      if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range);
        if (!match) return json(res, 416, { error: "Invalid range" });
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), end) : end;
        if (start > end || start < 0 || start >= stat.size) {
          res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
          return res.end();
        }
      }
      res.writeHead(range ? 206 : 200, {
        "Content-Type":
          asset === "video"
            ? "video/mp4"
            : asset === "thumbnail"
              ? "image/jpeg"
              : file.endsWith(".mp3")
                ? "audio/mpeg"
                : "audio/wav",
        "Content-Length": end - start + 1,
        "Accept-Ranges": "bytes",
        ...(range
          ? { "Content-Range": `bytes ${start}-${end}/${stat.size}` }
          : {}),
      });
      const stream = fs.createReadStream(file, { start, end });
      stream.on("error", () => res.destroy());
      res.on("close", () => stream.destroy());
      stream.pipe(res);
      return;
    }
    json(res, 404, { error: "Route not found" });
  } catch (error) {
    json(res, error instanceof z.ZodError ? 400 : 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
const port = Number(process.env.PORT ?? 8422);
server.listen(port, "127.0.0.1", () =>
  console.log(`Video API: http://127.0.0.1:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.close();
    process.exit(0);
  });
