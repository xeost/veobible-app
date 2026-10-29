import {
  validateContent,
  type SiteContent,
  type SiteSnapshot,
} from "../../../../packages/website/content";
import { contentRevision } from "./website";
import { deploymentStatus, type BuildStatus } from "./deployments";

export interface ReleaseEnvironment {
  DB: D1Database;
  WEBSITE_CONTENT: R2Bucket;
  SITE_LOCAL?: string;
  SITE_EXPORT_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}
const active = "'requested','queued','building','deploying','unknown'";
export const MAX_RELEASE_BYTES = 32 * 1024 * 1024;
const developmentKey = "development/content.json";
export const releaseKey = (id: number | string) => `releases/${id}.json`;

function encode(content: SiteContent, revision: string, deploymentId?: number) {
  const text = JSON.stringify({
    ...content,
    revision,
    ...(deploymentId ? { deploymentId } : {}),
  });
  if (new TextEncoder().encode(text).byteLength > MAX_RELEASE_BYTES)
    throw new Error("Website content exceeds the supported release size");
  return text;
}
export async function saveDevelopment(env: ReleaseEnvironment, input: unknown) {
  if (env.SITE_LOCAL !== "true") throw new Error("Development only");
  const content = validateContent(input);
  const revision = await contentRevision(content);
  await env.WEBSITE_CONTENT.put(developmentKey, encode(content, revision));
  return revision;
}
export async function readDevelopment(
  env: ReleaseEnvironment,
): Promise<SiteSnapshot | null> {
  if (env.SITE_LOCAL !== "true") return null;
  const object = await env.WEBSITE_CONTENT.get(developmentKey);
  return object ? object.json<SiteSnapshot>() : null;
}
export async function readPublished(
  env: ReleaseEnvironment,
): Promise<SiteSnapshot | null> {
  const row = await env.DB.prepare(
    "SELECT id FROM deployments WHERE target='site' AND status='success' ORDER BY id DESC LIMIT 1",
  ).first<{ id: number }>();
  if (!row) return null;
  const object = await env.WEBSITE_CONTENT.get(releaseKey(row.id));
  return object ? object.json<SiteSnapshot>() : null;
}

export async function prepareRelease(
  env: ReleaseEnvironment,
  input: unknown,
  actor: number,
  message: string,
) {
  const content = validateContent(input);
  const revision = await contentRevision(content);
  // Reserve the publication in D1 before writing an artifact. The partial unique
  // index serializes production publication, including concurrent HTTP requests.
  encode(content, revision);
  const row = await env.DB.prepare(
    `INSERT INTO deployments(status,created_by,message,target,content_revision)
    SELECT 'requested',?,?,'site',? WHERE NOT EXISTS
    (SELECT 1 FROM deployments WHERE target='site' AND status IN (${active})) RETURNING id`,
  )
    .bind(actor, message, revision)
    .first<{ id: number }>();
  if (!row) throw new Error("An update is in progress.");
  try {
    await env.WEBSITE_CONTENT.put(
      releaseKey(row.id),
      encode(content, revision, row.id),
      {
        httpMetadata: { contentType: "application/json" },
      },
    );
  } catch (error) {
    await env.DB.prepare(
      "UPDATE deployments SET status='failed',completed_at=CURRENT_TIMESTAMP WHERE id=?",
    )
      .bind(row.id)
      .run();
    throw error;
  }
  return { id: row.id, revision };
}

// Only export the immutable artifact assigned to this exact CI execution. A CI
// execution can start before the hook response is recorded; callers retry 409.
export async function exportRelease(
  request: Request,
  env: ReleaseEnvironment,
): Promise<Response> {
  const url = new URL(request.url);
  const local =
    env.SITE_LOCAL === "true" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const headers = {
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json",
  };
  if (
    !local &&
    (!env.SITE_EXPORT_TOKEN ||
      request.headers.get("Authorization") !==
        `Bearer ${env.SITE_EXPORT_TOKEN}`)
  )
    return new Response("Unauthorized", { status: 401 });
  if (request.method !== "GET")
    return new Response("Method not allowed", { status: 405 });
  let key: string;
  if (local && url.searchParams.get("development") === "1")
    key = developmentKey;
  else {
    const buildId = url.searchParams.get("build");
    if (!buildId || !/^[\w-]{1,100}$/.test(buildId))
      return new Response("Build identity required", { status: 400 });
    const row = await env.DB.prepare(
      "SELECT id,status FROM deployments WHERE target='site' AND external_id=?",
    )
      .bind(buildId)
      .first<{ id: number; status: string }>();
    if (!row)
      return new Response("Build not registered", {
        status: 409,
        headers: { ...headers, "Retry-After": "2" },
      });
    if (!["requested", "queued", "building", "deploying"].includes(row.status))
      return new Response("Build is no longer active", {
        status: 410,
        headers,
      });
    key = releaseKey(row.id);
  }
  const object = await env.WEBSITE_CONTENT.get(key);
  return object
    ? new Response(object.body, { headers })
    : new Response("Content unavailable", { status: 404, headers });
}

