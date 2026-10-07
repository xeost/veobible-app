import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { syncExistingProjects } from "./existing-projects";

test("existing project sync only updates matching states, never inserts projects, retains edits and skips active work", async () => {
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
        async all() {
          return { results: sqlite.prepare(query).all(...args) };
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
  const row = {
    slug: "john-3-16",
    title: "Juan 3:16",
    version: { locale: "es", code: "same", label: "Spanish" },
    passage: {
      id: "john-3-16",
      book: "john",
      endBook: "john",
      start: { chapter: 3, verse: 16 },
      end: { chapter: 3, verse: 16 },
    },
    settings: {
      passageOffsets: { startSeconds: 0.25, endSeconds: -0.1 },
      verseOffsets: [
        {
          reference: "Juan 3:16",
          startOffsetSeconds: 0,
          endOffsetSeconds: -0.1,
        },
      ],
      volumeMultiplier: 2,
    },
    published: true,
  };
  const input = { projects: [row], skipped: 0 };
  try {
    sqlite.exec(
      "INSERT INTO bible_versions(locale,code,label) VALUES ('es','same','Spanish'),('en','same','English')",
    );
    assert.deepEqual(await syncExistingProjects(database, "short", input), {
      updated: 0,
      unchanged: 0,
      skipped: 0,
      total: 1,
    });
    assert.equal(
      sqlite.prepare("SELECT count(*) total FROM video_projects").get()?.total,
      0,
    );
    sqlite
      .prepare(
        "INSERT INTO video_projects(kind,bible_version_id,slug,title,passage) VALUES ('short',1,?,?,?)",
      )
      .run(row.slug, "Original title", JSON.stringify(row.passage));
    assert.deepEqual(await syncExistingProjects(database, "short", input), {
      updated: 1,
      unchanged: 0,
      skipped: 0,
      total: 1,
    });
    const project = sqlite.prepare("SELECT * FROM video_projects").get()!;
    assert.equal(project.published, 1);
    assert.equal("output_environment" in project, false);
    assert.deepEqual(
      JSON.parse(String(project.settings)).verseOffsets,
      row.settings.verseOffsets,
    );
    sqlite
      .prepare(
        "UPDATE video_projects SET title='My title',settings=? WHERE id=?",
      )
      .run(
        JSON.stringify({
          ...JSON.parse(String(project.settings)),
          reuseVoices: false,
          clipAudioMode: "mix",
        }),
        project.id,
      );
    assert.equal(
      (await syncExistingProjects(database, "short", input)).unchanged,
      1,
    );
    assert.equal(
      sqlite.prepare("SELECT title FROM video_projects").get()?.title,
      "My title",
    );
    const beforeUnmatched = sqlite
      .prepare("SELECT * FROM video_projects")
      .all();
    assert.equal(
      (
        await syncExistingProjects(database, "short", {
          projects: [
            {
              ...row,
              slug: "different-passage",
              passage: { ...row.passage, id: "different-passage" },
            },
          ],
          skipped: 0,
        })
      ).updated,
      0,
    );
    assert.deepEqual(
      sqlite.prepare("SELECT * FROM video_projects").all(),
      beforeUnmatched,
    );
    assert.equal(
      (
        await syncExistingProjects(database, "short", {
          ...input,
          projects: [{ ...row, published: false }],
          activeProjectIds: [project.id],
        })
      ).skipped,
      1,
    );
    assert.equal(
      sqlite.prepare("SELECT published FROM video_projects").get()?.published,
      1,
    );
    assert.equal(
      (
        await syncExistingProjects(database, "short", {
          ...input,
          projects: [
            { ...row, published: false, settings: { volumeMultiplier: 3 } },
          ],
        })
      ).updated,
      1,
    );
    const updated = sqlite.prepare("SELECT * FROM video_projects").get()!;
    assert.equal(updated.published, 0);
    assert.equal("reuseVoices" in JSON.parse(String(updated.settings)), false);
    assert.equal(
      "clipAudioMode" in JSON.parse(String(updated.settings)),
      false,
    );
    assert.equal(JSON.parse(String(updated.settings)).volumeMultiplier, 3);
    assert.deepEqual(
      JSON.parse(String(updated.settings)).verseOffsets,
      row.settings.verseOffsets,
    );
    assert.equal(
      (
        await syncExistingProjects(database, "short", {
          projects: [{ ...row, version: { ...row.version, locale: "en" } }],
          skipped: 0,
        })
      ).updated,
      0,
    );
    assert.equal(
      (
        await syncExistingProjects(database, "long", {
          projects: [
            {
              ...row,
              passage: { ...row.passage, episode: 1, endBook: "exodus" },
            },
          ],
          skipped: 0,
        })
      ).updated,
      0,
    );
    assert.equal(
      (
        await syncExistingProjects(database, "short", {
          projects: [{ ...row, version: { ...row.version, code: "missing" } }],
          skipped: 0,
        })
      ).skipped,
      0,
    );
    assert.equal(
      (await syncExistingProjects(database, "short", input)).updated,
      1,
    );
    assert.equal(
      sqlite.prepare("SELECT count(*) total FROM video_projects").get()?.total,
      1,
    );
    assert.equal(
      (await syncExistingProjects(database, "short", input)).unchanged,
      1,
    );
  } finally {
    sqlite.close();
  }
});
