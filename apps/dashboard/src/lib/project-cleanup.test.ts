import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  publishedCleanupProjects,
  publishedCleanupSchema,
} from "./project-cleanup";

test("cleanup uses saved publication and format, then rechecks confirmed IDs without including newly published projects", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE bible_versions(id INTEGER,code TEXT);
    CREATE TABLE video_projects(id INTEGER,kind TEXT,slug TEXT,published INTEGER,bible_version_id INTEGER);
    INSERT INTO bible_versions VALUES(1,'kjv');
    INSERT INTO video_projects VALUES(1,'short','one',1,1),(2,'short','two',0,1),(3,'long','three',1,1),(4,'short','four',1,1);`);
  const database = {
    prepare(query: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async all() {
              return { results: sqlite.prepare(query).all(...(args as any[])) };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  try {
    assert.deepEqual(
      (
        await publishedCleanupProjects(database, {
          action: "preview",
          kind: "short",
        })
      ).map((p) => p.id),
      [1, 4],
    );
    assert.deepEqual(
      (
        await publishedCleanupProjects(database, {
          action: "preview",
          kind: "long",
        })
      ).map((p) => p.id),
      [3],
    );
    sqlite.exec(
      "UPDATE video_projects SET published=0 WHERE id=1; UPDATE video_projects SET published=1 WHERE id=2;",
    );
    assert.deepEqual(
      (
        await publishedCleanupProjects(database, {
          action: "delete",
          kind: "short",
          ids: [1, 3, 4],
        })
      ).map((p) => p.id),
      [4],
    );
    assert.equal(
      publishedCleanupSchema.safeParse({ action: "delete", kind: "short" })
        .success,
      false,
    );
    assert.equal(
      publishedCleanupSchema.safeParse({
        action: "delete",
        kind: "short",
        ids: [],
      }).success,
      false,
    );
    assert.equal(
      sqlite.prepare("SELECT count(*) AS count FROM video_projects").get()
        ?.count,
      4,
    );
  } finally {
    sqlite.close();
  }
});
