import {
  isDeployHookUrl,
  deploymentStatus,
  type BuildStatus,
} from "../../../lib/deployments";
import { profileSchema, saveProfile, ProfileError } from "../../../lib/profile";
import { userMessage } from "../../../lib/presentation";
import { db, bindings } from "../../../lib/env";
import { currentUser } from "../../../lib/auth";
import {
  digest,
  passwordHash,
  verifyPassword,
  sessionCookie,
  equal,
} from "../../../lib/security";
import { settingsSchema, renderSchema } from "../../../lib/video-schema";
import { videoFetch } from "../../../lib/video-client";
import { applyUpdate, syncJobs } from "../../../lib/jobs";
import { z } from "zod";
const json = (value: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
const userSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_.-]{3,60}$/),
  name: z.string().min(1).max(100),
  email: z.string().email().or(z.literal("")).default(""),
  role: z.enum(["admin", "editor"]),
  password: z.string().min(12).max(256),
});
async function handle(req: Request) {
  const url = new URL(req.url);
  const parts = url.pathname.slice(5).split("/");
  const method = req.method;
  const database = db();
  const body = async () => {
    if (Number(req.headers.get("content-length") || 0) > 1024 * 1024)
      throw new Error("Solicitud demasiado grande");
    return req.json();
  };
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("veo_session="))
    ?.slice(12);
  const secure = url.protocol === "https:";
  if (parts[0] === "jobs" && parts[2] === "callback" && method === "POST") {
    const job = await database
      .prepare("SELECT callback_hash FROM jobs WHERE id=?")
      .bind(parts[1])
      .first<{ callback_hash: string }>();
    const token =
      req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (!job || !equal(job.callback_hash, await digest(token)))
      return json({ error: "Unauthorized" }, 401);
    await applyUpdate(parts[1], await body());
    return json({ ok: true });
  }
  if (method !== "GET" && req.headers.get("origin") !== url.origin)
    return json({ error: "Origen no permitido" }, 403);
  if (parts.join("/") === "auth/login" && method === "POST") {
    const input = z
      .object({
        username: z.string().min(1).max(60),
        password: z.string().min(1).max(256),
      })
      .parse(await body());
    const key = await digest(
      `${req.headers.get("cf-connecting-ip") ?? "local"}:${input.username.toLowerCase()}`,
    );
    const limit = await database
      .prepare("SELECT attempts,reset_at FROM login_attempts WHERE key=?")
      .bind(key)
      .first<{ attempts: number; reset_at: number }>();
    if (limit && limit.reset_at > Date.now() && limit.attempts >= 10)
      return json({ error: "Espera unos minutos antes de reintentar" }, 429);
    await database
      .prepare(
        "INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END",
      )
      .bind(key, Date.now() + 900000, Date.now(), Date.now())
      .run();
    const user = await database
      .prepare("SELECT * FROM users WHERE username=? AND active=1")
      .bind(input.username)
      .first<{ id: string; password_hash: string }>();
    if (!user || !(await verifyPassword(input.password, user.password_hash)))
      return json({ error: "Usuario o contraseña incorrectos" }, 401);
    const token = crypto.randomUUID() + crypto.randomUUID();
    await database.batch([
      database
        .prepare("INSERT INTO sessions VALUES (?,?,?)")
        .bind(await digest(token), user.id, Date.now() + 86400 * 7 * 1000),
      database.prepare("DELETE FROM login_attempts WHERE key=?").bind(key),
      database
        .prepare("DELETE FROM sessions WHERE expires_at<?")
        .bind(Date.now()),
    ]);
    return json({ ok: true }, 200, {
      "Set-Cookie": sessionCookie(token, secure),
    });
  }
  const user = await currentUser(cookie ?? "");
  if (!user) return json({ error: "Inicia sesión" }, 401);
  const admin = () => {
    if (user.role !== "admin") throw new Error("Se requiere administrador");
  };
  if (parts.join("/") === "auth/me" && method === "GET") return json({ user });
  if (parts.join("/") === "auth/logout" && method === "POST") {
    if (cookie)
      await database
        .prepare("DELETE FROM sessions WHERE token_hash=?")
        .bind(await digest(cookie))
        .run();
    return json({ ok: true }, 200, {
      "Set-Cookie": sessionCookie("", secure, 0),
    });
  }
  if (parts.join("/") === "auth/profile" && method === "PATCH") {
    const input = profileSchema.parse(await body());
    const updated = await saveProfile(
      database,
      user,
      input,
      await digest(cookie ?? ""),
    );
    return json({ ok: true, user: updated });
  }

  if (parts[0] === "users") {
    admin();
    if (method === "GET")
      return json({
        users: (
          await database
            .prepare(
              "SELECT id,username,name,email,role,active,created_at FROM users ORDER BY created_at",
            )
            .all()
        ).results,
      });
    if (method === "POST") {
      const input = userSchema.parse(await body());
      await database
        .prepare(
          "INSERT INTO users(id,username,name,email,role,password_hash) VALUES (?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
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
      if (parts[1] === user.id)
        return json(
          {
            error: "No puedes cambiar tu propio rol o acceso desde esta lista",
          },
          400,
        );
      await database
        .prepare(
          "UPDATE users SET active=COALESCE(?,active),role=COALESCE(?,role),password_hash=COALESCE(?,password_hash) WHERE id=?",
        )
        .bind(
          input.active === undefined ? null : Number(input.active),
          input.role ?? null,
          input.password ? await passwordHash(input.password) : null,
          parts[1],
        )
        .run();
      await database
        .prepare("DELETE FROM sessions WHERE user_id=?")
        .bind(parts[1])
        .run();
      return json({ ok: true });
    }
  }
  if (parts[0] === "versions" && method === "GET")
    return json({
      versions: (await database.prepare("SELECT * FROM versions").all())
        .results,
    });
  if (parts[0] === "settings") {
    const kind = z.enum(["short", "long"]).parse(url.searchParams.get("kind"));
    const version = z.string().min(1).parse(url.searchParams.get("version"));
    if (method === "GET") {
      const row = await database
        .prepare(
          "SELECT settings FROM version_settings WHERE kind=? AND version_id=?",
        )
        .bind(kind, version)
        .first<{ settings: string }>();
      return json({
        settings: settingsSchema.parse(row ? JSON.parse(row.settings) : {}),
      });
    }
    if (method === "PUT") {
      const input = settingsSchema.parse(await body());
      await database
        .prepare(
          "INSERT INTO version_settings VALUES (?,?,?) ON CONFLICT(kind,version_id) DO UPDATE SET settings=excluded.settings",
        )
        .bind(kind, version, JSON.stringify(input))
        .run();
      return json({ ok: true });
    }
  }
  if (parts[0] === "summary" && method === "GET") {
    await syncJobs();
    return json({
      catalog: (
        await database
          .prepare("SELECT kind,count(*) total FROM catalog GROUP BY kind")
          .all()
      ).results,
      states: (
        await database
          .prepare("SELECT status,count(*) total FROM projects GROUP BY status")
          .all()
      ).results,
      published: await database
        .prepare(
          "SELECT count(*) total FROM projects WHERE published_at IS NOT NULL",
        )
        .first(),
      recent: (
        await database
          .prepare(
            "SELECT p.*,c.title,c.kind,v.label FROM projects p JOIN catalog c ON c.id=p.catalog_id JOIN versions v ON v.id=p.version_id WHERE p.result IS NOT NULL OR p.status<>'draft' OR p.published_at IS NOT NULL ORDER BY p.updated_at DESC LIMIT 8",
          )
          .all()
      ).results,
    });
  }
  if (parts[0] === "videos" && method === "GET" && !parts[1]) {
    await syncJobs();
    const kind = z.enum(["short", "long"]).parse(url.searchParams.get("kind"));
    const version = url.searchParams.get("version") ?? "rv1909";
    const rows = await database
      .prepare(
        "SELECT c.*,p.id project_id,COALESCE(p.status,'draft') status,p.published_at,p.used_at,p.settings,p.result,p.updated_at FROM catalog c LEFT JOIN projects p ON p.catalog_id=c.id AND p.version_id=? WHERE c.kind=? ORDER BY c.position",
      )
      .bind(version, kind)
      .all();
    return json({ videos: rows.results });
  }
  if (parts[0] === "videos" && parts[1]) {
    if (method === "GET" && !parts[2]) await syncJobs();
    const catalog = await database
      .prepare("SELECT * FROM catalog WHERE id=?")
      .bind(decodeURIComponent(parts[1]))
      .first<{ id: string; kind: "short" | "long"; passage: string }>();
    if (!catalog) return json({ error: "Video inexistente" }, 404);
    const expectedKind = url.searchParams.get("kind");
    if (expectedKind && expectedKind !== catalog.kind)
      return json({ error: "Video inexistente" }, 404);
    const versionId = url.searchParams.get("version") ?? "rv1909";
    const version = await database
      .prepare("SELECT * FROM versions WHERE id=?")
      .bind(versionId)
      .first<{ id: string; locale: string; label: string }>();
    if (!version) return json({ error: "Versión inexistente" }, 400);
    const defaults = await database
      .prepare(
        "SELECT settings FROM version_settings WHERE kind=? AND version_id=?",
      )
      .bind(catalog.kind, version.id)
      .first<{ settings: string }>();
    if (method === "POST" || method === "PATCH")
      await database
        .prepare(
          "INSERT INTO projects(id,catalog_id,version_id,settings) VALUES (?,?,?,?) ON CONFLICT(catalog_id,version_id) DO NOTHING",
        )
        .bind(
          crypto.randomUUID(),
          catalog.id,
          version.id,
          JSON.stringify(
            settingsSchema.parse(defaults ? JSON.parse(defaults.settings) : {}),
          ),
        )
        .run();
    const project = await database
      .prepare("SELECT * FROM projects WHERE catalog_id=? AND version_id=?")
      .bind(catalog.id, version.id)
      .first<{
        id: string;
        settings: string;
        status: string;
        result: string | null;
      }>();
    if (method === "GET" && !parts[2]) {
      const video = await database
        .prepare(
          "SELECT c.*,p.id project_id,COALESCE(p.status,'draft') status,p.published_at,p.used_at,p.settings,p.result,p.updated_at FROM catalog c LEFT JOIN projects p ON p.catalog_id=c.id AND p.version_id=? WHERE c.id=?",
        )
        .bind(version.id, catalog.id)
        .first();
      return json({
        video,
        defaults: settingsSchema.parse(
          defaults ? JSON.parse(defaults.settings) : {},
        ),
      });
    }
    if (parts[2] === "analyze" && method === "POST") {
      const input = settingsSchema.parse(await body());
      const response = await videoFetch("/v1/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project?.id,
          kind: catalog.kind,
          version,
          passage: JSON.parse(catalog.passage),
          settings: input,
        }),
      });
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }
    if (parts[2] === "media" && method === "GET") {
      if (!project) return json({ error: "Sin archivos" }, 404);
      const asset = z
        .union([
          z.enum(["video", "thumbnail", "intro", "outro"]),
          z.string().regex(/^reading-\d+$/),
        ])
        .parse(url.searchParams.get("asset"));
      const response = await videoFetch(
        `/v1/projects/${project.id}/media/${asset}?kind=${catalog.kind}`,
        {
          headers: req.headers.has("range")
            ? { Range: req.headers.get("range")! }
            : {},
        },
      );
      const headers = new Headers();
      for (const name of [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
      ]) {
        const value = response.headers.get(name);
        if (value) headers.set(name, value);
      }
      headers.set("Cache-Control", "no-store");
      if (url.searchParams.get("download") === "1")
        headers.set(
          "Content-Disposition",
          `attachment; filename="${JSON.parse(catalog.passage).id}.${asset === "thumbnail" ? "jpg" : "mp4"}"`,
        );
      return new Response(response.body, { status: response.status, headers });
    }
    if (method === "PATCH" && project) {
      if (["queued", "running"].includes(project.status))
        return json({ error: "Espera a que termine la generación" }, 409);
      const input = z
        .object({
          settings: settingsSchema.optional(),
          published: z.boolean().optional(),
        })
        .parse(await body());
      await database
        .prepare(
          "UPDATE projects SET settings=COALESCE(?,settings),published_at=CASE WHEN ? IS NULL THEN published_at WHEN ?=1 THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
        )
        .bind(
          input.settings ? JSON.stringify(input.settings) : null,
          input.published === undefined ? null : Number(input.published),
          Number(input.published),
          project.id,
        )
        .run();
      return json({ ok: true });
    }
    if (parts[2] === "render" && method === "POST" && project) {
      if (["queued", "running"].includes(project.status))
        return json({ error: "Ya hay un trabajo activo" }, 409);
      const input = settingsSchema.parse(await body());
      const id = crypto.randomUUID(),
        token = crypto.randomUUID() + crypto.randomUUID();
      const base = bindings().DASHBOARD_CALLBACK_URL;
      if (!base) throw new Error("Configura DASHBOARD_CALLBACK_URL");
      const snapshot = {
        id,
        projectId: project.id,
        kind: catalog.kind,
        version,
        passage: JSON.parse(catalog.passage),
        settings: input,
      };
      const request = renderSchema.parse({
        ...snapshot,
        callback: {
          url: `${base.replace(/\/$/, "")}/api/jobs/${id}/callback`,
          token,
        },
      });
      await database.batch([
        database
          .prepare(
            "INSERT INTO jobs(id,project_id,status,snapshot,callback_hash,created_by) VALUES (?,?,'queued',?,?,?)",
          )
          .bind(
            id,
            project.id,
            JSON.stringify(snapshot),
            await digest(token),
            user.id,
          ),
        database
          .prepare(
            "UPDATE projects SET status='queued',settings=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
          )
          .bind(JSON.stringify(input), project.id),
      ]);
      try {
        const response = await videoFetch("/v1/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        if (!response.ok)
          await applyUpdate(id, {
            status: "failed",
            stage: "Rechazado",
            error: (await response.text()).slice(0, 6000),
          });
      } catch {
        /* Acceptance can be ambiguous on timeout; next sync resolves it. */
      }
      return json({ ok: true, jobId: id }, 202);
    }
  }
  if (parts[0] === "jobs" && method === "GET") {
    await syncJobs();
    return json({
      jobs: (
        await database
          .prepare(
            "SELECT id,project_id,status,stage,snapshot,result,error,created_at,updated_at FROM jobs ORDER BY created_at DESC LIMIT 100",
          )
          .all()
      ).results,
    });
  }
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
                "La publicación de actualizaciones todavía no está disponible. Contacta al administrador.",
            },
            400,
          );
        if (!isDeployHookUrl(hookUrl))
          return json(
            {
              error:
                "Revisa los datos y ajustes introducidos antes de continuar.",
            },
            400,
          );
        const input = z
          .object({ message: z.string().trim().max(500).default("") })
          .parse(await body());
        const id = crypto.randomUUID();
        await database
          .prepare(
            "INSERT INTO deployments(id,status,created_by,message,target) VALUES (?,'requested',?,?,'site')",
          )
          .bind(id, user.id, input.message)
          .run();
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
                "SELECT d.id,d.status,d.message,d.created_at,d.completed_at,d.duration_ms,(d.external_id IS NOT NULL) AS trackable,u.name AS created_by_name FROM deployments d LEFT JOIN users u ON u.id=d.created_by WHERE d.target='site' ORDER BY d.created_at DESC LIMIT 50",
              )
              .all()
          ).results,
        });
      }
    }
  }
  return json({ error: "Ruta no encontrada" }, 404);
}
async function route(req: Request) {
  try {
    return await handle(req);
  } catch (error) {
    if (error instanceof ProfileError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        {
          error: userMessage(error, 400),
        },
        400,
      );
    const message = error instanceof Error ? error.message : "Error interno";
    console.error(message);
    return json(
      { error: userMessage(error) },
      message === "Se requiere administrador" ? 403 : 500,
    );
  }
}
export { route as GET, route as POST, route as PATCH, route as PUT };
