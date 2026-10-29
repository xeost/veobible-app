import { websiteApi } from "../../../lib/website-api";
import {
  publicationContent,
  contentRevision,
  websiteState,
  publicationChanges,
} from "../../../lib/website";
import { narrationModelSchema } from "../../../../../../tools/video-project-api/src/narration-models";
import { signMediaAccess } from "../../../../../../tools/api-proxy/src/media-access.mjs";
import {
  loadChapterAudioSettings,
  saveChapterAudioSettings,
} from "../../../lib/chapter-audio-settings";
import {
  loadLoudnessSettings,
  saveLoudnessSettings,
} from "../../../lib/loudness-settings";
import {
  loadVisualShortcuts,
  changeVisualShortcut,
  visualShortcutKindSchema,
  VisualShortcutError,
} from "../../../lib/visual-shortcuts";
import {
  loadVoiceStyleDefaults,
  voiceStyleDefaultsSchema,
} from "../../../lib/voice-style-presets";
import {
  voiceSampleRequestSchema,
  resolveVoiceSampleSettings,
} from "../../../lib/voice-sample-settings";
import {
  loadAudioVersePause,
  audioVersePauseSchema,
} from "../../../lib/audio-settings";
import {
  baseVoiceCatalogSchema,
  loadBaseVoiceDefaults,
  saveBaseVoiceDefaults,
  baseVoiceDefaultsSchema,
} from "../../../lib/base-voices";
import { baseVoiceSchema } from "../../../../../../tools/video-project-api/src/base-voice-schema";
import { resolveNarrationStyle } from "../../../lib/narration-parameters";
import {
  loadNarrationStyles,
  loadNarrationPresetLibrary,
  saveNarrationGenerationSettings,
  loadReadingNarrationOverrides,
  readingNarrationOverridesSchema,
} from "../../../lib/narration-parameters";
import {
  loadNarrationModels,
  applyNarrationSelection,
  disabledNarrationChoices,
  narrationModelsSchema,
} from "../../../lib/narration-models";
import {
  loadPublicationSettings,
  savePublicationSettings,
} from "../../../lib/publication-settings";
import { bibleBooksSchema } from "../../../lib/manual-video-project";
import {
  bibleVersionSchema,
  syncBibleVersions,
  listBibleVersions,
  bibleVersionOptions,
  saveBibleVersion,
  deleteBibleVersion,
  BibleVersionError,
} from "../../../lib/bible-versions";
import {
  loadProjectSettings,
  saveProjectSettings,
} from "../../../lib/project-settings";
import {
  isDeployHookUrl,
  deploymentStatus,
  type BuildStatus,
} from "../../../lib/deployments";
import { profileSchema, saveProfile, ProfileError } from "../../../lib/profile";
import { userMessage } from "../../../lib/presentation";
import { db, bindings } from "../../../lib/env";
import { currentUser, createUserToken } from "../../../lib/auth";
import {
  passwordHash,
  verifyPassword,
  sessionCookie,
} from "../../../lib/security";
import { videoFetch } from "../../../lib/video-client";
import { videoApi } from "../../../lib/video-api";
import { audioApi } from "../../../lib/audio-api";
import { audioProjectCallback } from "../../../lib/audio-projects";
import {
  localModelsSchema,
  localModelRemovalTargets,
  localModelDownloadSchema,
  localModelUpdateSchema,
} from "../../../lib/local-models";
import { z } from "zod";
import {
  loadVoiceSettings,
  saveVoiceSettings,
} from "../../../lib/voice-settings";
import {
  loadSocialSettings,
  saveSocialSettings,
} from "../../../lib/social-settings";
import { requestLanguage, translateServer } from "../../../lib/i18n-server";
import type { Language } from "../../../i18n/context";

const createJson =
  (lang: Language) =>
  (value: unknown, status = 200, headers: HeadersInit = {}) => {
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
      headers: { "Cache-Control": "no-store", ...headers },
    });
  };

const userSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_.-]{3,60}$/),
  name: z.string().min(1).max(100),
  email: z.string().email().or(z.literal("")).default(""),
  role: z.enum(["admin", "editor"]),
  password: z.string().min(12).max(256),
});
async function handle(req: Request, lang: Language) {
  const json = createJson(lang);
  const url = new URL(req.url);
  const parts = url.pathname.slice(5).split("/");
  const method = req.method;
  const database = db();
  const body = async () => {
    if (Number(req.headers.get("content-length") || 0) > 1024 * 1024)
      throw new Error("Request too large");
    return req.json();
  };
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("veo_session="))
    ?.slice(12);
  const secure = url.protocol === "https:";
  const audioCallback = await audioProjectCallback(req, database);
  if (audioCallback) return audioCallback;
  if (method !== "GET" && req.headers.get("origin") !== url.origin)
    return json({ error: "Origin not allowed" }, 403);
  if (parts.join("/") === "auth/login" && method === "POST") {
    const input = z
      .object({
        username: z.string().min(1).max(60),
        password: z.string().min(1).max(256),
      })
      .parse(await body());
    const user = await database
      .prepare("SELECT * FROM dashboard_users WHERE username=? AND active=1")
      .bind(input.username)
      .first<{ id: number; password_hash: string }>();
    if (!user || !(await verifyPassword(input.password, user.password_hash)))
      return json({ error: "Incorrect username or password" }, 401);
    const token = await createUserToken(user.id);
    return json({ ok: true }, 200, {
      "Set-Cookie": sessionCookie(token, secure),
    });
  }
  const user = await currentUser(cookie ?? "");
  if (!user) return json({ error: "Sign in" }, 401);
  const admin = () => {
    if (user.role !== "admin") throw new Error("Administrator required");
  };
  if (parts[0] === "website") {
    admin();
    return websiteApi(req, database, String(user.id), json);
  }
  if (
    parts[0] === "settings" &&
    parts[1] === "visual-shortcuts" &&
    parts.length <= 3
  ) {
    const kind = visualShortcutKindSchema.parse(url.searchParams.get("kind"));
    if (parts.length === 2 && method === "GET")
      return json({ shortcuts: await loadVisualShortcuts(database, kind) });
    if (parts.length === 2 && method === "POST")
      return json(
        {
          shortcuts: await changeVisualShortcut(
            database,
            kind,
            "add",
            await body(),
          ),
        },
        201,
      );
    if (
      parts.length === 3 &&
      (method === "PUT" || method === "DELETE" || method === "PATCH")
    ) {
      const id = z.string().uuid().parse(parts[2]);
      return json({
        shortcuts: await changeVisualShortcut(
          database,
          kind,
          method === "PATCH" ? "move" : method === "PUT" ? "update" : "remove",
          method !== "DELETE" ? await body() : undefined,
          id,
        ),
      });
    }
  }
  const audioResponse = await audioApi(req, database);
  if (audioResponse) return audioResponse;
  if (
    parts.length === 4 &&
    parts[0] === "admin-tools" &&
    parts[1] === "local-models" &&
    parts[3] === "updates" &&
    method === "GET"
  ) {
    const id = z
      .string()
      .regex(/^local-model-[1-9]\d*$/)
      .parse(parts[2]);
    try {
      const response = await videoFetch(`/v1/local-models/${id}/updates`);
      if (!response.ok) throw new Error("Local model update check failed");
      const result = localModelUpdateSchema.parse(await response.json());
      const inventory = applyNarrationSelection(
        { checkedAt: result.checkedAt, models: [result.model] },
        await loadNarrationModels(database),
      );
      return json({ ...result, model: inventory.models[0] });
    } catch (cause) {
      console.error("Local model update check failed", cause);
      return json(
        {
          error:
            "Could not check model updates. Check that generation is available and try again.",
        },
        502,
      );
    }
  }
  const modelInventory = async () => {
    const response = await videoFetch("/v1/local-models?refresh=1");
    if (!response.ok) throw new Error("Local model inventory unavailable");
    return applyNarrationSelection(
      localModelsSchema.parse(await response.json()),
      await loadNarrationModels(database),
    );
  };
  if (
    parts.length === 3 &&
    parts[0] === "admin-tools" &&
    parts[1] === "local-models" &&
    ["DELETE", "PATCH"].includes(method)
  ) {
    admin();
    const input = z
      .object({ repository: z.string(), variant: z.string() })
      .strict()
      .parse(await body());
    try {
      const inventory = await modelInventory();
      const model = inventory.models.find(
        (item) =>
          item.id === parts[2] &&
          item.repository === input.repository &&
          item.variant === input.variant,
      );
      if (!model)
        return json(
          { error: "The model list changed. Refresh it and try again." },
          409,
        );
      if (
        method === "DELETE" &&
        localModelRemovalTargets(inventory.models, model.repository).some(
          (item) => item.uses.length > 0,
        )
      )
        return json(
          {
            error:
              "This model is in use. Choose another model in settings before removing its weights.",
          },
          409,
        );
      const response = await videoFetch(
        `/v1/local-models/${encodeURIComponent(model.id)}`,
        {
          method,
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(75_000),
        },
      );
      if (!response.ok) {
        if (
          response.status === 409 &&
          ((await response.json()) as { error?: string }).error ===
            "Download this model before enabling it."
        )
          return json(
            { error: "Download this model before enabling it." },
            409,
          );
        if (response.status === 409)
          return json(
            {
              error:
                "Wait for generation to finish, refresh the model list and try again.",
            },
            409,
          );
        throw new Error("Model change failed");
      }
      return json({ ok: true });
    } catch (cause) {
      console.error("Model change failed", cause);
      return json(
        {
          error: "Could not change this model. Refresh the list and try again.",
        },
        502,
      );
    }
  }
  if (
    parts.length === 4 &&
    parts[0] === "admin-tools" &&
    parts[1] === "local-models" &&
    parts[3] === "download" &&
    method === "POST"
  ) {
    admin();
    const id = z
      .string()
      .regex(/^local-model-[1-9]\d*$/)
      .parse(parts[2]);
    const input = z
      .object({ repository: z.string(), variant: z.string() })
      .strict()
      .parse(await body());
    try {
      const response = await videoFetch(`/v1/local-models/${id}/download`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (response.status === 409)
        return json(
          {
            error:
              "Another model operation is in progress or the list changed. Refresh it and try again.",
          },
          409,
        );
      if (!response.ok) throw new Error("Model download start failed");
      const result = (await response.json()) as { download: unknown };
      return json(
        { download: localModelDownloadSchema.parse(result.download) },
        202,
      );
    } catch (cause) {
      console.error("Model download start failed", cause);
      return json(
        {
          error:
            "Could not start the model download. Check that generation is available and try again.",
        },
        502,
      );
    }
  }
  if (parts.join("/") === "admin-tools/voice-generation") {
    if (method === "GET")
      return json({
        disabledModels: disabledNarrationChoices(await modelInventory()),
        models: await loadNarrationModels(database),
        styles: await loadNarrationStyles(database),
        presets: await loadNarrationPresetLibrary(database),
      });
    if (method === "PUT") {
      const input = await body();
      const disabled = disabledNarrationChoices(await modelInventory());
      const selection = narrationModelsSchema.parse(
        (input as { models?: unknown }).models,
      );
      if (
        (["en", "es", "pt"] as const).some((locale) =>
          disabled.includes(selection[locale]),
        )
      )
        return json(
          {
            error:
              "This voice model is disabled. Enable it in administration tools before generating voices.",
          },
          409,
        );
      return json(await saveNarrationGenerationSettings(database, input));
    }
  }
  if (parts.join("/") === "admin-tools/local-models" && method === "GET") {
    try {
      const response = await videoFetch(
        `/v1/local-models${url.searchParams.get("refresh") === "1" ? "?refresh=1" : ""}`,
      );
      if (!response.ok) throw new Error("Local model inventory unavailable");
      return json(
        applyNarrationSelection(
          localModelsSchema.parse(await response.json()),
          await loadNarrationModels(database),
        ),
      );
    } catch (cause) {
      console.error("Local model inventory unavailable", cause);
      return json(
        {
          error:
            "Could not read local model versions. Check that generation is available and try again.",
        },
        502,
      );
    }
  }
  if (parts[0] === "versions") {
    if (parts.length === 2 && parts[1] === "options" && method === "GET")
      return json({ versions: await bibleVersionOptions(database) });
    if (parts.length === 1 && method === "GET")
      return json({ versions: await listBibleVersions(database) });
    if (parts.length === 3 && parts[2] === "books" && method === "GET") {
      const id = z.coerce.number().int().positive().parse(parts[1]);
      const version = await database
        .prepare("SELECT locale,code FROM bible_versions WHERE id=?")
        .bind(id)
        .first<{ locale: string; code: string }>();
      if (!version) return json({ error: "Version not found" }, 404);
      try {
        const response = await videoFetch(
          "/v1/bible-versions/books?" +
            new URLSearchParams({
              locale: version.locale,
              version: version.code,
            }),
        );
        if (!response.ok) throw new Error("Bible books unavailable");
        return json({
          books: bibleBooksSchema.parse(
            ((await response.json()) as { books: unknown }).books,
          ),
        });
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
    }
    admin();
    if (parts.length === 2 && parts[1] === "sync" && method === "POST") {
      let versions: unknown;
      try {
        const response = await videoFetch("/v1/bible-versions");
        if (!response.ok) throw new Error("Version discovery failed");
        versions = ((await response.json()) as { versions?: unknown }).versions;
        z.array(bibleVersionSchema).parse(versions);
      } catch (error) {
        console.error("Bible version discovery failed", error);
        return json(
          {
            error:
              "Versions could not be synced. Check that generation is available and try again.",
          },
          502,
        );
      }
      return json(await syncBibleVersions(database, versions));
    }
    if (parts.length === 1 && method === "POST")
      return json(
        { version: await saveBibleVersion(database, await body()) },
        201,
      );
    if (parts.length === 2) {
      const id = z.coerce.number().int().positive().parse(parts[1]);
      if (method === "PATCH")
        return json({
          version: await saveBibleVersion(database, await body(), id),
        });
      if (method === "DELETE") {
        await deleteBibleVersion(database, id);
        return json({ ok: true });
      }
    }
    return json({ error: "Route not found" }, 404);
  }
  if (parts.join("/") === "settings/base-voices") {
    const kind = z
      .enum(["short", "long", "book", "audio"])
      .parse(url.searchParams.get("kind"));
    if (method === "GET") {
      const [defaults, readingParameters, styles, stylePresets] =
        await Promise.all([
          loadBaseVoiceDefaults(database, kind),
          loadReadingNarrationOverrides(database, kind),
          loadNarrationStyles(database),
          loadVoiceStyleDefaults(database, kind),
        ]);
      return json({
        defaults,
        stylePresets,
        readingParameters,
        ...(kind === "audio"
          ? { versePauseSeconds: await loadAudioVersePause(database) }
          : {}),
        generalParameters: {
          en: resolveNarrationStyle(styles.en),
          es: resolveNarrationStyle(styles.es),
          pt: resolveNarrationStyle(styles.pt),
        },
      });
    }
    if (method === "PUT") {
      admin();
      const input = await body();
      const configuration = z
        .object({
          defaults: baseVoiceDefaultsSchema,
          readingParameters: readingNarrationOverridesSchema.optional(),
          stylePresets: voiceStyleDefaultsSchema.optional(),
          versePauseSeconds:
            kind === "audio"
              ? audioVersePauseSchema.optional()
              : z.never().optional(),
        })
        .strict()
        .safeParse(input);
      const defaults = configuration.success
        ? configuration.data.defaults
        : baseVoiceDefaultsSchema.parse(input);
      const response = await videoFetch("/v1/base-voices");
      if (!response.ok)
        return json({ error: "Could not load voices. Try again." }, 502);
      const catalog = baseVoiceCatalogSchema.parse(await response.json());
      if (
        Object.values(defaults)
          .flatMap((roles) => Object.values(roles))
          .some((id) => !catalog.voices.some((voice) => voice.id === id))
      )
        return json(
          { error: "Choose an available voice for each language." },
          400,
        );
      return json({
        defaults: await saveBaseVoiceDefaults(
          database,
          kind,
          defaults,
          configuration.success
            ? configuration.data.readingParameters
            : undefined,
          configuration.success && kind === "audio"
            ? configuration.data.versePauseSeconds
            : undefined,
          configuration.success ? configuration.data.stylePresets : undefined,
        ),
      });
    }
  }
  if (parts[0] === "base-voices") {
    if (parts.length === 2 && parts[1] === "media-access" && method === "GET") {
      const response = await videoFetch("/v1/base-voices");
      if (!response.ok)
        return json({ error: "Could not load voices. Try again." }, 502);
      const catalog = baseVoiceCatalogSchema.parse(await response.json());
      const expiresAt = Date.now() + 60 * 60 * 1000;
      const env = bindings();
      const voices = await Promise.all(
        catalog.voices.map(async ({ id, locale }) => {
          const path = `/v1/base-voices/${id}/`;
          const token = await signMediaAccess(
            { path, query: "", origin: url.origin, expiresAt },
            env.DASHBOARD_API_PROXY_TOKEN,
          );
          return {
            id,
            locale,
            url: `${env.VIDEO_API_URL.replace(/\/$/, "")}${path}original?mediaToken=${encodeURIComponent(token)}`,
          };
        }),
      );
      return json({ voices, expiresAt });
    }
    if (parts.length === 2 && parts[1] === "about" && method === "GET") {
      try {
        const response = await videoFetch("/v1/base-voices/about");
        if (response.status === 404)
          return json(
            { error: "Voice information is not available yet." },
            404,
          );
        if (!response.ok) throw new Error("Voice information unavailable");
        const document = z
          .object({ markdown: z.string().max(1024 * 1024) })
          .parse(await response.json());
        return json(document);
      } catch (cause) {
        console.error("Could not load voice information", cause);
        return json(
          {
            error:
              "Could not load voice information. Try again or contact the administrator.",
          },
          502,
        );
      }
    }

    if (parts.length === 1 && method === "GET") {
      const response = await videoFetch("/v1/base-voices");
      if (!response.ok)
        return json({ error: "Could not load voices. Try again." }, 502);
      const catalog = baseVoiceCatalogSchema.parse(await response.json());
      const locale = z
        .enum(["es", "en", "pt"])
        .optional()
        .parse(url.searchParams.get("locale") ?? undefined);
      return json({
        voices: catalog.voices.filter(
          (voice) => !locale || voice.locale === locale,
        ),
        presets: await loadNarrationPresetLibrary(database),
      });
    }
    if (parts.length === 3 && parts[2] === "sample") {
      const voice = baseVoiceSchema.parse(parts[1]);
      if (method === "PUT") {
        admin();
        const input = z
          .object({ model: narrationModelSchema, previewId: z.string().uuid() })
          .strict()
          .parse(await body());
        const response = await videoFetch(`/v1/base-voices/${voice}/sample`, {
          method: "PUT",
          body: JSON.stringify(input),
        });
        if (!response.ok)
          return json(
            {
              error:
                "Could not save the voice example. Generate a new example and try again.",
            },
            response.status === 409 ? 409 : 502,
          );
        return json({
          saved: true,
          ...baseVoiceCatalogSchema.parse(await response.json()),
        });
      }
      if (method === "GET") {
        const model = narrationModelSchema
          .optional()
          .parse(url.searchParams.get("model") ?? undefined);
        const previewId = z
          .string()
          .uuid()
          .optional()
          .parse(url.searchParams.get("preview") ?? undefined);
        if (previewId && !model)
          return json(
            { error: "No example has been generated for this voice yet." },
            404,
          );
        const query = new URLSearchParams();
        if (model) query.set("model", model);
        if (previewId) query.set("preview", previewId);
        const response = await videoFetch(
          `/v1/base-voices/${voice}/sample?${query}`,
        );
        if (!response.ok)
          return json(
            { error: "No example has been generated for this voice yet." },
            404,
          );
        return new Response(response.body, {
          headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
        });
      }
      if (method === "POST") {
        admin();
        const input = voiceSampleRequestSchema.parse(await body());
        const { text } = input;
        const locale = z.enum(["es", "en", "pt"]).parse(voice.split("-")[0]);
        const [models, styles] = input.narrationSettings
          ? [input.narrationSettings.models, input.narrationSettings.styles]
          : await Promise.all([
              loadNarrationModels(database),
              loadNarrationStyles(database),
            ]);
        const readingOverride =
          input.role === "reading" && input.kind
            ? input.readingParameters !== undefined
              ? input.readingParameters
              : (await loadReadingNarrationOverrides(database, input.kind))[
                  locale
                ]
            : null;
        const response = await videoFetch(`/v1/base-voices/${voice}/sample`, {
          method: "POST",
          body: JSON.stringify({
            text,
            outputEnvironment:
              process.env.NODE_ENV === "production"
                ? "production"
                : "development",
            ...resolveVoiceSampleSettings(
              locale,
              { models, styles },
              readingOverride,
            ),
          }),
        });
        if (!response.ok)
          return json(
            { error: "Could not generate the example. Try again." },
            502,
          );
        return json(await response.json(), response.status);
      }
    }
  }
  if (parts.join("/") === "settings/voice-templates") {
    const kind = z
      .enum(["short", "long", "book"])
      .parse(url.searchParams.get("kind"));
    if (method === "GET")
      return json({ templates: await loadVoiceSettings(database, kind) });
    if (method === "PUT") {
      admin();
      return json({
        templates: await saveVoiceSettings(database, kind, await body()),
      });
    }
  }
  if (parts.join("/") === "settings/publication-templates") {
    const kind = z
      .enum(["short", "long", "book"])
      .parse(url.searchParams.get("kind"));
    if (method === "GET")
      return json({ templates: await loadPublicationSettings(database, kind) });
    if (method === "PUT") {
      admin();
      return json({
        templates: await savePublicationSettings(database, kind, await body()),
      });
    }
  }
  if (parts.join("/") === "settings/chapter-audio") {
    const kind = z
      .enum(["short", "long", "book"])
      .parse(url.searchParams.get("kind"));
    if (method === "GET")
      return json({ settings: await loadChapterAudioSettings(database, kind) });
    if (method === "PUT") {
      admin();
      return json({
        settings: await saveChapterAudioSettings(database, kind, await body()),
      });
    }
  }
  if (parts.join("/") === "settings/project-settings") {
    const kind = z
      .enum(["short", "long", "book"])
      .parse(url.searchParams.get("kind"));
    if (method === "GET")
      return json({ settings: await loadProjectSettings(database, kind) });
    if (method === "PUT") {
      admin();
      return json({
        settings: await saveProjectSettings(database, kind, await body()),
      });
    }
  }
  if (parts.join("/") === "settings/video-loudness") {
    if (method === "GET")
      return json({ settings: await loadLoudnessSettings(database) });
    if (method === "PUT") {
      admin();
      return json({
        settings: await saveLoudnessSettings(database, await body()),
      });
    }
  }
  if (parts.join("/") === "settings/social-accounts") {
    admin();
    if (method === "GET")
      return json({ accounts: await loadSocialSettings(database) });
    if (method === "PUT")
      return json({
        accounts: await saveSocialSettings(database, await body()),
      });
  }
  if (parts.join("/") === "auth/me" && method === "GET") return json({ user });
  if (parts.join("/") === "auth/logout" && method === "POST") {
    return json({ ok: true }, 200, {
      "Set-Cookie": sessionCookie("", secure, 0),
    });
  }
  if (parts.join("/") === "auth/profile" && method === "PATCH") {
    const input = profileSchema.parse(await body());
    const updated = await saveProfile(database, user, input);
    return json({ ok: true, user: updated }, 200, {
      "Set-Cookie": sessionCookie(await createUserToken(user.id), secure),
    });
  }

  if (parts[0] === "users") {
    admin();
    if (method === "GET")
      return json({
        users: (
          await database
            .prepare(
              "SELECT id,username,name,email,role,active,created_at FROM dashboard_users ORDER BY created_at",
            )
            .all()
        ).results,
      });
    if (method === "POST") {
      const input = userSchema.parse(await body());
      await database
        .prepare(
          "INSERT INTO dashboard_users(username,name,email,role,password_hash) VALUES (?,?,?,?,?)",
        )
        .bind(
          input.username,
          input.name,
          input.email,
          input.role,
          await passwordHash(input.password),
        )
        .run();
      return json({ ok: true }, 201);
    }
    if (method === "PATCH" && parts[1]) {
      const input = z
        .object({
          active: z.boolean().optional(),
          role: z.enum(["admin", "editor"]).optional(),
          password: z.string().min(12).max(256).optional(),
        })
        .parse(await body());
      if (Number(parts[1]) === user.id)
        return json(
          {
            error: "You cannot change your own role or access from this list",
          },
          400,
        );
      await database
        .prepare(
          "UPDATE dashboard_users SET active=COALESCE(?,active),role=COALESCE(?,role),password_hash=COALESCE(?,password_hash),auth_version=auth_version+1 WHERE id=?",
        )
        .bind(
          input.active === undefined ? null : Number(input.active),
          input.role ?? null,
          input.password ? await passwordHash(input.password) : null,
          parts[1],
        )
        .run();
      return json({ ok: true });
    }
  }
  const videoResponse = await videoApi(req, database);
  if (videoResponse) return videoResponse;
  if (parts[0] === "health" && method === "GET") {
    try {
      const response = await videoFetch("/health");
      return json({
        connected: response.ok,
        ...((await response.json()) as object),
      });
    } catch {
      return json({ connected: false });
    }
  }
  if (parts[0] === "deployments") {
    admin();
    const env = bindings();
    if (parts[1] === "dev-build" && method === "POST") {
      if (env.SITE_LOCAL !== "true")
        return json({ error: "Route not found" }, 404);
      if (!env.SITE_API)
        return json(
          { error: "Could not connect. Try again in a few moments." },
          503,
        );
      const input = z
        .object({ expectedRevision: z.string().length(64) })
        .strict()
        .parse(await body());
      const content = await publicationContent(database);
      if (input.expectedRevision !== (await contentRevision(content)))
        return json(
          { error: "Website content changed. Review it before publishing." },
          409,
        );
      const revision = await env.SITE_API.devBuild(content, String(user.id));
      return json({ revision });
    }
    const hookRow = await database
      .prepare("SELECT value FROM site_settings WHERE key=?")
      .bind("deploy_hook:veobible:site")
      .first<{ value: string }>();
    const hookUrl = hookRow?.value ?? "";
    if (parts.length === 3 && parts[2] === "resolve" && method === "POST") {
      z.object({ stopped: z.literal(true) }).parse(await body());
      const pending = await database
        .prepare(
          "SELECT id,status,external_id,content_revision,details FROM deployments WHERE id=? AND target='site'",
        )
        .bind(parts[1])
        .first<{
          id: number;
          status: string;
          external_id: string | null;
          content_revision: string | null;
          details: string | null;
        }>();
      if (
        !pending ||
        !["requested", "queued", "building", "deploying", "unknown"].includes(
          pending.status,
        )
      )
        return json(
          {
            error:
              "Review the information and settings you entered before continuing.",
          },
          409,
        );
      if (
        pending.external_id &&
        env.CLOUDFLARE_ACCOUNT_ID &&
        env.CLOUDFLARE_API_TOKEN
      ) {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/builds/builds/${encodeURIComponent(pending.external_id)}`,
          {
            headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
            signal: AbortSignal.timeout(10000),
          },
        );
        const status = (await response.json()) as {
          success: boolean;
          result?: BuildStatus;
        };
        if (!response.ok || !status.success || !status.result)
          return json(
            { error: "Could not connect. Try again in a few moments." },
            503,
          );
        if (!["failed", "cancelled"].includes(deploymentStatus(status.result)))
          return json({ error: "An update is in progress." }, 409);
      }
      if (pending.content_revision) {
        if (!env.SITE_API)
          return json(
            { error: "Could not connect. Try again in a few moments." },
            503,
          );
        await env.SITE_API.finish(pending.content_revision, false);
      }
      await database
        .prepare(
          "UPDATE deployments SET status='cancelled',completed_at=CURRENT_TIMESTAMP,details=? WHERE id=?",
        )
        .bind(
          JSON.stringify({ resolvedBy: user.id, previous: pending.details }),
          pending.id,
        )
        .run();
      return json({ ok: true });
    }
    if (parts[1] === "settings") {
      if (method === "GET") return json({ hookUrl });
      if (method === "POST") {
        const input = z
          .object({
            hookUrl: z
              .string()
              .trim()
              .max(2048)
              .refine((value) => value === "" || isDeployHookUrl(value)),
          })
          .parse(await body());
        await database
          .prepare(
            "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
          )
          .bind(
            "deploy_hook:veobible:site",
            input.hookUrl,
            new Date().toISOString(),
          )
          .run();
        return json({ ok: true, configured: Boolean(input.hookUrl) });
      }
    } else if (parts.length === 1) {
      if (method === "POST") {
        if (!hookUrl)
          return json(
            {
              error:
                "Publishing updates is not available yet. Contact your administrator.",
            },
            400,
          );
        if (!isDeployHookUrl(hookUrl))
          return json(
            {
              error:
                "Review the information and settings you entered before continuing.",
            },
            400,
          );
        const input = z
          .object({
            message: z.string().trim().max(500).default(""),
            expectedRevision: z.string().length(64),
          })
          .parse(await body());
        const content = await publicationContent(database);
        if (input.expectedRevision !== (await contentRevision(content)))
          return json(
            { error: "Website content changed. Review it before publishing." },
            409,
          );
        if (!env.SITE_API)
          return json(
            { error: "Could not connect. Try again in a few moments." },
            503,
          );
        const revision = await env.SITE_API.stage(content, String(user.id));
        let creation;
        try {
          creation = await database
            .prepare(
              "INSERT INTO deployments(status,created_by,message,target,content_revision) VALUES ('requested',?,?,'site',?)",
            )
            .bind(user.id, input.message, revision)
            .run();
        } catch (error) {
          await env.SITE_API.finish(revision, false);
          throw error;
        }
        const id = creation.meta.last_row_id;
        let status = "unknown";
        try {
          const response = await fetch(hookUrl, {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(15000),
          });
          const details = (await response.text()).slice(0, 6000);
          let result: { success?: boolean; result?: { build_uuid?: string } } =
            {};
          try {
            result = JSON.parse(details);
          } catch {
            /* Some providers return an empty response. */
          }
          status =
            response.ok && result.success !== false ? "requested" : "failed";
          if (status === "failed") await env.SITE_API.finish(revision, false);
          await database
            .prepare(
              "UPDATE deployments SET status=?,external_id=?,details=? WHERE id=?",
            )
            .bind(
              status,
              status === "requested"
                ? (result.result?.build_uuid ?? null)
                : null,
              details,
              id,
            )
            .run();
        } catch (error) {
          console.error("Deployment request could not be confirmed", error);
          await database
            .prepare("UPDATE deployments SET status='unknown' WHERE id=?")
            .bind(id)
            .run();
        }
        return json({ ok: status === "requested", id, status });
      }
      if (method === "GET") {
        let syncError = false;
        if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
          const pending = await database
            .prepare(
              "SELECT id,external_id,content_revision FROM deployments WHERE target='site' AND external_id IS NOT NULL AND status IN ('requested','queued','building','deploying') ORDER BY created_at DESC LIMIT 5",
            )
            .all<{
              id: string;
              external_id: string;
              content_revision: string | null;
            }>();
          const updates = await Promise.all(
            pending.results.map(async (record) => {
              try {
                const response = await fetch(
                  `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID!)}/builds/builds/${encodeURIComponent(record.external_id)}`,
                  {
                    headers: {
                      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
                    },
                    signal: AbortSignal.timeout(10000),
                  },
                );
                const data = (await response.json()) as {
                  success: boolean;
                  result: BuildStatus;
                };
                if (!response.ok || !data.success || !data.result)
                  throw new Error("Build status unavailable");
                const build = data.result;
                const state = deploymentStatus(build);
                if (
                  record.content_revision &&
                  ["success", "failed", "cancelled"].includes(state)
                )
                  await env.SITE_API?.finish(
                    record.content_revision,
                    state === "success",
                  );
                const started =
                  build.running_on || build.initializing_on || build.created_on;
                const duration =
                  started && build.stopped_on
                    ? Math.max(
                        0,
                        Date.parse(build.stopped_on) - Date.parse(started),
                      )
                    : null;
                return database
                  .prepare(
                    "UPDATE deployments SET status=?,completed_at=?,duration_ms=? WHERE id=?",
                  )
                  .bind(
                    deploymentStatus(build),
                    build.stopped_on ?? null,
                    Number.isFinite(duration) ? duration : null,
                    record.id,
                  );
              } catch (error) {
                console.error("Deployment synchronization failed", error);
                syncError = true;
              }
            }),
          );
          const statements = updates.filter(
            (statement): statement is D1PreparedStatement => Boolean(statement),
          );
          if (statements.length) await database.batch(statements);
        }
        // The deployed static marker also reconciles builds without tracking credentials.
        const unresolved = (
          await database
            .prepare(
              "SELECT id,content_revision FROM deployments WHERE target='site' AND content_revision IS NOT NULL AND status IN ('requested','queued','building','deploying','unknown')",
            )
            .all<{ id: number; content_revision: string }>()
        ).results;
        if (unresolved.length) {
          try {
            const live = await fetch(
              "https://veobible.com/website-release.json",
              { cache: "no-store", signal: AbortSignal.timeout(5000) },
            );
            if (live.ok) {
              const marker = (await live.json()) as { revision: string };
              for (const record of unresolved)
                if (record.content_revision === marker.revision) {
                  await database
                    .prepare(
                      "UPDATE deployments SET status='success',completed_at=CURRENT_TIMESTAMP WHERE id=?",
                    )
                    .bind(record.id)
                    .run();
                  await env.SITE_API?.finish(record.content_revision, true);
                }
            }
          } catch (error) {
            console.error("Website release check failed", error);
          }
        }
        const website = await websiteState(database);
        let previous = null;
        try {
          previous = (await env.SITE_API?.deployed()) ?? null;
        } catch (error) {
          console.error("Previous website release unavailable", error);
        }

        const revision = await contentRevision(website.content);
        let devBuild = null;
        if (env.SITE_LOCAL === "true") {
          devBuild = { available: false, changed: true };
          try {
            if (env.SITE_API) {
              const current = await env.SITE_API.development();
              devBuild = {
                available: true,
                changed: current?.revision !== revision,
              };
            }
          } catch (error) {
            console.error("Development content unavailable", error);
          }
        }
        return json({
          devBuild,
          website: {
            changes: publicationChanges(website.content, previous),
            ready: website.projects.filter((p) => p.included && !p.issue)
              .length,
            blocked: website.projects.filter((p) => p.included && p.issue)
              .length,
            books: website.content.bookVideos.length,
            revision,
            pages: website.projects
              .filter((p) => p.included)
              .map((p) => ({ title: p.title, path: p.path, issue: p.issue })),
          },
          configured: Boolean(hookUrl),
          syncError,
          trackingAvailable: Boolean(
            env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN,
          ),
          deployments: (
            await database
              .prepare(
                "SELECT d.id,d.status,d.message,d.created_at,d.completed_at,d.duration_ms,(d.external_id IS NOT NULL) AS trackable,u.name AS created_by_name FROM deployments d LEFT JOIN dashboard_users u ON u.id=d.created_by WHERE d.target='site' ORDER BY d.created_at DESC,d.id DESC LIMIT 50",
              )
              .all()
          ).results,
        });
      }
    }
  }
  return json({ error: "Route not found" }, 404);
}
async function route(req: Request) {
  const lang = requestLanguage(req);
  const json = createJson(lang);
  try {
    return await handle(req, lang);
  } catch (error) {
    if (
      error instanceof ProfileError ||
      error instanceof BibleVersionError ||
      error instanceof VisualShortcutError
    )
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        {
          error: userMessage(error, 400, lang),
        },
        400,
      );
    if (
      error instanceof Error &&
      [
        "Review website videos before publishing.",
        "A website update is already in progress",
      ].includes(error.message)
    )
      return json({ error: error.message }, 409);
    const message = error instanceof Error ? error.message : "Internal error";
    console.error(message);
    const status = /Se requiere administrador|Administrator required/i.test(
      message,
    )
      ? 403
      : 500;
    return json({ error: userMessage(error, status, lang) }, status);
  }
}
export {
  route as GET,
  route as POST,
  route as PATCH,
  route as PUT,
  route as DELETE,
};
