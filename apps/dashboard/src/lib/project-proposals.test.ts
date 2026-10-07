import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { syncVideoProjects } from "./project-proposals";
import type { BibleVersion } from "./bible-versions";
test("project sync only adds missing slugs within a format and Bible version, retaining all existing project data", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../../migrations/0001_dashboard.sql", import.meta.url),
      "utf8",
    ),
  );
  const database = {
    prepare(query: string) {
      let args: any[] = [];
      const statement = {
        bind(...values: any[]) {
          args = values;
          return statement;
        },
        async first() {
          return sqlite.prepare(query).get(...args) ?? null;
        },
        async run() {
          return {
            meta: {
              changes: Number(sqlite.prepare(query).run(...args).changes),
            },
          };
        },
      };
      return statement;
    },
    async batch(statements: { run: () => Promise<unknown> }[]) {
      return Promise.all(statements.map((row) => row.run()));
    },
  } as unknown as D1Database;
  const spanish = {
    id: 1,
    locale: "es",
    code: "same",
    label: "Spanish",
    project_count: 0,
  } as BibleVersion;
  const english = {
    id: 2,
    locale: "en",
    code: "same",
    label: "English",
    project_count: 0,
  } as BibleVersion;
  const first = {
    id: 1,
    slug: "same-passage",
    title: "First",
    start: { book: "genesis", chapter: 1, verse: 1 },
    end: { book: "exodus", chapter: 2, verse: 3 },
  };
  const second = { ...first, id: 2, slug: "new-passage", title: "Second" };
  try {
    sqlite.exec(
      "INSERT INTO bible_versions(locale,code,label) VALUES ('es','same','Spanish'),('en','same','English')",
    );
    sqlite.prepare("INSERT INTO site_settings(key,value) VALUES (?,?)").run(
      "project_settings:short",
      JSON.stringify({
        es: { same: { volumeMultiplier: 1.5 } },
        en: { same: { volumeMultiplier: 2 } },
        pt: {},
      }),
    );
    assert.deepEqual(
      await syncVideoProjects(database, "short", spanish, [first]),
      { added: 1, total: 1 },
    );
    const saved = sqlite.prepare("SELECT * FROM video_projects").get()!;
    assert.equal(JSON.parse(String(saved.settings)).volumeMultiplier, 1.5);
    assert.equal(JSON.parse(String(saved.passage)).endBook, "exodus");
    sqlite.exec(
      "UPDATE video_projects SET title='User title',settings='{\"volumeMultiplier\":3}',published=1",
    );
    const original = sqlite.prepare("SELECT * FROM video_projects").get();
    assert.deepEqual(
      await syncVideoProjects(database, "short", spanish, [
        {
          ...first,
          title: "Upstream edit",
          end: { book: "john", chapter: 3, verse: 16 },
        },
        second,
      ]),
      { added: 1, total: 2 },
    );
    assert.deepEqual(
      sqlite.prepare("SELECT * FROM video_projects WHERE id=?").get(saved.id),
      original,
    );
    assert.deepEqual(
      await syncVideoProjects(database, "short", spanish, [first, second]),
      { added: 0, total: 2 },
    );
    assert.deepEqual(
      await syncVideoProjects(database, "short", english, [first]),
      { added: 1, total: 1 },
    );
    assert.deepEqual(
      await syncVideoProjects(database, "long", spanish, [first]),
      { added: 1, total: 1 },
    );
    const long = sqlite
      .prepare("SELECT passage FROM video_projects WHERE kind='long'")
      .get()!;
    assert.equal(JSON.parse(String(long.passage)).episode, 1);
    assert.deepEqual(await syncVideoProjects(database, "short", spanish, []), {
      added: 0,
      total: 0,
    });
    assert.equal(
      sqlite.prepare("SELECT count(*) count FROM video_projects").get()?.count,
      4,
    );
    await assert.rejects(
      syncVideoProjects(database, "short", spanish, [first, first]),
    );
    await assert.rejects(
      syncVideoProjects(database, "short", spanish, [
        { ...second, slug: "valid-new" },
        { ...first, slug: "../unsafe" },
      ]),
    );
    assert.equal(
      sqlite.prepare("SELECT count(*) count FROM video_projects").get()?.count,
      4,
    );
  } finally {
    sqlite.close();
  }
});
