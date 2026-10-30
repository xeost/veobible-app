import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { signToken } from "./jwt";
import { workerQueueRead } from "./worker-queue-read";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE dashboard_users(id INTEGER,auth_version INTEGER,active INTEGER);
    INSERT INTO dashboard_users VALUES(1,2,1);
    CREATE TABLE bible_versions(id INTEGER,code TEXT);
    INSERT INTO bible_versions VALUES(1,'rv1909');
    CREATE TABLE video_projects(id INTEGER,kind TEXT,title TEXT,bible_version_id INTEGER);
    INSERT INTO video_projects VALUES(14,'short','Test video',1);
  `);
  const queries: string[] = [];
  const database = {
    prepare(sql: string) {
      queries.push(sql);
      return {
        bind(...values: (string | number)[]) {
          return {
            async first() {
              return sqlite.prepare(sql).get(...values) ?? null;
            },
            async all() {
              return { results: sqlite.prepare(sql).all(...values) };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  const env = {
    DB: database,
    JWT_SECRET: "queue-test-secret-at-least-thirty-two-bytes",
    VIDEO_API_URL: "https://local-service.test/",
    DASHBOARD_API_PROXY_TOKEN: "private-service-token",
  };
  return { sqlite, queries, env };
}

test("direct queue polling rejects invalid, revoked and disabled sessions before contacting services", async () => {
  const { sqlite, queries, env } = fixture();
  try {
    const forward: typeof fetch = async () => {
      throw new Error("unauthorized requests must not contact the service");
    };
    const valid = await signToken(1, 2, env.JWT_SECRET);
    for (const token of [
      undefined,
      "invalid",
      await signToken(1, 1, env.JWT_SECRET),
      await signToken(9, 2, env.JWT_SECRET),
    ]) {
      const response = await workerQueueRead(
        new Request("https://dash.test/api/generation-queue", {
          headers: token ? { cookie: `veo_session=${token}` } : {},
        }),
        env,
        forward,
      );
      assert.equal(response?.status, 401);
    }
    sqlite.exec("UPDATE dashboard_users SET active=0");
    const response = await workerQueueRead(
      new Request("https://dash.test/api/generation-queue", {
        headers: { cookie: `veo_session=${valid}`, "x-language": "es" },
      }),
      env,
      forward,
    );
    assert.equal(response?.status, 401);
    assert.equal(response?.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response?.json(), { error: "Inicia sesión" });
    assert.ok(queries.every((sql) => sql.includes("dashboard_users")));
  } finally {
    sqlite.close();
  }
});

test("direct queue polling requests only active work by default and loads history on demand", async () => {
  const { sqlite, queries, env } = fixture();
  try {
    const token = await signToken(1, 2, env.JWT_SECRET);
    for (const history of [false, true]) {
      queries.length = 0;
      const response = await workerQueueRead(
        new Request(
          `https://dash.test/api/generation-queue${history ? "?history=1" : ""}`,
          {
            headers: { cookie: `other=x; veo_session=${token}` },
          },
        ),
        env,
        async (input, init) => {
          const url = new URL(String(input));
          assert.equal(url.origin, "https://local-service.test");
          assert.equal(url.pathname, "/v1/queue");
          assert.equal(url.searchParams.get("history"), history ? "1" : "0");
          assert.ok(url.searchParams.has("outputEnvironment"));
          assert.equal(
            new Headers(init?.headers).get("authorization"),
            "Bearer private-service-token",
          );
          assert.ok(init?.signal);
          return Response.json({
            summary: { progress: 100, completed: 1, total: 1 },
            // Also exercise compatibility with an older local service returning
            // history even when the sidebar does not request it.
            items: [
              { projectId: 14, kind: "short", status: "done", type: "intro" },
            ],
          });
        },
      );
      const data = (await response?.json()) as any;
      assert.equal(response?.status, 200);
      assert.equal(data.connected, true);
      assert.deepEqual(data.items, []);
      assert.equal(queries.length, history ? 2 : 1);
      assert.equal(
        data.history?.[0].href,
        history ? "/short-videos/14" : undefined,
      );
      assert.deepEqual(data.summary, { progress: 100, completed: 1, total: 1 });
    }
  } finally {
    sqlite.close();
  }
});

test("queue service failures keep the availability contract and unrelated requests fall through", async () => {
  const { sqlite, env } = fixture();
  try {
    const token = await signToken(1, 2, env.JWT_SECRET);
    for (const forward of [
      async () => new Response("unavailable", { status: 503 }),
      async () => {
        throw new Error("offline");
      },
    ]) {
      const response = await workerQueueRead(
        new Request("https://dash.test/api/generation-queue", {
          headers: { cookie: `veo_session=${token}` },
        }),
        env,
        forward,
      );
      assert.deepEqual(await response?.json(), {
        connected: false,
        items: [],
        summary: { progress: 0, completed: 0, total: 0 },
      });
    }
    assert.equal(
      await workerQueueRead(
        new Request("https://dash.test/current-projects"),
        env,
      ),
      null,
    );
    assert.equal(
      await workerQueueRead(
        new Request("https://dash.test/api/generation-queue", {
          method: "POST",
        }),
        env,
      ),
      null,
    );
  } finally {
    sqlite.close();
  }
});
