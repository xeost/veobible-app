import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { verifyPassword } from "./security";
const directory = new URL("../../migrations/", import.meta.url);
test("migrations preserve numeric project tables and only the requested admin", async () => {
  const migrations = readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.equal(migrations[0], "0001_dashboard.sql");
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
      db.prepare("SELECT sum(published) total FROM video_projects").get()
        ?.total,
      0,
    );
    assert.throws(
      () => db.exec("UPDATE video_projects SET published=2"),
      /CHECK/,
    );
    assert.throws(
      () => db.exec("UPDATE video_projects SET bible_version_id=99 WHERE id=1"),
      /FOREIGN KEY/,
    );
    const before = db.prepare("SELECT * FROM video_projects ORDER BY id").all();
    for (const name of migrations.slice(1))
      db.exec(readFileSync(new URL(name, directory), "utf8"));
    assert.deepEqual(
      db
        .prepare("SELECT * FROM video_projects ORDER BY id")
        .all()
        .map((row) => ({ ...row })),
      before.map((row) => ({ ...row, social_video_ids: "{}" })),
    );
    const columns = db
      .prepare("PRAGMA table_info(video_projects)")
      .all()
      .map((row) => row.name);
    assert.ok(columns.includes("published"));
    assert.ok(columns.includes("social_video_ids"));
    assert.ok(!columns.includes("used"));
    assert.ok(columns.includes("slug"));
    assert.ok(!columns.includes("passage_id"));
    assert.ok(!columns.includes("status"));
    assert.ok(!columns.includes("output_environment"));
    assert.ok(!columns.includes("published_at"));
  } finally {
    db.close();
  }
});

test("audio reset migration drops old projects and the environment column while preserving other tables", () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    const migrations = readdirSync(directory)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    for (const name of migrations.filter((name) => name < "0008"))
      sqlite.exec(readFileSync(new URL(name, directory), "utf8"));
    sqlite.exec(`
      INSERT INTO bible_versions(id,locale,code,label) VALUES(1,'es','rv1909','Reina Valera 1909');
      INSERT INTO video_projects(kind,bible_version_id,slug,title,passage) VALUES('short',1,'kept','Kept','{}');
      INSERT INTO site_settings(key,value) VALUES('kept','{}');
      INSERT INTO audio_projects(output_environment,bible_version_id,edition,book,title,book_order,chapter_count,verse_counts,settings)
        VALUES('production',1,'rv1909-v2','jude','Judas',65,1,'[25]','{}'),
              ('development',1,'rv1909-v3','jude','Judas',65,1,'[25]','{}');
    `);
    const kept = [
      "bible_versions",
      "video_projects",
      "site_settings",
      "dashboard_users",
    ].map((table) => ({
      table,
      rows: sqlite.prepare(`SELECT * FROM ${table}`).all(),
    }));
    sqlite.exec(
      readFileSync(new URL("0008_reset_audio_projects.sql", directory), "utf8"),
    );
    assert.equal(
      sqlite.prepare("SELECT count(*) total FROM audio_projects").get()?.total,
      0,
    );
    assert.ok(
      !sqlite
        .prepare("PRAGMA table_info(audio_projects)")
        .all()
        .some((row) => row.name === "output_environment"),
    );
    for (const { table, rows } of kept)
      assert.deepEqual(sqlite.prepare(`SELECT * FROM ${table}`).all(), rows);
    const insert = `INSERT INTO audio_projects(bible_version_id,edition,book,title,book_order,chapter_count,verse_counts,settings) VALUES(1,'rv1909-v2','jude','Judas',65,1,'[25]','{}')`;
    sqlite.exec(insert);
    assert.equal(sqlite.prepare("SELECT id FROM audio_projects").get()?.id, 1);
    assert.throws(() => sqlite.exec(insert), /UNIQUE/);
    assert.throws(
      () => sqlite.exec("UPDATE bible_versions SET code='changed' WHERE id=1"),
      /audio projects/,
    );
    assert.throws(
      () => sqlite.exec("UPDATE audio_projects SET bible_version_id=999"),
      /FOREIGN KEY/,
    );
    const indexNames = sqlite
      .prepare("PRAGMA index_list(audio_projects)")
      .all()
      .map((row) => row.name);
    for (const name of [
      "audio_projects_version_edition",
      "audio_projects_bible_version",
      "audio_projects_status",
    ])
      assert.ok(indexNames.includes(name));
  } finally {
    sqlite.close();
  }
});
