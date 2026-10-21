import { loadAudioVersePause } from "./audio-settings";
import { z } from "zod";
import { pageAudioProjects } from "./audio-listing";
import {
  audioProjectSchema,
  audioEditionSchema,
  audioBookSchema,
  audioGenerateSchema,
  type AudioProjectDetail,
} from "../../../../tools/video-project-api/src/audio-project-schema";
import { videoFetch } from "./video-client";
import { bibleVersionOptions } from "./bible-versions";
import { loadBaseVoiceDefaults } from "./base-voices";
import { loadNarrationModels } from "./narration-models";
import {
  loadReadingNarrationOverrides,
  resolveReadingNarrationParameters,
  loadNarrationStyles,
  resolveNarrationStyle,
} from "./narration-parameters";
import { translateServer, requestLanguage } from "./i18n-server";
import {
  AudioDatabaseError,
  findAudioProject,
  listAudioProjects,
  insertAudioProjects,
  saveAudioProject,
  beginAudioJob,
  failAudioJob,
  applyAudioEvent,
} from "./audio-projects";
export async function audioApi(
  req: Request,
  database: D1Database,
): Promise<Response | null> {
  const url = new URL(req.url),
    parts = url.pathname.slice(5).split("/");
  if (parts[0] !== "audios") return null;
  const outputEnvironment =
    process.env.NODE_ENV === "production" ? "production" : "development";
  const json = (data: unknown, status = 200) =>
    Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
  const forward = async (target: string, body: unknown) =>
    videoFetch(target, {
      method: "POST",
      body: JSON.stringify({ ...(body as object), outputEnvironment }),
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.has("range")
          ? { Range: req.headers.get("range")! }
          : {}),
      },
    });
  const relay = async (response: Response) => {
    const data = (await response.json()) as { error?: string };
    if (data.error)
      data.error = translateServer(data.error, requestLanguage(req));
    return json(data, response.status);
  };
  try {
    if (
      parts.length === 1 &&
      req.method === "GET" &&
      url.searchParams.get("catalog") === "1"
    )
      return json(
        await pageAudioProjects(database, url.searchParams, outputEnvironment),
      );
    if (parts.length === 1 && req.method === "GET")
      return json({
        projects: await listAudioProjects(database, outputEnvironment),
      });
    if (parts[1] === "options" && parts.length === 2 && req.method === "GET")
      return relay(
        await forward("/v1/audio-projects/options", {
          versions: await bibleVersionOptions(database),
        }),
      );
    if (parts.length === 1 && req.method === "POST") {
      const input = z
        .object({
          versionId: z.number().int().positive(),
          edition: audioEditionSchema,
        })
        .parse(await req.json());
      const version = (await bibleVersionOptions(database)).find(
        (v) => v.id === input.versionId,
      );
      if (!version) throw new AudioDatabaseError("Version not found", 404);
      const defaults = await loadBaseVoiceDefaults(database, "audio");
      const response = await forward("/v1/audio-projects", {
        version,
        edition: input.edition,
      });
      if (!response.ok) return relay(response);
      const result = (await response.json()) as {
        edition: string;
        number: number;
        count: number;
        projects: unknown[];
      };
      const projects = result.projects.map((value) => {
        const project = audioProjectSchema.parse(value);
        return {
          ...project,
          settings: {
            ...project.settings,
            baseVoice: defaults[project.version.locale].reading,
          },
        };
      });
      await insertAudioProjects(database, projects, outputEnvironment);
      return json(
        { edition: result.edition, number: result.number, count: result.count },
        201,
      );
    }
    if (parts.length < 3 || parts.length > 4)
      return json({ error: "Not found" }, 404);
    const edition = audioEditionSchema.parse(parts[1]),
      book = audioBookSchema.parse(parts[2]);
    const { row, project } = await findAudioProject(
      database,
      edition,
      book,
      outputEnvironment,
    );
    const endpoint = `/v1/audio-projects/${edition}/${book}`;
    const snapshot = {
      project,
      jobId: row.active_job_id,
      sequence: row.job_sequence,
    };
    if (parts.length === 3 && req.method === "PUT")
      return json(
        await saveAudioProject(
          database,
          edition,
          book,
          await req.json(),
          outputEnvironment,
        ),
      );
    if (parts.length === 3 && req.method === "GET") {
      const response = await forward(endpoint, snapshot);
      if (!response.ok) return relay(response);
      const detail = (await response.json()) as AudioProjectDetail & {
        sequence: number;
      };
      if (row.active_job_id && detail.sequence > row.job_sequence) {
        const { content: _, sequence, ...updated } = detail;
        await applyAudioEvent(database, row.id, row.active_job_id, {
          sequence,
          project: updated,
        });
      }
      // Database revisions are authoritative even when a retained worker snapshot
      // supplies Bible content or helps reconcile an interrupted generation.
      return json({
        ...detail,
        ...(await findAudioProject(database, edition, book, outputEnvironment))
          .project,
      });
    }
    if (parts[3] === "generate" && req.method === "POST") {
      const input = audioGenerateSchema.parse(await req.json());
      if (
        input.chapter &&
        (input.chapter > project.chapterCount ||
          (input.verse && input.verse > project.verseCounts[input.chapter - 1]))
      )
        throw new AudioDatabaseError("Verse not found.", 400);
      const models = await loadNarrationModels(database),
        styles = await loadNarrationStyles(database),
        readingParameters = await loadReadingNarrationOverrides(
          database,
          "audio",
        );
      const job = await beginAudioJob(
        database,
        edition,
        book,
        outputEnvironment,
        await loadAudioVersePause(database),
      );
      try {
        const response = await forward(`${endpoint}/generate`, {
          project: job.project,
          jobId: job.jobId,
          sequence: 0,
          input: {
            ...input,
            voiceModel: models[project.version.locale],
            voiceParameters: resolveReadingNarrationParameters(
              resolveNarrationStyle(styles[project.version.locale]),
              readingParameters[project.version.locale],
            ),
          },
          callback: {
            url: `${url.origin}/api/audio-project-events/${job.id}/${job.jobId}`,
            token: job.token,
          },
        });
        if (!response.ok) {
          await failAudioJob(database, job.id, job.jobId);
          return relay(response);
        }
        return json({ queued: true }, 202);
      } catch (error) {
        // A network timeout may occur after the worker accepted the job. Keep the
        // job fence: its callback or the next inspection will reconcile it safely.
        console.error("Audio generation dispatch uncertain", String(error));
        return json({ queued: true }, 202);
      }
    }
    if (parts[3] === "media" && req.method === "GET") {
      const response = await forward(
        `${endpoint}/media${url.search}`,
        snapshot,
      );
      if (!response.ok && response.status !== 416) return relay(response);
      const headers = new Headers({ "Cache-Control": "no-store" });
      for (const name of [
        "content-type",
        "content-length",
        "accept-ranges",
        "content-range",
        "content-disposition",
      ])
        if (response.headers.has(name))
          headers.set(name, response.headers.get(name)!);
      return new Response(response.body, { status: response.status, headers });
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error(
      "Audio request failed",
      error instanceof Error ? error.message : String(error),
    );
    return json(
      {
        error: translateServer(
          error instanceof AudioDatabaseError
            ? error.message
            : "Could not complete the audio request. Check that generation is available and try again.",
          requestLanguage(req),
        ),
      },
      error instanceof AudioDatabaseError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : 503,
    );
  }
}
