import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { listVideoProjects } from "./video-listing";
import {
  parseCurrentProjects,
  currentProjectStorageKey,
  projectVersionKey,
} from "./current-video-projects";

test("current project marks retain separate language and format scopes and reject invalid saved IDs", () => {
  assert.notEqual(
    currentProjectStorageKey("short"),
    currentProjectStorageKey("long"),
  );
  assert.notEqual(
    projectVersionKey({ locale: "es", version_code: "test" } as any),
    projectVersionKey({ locale: "en", version_code: "test" } as any),
  );
  assert.deepEqual(
    parseCurrentProjects('{"es:test":14,"en:test":23,"bad":-1,"text":"42"}'),
    { "es:test": 14, "en:test": 23 },
  );
  for (const input of [null, "broken", "[]", "null"])
    assert.deepEqual(parseCurrentProjects(input), {});
});

test("marked project listings return only requested IDs in the matching format and version", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE bible_versions(id INTEGER,code TEXT,locale TEXT,label TEXT);
    CREATE TABLE video_projects(id INTEGER,kind TEXT,title TEXT,published INTEGER,updated_at TEXT,bible_version_id INTEGER);
    INSERT INTO bible_versions VALUES(1,'test','es','Test'),(2,'test','en','Test');
    INSERT INTO video_projects VALUES(1,'short','One',0,null,1),(2,'short','Two',1,null,2),(3,'long','Three',0,null,1),(4,'short','Four',0,null,1);`);
  const database = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async all() {
              return { results: sqlite.prepare(sql).all(...(values as any[])) };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  try {
    const rows = await listVideoProjects(database, "short", "1", "1,2,3,999");
    assert.deepEqual(
      rows.map((row) => row.id),
      [1],
    );
    const allVersions = await listVideoProjects(
      database,
      "short",
      null,
      "1,2,3,999",
    );
    assert.deepEqual(
      allVersions.map((row) => row.id),
      [1, 2],
    );
    await assert.rejects(listVideoProjects(database, "short", null, "1,-2"));
  } finally {
    sqlite.close();
  }
});
