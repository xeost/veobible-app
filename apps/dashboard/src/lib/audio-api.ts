import { outputEnvironment as requestOutputEnvironment } from "./output-environment";
import {
  loadVoiceStyleDefaults,
  selectedVoiceStyleParameters,
} from "./voice-style-presets";
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
import { bindings } from "./env";
import { signMediaAccess } from "../../../../tools/api-proxy/src/media-access.mjs";
import {
  audioEditorHeader,
  audioEditorState,
  type AudioEditorHeader,
} from "./audio-editor-state";
import { audioMediaUrl } from "./audio-media";
import { bibleVersionOptions } from "./bible-versions";
import { loadBaseVoiceDefaults, resolveAudioBaseVoice } from "./base-voices";
import {
  loadNarrationModels,
  selectedNarrationDecoder,
  selectedNarrationTextAdaptations,
} from "./narration-models";
import {
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
  saveAudioVerseApproval,
  beginAudioJob,
  failAudioJob,
  applyAudioEvent,
} from "./audio-projects";
export async function audioApi(
  req: Request,
  database: D1Database,
  retryFinishedSession = true,
): Promise<Response | null> {
  const url = new URL(req.url),
    parts = url.pathname.slice(5).split("/");
  if (parts[0] !== "audios") return null;
  const outputEnvironment = requestOutputEnvironment();
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
            inheritBaseVoice: true,
            voiceDefaultsVersion: 1,
            narrationPreset: undefined,
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
    const editorMediaAccess = async (
      header: Pick<AudioEditorHeader, "book_order" | "chapter_count">,
    ) => {
      const expiresAt = Date.now() + 60 * 60 * 1000;
      const path = `/v1/audio-projects/${edition}/${book}/`;
      const query = new URLSearchParams({
        outputEnvironment,
        order: String(header.book_order),
        chapterCount: String(header.chapter_count),
      });
      const token = await signMediaAccess(
        { path, query: query.toString(), origin: url.origin, expiresAt },
        bindings().DASHBOARD_API_PROXY_TOKEN,
      );
      return {
        base: `${bindings().VIDEO_API_URL.replace(/\/$/, "")}${path}`,
        query: `${query}&mediaToken=${encodeURIComponent(token)}`,
        expiresAt,
      };
    };
    if (
      ["state", "content", "media-access", "original"].includes(parts[3]) &&
      (req.method === "GET" ||
        (parts[3] === "original" && req.method === "POST"))
    ) {
      const header = await audioEditorHeader(
        database,
        edition,
        book,
        outputEnvironment,
      );
      if (parts[3] === "media-access")
        return json({ mediaAccess: await editorMediaAccess(header) });
      if (parts[3] === "original")
        return relay(
          await forward(
            `/v1/audio-projects/${edition}/${book}/original${url.search}`,
            {
              project: {
                edition,
                book,
                version: {
                  id: header.bible_version_id,
                  code: header.code,
                  locale: header.locale,
                  label: header.label,
                },
                order: header.book_order,
                chapterCount: header.chapter_count,
              },
              start: req.method === "POST",
            },
          ),
        );
      if (parts[3] === "content") {
        const response = await forward(
          `/v1/audio-projects/${edition}/${book}/content`,
          {
            version: {
              id: header.bible_version_id,
              code: header.code,
              locale: header.locale,
              label: header.label,
            },
            chapterCount: header.chapter_count,
            order: header.book_order,
          },
        );
        if (!response.ok) return relay(response);
        // Stream Bible text without decoding and re-encoding the full book in the Worker.
        return new Response(response.body, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      }
      const since = url.searchParams.has("revision")
        ? z.coerce
            .number()
            .int()
            .nonnegative()
            .parse(url.searchParams.get("revision"))
        : null;
      return audioEditorState(
        database,
        header,
        since,
        forward,
        async (current) => {
          const [mediaAccess, voices, styles] = await Promise.all([
            editorMediaAccess(current),
            loadBaseVoiceDefaults(database, "audio"),
            loadVoiceStyleDefaults(database, "audio"),
          ]);
          return {
            mediaAccess,
            baseVoiceDefaults: voices[current.locale],
            voiceStyleDefaults: styles[current.locale],
          };
        },
      );
    }
    const { row, project } = await findAudioProject(
      database,
      edition,
      book,
      outputEnvironment,
    );
    const endpoint = `/v1/audio-projects/${edition}/${book}`;
    const mediaAccess = () =>
      editorMediaAccess({
        book_order: project.order,
        chapter_count: project.chapterCount,
      });
    if (
      ["media", "original-media"].includes(parts[3]) &&
      req.method === "GET"
    ) {
      const chapter = z.coerce
        .number()
        .int()
        .positive()
        .max(project.chapterCount)
        .parse(url.searchParams.get("chapter"));
      const verse = url.searchParams.has("verse")
        ? z.coerce
            .number()
            .int()
            .positive()
            .parse(url.searchParams.get("verse"))
        : undefined;
      const original = parts[3] === "original-media";
      const asset = verse
        ? project.recordings[`${chapter}:${verse}`]
        : project.chapters[String(chapter)];
      if (!original && !asset)
        throw new AudioDatabaseError("Audio is not ready yet.", 404);
      const target = new URL(
        audioMediaUrl(
          await mediaAccess(),
          chapter,
          verse,
          url.searchParams.get("revision") ?? "",
          asset?.file,
          original,
        ),
      );
      for (const name of ["download", "waveform"])
        if (url.searchParams.has(name))
          target.searchParams.set(name, url.searchParams.get(name)!);
      return new Response(null, {
        status: 302,
        headers: {
          Location: target.href,
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    }
    const snapshot = {
      project,
      jobId: row.active_job_id,
      sequence: row.job_sequence,
    };
    if (parts[3] === "clean-editing-files" && req.method === "POST") {
      const input = z
        .object({
          chapter: z.number().int().positive().max(project.chapterCount),
          revision: z.number().int().nonnegative(),
        })
        .parse(await req.json());
      const job = await beginAudioJob(
        database,
        edition,
        book,
        outputEnvironment,
        undefined,
        input.revision,
      );
      try {
        const response = await forward(`${endpoint}/clean-editing-files`, {
          project: job.project,
          jobId: job.jobId,
          sequence: 0,
          chapter: input.chapter,
        });
        if (!response.ok) {
          await failAudioJob(database, job.id, job.jobId);
          return relay(response);
        }
        await applyAudioEvent(
          database,
          job.id,
          job.jobId,
          await response.json(),
        );
        return json(
          (await findAudioProject(database, edition, book, outputEnvironment))
            .project,
        );
      } catch (error) {
        await failAudioJob(database, job.id, job.jobId);
        throw error;
      }
    }
    if (parts.length === 4 && parts[3] === "approval" && req.method === "PUT")
      return json(
        await saveAudioVerseApproval(
          database,
          edition,
          book,
          await req.json(),
          outputEnvironment,
        ),
      );
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
        const {
          content: _,
          originalChapters: __,
          sequence,
          ...updated
        } = detail;
        await applyAudioEvent(database, row.id, row.active_job_id, {
          sequence,
          project: updated,
        });
      }
      // Database revisions are authoritative even when a retained worker snapshot
      // supplies Bible content or helps reconcile an interrupted generation.
      return json({
        ...detail,
        mediaAccess: await mediaAccess(),
        ...(await findAudioProject(database, edition, book, outputEnvironment))
          .project,
        baseVoiceDefaults: (await loadBaseVoiceDefaults(database, "audio"))[
          project.version.locale
        ],
        voiceStyleDefaults: (await loadVoiceStyleDefaults(database, "audio"))[
          project.version.locale
        ],
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
        styleDefaults = await loadVoiceStyleDefaults(database, "audio");
      const active =
        row.active_job_id && ["queued", "running"].includes(project.status);
      const job = active
        ? null
        : await beginAudioJob(
            database,
            edition,
            book,
            outputEnvironment,
            await loadAudioVersePause(database),
          );
      try {
        const generationProject = job?.project ?? project;
        const response = await forward(`${endpoint}/generate`, {
          project: {
            ...generationProject,
            settings: resolveAudioBaseVoice(
              generationProject.settings,
              project.version.locale,
              await loadBaseVoiceDefaults(database, "audio"),
            ),
          },
          jobId: job?.jobId ?? row.active_job_id,
          sequence: job ? 0 : row.job_sequence,
          append: Boolean(active),
          input: {
            ...input,
            voiceModel: models[project.version.locale],
            voiceTextAdaptations: selectedNarrationTextAdaptations(
              models,
              project.version.locale,
            ),
            voiceDecoder: selectedNarrationDecoder(
              models,
              project.version.locale,
            ),
            voiceParameters: selectedVoiceStyleParameters(
              resolveNarrationStyle(styles[project.version.locale]),
              styleDefaults[project.version.locale],
              { reading: project.settings.narrationPreset },
              "reading",
            ),
          },
          ...(job
            ? {
                callback: {
                  url: `${url.origin}/api/audio-project-events/${job.id}/${job.jobId}`,
                  token: job.token,
                  format: "patch-v1",
                },
              }
            : {}),
        });
        if (response.status === 409 && active && retryFinishedSession) {
          const latest = await findAudioProject(
            database,
            edition,
            book,
            outputEnvironment,
          );
          if (!["queued", "running"].includes(latest.project.status))
            return audioApi(
              new Request(req.url, {
                method: "POST",
                headers: req.headers,
                body: JSON.stringify(input),
              }),
              database,
              false,
            );
        }
        if (!response.ok) {
          if (job) await failAudioJob(database, job.id, job.jobId);
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
