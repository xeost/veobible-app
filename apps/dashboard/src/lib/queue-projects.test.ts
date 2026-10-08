import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { loadQueueProjects } from "./queue-projects";

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
  } finally {
    sqlite.close();
  }
});
