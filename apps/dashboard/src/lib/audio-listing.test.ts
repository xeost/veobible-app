import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { pageAudioProjects } from "./audio-listing";
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  const directory = new URL("../../migrations/", import.meta.url);
  for (const file of readdirSync(directory)
    .filter((file) => file.endsWith(".sql"))
    .sort())
    sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  sqlite.exec(
    "INSERT INTO bible_versions(id,locale,code,label) VALUES(1,'es','rv1909','Reina Valera 1909'),(2,'en','kjv','King James Version')",
  );
  const insert = sqlite.prepare(
    `INSERT INTO audio_projects(bible_version_id,edition,book,title,book_order,chapter_count,verse_counts,settings,recordings,chapters,status) VALUES(?,?,?,?,?,2,'[2,2]',?,?,?,?)`,
  );
  for (let i = 1; i <= 66; i++)
    insert.run(
      1,
      "rv1909-v2",
      `book-${i}`,
      i === 2 ? "ÉXODO" : `Libro ${i}`,
      i,
      JSON.stringify({ private: "x".repeat(1000) }),
      JSON.stringify({ private: "x".repeat(1000) }),
      i % 2 === 0
        ? "{}"
        : '{"1":{"file":"chapter.mp3"},"2":{"file":"chapter2.mp3"}}',
      i % 2 === 0 ? "draft" : "done",
    );
  insert.run(
    1,
    "rv1909-v10",
    "book-1",
    "Libro siguiente",
    1,
    "{}",
    "{}",
    "{}",
    "failed",
  );
  insert.run(2, "kjv-v2", "jude", "Jude", 65, "{}", "{}", "{}", "queued");
  const queries: string[] = [];
  const database = {
    prepare(sql: string) {
      let args: any[] = [];
      const statement = {
        bind(...values: any[]) {
          args = values;
          return statement;
        },
        async all() {
          queries.push(sql);
          return { results: sqlite.prepare(sql).all(...args) };
        },
      };
      return statement;
    },
    async batch(statements: { all: () => Promise<unknown> }[]) {
      return Promise.all(statements.map((statement) => statement.all()));
    },
  } as unknown as D1Database;
  return { sqlite, database, queries };
}
test("audio catalogue pages in book order, uses lightweight rows and isolates editions and environments", async () => {
  const { sqlite, database, queries } = fixture();
  try {
    const page = await pageAudioProjects(
      database,
      new URLSearchParams({ edition: "rv1909-v2", page: "2", pageSize: "10" }),
      "development",
    );
    assert.equal(page.projects.length, 10);
    assert.equal(page.projects[0].book, "book-11");
    assert.equal(page.projects[9].book, "book-20");
    assert.deepEqual(page.pagination, {
      page: 2,
      pageSize: 10,
      total: 66,
      pages: 7,
    });
    assert.deepEqual(page.summary, { total: 66, pending: 33, generated: 33 });
    assert.equal(page.projects[0].completedChapters, 2);
    assert.equal("recordings" in page.projects[0], false);
    assert.equal("settings" in page.projects[0], false);
    assert.equal(page.editions.length, 3);
    assert.ok(
      queries.every(
        (sql) =>
          !sql.includes("p.*") &&
          !sql.includes("p.settings") &&
          !sql.includes("p.recordings"),
      ),
    );
  } finally {
    sqlite.close();
  }
});
test("audio search and status filters affect pagination while summary retains edition totals", async () => {
  const { sqlite, database } = fixture();
  try {
    const query = await pageAudioProjects(
      database,
      new URLSearchParams({ edition: "rv1909-v2", query: "éxodo" }),
      "development",
    );
    assert.equal(query.projects.length, 1);
    assert.equal(query.projects[0].title, "ÉXODO");
    assert.equal(query.summary.total, 66);
    const draft = await pageAudioProjects(
      database,
      new URLSearchParams({
        edition: "rv1909-v2",
        status: "draft",
        pageSize: "20",
      }),
      "development",
    );
    assert.equal(draft.pagination.total, 33);
    assert.ok(draft.projects.every((p) => p.status === "draft"));
    assert.equal(draft.summary.generated, 33);
    const literal = await pageAudioProjects(
      database,
      new URLSearchParams({ query: "%_" }),
      "development",
    );
    assert.equal(literal.pagination.total, 0);
    const sorted = await pageAudioProjects(
      database,
      new URLSearchParams({ pageSize: "100" }),
      "development",
    );
    const rows = sorted.projects.filter((p) => p.version.code === "rv1909");
    assert.equal(rows[0].edition, "rv1909-v2");
    assert.equal(rows.at(-1)?.edition, "rv1909-v10");
  } finally {
    sqlite.close();
  }
});
test("audio pagination clamps missing pages and validates filters", async () => {
  const { sqlite, database } = fixture();
  try {
    const last = await pageAudioProjects(
      database,
      new URLSearchParams({
        edition: "rv1909-v2",
        page: "999",
        pageSize: "20",
      }),
      "development",
    );
    assert.equal(last.pagination.page, 4);
    assert.equal(last.projects.length, 6);
    const empty = await pageAudioProjects(
      database,
      new URLSearchParams({ query: "not found" }),
      "development",
    );
    assert.equal(empty.projects.length, 0);
    assert.equal(empty.pagination.pages, 1);
    const invalidFilters: Record<string, string>[] = [
      { pageSize: "1000" },
      { status: "invalid" },
      { edition: "../rv1909" },
    ];
    for (const values of invalidFilters)
      await assert.rejects(
        pageAudioProjects(database, new URLSearchParams(values), "development"),
      );
  } finally {
    sqlite.close();
  }
});

test("marked audio lookup returns only selected projects in the active environment", async () => {
  const { sqlite, database } = fixture();
  try {
    const params = new URLSearchParams({ ids: "1,2,69,999", pageSize: "100" });
    const development = await pageAudioProjects(
      database,
      params,
      "development",
    );
    assert.deepEqual(
      development.projects.map((row) => row.id),
      [1, 2],
    );
    assert.equal(development.pagination.total, 2);
    assert.equal("recordings" in development.projects[0], false);
    const production = await pageAudioProjects(database, params, "production");
    assert.deepEqual(
      production.projects.map((row) => row.id),
      [1, 2],
    );
    for (const ids of [
      "",
      "1,invalid",
      "-1",
      "1.5",
      Array(81).fill("1").join(","),
    ]) {
      await assert.rejects(
        pageAudioProjects(
          database,
          new URLSearchParams({ ids }),
          "development",
        ),
      );
    }
  } finally {
    sqlite.close();
  }
});

test("next audio projects are ordered by ID within the same edition and environment", async () => {
  const { sqlite, database } = fixture();
  try {
    // Book order can differ from insertion order: advancing follows IDs.
    sqlite.exec("UPDATE audio_projects SET book_order=100 WHERE id=2");
    const params = new URLSearchParams({
      edition: "rv1909-v2",
      afterId: "1",
      pageSize: "3",
    });
    assert.deepEqual(
      (await pageAudioProjects(database, params, "development")).projects.map(
        (row) => row.id,
      ),
      [2, 3, 4],
    );
    params.set("afterId", "66");
    assert.equal(
      (await pageAudioProjects(database, params, "development")).projects
        .length,
      0,
    );
    params.set("afterId", "69");
    assert.equal(
      (await pageAudioProjects(database, params, "production")).projects.length,
      0,
    );
    for (const value of ["0", "-1", "invalid", "1.5"]) {
      params.set("afterId", value);
      await assert.rejects(pageAudioProjects(database, params, "development"));
    }
  } finally {
    sqlite.close();
  }
});
