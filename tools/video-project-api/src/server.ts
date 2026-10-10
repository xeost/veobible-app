import { openProjectFolder } from "./open-project-folder.js";
import type { VoicePart } from "./chapter-introductions.js";
import { loadProjectProposals } from "./project-proposals.js";
import {
  discoverExistingProjects,
  existingRenderResult,
  existingOutputMedia,
} from "./existing-projects.js";
import {
  availableBibleBooks,
  availableBibleVersions,
} from "./bible-versions.js";
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { renderSchema, previewSchema } from "./protocol.js";
import { z } from "zod";
import { GenerationQueue } from "./generation-queue.js";
import { clampProgress } from "./generation-progress.js";
import { generationFailureReason } from "./generation-failure.js";
const toolRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
if (fs.existsSync(path.join(toolRoot, ".env")))
  process.loadEnvFile(path.join(toolRoot, ".env"));
const {
  render,
  inspection,
  projectDir,
  sourceDir,
  voiceFilename,
  generateProjectVoice,
  existingProjectVoices,
  chapterVoicesAvailable,
  projectChapterVoiceFiles,
} = await import("./pipeline.js");
const { outputRoot } = await import("./working-directories.js");
const { createPreview, previewAsset } = await import("./preview.js");
const token = process.env.PROXY_API_TOKEN;
if (!token || token.length < 32)
  throw new Error("PROXY_API_TOKEN must contain at least 32 characters");
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
  progress?: number;
  lastCallbackStatus?: string;
  callbackError?: string;
  result?: unknown;
  error?: string;
  failureReason?: ReturnType<typeof generationFailureReason>;
};
async function chapterFilesFromQuery(url: URL) {
  if (
    url.searchParams.get("kind") !== "long" ||
    !url.searchParams.has("passageRange")
  )
    return [];
  const passage = renderSchema.shape.passage.parse(
    JSON.parse(url.searchParams.get("passageRange")!),
  );
  if (passage.id !== url.searchParams.get("passage"))
    throw new Error("Project passage mismatch");
  return projectChapterVoiceFiles({
    kind: "long",
    passage,
    version: {
      id: renderSchema.shape.version.shape.id.parse(
        url.searchParams.get("version"),
      ),
      locale: renderSchema.shape.version.shape.locale.parse(
        url.searchParams.get("locale"),
      ),
      label: "",
    },
    outputEnvironment: renderSchema.shape.outputEnvironment.parse(
      url.searchParams.get("outputEnvironment") ?? undefined,
    ),
  });
}

const readingSources = new Map<
  string,
  { kind: string; sections: { file: string }[] }
>();
const jobs = new Map<string, Job>();
const voiceJobs = new Map<string, Partial<Record<VoicePart, Job>>>();
const generationQueue = new GenerationQueue();
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
  .pick({
    kind: true,
    outputEnvironment: true,
    version: true,
    passage: true,
    settings: true,
    voiceTemplates: true,
  })
  .extend({ projectId: z.number().int().positive() });
