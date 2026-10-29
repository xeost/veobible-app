import { test } from "node:test";
import assert from "node:assert/strict";
import { websiteDatabase } from "./test-support/website-database";
import { pendingContext } from "./website-youtube";
import { saveSocialSettings, emptySocialSettings } from "./social-settings";

test("pending YouTube query uses its partial index and tracks missing IDs automatically", async () => {
  const { sqlite, db, queries } = websiteDatabase();
  try {
    const accounts = emptySocialSettings();
    accounts.es.youtube = "veobible-es";
    await saveSocialSettings(db, accounts);
    sqlite.exec(`INSERT INTO bible_versions(locale,code,label) VALUES('es','rv1909','RV1909');
      WITH RECURSIVE numbers(id) AS (SELECT 1 UNION ALL SELECT id+1 FROM numbers WHERE id<10000)
      INSERT INTO video_projects(kind,bible_version_id,slug,title,passage,published,social_video_ids)
      SELECT 'short',1,'project-'||id,'Published video','{}',1,'{"youtube":"abcdefghijk"}' FROM numbers;
      INSERT INTO video_projects(kind,bible_version_id,slug,title,passage,published,social_video_ids) VALUES
      ('short',1,'missing','Missing','{}',1,'{}'),
      ('long',1,'null-id','Null ID','{}',1,'{"youtube":null}'),
      ('book',1,'empty-id','Empty ID','{}',1,'{"youtube":""}'),
      ('short',1,'known','Known','{}',1,'{"youtube":"abcdefghijk"}'),
      ('short',1,'draft','Draft','{}',0,'{}');
      ANALYZE;`);
    const before = await pendingContext(db);
    assert.deepEqual(
      before.projects.map((p) => p.id),
      [10003, 10002, 10001],
    );
    const query = queries.find((q) =>
      q.startsWith("SELECT p.id,p.kind,p.title"),
    )!;
    const plan = sqlite
      .prepare(`EXPLAIN QUERY PLAN ${query}`)
      .all()
      .map((row) => String(row.detail));
    assert.ok(
      plan.some((detail) => detail.includes("video_projects_pending_youtube")),
      plan.join("\n"),
    );
    assert.ok(
      !plan.some((detail) => detail.includes("TEMP B-TREE")),
      plan.join("\n"),
    );
    sqlite.exec(`UPDATE video_projects SET social_video_ids=json_set(social_video_ids,'$.youtube','abcdefghijk') WHERE id=10003;
      UPDATE video_projects SET published=0 WHERE id=10002;`);
    assert.deepEqual(
      (await pendingContext(db)).projects.map((p) => p.id),
      [10001],
    );
    sqlite.exec(
      `UPDATE video_projects SET social_video_ids=json_remove(social_video_ids,'$.youtube') WHERE id=10004`,
    );
    assert.deepEqual(
      (await pendingContext(db)).projects.map((p) => p.id),
      [10004, 10001],
    );
  } finally {
    sqlite.close();
  }
});
