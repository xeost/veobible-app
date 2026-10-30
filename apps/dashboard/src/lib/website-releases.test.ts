import { test } from "node:test";
import assert from "node:assert/strict";
import { websiteDatabase } from "./test-support/website-database";
import {
  prepareRelease,
  saveDevelopment,
  readDevelopment,
  readPublished,
  exportRelease,
  pruneReleases,
  reconcileReleases,
  releaseKey,
  type ReleaseEnvironment,
} from "./website-releases";
import { emptyContent } from "../../../../packages/website/content";

function fixture() {
  const { db, sqlite } = websiteDatabase();
  const objects = new Map<string, { text: string; uploaded: Date }>();
  let failDelete = false;
  const bucket = {
    async put(key: string, text: string) {
      objects.set(key, { text, uploaded: new Date() });
    },
    async get(key: string) {
      const value = objects.get(key);
      return value
        ? { body: value.text, json: async () => JSON.parse(value.text) }
        : null;
    },
    async list({ prefix = "", cursor }: { prefix?: string; cursor?: string }) {
      // Force pagination to exercise the complete sweep.
      const entries = [...objects]
        .filter(([key]) => key.startsWith(prefix) && (!cursor || key > cursor))
        .sort(([a], [b]) => a.localeCompare(b));
      const page = entries.slice(0, 2);
      return {
        objects: page.map(([key, v]) => ({ key, uploaded: v.uploaded })),
        truncated: entries.length > 2,
        cursor: page.at(-1)?.[0],
      };
    },
    async delete(keys: string[]) {
      if (failDelete) throw new Error("storage unavailable");
      for (const key of keys) objects.delete(key);
    },
  };
  const env = {
    DB: db,
    WEBSITE_CONTENT: bucket,
    SITE_LOCAL: "true",
    SITE_EXPORT_TOKEN: "build-secret",
    R2_ACCOUNT_ID: "a".repeat(32),
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: "test-secret-key",
  } as unknown as ReleaseEnvironment;
  const settle = (id: number, status = "success") =>
    sqlite
      .prepare("UPDATE deployments SET status=? WHERE id=?")
      .run(status, id);
  const bind = (id: number, build: string) =>
    sqlite
      .prepare("UPDATE deployments SET external_id=? WHERE id=?")
      .run(build, id);
  const request = (
    query = "",
    token = "build-secret",
    host = "https://dashboard.test",
  ) =>
    new Request(`${host}/api/site-export${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  return {
    env,
    sqlite,
    objects,
    settle,
    bind,
    request,
    setFailDelete: (v: boolean) => {
      failDelete = v;
    },
  };
}

test("concurrent requests reserve only one publication; retries have a stable content hash and independent identity", async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    prepareRelease(f.env, emptyContent, 1, ""),
    prepareRelease(f.env, emptyContent, 1, ""),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(f.objects.size, 1);
  const first = (
    results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{
      id: number;
      revision: string;
    }>
  ).value;
  assert.throws(
    () =>
      f.sqlite
        .prepare(
          "INSERT INTO deployments(status,target) VALUES ('building','site')",
        )
        .run(),
    /UNIQUE/,
  );
  f.settle(first.id, "failed");
  const retry = await prepareRelease(f.env, emptyContent, 1, "");
  assert.equal(retry.revision, first.revision);
  assert.notEqual(retry.id, first.id);
});

test("build exports require their own credential and an exact active build identity", async () => {
  const f = fixture();
  const release = await prepareRelease(f.env, emptyContent, 1, "");
  assert.equal(
    (await exportRelease(f.request("?build=abc", "wrong"), f.env)).status,
    401,
  );
  assert.equal((await exportRelease(f.request(), f.env)).status, 400);
  assert.equal(
    (await exportRelease(f.request("?build=abc"), f.env)).status,
    409,
  );
  f.bind(release.id, "abc");
  f.env.WEBSITE_CONTENT.get = async () => {
    throw new Error("Production downloads must bypass the Worker");
  };
  const response = await exportRelease(f.request("?build=abc"), f.env);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.body, null);
  const download = new URL(response.headers.get("Location")!);
  assert.equal(download.hostname, `${"a".repeat(32)}.r2.cloudflarestorage.com`);
  assert.equal(download.pathname, `/site-releases/${release.id}.json`);
  assert.equal(download.searchParams.get("X-Amz-Expires"), "300");
  assert.equal(download.searchParams.get("X-Amz-SignedHeaders"), "host");
  assert.match(download.searchParams.get("X-Amz-Signature")!, /^[a-f0-9]{64}$/);
  assert.ok(!download.href.includes("build-secret"));
  assert.ok(!download.href.includes("test-secret-key"));
  assert.equal(
    (await exportRelease(f.request("?build=other"), f.env)).status,
    409,
  );
  assert.equal(
    (
      await exportRelease(f.request("?build=abc"), {
        ...f.env,
        R2_SECRET_ACCESS_KEY: undefined,
      })
    ).status,
    503,
  );
  f.settle(release.id, "failed");
  assert.equal(
    (await exportRelease(f.request("?build=abc"), f.env)).status,
    410,
  );
});

test("development overwrites one isolated object and is available anonymously only on loopback", async () => {
  const f = fixture();
  const revision = await saveDevelopment(f.env, emptyContent);
  assert.equal(await saveDevelopment(f.env, emptyContent), revision);
  assert.equal(f.objects.size, 1);
  assert.equal((await readDevelopment(f.env))?.revision, revision);
  assert.equal(
    (
      await exportRelease(
        f.request("?development=1", "wrong", "http://127.0.0.1:3003"),
        f.env,
      )
    ).status,
    200,
  );
  assert.equal(
    (await exportRelease(f.request("?development=1", "wrong"), f.env)).status,
    401,
  );
  assert.equal(
    (await exportRelease(f.request("?development=1"), f.env)).status,
    400,
  );
  await assert.rejects(
    () => saveDevelopment({ ...f.env, SITE_LOCAL: undefined }, emptyContent),
    /Development only/,
  );
});

test("content larger than a D1 row is stored in R2 with only metadata in D1", async () => {
  const f = fixture();
  const content = {
    schema: 1,
    bookVideos: [],
    publications: Array.from({ length: 300 }, (_, index) => ({
      projectId: index + 1,
      kind: "short",
      locale: "es",
      version: "rv1909",
      slug: `page-${index}`,
      title: "Title",
      description: "x".repeat(9000),
      youtubeId: "abcdefghijk",
      passage: {
        book: "genesis",
        start: { chapter: 1, verse: 1 },
        end: { chapter: 1, verse: 3 },
      },
    })),
  };
  const release = await prepareRelease(f.env, content, 1, "");
  assert.ok(f.objects.get(releaseKey(release.id))!.text.length > 2_000_000);
  const row = f.sqlite
    .prepare("SELECT * FROM deployments WHERE id=?")
    .get(release.id)!;
  assert.ok(JSON.stringify(row).length < 1000);
  assert.equal(row.content_revision, release.revision);
});

test("retention sweeps all pages, keeps two successes plus active and development, and retries failed deletion", async () => {
  const f = fixture();
  await saveDevelopment(f.env, emptyContent);
  for (let i = 0; i < 6; i++) {
    const r = await prepareRelease(f.env, emptyContent, 1, "");
    f.settle(r.id, i === 4 ? "failed" : "success");
  }
  const active = await prepareRelease(f.env, emptyContent, 1, "");
  for (const value of f.objects.values()) value.uploaded = new Date(0);
  f.objects.set("orphan.json", { text: "{}", uploaded: new Date(0) });
  f.objects.set("fresh.json", { text: "{}", uploaded: new Date() });
  f.setFailDelete(true);
  await assert.rejects(() => pruneReleases(f.env), /storage unavailable/);
  f.setFailDelete(false);
  await pruneReleases(f.env);
  assert.deepEqual(
    [...f.objects.keys()].sort(),
    [
      "development/content.json",
      "4.json",
      "6.json",
      releaseKey(active.id),
      "fresh.json",
    ].sort(),
  );
  assert.equal((await readPublished(f.env))?.revision, active.revision);
  assert.equal(
    (
      await (await f.env.WEBSITE_CONTENT.get("6.json"))!.json<{
        deploymentId: number;
      }>()
    ).deploymentId,
    6,
  );
});

test("reconciliation settles without a dashboard request and ignores an older marker with the same content", async () => {
  const f = fixture();
  const previous = await prepareRelease(f.env, emptyContent, 1, "");
  f.settle(previous.id);
  const current = await prepareRelease(f.env, emptyContent, 1, "");
  f.bind(current.id, "current-build");
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({ revision: previous.revision, deploymentId: previous.id });
    await reconcileReleases(f.env);
    assert.equal(
      f.sqlite
        .prepare("SELECT status FROM deployments WHERE id=?")
        .get(current.id)?.status,
      "requested",
    );
    globalThis.fetch = async () =>
      Response.json({ revision: current.revision, deploymentId: current.id });
    await reconcileReleases(f.env);
    assert.equal(
      f.sqlite
        .prepare("SELECT status FROM deployments WHERE id=?")
        .get(current.id)?.status,
      "success",
    );
    const failed = await prepareRelease(f.env, emptyContent, 1, "");
    f.bind(failed.id, "failed-build");
    globalThis.fetch = async (input) =>
      String(input).includes("api.cloudflare.com")
        ? Response.json({
            success: true,
            result: { status: "finished", build_outcome: "failed" },
          })
        : Response.json({
            revision: previous.revision,
            deploymentId: previous.id,
          });
    await reconcileReleases({
      ...f.env,
      CLOUDFLARE_ACCOUNT_ID: "account",
      CLOUDFLARE_API_TOKEN: "token",
    });
    assert.equal(
      f.sqlite
        .prepare("SELECT status FROM deployments WHERE id=?")
        .get(failed.id)?.status,
      "failed",
    );
    await prepareRelease(f.env, emptyContent, 1, "");
  } finally {
    globalThis.fetch = original;
  }
});

test("audit history is bounded while old published content and active work stay protected", async () => {
  const f = fixture();
  const successful = await prepareRelease(f.env, emptyContent, 1, "");
  f.settle(successful.id);
  for (let i = 0; i < 250; i++)
    f.sqlite
      .prepare(
        "INSERT INTO deployments(status,target,content_revision) VALUES ('failed','site','unused')",
      )
      .run();
  const pending = await prepareRelease(f.env, emptyContent, 1, "");
  await pruneReleases(f.env);
  assert.equal(
    f.sqlite.prepare("SELECT count(*) AS n FROM deployments").get()?.n,
    201,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT status FROM deployments WHERE id=?")
      .get(successful.id)?.status,
    "success",
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT status FROM deployments WHERE id=?")
      .get(pending.id)?.status,
    "requested",
  );
});

test("failed uploads release the reservation without triggering publication", async () => {
  const f = fixture();
  const put = f.env.WEBSITE_CONTENT.put;
  f.env.WEBSITE_CONTENT.put = async () => {
    throw new Error("upload failed");
  };
  await assert.rejects(
    () => prepareRelease(f.env, emptyContent, 1, ""),
    /upload failed/,
  );
  assert.equal(
    f.sqlite.prepare("SELECT status FROM deployments").get()?.status,
    "failed",
  );
  f.env.WEBSITE_CONTENT.put = put;
  await prepareRelease(f.env, emptyContent, 1, "");
});
