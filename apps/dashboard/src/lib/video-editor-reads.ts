import { settingsSchema } from "./video-schema";
import { loadBaseVoiceDefaults, projectBaseVoice } from "./base-voices";
import {
  loadNarrationModels,
  selectedNarrationDecoder,
  selectedNarrationTextAdaptations,
} from "./narration-models";
import {
  loadNarrationStyles,
  resolveNarrationStyle,
} from "./narration-parameters";
import {
  loadVoiceStyleDefaults,
  selectedVoiceStyleParameters,
} from "./voice-style-presets";
import { inheritVideoVoiceDefaults } from "./project-voice-defaults";
import { loadLoudnessSettings } from "./loudness-settings";
import { z } from "zod";

type ReadScope = {
  id: number;
  kind: "short" | "long" | "book";
  slug: string;
  passage: string;
  version_code: string;
  locale: "en" | "es" | "pt";
  voice_settings?: string;
};
const contexts = new WeakMap<D1Database, Map<string, string>>();

/** Compare exact saved values, not timestamps/TTLs: another tab's settings take
 * effect immediately, even for two edits within the same clock tick. */
export async function videoVoiceReadQuery(
  database: D1Database,
  scope: ReadScope,
  environment: string,
) {
  const keys = [
    "voice_generation_models",
    "voice_generation_parameters",
    `base_voice_defaults:${scope.kind}`,
    `voice_style_defaults:${scope.kind}`,
    `reading_voice_parameters:${scope.kind}`,
  ];
  const rows = (
    await database
      .prepare(
        `SELECT key,value FROM site_settings WHERE key IN (${keys.map(() => "?").join(",")}) ORDER BY key`,
      )
      .bind(...keys)
      .all<{ key: string; value: string }>()
  ).results;
  const key = JSON.stringify([scope, environment, rows]);
  let cache = contexts.get(database);
  if (!cache) {
    cache = new Map();
    contexts.set(database, cache);
  }
  const cached = cache.get(key);
  if (cached) return new URLSearchParams(cached);
  const values = new Map(rows.map((row) => [row.key, row.value]));
  // Reuse the existing loaders/validation against this single consistent read.
  const snapshot = {
    prepare(query: string) {
      if (query !== "SELECT value FROM site_settings WHERE key=?")
        throw new Error("Unsupported settings snapshot query");
      return {
        bind(key: string) {
          return {
            async first() {
              return values.has(key) ? { value: values.get(key) } : null;
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  const [models, styles, defaults, styleDefaults] = await Promise.all([
    loadNarrationModels(snapshot),
    loadNarrationStyles(snapshot),
    loadBaseVoiceDefaults(snapshot, scope.kind),
    loadVoiceStyleDefaults(snapshot, scope.kind),
  ]);
  const voiceSettingsSchema = settingsSchema.pick({
    voiceDefaultsVersion: true,
    baseVoice: true,
    baseVoices: true,
    inheritedBaseVoiceRoles: true,
    voiceStylePresets: true,
  });
  let settings = voiceSettingsSchema.parse(
    Object.fromEntries(
      Object.entries(JSON.parse(scope.voice_settings ?? "{}")).filter(
        ([, value]) => value !== null,
      ),
    ),
  );
  if (settings.voiceDefaultsVersion !== 1)
    settings = inheritVideoVoiceDefaults(
      settings,
      defaults[scope.locale],
      styleDefaults[scope.locale],
    );
  const decoder = selectedNarrationDecoder(models, scope.locale);
  const adaptations = selectedNarrationTextAdaptations(models, scope.locale);
  const query = new URLSearchParams({
    kind: scope.kind,
    version: scope.version_code,
    passage: scope.slug,
    locale: scope.locale,
    passageRange: scope.passage,
    outputEnvironment: environment,
    voiceModel: models[scope.locale],
    ...(decoder ? { voiceDecoder: decoder } : {}),
    ...(adaptations
      ? { voiceTextAdaptations: JSON.stringify(adaptations) }
      : {}),
    baseVoice: projectBaseVoice(
      settings,
      scope.locale,
      "intro",
      defaults[scope.locale],
    ),
    voiceParameters: JSON.stringify(
      selectedVoiceStyleParameters(
        resolveNarrationStyle(styles[scope.locale]),
        styleDefaults[scope.locale],
        settings.voiceStylePresets as Parameters<
          typeof selectedVoiceStyleParameters
        >[2],
        "intro",
      ),
    ),
  });
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(key, query.toString());
  return query;
}

type Forward = (path: string) => Promise<Response>;
export async function videoEditorRead(
  req: Request,
  database: D1Database,
  id: number,
  environment: string,
  forward: Forward,
  signAccess: (path: string, query: URLSearchParams) => Promise<object>,
): Promise<Response | null> {
  const url = new URL(req.url),
    action = url.pathname.split("/")[4];
  if (
    req.method !== "GET" ||
    url.pathname.split("/").length !== 5 ||
    !["state", "alignment", "voices", "media-access"].includes(action)
  )
    return null;
  const voiceContext = action === "voices" || action === "media-access";
  const scope = await database
    .prepare(
      `SELECT p.id,p.kind,p.slug,p.passage,v.code version_code,v.locale${
        voiceContext
          ? `,
    json_object('voiceDefaultsVersion',json_extract(p.settings,'$.voiceDefaultsVersion'),
      'baseVoice',json_extract(p.settings,'$.baseVoice'),
      'baseVoices',json_extract(p.settings,'$.baseVoices'),
      'inheritedBaseVoiceRoles',json_extract(p.settings,'$.inheritedBaseVoiceRoles'),
      'voiceStylePresets',json_extract(p.settings,'$.voiceStylePresets')) voice_settings`
          : ""
      }
    FROM video_projects p JOIN bible_versions v ON v.id=p.bible_version_id WHERE p.id=?`,
    )
    .bind(id)
    .first<ReadScope>();
  if (
    !scope ||
    (url.searchParams.has("kind") &&
      url.searchParams.get("kind") !== scope.kind)
  )
    return Response.json({ error: "Video not found" }, { status: 404 });
  const query = voiceContext
    ? await videoVoiceReadQuery(database, scope, environment)
    : new URLSearchParams({
        kind: scope.kind,
        version: scope.version_code,
        passage: scope.slug,
        outputEnvironment: environment,
      });
  if (action === "media-access") {
    query.set(
      "loudnessTarget",
      String((await loadLoudnessSettings(database))[scope.locale]),
    );
    return Response.json(
      { mediaAccess: await signAccess(`/v1/projects/${id}/media/`, query) },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  for (const name of ["cursor", "updates"])
    if (url.searchParams.has(name))
      query.set(name, z.string().max(128).parse(url.searchParams.get(name)));
  const response = await forward(`/v1/projects/${id}/${action}?${query}`);
  // Offset arrays and unchanged responses stream through without being parsed.
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
