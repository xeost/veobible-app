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
    const input = z
      .object({
        name: z.string().min(1).max(100),
        email: z.string().email().or(z.literal("")),
        currentPassword: z.string().max(256).optional(),
        password: z.string().min(12).max(256).optional(),
      })
      .parse(await body());
    if (input.password) {
      const row = await database
        .prepare("SELECT password_hash FROM users WHERE id=?")
        .bind(user.id)
        .first<{ password_hash: string }>();
      if (
        !row ||
        !(await verifyPassword(input.currentPassword ?? "", row.password_hash))
      )
        return json({ error: "Contraseña actual incorrecta" }, 400);
      await database.batch([
        database
          .prepare("UPDATE users SET name=?,email=?,password_hash=? WHERE id=?")
          .bind(
            input.name,
            input.email,
            await passwordHash(input.password),
            user.id,
          ),
        database
          .prepare("DELETE FROM sessions WHERE user_id=? AND token_hash<>?")
          .bind(user.id, await digest(cookie ?? "")),
      ]);
    } else
      await database
        .prepare("UPDATE users SET name=?,email=? WHERE id=?")
        .bind(input.name, input.email, user.id)
        .run();
    return json({ ok: true });
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
    const catalog = await database
      .prepare("SELECT * FROM catalog WHERE id=?")
      .bind(decodeURIComponent(parts[1]))
      .first<{ id: string; kind: "short" | "long"; passage: string }>();
    if (!catalog) return json({ error: "Video inexistente" }, 404);
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
    if (method === "POST") {
      if (!env.DASHBOARD_DEPLOY_HOOK)
        return json({ error: "Configura DASHBOARD_DEPLOY_HOOK" }, 400);
      const id = crypto.randomUUID();
      await database
        .prepare(
          "INSERT INTO deployments(id,status,created_by) VALUES (?,'requested',?)",
        )
        .bind(id, user.id)
        .run();
      try {
        const response = await fetch(env.DASHBOARD_DEPLOY_HOOK, {
          method: "POST",
          signal: AbortSignal.timeout(15000),
        });
        await database
          .prepare("UPDATE deployments SET status=?,details=? WHERE id=?")
          .bind(
            response.ok ? "requested" : "failed",
            (await response.text()).slice(0, 6000),
            id,
          )
          .run();
      } catch (error) {
        await database
          .prepare(
            "UPDATE deployments SET status='unknown',details=? WHERE id=?",
          )
          .bind(String(error), id)
          .run();
      }
      return json({ ok: true, id });
    }
    if (method === "GET") {
      let cloudflare: unknown[] = [],
        syncError: string | null = null;
      if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
        try {
          const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/workers/scripts/${encodeURIComponent(env.DASHBOARD_WORKER_NAME ?? "veobible-dashboard")}/deployments`,
            {
              headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
              signal: AbortSignal.timeout(10000),
            },
          );
          const data = (await response.json()) as {
            success: boolean;
            result: unknown[];
          };
          if (!response.ok || !data.success)
            throw new Error("No se pudo consultar Cloudflare");
          cloudflare = data.result;
        } catch (error) {
          syncError = String(error);
        }
      }
      return json({
        configured: Boolean(env.DASHBOARD_DEPLOY_HOOK),
        cloudflare,
        syncError,
        deployments: (
          await database
            .prepare(
              "SELECT * FROM deployments ORDER BY created_at DESC LIMIT 30",
            )
            .all()
        ).results,
      });
    }
  }
  return json({ error: "Ruta no encontrada" }, 404);
}
async function route(req: Request) {
  try {
    return await handle(req);
  } catch (error) {
    if (error instanceof z.ZodError)
      return json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        400,
      );
    const message = error instanceof Error ? error.message : "Error interno";
    console.error(message);
    return json(
      { error: message },
      message === "Se requiere administrador" ? 403 : 500,
    );
  }
}
export { route as GET, route as POST, route as PATCH, route as PUT };
