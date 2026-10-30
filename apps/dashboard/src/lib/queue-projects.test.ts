import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { loadQueueProjects, loadQueueView } from "./queue-projects";

test("queue queries only participant IDs, deduplicates them and skips the database when idle", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const queries: { sql: string; ids: number[] }[] = [];
  sqlite.exec(
    "CREATE TABLE bible_versions(id INTEGER,code TEXT); CREATE TABLE video_projects(id INTEGER,kind TEXT,title TEXT,bible_version_id INTEGER,settings TEXT); INSERT INTO bible_versions VALUES(1,'rv1909');",
  );
  const insert = sqlite.prepare(
    "INSERT INTO video_projects VALUES(?,'short','Test',1,?)",
  );
  for (let id = 1; id <= 200; id++)
    insert.run(id, "large settings payload".repeat(100));
  const database = {
    prepare(sql: string) {
      return {
        bind(...ids: number[]) {
          queries.push({ sql, ids });
          return {
            async all() {
              return { results: sqlite.prepare(sql).all(...ids) };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  try {
    assert.equal((await loadQueueProjects(database, [])).size, 0);
    assert.equal(queries.length, 0);
    const projects = await loadQueueProjects(database, [3, 3, 5, -1, NaN, 999]);
    assert.deepEqual([...projects.keys()], [3, 5]);
    assert.deepEqual(queries[0].ids, [3, 5, 999]);
    assert.equal(projects.get(3)?.version_code, "rv1909");
    assert.ok(!("settings" in projects.get(3)!));
    assert.ok(!queries[0].sql.includes("p.*"));
    sqlite.exec("UPDATE video_projects SET kind='long' WHERE id=5;");
    const entries = [
      {
        projectId: 3,
        kind: "short",
        status: "done",
        type: "intro",
        finishedAt: "2026-10-08T01:00:00Z",
      },
      { projectId: 5, kind: "long", status: "failed", type: "video" },
      { projectId: 7, kind: "short", status: "running", type: "outro" },
      { projectId: 999, kind: "short", status: "done", type: "video" },
      { projectId: 5, kind: "short", status: "done", type: "outro" },
    ];
    queries.length = 0;
    const sidebar = await loadQueueView(database, entries, false);
    assert.equal(sidebar.history, undefined);
    assert.deepEqual(queries[0].ids, [7]);
    assert.equal(sidebar.items[0].href, "/short-videos/7");
    queries.length = 0;
    const modal = await loadQueueView(database, entries, true);
    assert.deepEqual(queries[0].ids, [7, 3, 5, 999]);
    assert.deepEqual(
      modal.history?.map((item) => item.href),
      ["/short-videos/3", "/long-videos/5"],
    );
    assert.equal(modal.history?.[0].finishedAt, entries[0].finishedAt);
    assert.equal(modal.history?.[0].type, "intro");
    assert.equal(modal.history?.[1].status, "failed");
    queries.length = 0;
    assert.equal(
      (
        await loadQueueProjects(
          database,
          Array.from({ length: 200 }, (_, i) => i + 1),
        )
      ).size,
      200,
    );
    assert.deepEqual(
      queries.map((query) => query.ids.length),
      [90, 90, 20],
    );
    sqlite.exec(
      "CREATE TABLE audio_projects(id INTEGER,title TEXT,edition TEXT,book TEXT,bible_version_id INTEGER); INSERT INTO audio_projects VALUES(3,'Génesis','rv1909-v2','genesis',1)",
    );
    queries.length = 0;
    const audioEntry = {
      projectId: 3,
      kind: "audio",
      type: "audio-verse",
      status: "running",
      chapter: 1,
      verse: 2,
      outputEnvironment: "development",
    };
    const mixed = await loadQueueView(
      database,
      [...entries.slice(0, 1), audioEntry],
      true,
      "development",
    );
    assert.equal(mixed.items[0].href, "/audios/rv1909-v2/genesis");
    assert.equal(mixed.items[0].title, "Génesis");
    assert.ok("verse" in mixed.items[0]);
    assert.equal(mixed.items[0].verse, 2);
    assert.equal(mixed.history?.[0].href, "/short-videos/3");
    assert.equal(
      (
        await loadQueueView(
          database,
          [{ ...audioEntry, outputEnvironment: "production" }],
          false,
          "development",
        )
      ).items.length,
      0,
    );
  } finally {
    sqlite.close();
  }
});

test("voice examples appear in the queue and history without project database lookups", async () => {
  const database = {
    prepare() {
      throw new Error("Samples must not query project tables");
    },
  } as unknown as D1Database;
  const sample = {
    id: "sample-1",
    projectId: null,
    type: "voice-sample",
    kind: "voice-sample",
    voice: "es-2",
    locale: "es",
    status: "running",
    progress: 45,
    finishedAt: undefined as string | undefined,
  };
  const entries = [
    sample,
    {
      ...sample,
      id: "sample-2",
      status: "done",
      finishedAt: "2026-10-21T12:00:00Z",
    },
    { ...sample, id: "sample-3", status: "failed" },
  ];
  const active = await loadQueueView(database, entries, false);
  assert.equal(active.items.length, 1);
  assert.equal(active.items[0].href, "/admin-tools");
  assert.equal(active.items[0].progress, 45);
  assert.equal(active.items[0].voice, "es-2");
  assert.equal(active.history, undefined);
  const full = await loadQueueView(database, entries, true);
  assert.deepEqual(
    full.history?.map((item) => item.status),
    ["done", "failed"],
  );
  assert.equal(full.history?.[0].finishedAt, entries[1].finishedAt);
});