// Keep two successful deployments and every nonterminal deployment. Development
// uses a single overwritten object. List pagination also catches orphaned uploads
// after a crash; the grace period protects writes currently in progress.
export async function pruneReleases(env: ReleaseEnvironment, now = Date.now()) {
  const retained = await env.DB.prepare(
    `SELECT id FROM deployments WHERE target='site' AND
    (status IN (${active}) OR id IN (SELECT id FROM deployments WHERE target='site' AND status='success' ORDER BY id DESC LIMIT 2))`,
  ).all<{ id: number }>();
  const keep = new Set(retained.results.map((row) => releaseKey(row.id)));
  let cursor: string | undefined;
  do {
    const page = await env.WEBSITE_CONTENT.list({
      prefix: "releases/",
      cursor,
      limit: 1000,
    });
    const remove = page.objects
      .filter(
        (object) =>
          !keep.has(object.key) &&
          object.uploaded.getTime() < now - 60 * 60 * 1000,
      )
      .map((object) => object.key);
    // Newly created deployments have unique keys and fresh upload timestamps;
    // terminal deployments are never reactivated or rewritten.
    if (remove.length) await env.WEBSITE_CONTENT.delete(remove);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  // Bound even the lightweight audit history. Preserve retained successes and
  // active records; deletion of unreferenced objects remains retryable by listing.
  await env.DB.prepare(
    `DELETE FROM deployments WHERE target='site'
    AND status IN ('success','failed','cancelled')
    AND id NOT IN (SELECT id FROM deployments WHERE target='site' ORDER BY id DESC LIMIT 200)
    AND id NOT IN (SELECT id FROM deployments WHERE target='site' AND status='success' ORDER BY id DESC LIMIT 2)`,
  ).run();
}

export async function reconcileReleases(
  env: ReleaseEnvironment,
): Promise<boolean> {
  let syncError = false;
  const pending = await env.DB.prepare(
    `SELECT id,external_id,content_revision FROM deployments WHERE target='site' AND status IN (${active})`,
  ).all<{ id: number; external_id: string | null; content_revision: string }>();
  for (const row of pending.results) {
    if (
      !row.external_id ||
      !env.CLOUDFLARE_ACCOUNT_ID ||
      !env.CLOUDFLARE_API_TOKEN
    )
      continue;
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/builds/builds/${encodeURIComponent(row.external_id)}`,
        {
          headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
          signal: AbortSignal.timeout(10000),
        },
      );
      const data = (await response.json()) as {
        success: boolean;
        result?: BuildStatus;
      };
      if (!response.ok || !data.success || !data.result)
        throw new Error("Build status unavailable");
      const state = deploymentStatus(data.result);
      const started =
        data.result.running_on ||
        data.result.initializing_on ||
        data.result.created_on;
      const duration =
        started && data.result.stopped_on
          ? Math.max(
              0,
              Date.parse(data.result.stopped_on) - Date.parse(started),
            )
          : null;
      // Only our linked build can settle this deployment. An ambiguous trigger
      // never expires automatically: it may still deploy and must be resolved.
      await env.DB.prepare(
        `UPDATE deployments SET status=?,completed_at=?,duration_ms=? WHERE id=? AND status IN (${active})`,
      )
        .bind(
          state,
          data.result.stopped_on ?? null,
          duration !== null && Number.isFinite(duration) ? duration : null,
          row.id,
        )
        .run();
    } catch (error) {
      console.error("Website reconciliation failed", error);
      syncError = true;
    }
  }
  if (pending.results.length) {
    try {
      const response = await fetch(
        "https://veobible.com/website-release.json",
        { cache: "no-store", signal: AbortSignal.timeout(5000) },
      );
      if (response.ok) {
        const marker = (await response.json()) as {
          revision?: string;
          deploymentId?: number;
        };
        for (const row of pending.results) {
          if (
            marker.deploymentId === row.id &&
            marker.revision === row.content_revision
          )
            await env.DB.prepare(
              `UPDATE deployments SET status='success',completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP) WHERE id=? AND status IN (${active})`,
            )
              .bind(row.id)
              .run();
        }
      }
    } catch (error) {
      console.error("Website marker check failed", error);
      syncError = true;
    }
  }
  await pruneReleases(env);
  return syncError;
}
