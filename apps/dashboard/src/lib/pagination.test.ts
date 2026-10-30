import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { loadDashboardSummary } from "./dashboard-summary";
import { pageVideoProjects, listVideoProjects } from "./video-listing";
import { bibleVersionOptions, listBibleVersions } from "./bible-versions";
import { parsePagination } from "./pagination";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../../migrations/0001_dashboard.sql", import.meta.url),
      "utf8",
    ),
  );
  sqlite.exec(
    readFileSync(
      new URL("../../migrations/0002_query_indexes.sql", import.meta.url),
      "utf8",
    ),
  );
  sqlite.exec(
    "INSERT INTO bible_versions(locale,code,label) VALUES('es','test','Spanish'),('en','test','English')",
  );
  sqlite.exec(
    readFileSync(
      new URL("../../migrations/0004_audio_projects.sql", import.meta.url),
      "utf8",
    ),
  );
  sqlite.exec(
    readFileSync(
      new URL(
        "../../migrations/0005_audio_project_environments.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  sqlite.exec(
    readFileSync(
      new URL(
        "../../migrations/0008_reset_audio_projects.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const insert = sqlite.prepare(
    "INSERT INTO video_projects(kind,bible_version_id,slug,title,passage,published,settings) VALUES(?,?,?,?,?,?,?)",
  );
  for (let id = 1; id <= 137; id++)
    insert.run(
      "short",
      1,
      `test-${id}`,
      `Pasaje ${id}`,
      "{}",
      id % 2,
      JSON.stringify({ private: "x".repeat(1000) }),
    );
  insert.run("short", 2, "other", "Other language", "{}", 0, "{}");
  insert.run("long", 1, "other", "Other format", "{}", 0, "{}");
  insert.run("short", 1, "accent", "ÉXODO · CANÇÃO 100%_", "{}", 0, "{}");
  let batches = 0;
  const queries: { sql: string; values: unknown[] }[] = [];
  const database = {
    prepare(sql: string) {
      let values: any[] = [];
      const execute = () => {
        queries.push({ sql, values });
        return { results: sqlite.prepare(sql).all(...values) };
      };
      const statement = {
        bind(...args: any[]) {
          values = args;
          return statement;
        },
        all: async () => execute(),
        first: async () => execute().results[0] ?? null,
        execute,
      };
      return statement;
    },
    async batch(statements: { execute: () => unknown }[]) {
      batches++;
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.execute());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
  const load = (query = "") => {
    const params = new URLSearchParams(query);
    if (!params.has("kind")) params.set("kind", "short");
    if (!params.has("version")) params.set("version", "1");
    return pageVideoProjects(database, params);
  };
  return { sqlite, database, load, queries, batches: () => batches };
}

test("catalogue downloads only the requested page, with stable ordering and whole-scope totals", async () => {
  const f = fixture();
  try {
    const first = await f.load("pageSize=10");
    const next = await f.load("page=2&pageSize=10");
    assert.equal(f.batches(), 2);
    assert.deepEqual(first.pagination, {
      page: 1,
      pageSize: 10,
      total: 138,
      pages: 14,
    });
    assert.deepEqual(
      first.videos.map((row) => row.id),
      Array.from({ length: 10 }, (_, i) => i + 1),
    );
    assert.deepEqual(
      next.videos.map((row) => row.id),
      Array.from({ length: 10 }, (_, i) => i + 11),
    );
    assert.deepEqual(next.summary, {
      total: 138,
      published: 69,
      unpublished: 69,
    });
    assert.ok(
      first.videos.every((row) => !("settings" in row) && !("passage" in row)),
    );
    const pageQuery = f.queries.find(({ sql }) =>
      sql.includes("LIMIT ? OFFSET ?"),
    )!;
    assert.deepEqual(pageQuery.values.slice(-2), [10, 0]);
    const plan = f.sqlite
      .prepare(`EXPLAIN QUERY PLAN ${pageQuery.sql}`)
      .all(...(pageQuery.values as any[]));
    assert.match(
      JSON.stringify(plan),
      /USING (?:COVERING )?INDEX video_projects_kind_version/,
    );
    const activityPlan = f.sqlite
      .prepare(
        "EXPLAIN QUERY PLAN SELECT id,title FROM video_projects ORDER BY updated_at DESC,id DESC LIMIT 8",
      )
      .all();
    assert.match(JSON.stringify(activityPlan), /video_projects_updated_id/);
    assert.doesNotMatch(JSON.stringify(activityPlan), /TEMP B-TREE/);
  } finally {
    f.sqlite.close();
  }
});

test("search and publication filtering happen before pagination without changing summary scope", async () => {
  const f = fixture();
  try {
    const result = await f.load(
      "query=Pasaje+1&publication=published&pageSize=10",
    );
    const expected = Array.from({ length: 137 }, (_, i) => i + 1).filter(
      (id) => id % 2 === 1 && `pasaje ${id} ${id}`.includes("pasaje 1"),
    );
    assert.equal(result.pagination.total, expected.length);
    assert.deepEqual(
      result.videos.map((row) => row.id),
      expected.slice(0, 10),
    );
    assert.deepEqual(result.summary, {
      total: 138,
      published: 69,
      unpublished: 69,
    });
    assert.equal(
      (await f.load("query=éxodo")).videos[0].title,
      "ÉXODO · CANÇÃO 100%_",
    );
    assert.equal((await f.load("query=canção")).pagination.total, 1);
    assert.equal((await f.load("query=%25_")).pagination.total, 1); // Literal SQL wildcard characters.
    assert.equal((await f.load("query=%27+OR+1%3D1--")).pagination.total, 0);
    assert.equal((await f.load("query=++Pasaje")).pagination.total, 0); // Preserve meaningful spaces.
    assert.equal(
      (
        await pageVideoProjects(
          f.database,
          new URLSearchParams("kind=long&version=all"),
        )
      ).pagination.total,
      1,
    );
  } finally {
    f.sqlite.close();
  }
});

test("deleted pages clamp to the last page, empty results remain usable, and ID lookups stay exact", async () => {
  const f = fixture();
  try {
    const clamped = await f.load("page=999&pageSize=100");
    assert.deepEqual(clamped.pagination, {
      page: 2,
      pageSize: 100,
      total: 138,
      pages: 2,
    });
    assert.equal(clamped.videos.length, 38);
    const empty = await f.load("page=3&query=does-not-exist");
    assert.deepEqual(empty.pagination, {
      page: 1,
      pageSize: 10,
      total: 0,
      pages: 1,
    });
    assert.deepEqual(empty.videos, []);
    assert.deepEqual(
      (await listVideoProjects(f.database, "short", "1", "1,138,139,140")).map(
        (row) => row.id,
      ),
      [1, 140],
    );
    await assert.rejects(listVideoProjects(f.database, "short", null, null));
    await assert.rejects(
      listVideoProjects(
        f.database,
        "short",
        null,
        Array.from({ length: 81 }, (_, i) => String(i + 1)).join(","),
      ),
    );
  } finally {
    f.sqlite.close();
  }
});

test("version selectors skip project counting while management retains accurate counts and ordering", async () => {
  const f = fixture();
  try {
    const options = await bibleVersionOptions(f.database);
    assert.equal(options.length, 2);
    assert.ok(options.every((row) => !("project_count" in row)));
    assert.ok(f.queries.every(({ sql }) => !sql.includes("video_projects")));
    const versions = await listBibleVersions(f.database);
    assert.deepEqual(
      versions.map((row) => [row.id, row.project_count]),
      [
        [2, 1],
        [1, 139],
      ],
    );
    const sql = f.queries.at(-1)!.sql;
    assert.match(
      JSON.stringify(f.sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all()),
      /COVERING INDEX video_projects_version_id/,
    );
  } finally {
    f.sqlite.close();
  }
});

test("pagination rejects excessive, malformed and negative parameters", async () => {
  assert.deepEqual(parsePagination(new URLSearchParams()), {
    page: 1,
    pageSize: 10,
  });
  for (const params of [
    "page=0",
    "page=-1",
    "page=1.5",
    "page=abc",
    "pageSize=0",
    "pageSize=101",
    "page=1000001",
  ])
    assert.throws(() => parsePagination(new URLSearchParams(params)));
  const f = fixture();
  try {
    for (const params of ["publication=invalid", "version=-1", "pageSize=101"])
      await assert.rejects(f.load(params));
  } finally {
    f.sqlite.close();
  }
});

test("home totals share one aggregate scan and recent activity remains limited to eight lightweight rows", async () => {
  const f = fixture();
  try {
    const summary = await loadDashboardSummary(f.database);
    assert.equal(f.batches(), 1);
    assert.equal(f.queries.length, 2);
    assert.equal(summary.published.total, 69);
    assert.equal(summary.unpublished.total, 71);
    assert.equal(summary.recent.length, 8);
    assert.ok(
      summary.recent.every(
        (row) => !("settings" in row) && !("passage" in row),
      ),
    );
    f.sqlite.exec("DELETE FROM video_projects");
    const empty = await loadDashboardSummary(f.database);
    assert.deepEqual(empty, {
      projects: [],
      published: { total: 0 },
      unpublished: { total: 0 },
      recent: [],
    });
  } finally {
    f.sqlite.close();
  }
});
