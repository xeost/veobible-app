import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { verifyPassword } from "./security";
const directory = new URL("../../migrations/", import.meta.url);
test("one migration creates numeric project tables and only the requested admin", async () => {
  assert.deepEqual(readdirSync(directory), ["0001_dashboard.sql"]);
  const sql = readFileSync(new URL("0001_dashboard.sql", directory), "utf8");
  assert.equal((sql.match(/INSERT INTO/gi) ?? []).length, 1);
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(sql);
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row) => row.name);
    for (const name of [
      "catalog",
      "jobs",
      "projects",
      "users",
      "versions",
      "sessions",
      "login_attempts",
      "version_settings",
    ])
      assert.ok(!names.includes(name));
    const user = db.prepare("SELECT * FROM dashboard_users").get()!;
    assert.equal(user.id, 1);
    assert.equal(user.username, "admin");
    assert.equal(
      await verifyPassword("admin123", user.password_hash as string),
      true,
    );
    for (const table of [
      "video_projects",
      "bible_versions",
      "site_settings",
      "deployments",
    ])
      assert.equal(
        db.prepare(`SELECT count(*) total FROM ${table}`).get()?.total,
        0,
      );
    db.exec(
      "INSERT INTO bible_versions(locale,code,label) VALUES ('es','same','Spanish'),('en','same','English')",
    );
    db.exec(
      "INSERT INTO video_projects(kind,bible_version_id,slug,title,passage) VALUES ('short',1,'test','Project','{}'),('short',2,'test','Project','{}')",
    );
    assert.deepEqual(
      db
        .prepare("SELECT id FROM video_projects ORDER BY id")
        .all()
        .map((row) => row.id),
      [1, 2],
    );
    assert.equal(
      db.prepare("SELECT sum(published) total FROM video_projects").get()?.total,
      0,
    );
    assert.throws(() => db.exec("UPDATE video_projects SET published=2"), /CHECK/);
    assert.throws(
      () => db.exec("UPDATE video_projects SET bible_version_id=99 WHERE id=1"),
      /FOREIGN KEY/,
    );
    const columns = db
      .prepare("PRAGMA table_info(video_projects)")
      .all()
      .map((row) => row.name);
    assert.ok(columns.includes("published"));
    assert.ok(!columns.includes("used"));
    assert.ok(columns.includes("slug"));
    assert.ok(!columns.includes("passage_id"));
    assert.ok(!columns.includes("status"));
    assert.ok(!columns.includes("published_at"));
  } finally {
    db.close();
  }
});
