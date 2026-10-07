import { bibleBooksSchema } from "../../../lib/manual-video-project";
import {
  bibleVersionSchema,
  syncBibleVersions,
  listBibleVersions,
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
  if (parts[0] === "versions") {
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
  if (parts.join("/") === "settings/voice-templates") {
    const kind = z.enum(["short", "long"]).parse(url.searchParams.get("kind"));
    if (method === "GET")
      return json({ templates: await loadVoiceSettings(database, kind) });
    if (method === "PUT") {
      admin();
      return json({
        templates: await saveVoiceSettings(database, kind, await body()),
      });
    }
  }
  if (parts.join("/") === "settings/project-settings") {
    const kind = z.enum(["short", "long"]).parse(url.searchParams.get("kind"));
    if (method === "GET")
      return json({ settings: await loadProjectSettings(database, kind) });
    if (method === "PUT") {
      admin();
      return json({
        settings: await saveProjectSettings(database, kind, await body()),
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
    const hookRow = await database
      .prepare("SELECT value FROM site_settings WHERE key=?")
      .bind("deploy_hook:veobible:site")
      .first<{ value: string }>();
    // A saved empty value explicitly disables publishing, including the environment fallback.
    const hookUrl = hookRow ? hookRow.value : (env.SITE_DEPLOY_HOOK ?? "");
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
          .object({ message: z.string().trim().max(500).default("") })
          .parse(await body());
        const creation = await database
          .prepare(
            "INSERT INTO deployments(status,created_by,message,target) VALUES ('requested',?,?,'site')",
          )
          .bind(user.id, input.message)
          .run();
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
              "SELECT id,external_id FROM deployments WHERE target='site' AND external_id IS NOT NULL AND status IN ('requested','queued','building','deploying') ORDER BY created_at DESC LIMIT 5",
            )
            .all<{ id: string; external_id: string }>();
          await Promise.all(
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
                const started =
                  build.running_on || build.initializing_on || build.created_on;
                const duration =
                  started && build.stopped_on
                    ? Math.max(
                        0,
                        Date.parse(build.stopped_on) - Date.parse(started),
                      )
                    : null;
                await database
                  .prepare(
                    "UPDATE deployments SET status=?,completed_at=?,duration_ms=? WHERE id=?",
                  )
                  .bind(
                    deploymentStatus(build),
                    build.stopped_on ?? null,
                    Number.isFinite(duration) ? duration : null,
                    record.id,
                  )
                  .run();
              } catch (error) {
                console.error("Deployment synchronization failed", error);
                syncError = true;
              }
            }),
          );
        }
        return json({
          configured: Boolean(hookUrl),
          syncError,
          trackingAvailable: Boolean(
            env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN,
          ),
          deployments: (
            await database
              .prepare(
                "SELECT d.id,d.status,d.message,d.created_at,d.completed_at,d.duration_ms,(d.external_id IS NOT NULL) AS trackable,u.name AS created_by_name FROM deployments d LEFT JOIN dashboard_users u ON u.id=d.created_by WHERE d.target='site' ORDER BY d.created_at DESC LIMIT 50",
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
    if (error instanceof ProfileError || error instanceof BibleVersionError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        {
          error: userMessage(error, 400, lang),
        },
        400,
      );
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