const idSchema = z.string().uuid();
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
        service: "veobible-video-project",
        videoProjectProtocolVersion: 1,
        active: generationQueue.pendingCount,
      });
    if (
      /^\/v1\/projects\/[1-9]\d*\/open-folder$/.test(url.pathname) &&
      req.method === "POST"
    ) {
      const input = z
        .object({
          kind: renderSchema.shape.kind,
          version: renderSchema.shape.version.shape.id,
          slug: renderSchema.shape.passage.shape.id,
          outputEnvironment: renderSchema.shape.outputEnvironment,
        })
        .parse(await body(req));
      try {
        await openProjectFolder(
          projectDir(
            input.kind,
            input.version,
            input.slug,
            input.outputEnvironment,
          ),
          outputRoot(input.kind, input.outputEnvironment),
          input.kind,
        );
        return json(res, 200, { opened: true });
      } catch (error) {
        console.error("Could not open project folder", error);
        return json(res, 409, { error: "Could not open project folder" });
      }
    }
    if (url.pathname === "/v1/projects/final-videos" && req.method === "POST") {
      const input = z
        .object({
          outputEnvironment: renderSchema.shape.outputEnvironment,
          projects: z
            .array(
              z.object({
                id: z.number().int().positive(),
                kind: renderSchema.shape.kind,
                version: renderSchema.shape.version.shape.id,
                slug: renderSchema.shape.passage.shape.id,
              }),
            )
            .max(80),
        })
        .parse(await body(req));
      const projects = await Promise.all(
        input.projects.map(async (project) => ({
          id: project.id,
          rendered: Boolean(
            await existingOutputMedia(
              projectDir(
                project.kind,
                project.version,
                project.slug,
                input.outputEnvironment,
              ),
              project.kind,
              "video",
            ),
          ),
        })),
      );
      return json(res, 200, { projects });
    }
    if (url.pathname === "/v1/projects/existing" && req.method === "GET") {
      const kind = z
        .enum(["short", "long"])
        .parse(url.searchParams.get("kind"));
      return json(res, 200, {
        ...(await discoverExistingProjects(kind, {
          outputEnvironment: renderSchema.shape.outputEnvironment.parse(
            url.searchParams.get("outputEnvironment") ?? undefined,
          ),
        })),
        activeProjectIds: generationQueue
          .snapshot()
          .filter(
            (item) =>
              item.kind === kind && ["queued", "running"].includes(item.status),
          )
          .map((item) => item.projectId),
      });
    }
    if (
      url.pathname === "/v1/video-project-proposals" &&
      req.method === "GET"
    ) {
      const kind = z
        .enum(["short", "long"])
        .parse(url.searchParams.get("kind"));
      const locale = renderSchema.shape.version.shape.locale.parse(
        url.searchParams.get("locale"),
      );
      const code = renderSchema.shape.version.shape.id.parse(
        url.searchParams.get("version"),
      );
      return json(res, 200, {
        proposals: await loadProjectProposals(kind, { locale, code }),
      });
    }
    if (url.pathname === "/v1/bible-versions/books" && req.method === "GET") {
      const locale = renderSchema.shape.version.shape.locale.parse(
        url.searchParams.get("locale"),
      );
      const code = renderSchema.shape.version.shape.id.parse(
        url.searchParams.get("version"),
      );
      return json(res, 200, { books: await availableBibleBooks(locale, code) });
    }
    if (url.pathname === "/v1/bible-versions" && req.method === "GET")
      return json(res, 200, { versions: await availableBibleVersions() });
    if (url.pathname === "/v1/queue" && req.method === "GET") {
      const requested = url.searchParams.get("outputEnvironment");
      const environment =
        requested === null
          ? null
          : renderSchema.shape.outputEnvironment.parse(requested);
      return json(res, 200, {
        summary: generationQueue.summary(environment ?? undefined),
        items: generationQueue
          .snapshot()
          .filter(
            (item) =>
              environment === null ||
              (item.outputEnvironment ?? "production") === environment,
          ),
      });
    }
    if (url.pathname === "/v1/analyze" && req.method === "POST") {
      const input = analysisSchema.parse(await body(req));
      const result = await inspection(input);
      readingSources.set(`${input.outputEnvironment}:${input.projectId}`, {
        kind: input.kind,
        sections: result.sections,
      });
      return json(res, 200, result);
    }
    if (
      parts[1] === "projects" &&
      parts[3] === "state" &&
      req.method === "GET"
    ) {
      const projectId = z.coerce.number().int().positive().parse(parts[2]);
      const kind = z
        .enum(["short", "long"])
        .parse(url.searchParams.get("kind"));
      const version = renderSchema.shape.version.shape.id.parse(
        url.searchParams.get("version"),
      );
      const passage = renderSchema.shape.passage.shape.id.parse(
        url.searchParams.get("passage"),
      );
      const environment = renderSchema.shape.outputEnvironment.parse(
        url.searchParams.get("outputEnvironment") ?? undefined,
      );
      const active = generationQueue
        .snapshot()
        .find(
          (item) =>
            item.projectId === projectId &&
            item.kind === kind &&
            (item.outputEnvironment ?? "production") === environment &&
            item.type === "video" &&
            ["queued", "running"].includes(item.status),
        );
      const result =
        (await fsp
          .readFile(
            path.join(
              sourceDir(kind, version, passage, environment),
              "render-result.json",
            ),
            "utf8",
          )
          .then(
            (value) => JSON.parse(value),
            () => null,
          )) ??
        (await existingRenderResult(
          projectDir(kind, version, passage, environment),
          kind,
        ));
      return json(res, 200, {
        status: active?.status ?? (result ? "ready" : "draft"),
        stage: active?.stage ?? "",
        progress: active?.progress ?? (result ? 100 : 0),
        result,
      });
    }
    if (parts[1] === "projects" && parts[3] === "voices") {
      const projectId = z.coerce.number().int().positive().parse(parts[2]);
      if (req.method === "GET") {
        const kind = z
          .enum(["short", "long"])
          .parse(url.searchParams.get("kind"));
        const version = renderSchema.shape.version.shape.id.parse(
          url.searchParams.get("version"),
        );
        const passage = renderSchema.shape.passage.shape.id.parse(
          url.searchParams.get("passage"),
        );
        const environment = renderSchema.shape.outputEnvironment.parse(
          url.searchParams.get("outputEnvironment") ?? undefined,
        );
        const state = voiceJobs.get(`${environment}:${projectId}`) ?? {};
        const chapterFiles = await chapterFilesFromQuery(url);
        const voices = await Promise.all(
          [
            ...new Set<VoicePart>([
              "intro",
              "outro",
              ...chapterFiles.map((chapter) => chapter.part),
              ...(Object.keys(state) as VoicePart[]),
              ...(await fsp
                .readdir(sourceDir(kind, version, passage, environment))
                .catch(() => [])
                .then((files) =>
                  files.flatMap((file) => {
                    const match = /^2-(chapter-\d+)\.wav$/.exec(file);
                    return match ? [match[1] as VoicePart] : [];
                  }),
                )),
            ]),
          ].map(async (part) => {
            const cachedChapter = chapterFiles.find(
              (chapter) => chapter.part === part,
            );
            const available = cachedChapter
              ? cachedChapter.available
              : await fsp
                  .stat(
                    path.join(
                      sourceDir(kind, version, passage, environment),
                      voiceFilename(part),
                    ),
                  )
                  .then(
                    (stat) => stat.size > 0,
                    () => false,
                  );
            const job = state[part];
            return [
              part,
              {
                available,
                cached: cachedChapter?.cached ?? false,
                status: job?.status ?? "idle",
                progress:
                  job?.status === "done"
                    ? 100
                    : (job?.progress ?? (available ? 100 : 0)),
                failureReason: job?.failureReason,
              },
            ] as const;
          }),
        );
        return json(res, 200, { voices: Object.fromEntries(voices) });
      }
      if (req.method === "POST") {
        const input = analysisSchema
          .extend({
            part: z.union([
              z.enum(["intro", "outro"]),
              z
                .string()
                .regex(/^chapter-\d+$/)
                .transform((value) => value as VoicePart),
            ]),
          })
          .parse(await body(req));
        if (input.projectId !== projectId)
          return json(res, 400, { error: "Project mismatch" });
        if (
          generationQueue.hasPending(
            projectId,
            input.part,
            input.outputEnvironment,
          ) ||
          generationQueue.hasPending(
            projectId,
            "video",
            input.outputEnvironment,
          )
        )
          return json(res, 409, { error: "Project already active" });
        if (generationQueue.pendingCount >= 20)
          return json(res, 503, { error: "Render queue is full" });
        const job: Job = {
          id: crypto.randomUUID(),
          status: "queued",
          stage: "Queued",
        };
        const state =
          voiceJobs.get(`${input.outputEnvironment}:${projectId}`) ?? {};
        state[input.part] = job;
        voiceJobs.set(`${input.outputEnvironment}:${projectId}`, state);
        generationQueue.enqueue(
          {
            projectId,
            kind: input.kind,
            outputEnvironment: input.outputEnvironment,
            type: input.part,
          },
          job,
          async () => {
            job.status = "running";
            try {
              await generateProjectVoice(input, input.part, (progress) => {
                job.progress = Math.max(
                  job.progress ?? 0,
                  clampProgress(progress),
                );
              });
              job.status = "done";
            } catch (error) {
              console.error("Voice generation failed", error);
              job.failureReason = generationFailureReason(error);
              job.status = "failed";
            }
          },
        );
        return json(res, 202, { ok: true, status: job.status });
      }
    }
    if (url.pathname === "/v1/jobs" && req.method === "POST") {
      const input = renderSchema.parse(await body(req));
      if (input.callback && !origins.has(new URL(input.callback.url).origin))
        return json(res, 400, { error: "Callback origin not allowed" });
      if (jobs.has(input.id)) return json(res, 202, jobs.get(input.id));
      if (
        generationQueue.hasPending(
          input.projectId,
          "video",
          input.outputEnvironment,
        )
      )
        return json(res, 409, { error: "Project already active" });
      if (
        [
          ...new Set<VoicePart>([
            "intro",
            "outro",
            ...(Object.keys(
              voiceJobs.get(`${input.outputEnvironment}:${input.projectId}`) ??
                {},
            ) as VoicePart[]),
          ]),
        ].some((part) =>
          generationQueue.hasPending(
            input.projectId,
            part,
            input.outputEnvironment,
          ),
        )
      )
        return json(res, 409, { error: "Wait for generation to finish" });
      if (!(await chapterVoicesAvailable(input)))
        return json(res, 400, {
          error:
            "Generate every chapter introduction before generating the video.",
        });
      if (!(await existingProjectVoices(input)))
        return json(res, 400, {
          error:
            "Generate the introduction and closing voices before generating the video.",
        });
      if (generationQueue.pendingCount >= 20)
        return json(res, 503, { error: "Render queue is full" });
      const job: Job = { id: input.id, status: "queued", stage: "Queued" };
      jobs.set(job.id, job);
      const notify = async () => {
        if (!input.callback) return;
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
      generationQueue.enqueue(
        {
          projectId: input.projectId,
          kind: input.kind,
          outputEnvironment: input.outputEnvironment,
          type: "video",
        },
        job,
        async () => {
          job.status = "running";
          job.stage = "Starting";
          void notify();
          try {
            job.result = await render(input, (stage, progress) => {
              const stageChanged = job.stage !== stage;
              job.stage = stage;
              if (progress !== undefined)
                job.progress = Math.max(
                  job.progress ?? 0,
                  clampProgress(progress),
                );
              if (stageChanged) void notify();
            });
            job.status = "done";
            job.stage = "Complete";
          } catch (error) {
            job.status = "failed";
            job.stage = "Failed";
            job.error = error instanceof Error ? error.message : String(error);
            console.error(`Job ${job.id}: ${job.error}`);
          } finally {
            await notify();
            setTimeout(() => jobs.delete(job.id), 86400000).unref();
          }
        },
      );
      return json(res, 202, job);
    }
    if (url.pathname === "/v1/preview" && req.method === "POST") {
      return json(
        res,
        200,
        await createPreview(previewSchema.parse(await body(req))),
      );
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
      const id = z.coerce.number().int().positive().parse(parts[2]);
      const kind = z
        .enum(["short", "long"])
        .parse(url.searchParams.get("kind"));
      const version = renderSchema.shape.version.shape.id.parse(
        url.searchParams.get("version"),
      );
      const passage = renderSchema.shape.passage.shape.id.parse(
        url.searchParams.get("passage"),
      );
      const environment = renderSchema.shape.outputEnvironment.parse(
        url.searchParams.get("outputEnvironment") ?? undefined,
      );
      const asset = z
        .union([
          z.enum(["video", "thumbnail", "intro", "outro"]),
          z.string().regex(/^chapter-\d+$/),
          z.string().regex(/^reading-\d+$/),
          z.string().regex(/^preview-[0-9a-f-]{36}-\d+$/),
        ])
        .parse(parts[4]);
      const chapterFiles = asset.startsWith("chapter-")
        ? await chapterFilesFromQuery(url)
        : [];
      const reading = readingSources.get(`${environment}:${id}`);
      if (asset.startsWith("reading-") && reading?.kind !== kind)
        return json(res, 404, { error: "Analyze the passage first" });
      const file = asset.startsWith("preview-")
        ? previewAsset(asset, {
            projectId: id,
            kind,
            outputEnvironment: environment,
            version,
            passage,
          })
        : asset.startsWith("reading-")
          ? reading?.sections[Number(asset.slice(8))]?.file
          : asset === "intro" ||
              asset === "outro" ||
              asset.startsWith("chapter-")
            ? (chapterFiles.find((chapter) => chapter.part === asset)?.file ??
              path.join(
                sourceDir(kind, version, passage, environment),
                voiceFilename(asset as VoicePart),
              ))
            : await existingOutputMedia(
                projectDir(kind, version, passage, environment),
                kind,
                asset as "video" | "thumbnail",
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
        "Content-Type": file.endsWith(".mp4")
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
