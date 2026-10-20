import type http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { z } from "zod";
import { AudioProjects, AudioProjectError } from "./audio-projects.js";
import {
  audioVersionSchema,
  audioEnvironmentSchema,
  audioEditionSchema,
  audioBookSchema,
  audioProjectSchema,
} from "./audio-project-schema.js";
const libraries = {
  production: new AudioProjects(),
  development: new AudioProjects(undefined, "development"),
};
const sessions = new Map<string, { jobId: string; sequence: number }>();
const snapshotInput = z.object({
  project: audioProjectSchema,
  jobId: z.string().uuid().nullable().optional(),
  sequence: z.number().int().nonnegative().default(0),
});
const callbackSchema = z.object({
  url: z.string().url(),
  token: z.string().min(32),
});
async function notify(url: string, token: string, event: unknown) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) return;
    } catch {
      /* Retry the same sequence; duplicate deliveries are idempotent. */
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Audio progress could not be saved.");
}
export async function audioProjectHttp(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  body: () => Promise<unknown>,
  enqueue: (run: () => Promise<void>) => void,
  origins: ReadonlySet<string>,
) {
  if (
    url.pathname !== "/v1/audio-projects" &&
    !url.pathname.startsWith("/v1/audio-projects/")
  )
    return false;
  const json = (value: unknown, status = 200) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  try {
    const parts = url.pathname.split("/").filter(Boolean).slice(2);
    if (req.method !== "POST") {
      json({ error: "Audio project not found." }, 404);
      return true;
    }
    const raw = await body();
    const environment = z
      .object({ outputEnvironment: audioEnvironmentSchema })
      .parse(raw).outputEnvironment;
    const projects = libraries[environment];
    if (parts[0] === "options" && parts.length === 1 && req.method === "POST") {
      const { versions } = z
        .object({ versions: z.array(audioVersionSchema).max(1000) })
        .parse(raw);
      json({
        versions: await Promise.all(
          versions.map(async (version) => ({
            ...version,
            ...(await projects.nextEdition(version.code)),
          })),
        ),
      });
    } else if (!parts.length && req.method === "POST") {
      const input = z
        .object({ version: audioVersionSchema, edition: audioEditionSchema })
        .parse(raw);
      json(await projects.create(input.version, input.edition), 201);
    } else if (parts.length >= 2 && parts.length <= 3) {
      const edition = audioEditionSchema.parse(parts[0]),
        book = audioBookSchema.parse(parts[1]);
      if (req.method !== "POST") {
        json({ error: "Audio project not found." }, 404);
        return true;
      }
      const input = snapshotInput.parse(raw);
      if (
        input.project.outputEnvironment !== environment ||
        input.project.edition !== edition ||
        input.project.book !== book
      )
        throw new AudioProjectError(
          "Audio project does not match its folder.",
          400,
        );
      const id = `${environment}/${edition}/${book}`,
        known = sessions.get(id);
      if (!input.jobId || known?.jobId !== input.jobId) {
        projects.hydrate(input.project);
        if (input.jobId)
          sessions.set(id, { jobId: input.jobId, sequence: input.sequence });
        else sessions.delete(id);
      }
      if (parts.length === 2) {
        const detail = await projects.detail(edition, book);
        const session = sessions.get(id);
        if (
          session &&
          ["queued", "running"].includes(input.project.status) &&
          detail.status === "failed" &&
          session.sequence === input.sequence
        )
          session.sequence++;
        json({ ...detail, sequence: session?.sequence ?? 0 });
      } else if (parts[2] === "generate") {
        const generation = z
          .object({
            callback: callbackSchema,
            jobId: z.string().uuid(),
            input: z.unknown(),
          })
          .parse(raw);
        const callback = new URL(generation.callback.url);
        if (
          !origins.has(callback.origin) ||
          callback.username ||
          callback.password ||
          !/^\/api\/audio-project-events\/[1-9]\d*\/[0-9a-f-]{36}$/.test(
            callback.pathname,
          )
        )
          throw new AudioProjectError("Origin not allowed", 403);
        const session = sessions.get(id)!;
        json(
          await projects.queue(
            edition,
            book,
            generation.input,
            enqueue,
            undefined,
            async (project) => {
              await notify(generation.callback.url, generation.callback.token, {
                sequence: ++session.sequence,
                project,
              });
            },
          ),
          202,
        );
      } else if (parts[2] === "media") {
        const chapter = z.coerce
          .number()
          .int()
          .positive()
          .parse(url.searchParams.get("chapter"));
        const verse = url.searchParams.has("verse")
          ? z.coerce
              .number()
              .int()
              .positive()
              .parse(url.searchParams.get("verse"))
          : undefined;
        const file = await projects.media(edition, book, chapter, verse);
        const stat = await fsp.stat(file);
        let start = 0,
          end = stat.size - 1;
        const range = req.headers.range;
        if (range) {
          const match = /^bytes=(\d+)-(\d*)$/.exec(range);
          if (!match) {
            res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
            res.end();
            return true;
          }
          start = Number(match[1]);
          end = match[2] ? Math.min(Number(match[2]), end) : end;
          if (start > end || start >= stat.size) {
            res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
            res.end();
            return true;
          }
        }
        res.writeHead(range ? 206 : 200, {
          "Content-Type": file.endsWith(".mp3") ? "audio/mpeg" : "audio/wav",
          "Content-Length": end - start + 1,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store",
          ...(range
            ? { "Content-Range": `bytes ${start}-${end}/${stat.size}` }
            : {}),
          ...(url.searchParams.has("download")
            ? {
                "Content-Disposition": `attachment; filename="${book}-${chapter}${verse ? `-${verse}` : ""}.${verse ? "wav" : "mp3"}"`,
              }
            : {}),
        });
        const stream = fs.createReadStream(file, { start, end });
        stream.on("error", () => res.destroy());
        res.on("close", () => stream.destroy());
        stream.pipe(res);
      } else json({ error: "Audio project not found." }, 404);
    } else json({ error: "Audio project not found." }, 404);
  } catch (error) {
    console.error(
      "Audio project request failed",
      error instanceof Error ? error.message : String(error),
    );
    if (res.headersSent) res.destroy();
    else
      json(
        {
          error:
            error instanceof AudioProjectError
              ? error.message
              : "Could not complete the audio request. Check that generation is available and try again.",
        },
        error instanceof AudioProjectError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 500,
      );
  }
  return true;
}
