import { projectProposalsSchema, syncVideoProjects } from "./project-proposals";
import {
  existingProjectsSchema,
  syncExistingProjects,
} from "./existing-projects";
import { type BibleVersion } from "./bible-versions";
import { z } from "zod";
import { settingsSchema, renderSchema } from "./video-schema";
import { videoFetch } from "./video-client";
import {
  loadProjectSettings,
  versionProjectSettings,
} from "./project-settings";
import { loadVoiceSettings } from "./voice-settings";
import { loadSocialSettings } from "./social-settings";
import {
  bibleBooksSchema,
  manualVideoProjectSchema,
  validateManualVideoProject,
} from "./manual-video-project";
import { requestLanguage, translateServer } from "./i18n-server";

const outputEnvironment =
  process.env.NODE_ENV === "production" ? "production" : "development";
const select =
  "SELECT p.*,p.id project_id,v.id version_id,v.code version_code,v.locale,v.label FROM video_projects p JOIN bible_versions v ON v.id=p.bible_version_id";
type Project = {
  id: number;
  project_id: number;
  kind: "short" | "long";
  passage: string;
  slug: string;
  settings: string;
  title: string;
  version_id: number;
  version_code: string;
  locale: "es" | "en" | "pt";
  label: string;
  output_environment: "production" | "development";
};
export async function videoApi(
  req: Request,
  database: D1Database,
): Promise<Response | null> {
  const lang = requestLanguage(req);
  const json = (value: unknown, status = 200) => {
    let payload = value;
    if (
      value &&
      typeof value === "object" &&
      "error" in value &&
      typeof (value as { error?: unknown }).error === "string"
    ) {
      payload = {
        ...value,
        error: translateServer((value as { error: string }).error, lang),
      };
    }
    return Response.json(payload, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  };
  const url = new URL(req.url),
    parts = url.pathname.slice(5).split("/"),
    method = req.method;
  if (parts[0] === "summary" && method === "GET")
    return json({
      projects: (
        await database
          .prepare(
            "SELECT kind,count(*) total FROM video_projects GROUP BY kind",
          )
          .all()
      ).results,
      published: await database
        .prepare("SELECT count(*) total FROM video_projects WHERE published=1")
        .first(),
      unpublished: await database
        .prepare("SELECT count(*) total FROM video_projects WHERE published=0")
        .first(),
      recent: (
        await database
          .prepare(`${select} ORDER BY p.updated_at DESC LIMIT 8`)
          .all()
      ).results,
    });
  if (parts[0] === "generation-queue" && method === "GET") {
    try {
      const response = await videoFetch("/v1/queue");
      if (!response.ok) throw new Error("Queue unavailable");
      const data = (await response.json()) as {
        items: { projectId: number; kind: string; status: string }[];
        summary: { progress: number; completed: number; total: number };
      };
      const projects = (await database.prepare(select).all<Project>()).results;
      return json({
        connected: true,
        summary: data.summary,
        items: data.items
          .filter((item) => ["queued", "running"].includes(item.status))
          .flatMap((item) => {
            const project = projects.find(
              (row) => row.id === item.projectId && row.kind === item.kind,
            );
            return project
              ? [
                  {
                    ...item,
                    title: project.title,
                    version: project.version_code,
                    href: `/${item.kind === "short" ? "short-videos" : "long-videos"}/${project.id}`,
                  },
                ]
              : [];
          }),
      });
    } catch {
      return json({
        connected: false,
        items: [],
        summary: { progress: 0, completed: 0, total: 0 },
      });
    }
  }
  if (parts[0] !== "videos") return null;
  if (!parts[1] && method === "GET") {
    const kind = z.enum(["short", "long"]).parse(url.searchParams.get("kind"));
    const version = url.searchParams.get("version");
    return json({
      videos: (
        await database
          .prepare(
            `${select} WHERE p.kind=?${version && version !== "all" ? " AND v.id=?" : ""} ORDER BY p.id ASC`,
          )
          .bind(
            ...(version && version !== "all"
              ? [kind, z.coerce.number().int().positive().parse(version)]
              : [kind]),
          )
          .all()
      ).results,
    });
  }
  if (!parts[1] && method === "POST") {
    const raw = await req.json();
    const input = manualVideoProjectSchema.parse(raw);
    const version = await database
      .prepare("SELECT * FROM bible_versions WHERE id=?")
      .bind(input.versionId)
      .first<BibleVersion>();
    if (!version) return json({ error: "Version not found" }, 404);
    let books;
    try {
      const response = await videoFetch(
        "/v1/bible-versions/books?" +
          new URLSearchParams({
            locale: version.locale,
            version: version.code,
          }),
      );
      if (!response.ok) throw new Error("Bible books unavailable");
      books = bibleBooksSchema.parse(
        ((await response.json()) as { books: unknown }).books,
      );
    } catch (error) {
      console.error("Bible books unavailable", error);
      return json(
        {
          error:
            "Books could not be loaded. Check that this version is available and try again.",
        },
        502,
      );
    }
    validateManualVideoProject(input, books);
    const passage = {
      id: input.slug,
      book: input.start.book,
      endBook: input.end.book,
      ...(input.kind === "long" ? { episode: input.episode } : {}),
      start: { chapter: input.start.chapter, verse: input.start.verse },
      end: { chapter: input.end.chapter, verse: input.end.verse },
    };
    const existing = await database
      .prepare(
        `${select} WHERE p.kind=? AND p.slug=? AND v.locale=? AND v.code=?`,
      )
      .bind(input.kind, input.slug, version.locale, version.code)
      .first<Project>();
    if (existing)
      return json(
        {
          error:
            "A project with this short name already exists for the selected version.",
        },
        409,
      );
    const settings = settingsSchema.parse(
      versionProjectSettings(
        await loadProjectSettings(database, input.kind),
        version.locale,
        version.code,
      ),
    );
    const result = await database
      .prepare(
        "INSERT INTO video_projects(kind,bible_version_id,slug,title,passage,settings,output_environment) VALUES (?,?,?,?,?,?,?)",
      )
      .bind(
        input.kind,
        version.id,
        input.slug,
        input.title,
        JSON.stringify(passage),
        JSON.stringify(settings),
        outputEnvironment,
      )
      .run();
    return json({ id: result.meta.last_row_id }, 201);
  }
  if (parts[1] === "sync" && !parts[2] && method === "POST") {
    const kind = z.enum(["short", "long"]).parse(url.searchParams.get("kind"));
    const input = z
      .object({ versionId: z.number().int().positive() })
      .parse(await req.json());
    const version = await database
      .prepare("SELECT * FROM bible_versions WHERE id=?")
      .bind(input.versionId)
      .first<BibleVersion>();
    if (!version) return json({ error: "Version not found" }, 404);
    let proposals: unknown;
    try {
      const query = new URLSearchParams({
        kind,
        locale: version.locale,
        version: version.code,
      });
      const response = await videoFetch("/v1/video-project-proposals?" + query);
      if (!response.ok) throw new Error("Project proposal discovery failed");
      proposals = ((await response.json()) as { proposals?: unknown })
        .proposals;
      projectProposalsSchema.parse(proposals);
    } catch (cause) {
      console.error("Project proposal discovery failed", cause);
      return json(
        {
          error:
            "Projects could not be synced. Check that generation is available and try again.",
        },
        502,
      );
    }
    return json(
      await syncVideoProjects(
        database,
        kind,
        version,
        proposals,
        outputEnvironment,
      ),
    );
  }
  if (parts[1] === "sync-existing" && !parts[2] && method === "POST") {
    const kind = z.enum(["short", "long"]).parse(url.searchParams.get("kind"));
    let data;
    try {
      const response = await videoFetch(
        `/v1/projects/existing?kind=${kind}&outputEnvironment=${outputEnvironment}`,
      );
      if (!response.ok) throw new Error("Existing project discovery failed");
      data = existingProjectsSchema.parse(await response.json());
    } catch (cause) {
      console.error("Existing project discovery failed", cause);
      return json(
        {
          error:
            "Could not sync existing projects. Check that generation is available and try again.",
        },
        502,
      );
    }
    return json(
      await syncExistingProjects(database, kind, data, outputEnvironment),
    );
  }
  const id = z.coerce.number().int().positive().parse(parts[1]);
  const project = await database
    .prepare(`${select} WHERE p.id=?`)
    .bind(id)
    .first<Project>();
  if (
    !project ||
    (url.searchParams.get("kind") &&
      url.searchParams.get("kind") !== project.kind)
  )
    return json({ error: "Video not found" }, 404);
  const version = {
    id: project.version_code,
    locale: project.locale,
    label: project.label,
  };
  const query = new URLSearchParams({
    kind: project.kind,
    version: project.version_code,
    passage: project.slug,
    outputEnvironment: project.output_environment,
  });
  const state = async () => {
    try {
      const response = await videoFetch(`/v1/projects/${id}/state?${query}`);
      if (!response.ok) throw new Error("State unavailable");
      return (await response.json()) as {
        status: string;
        result: unknown;
        progress: number;
      };
    } catch {
      return { status: "unavailable", result: null, progress: 0 };
    }
  };
  if (!parts[2] && method === "GET") {
    const current = await state();
    return json({
      video: {
        ...project,
        status: current.status,
        progress: current.progress,
        result: current.result ? JSON.stringify(current.result) : null,
      },
      defaults: settingsSchema.parse(
        versionProjectSettings(
          await loadProjectSettings(database, project.kind),
          project.locale,
          project.version_code,
        ),
      ),
    });
  }
  if (!parts[2] && method === "PATCH") {
    const input = z
      .object({
        settings: settingsSchema.optional(),
        published: z.boolean().optional(),
      })
      .parse(await req.json());
    if (["queued", "running"].includes((await state()).status))
      return json({ error: "Wait for generation to finish" }, 409);
    await database
      .prepare(
        "UPDATE video_projects SET settings=COALESCE(?,settings),published=COALESCE(?,published),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
      )
      .bind(
        input.settings ? JSON.stringify(input.settings) : null,
        input.published === undefined ? null : Number(input.published),
        id,
      )
      .run();
    return json({ ok: true });
  }
  if (parts[2] === "media" && method === "GET") {
    const asset = z
      .union([
        z.enum(["video", "thumbnail", "intro", "outro"]),
        z.string().regex(/^reading-\d+$/),
        z.string().regex(/^preview-[0-9a-f-]{36}-\d+$/),
      ])
      .parse(url.searchParams.get("asset"));
    const response = await videoFetch(
      `/v1/projects/${id}/media/${asset}?${query}`,
      {
        headers: req.headers.has("range")
          ? { Range: req.headers.get("range")! }
          : {},
      },
    );
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    if (url.searchParams.has("download"))
      headers.set(
        "Content-Disposition",
        `attachment; filename="${project.slug}.${asset === "thumbnail" ? "jpg" : "mp4"}"`,
      );
    return new Response(response.body, { status: response.status, headers });
  }
  if (parts[2] === "voices" && method === "GET") {
    const response = await videoFetch(`/v1/projects/${id}/voices?${query}`);
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
  if (
    method === "POST" &&
    ["analyze", "voices", "render", "preview"].includes(parts[2])
  ) {
    const values = (await req.json()) as Record<string, unknown>;
    const settings = settingsSchema.parse(
      parts[2] === "voices"
        ? JSON.parse(project.settings)
        : parts[2] === "render"
          ? { ...values, reuseVoices: true, clipAudioMode: "voice" }
          : values,
    );
    const voiceTemplates = (await loadVoiceSettings(database, project.kind))[
      project.locale
    ];
    const common = {
      projectId: id,
      kind: project.kind,
      outputEnvironment: project.output_environment,
      version,
      passage: JSON.parse(project.passage),
      settings,
      voiceTemplates,
    };
    if (parts[2] === "voices") {
      const part = z.enum(["intro", "outro"]).parse(values.part);
      if (!voiceTemplates[part])
        return json(
          {
            error: "Configure narration scripts in Settings before generating.",
          },
          400,
        );
      const response = await videoFetch(`/v1/projects/${id}/voices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...common, part }),
      });
      return new Response(response.body, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (parts[2] === "analyze") {
      const response = await videoFetch("/v1/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(common),
      });
      return new Response(response.body, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    const request = renderSchema.parse({
      ...common,
      id: crypto.randomUUID(),
      socialAccounts: (await loadSocialSettings(database))[project.locale],
    });
    const response = await videoFetch(
      parts[2] === "preview" ? "/v1/preview" : "/v1/jobs",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        ...(parts[2] === "preview"
          ? { signal: AbortSignal.timeout(120000) }
          : {}),
      },
    );
    if (response.ok && parts[2] !== "preview")
      await database
        .prepare(
          "UPDATE video_projects SET settings=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
        )
        .bind(JSON.stringify(settings), id)
        .run();
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  return json({ error: "Video not found" }, 404);
}
