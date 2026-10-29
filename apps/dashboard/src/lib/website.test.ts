import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import {
  websiteState,
  publicationContent,
  contentRevision,
  publicationChanges,
} from "./website";
function database() {
  const sqlite = new DatabaseSync(":memory:");
  for (const name of readdirSync(new URL("../../migrations/", import.meta.url))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    sqlite.exec(
      readFileSync(
        new URL(`../../migrations/${name}`, import.meta.url),
        "utf8",
      ),
    );
  for (const kind of ["short", "long", "book"])
    sqlite.prepare("INSERT INTO site_settings(key,value) VALUES(?,?)").run(
      `publication_templates:${kind}`,
      JSON.stringify({
        es: { youtube: "# Título\n{reference}" },
        en: { youtube: "# Title\n{reference}" },
        pt: { youtube: "# Título\n{reference}" },
      }),
    );
  const prepare = (sql: string) => {
    let args: any[] = [];
    const stmt = {
      bind(...v: any[]) {
        args = v;
        return stmt;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...args) };
      },
      async first() {
        return sqlite.prepare(sql).get(...args) ?? null;
      },
      async run() {
        return { meta: sqlite.prepare(sql).run(...args) };
      },
    };
    return stmt;
  };
  return {
    sqlite,
    db: {
      prepare,
      batch: async (ss: any[]) => Promise.all(ss.map((s) => s.run())),
    } as unknown as D1Database,
  };
}
test("website includes only socially published short/long projects, blocks missing links and preserves social status", async () => {
  const { sqlite, db } = database();
  sqlite.exec(
    "INSERT INTO bible_versions(locale,code,label) VALUES('es','rv1909','RV1909')",
  );
  const passage = JSON.stringify({
    book: "genesis",
    start: { chapter: 1, verse: 1 },
    end: { chapter: 1, verse: 3 },
  });
  const insert = sqlite.prepare(
    "INSERT INTO video_projects(kind,bible_version_id,slug,title,passage,published) VALUES(?,1,?,?,?,?)",
  );
  insert.run("short", "short", "Short", passage, 1);
  insert.run("long", "draft", "Draft", passage, 0);
  insert.run("book", "book", "Book", passage, 1);
  let state = await websiteState(db);
  assert.equal(state.projects.length, 1);
  assert.equal(state.projects[0].issue, "Missing YouTube video");
  await assert.rejects(() => publicationContent(db), /Review website/);
  sqlite.exec(
    "UPDATE video_projects SET social_video_ids='{\"youtube\":\"abcdefghijk\"}' WHERE id=1; INSERT INTO pages_from_video_projects(video_project_id,description) VALUES(1,'Editorial text')",
  );
  const content = await publicationContent(db);
  assert.equal(content.publications.length, 1);
  assert.equal(content.publications[0].description, "Editorial text");
  const revision = await contentRevision(content);
  sqlite.exec("UPDATE pages_from_video_projects SET description='New text'");
  assert.notEqual(
    await contentRevision(await publicationContent(db)),
    revision,
  );
  sqlite.exec("UPDATE pages_from_video_projects SET included=0");
  assert.equal((await publicationContent(db)).publications.length, 0);
  assert.equal(
    sqlite.prepare("SELECT published FROM video_projects WHERE id=1").get()
      ?.published,
    1,
  );
  sqlite.exec("UPDATE video_projects SET published=0 WHERE id=1");
  assert.equal((await websiteState(db)).projects.length, 0);
});

test("publication review lists new, updated and removed pages", () => {
  const p = {
    projectId: 1,
    kind: "short" as const,
    locale: "es" as const,
    version: "rv1909",
    slug: "one",
    title: "One",
    description: "",
    youtubeId: "abcdefghijk",
    passage: {
      book: "genesis",
      start: { chapter: 1, verse: 1 },
      end: { chapter: 1, verse: 2 },
    },
  };
  const previous = {
    schema: 1 as const,
    bookVideos: [],
    publications: [p, { ...p, projectId: 2, slug: "removed" }],
  };
  const current = {
    ...previous,
    publications: [
      { ...p, description: "Updated" },
      { ...p, projectId: 3, slug: "new" },
    ],
  };
  assert.deepEqual(
    publicationChanges(current, previous).map((c) => c.action),
    ["Updated page", "New page", "Page to remove"],
  );
});

test("social IDs come from projects, preserve other platforms and use Settings channels", async () => {
  const { sqlite, db } = database();
  sqlite.exec(`INSERT INTO bible_versions(locale,code,label) VALUES('es','rv1909','RV1909');
 INSERT INTO video_projects(kind,bible_version_id,slug,title,passage,published,social_video_ids) VALUES('book',1,'genesis','Génesis','{"book":"genesis"}',1,'{"instagram":"keep-me"}');`);
  sqlite.exec(
    `UPDATE video_projects SET social_video_ids=json_set(social_video_ids,'$.youtube','abcdefghijk') WHERE id=1`,
  );
  assert.deepEqual(
    JSON.parse(
      sqlite.prepare("SELECT social_video_ids FROM video_projects").get()!
        .social_video_ids as string,
    ),
    { instagram: "keep-me", youtube: "abcdefghijk" },
  );
  const { saveSocialSettings, emptySocialSettings } =
    await import("./social-settings");
  const accounts = emptySocialSettings();
  accounts.es.youtube = "configured-channel";
  await saveSocialSettings(db, accounts);
  const state = await websiteState(db);
  assert.equal(
    state.sources.find((s) => s.locale === "es")?.channel,
    "@configured-channel",
  );
  assert.equal(state.socialProjects.length, 1);
  assert.equal(state.projects.length, 0);
  assert.equal(
    state.content.bookVideos.find(
      (b) =>
        b.locale === "es" && b.version === "rv1909" && b.book === "genesis",
    )?.youtubeId,
    "abcdefghijk",
  );
  assert.throws(() =>
    sqlite.exec("UPDATE video_projects SET social_video_ids='[]'"),
  );
});

test("YouTube detection stores project social IDs without overwriting other platforms or known IDs", async () => {
  const { sqlite, db } = database();
  const { saveSocialSettings, emptySocialSettings } =
    await import("./social-settings");
  const accounts = emptySocialSettings();
  accounts.es.youtube = "veobible-es";
  await saveSocialSettings(db, accounts);
  sqlite.exec(`INSERT INTO bible_versions(locale,code,label) VALUES('es','rv1909','RV1909');
 INSERT INTO video_projects(kind,bible_version_id,slug,title,passage,published,social_video_ids) VALUES('book',1,'genesis','Génesis','{"book":"genesis"}',1,'{"tiktok":"keep"}');
 INSERT INTO social_video_cache(platform,video_id,account,title,published_at) VALUES('youtube','abcdefghijk','@veobible-es','Génesis','2026-10-01');`);
  const { detectVideos } = await import("./website-youtube");
  assert.equal((await detectVideos(db)).projects, 1);
  const ids = JSON.parse(
    sqlite.prepare("SELECT social_video_ids FROM video_projects").get()!
      .social_video_ids as string,
  );
  assert.deepEqual(ids, { tiktok: "keep", youtube: "abcdefghijk" });
  assert.equal((await detectVideos(db)).projects, 0);
  assert.equal(
    sqlite
      .prepare("SELECT count(*) AS count FROM pages_from_video_projects")
      .get()?.count,
    0,
  );
});

test("detection stays bounded and automatically continues across batches", async () => {
  const { sqlite, db } = database();
  const { saveSocialSettings, emptySocialSettings } =
    await import("./social-settings");
  const accounts = emptySocialSettings();
  accounts.es.youtube = "veobible-es";
  await saveSocialSettings(db, accounts);
  sqlite.exec(
    "INSERT INTO bible_versions(locale,code,label) VALUES('es','rv1909','RV1909')",
  );
  for (let i = 1; i <= 21; i++) {
    sqlite
      .prepare(
        "INSERT INTO video_projects(kind,bible_version_id,slug,title,passage,published) VALUES('short',1,?,?,?,1)",
      )
      .run(`project-${i}`, `Title ${i}`, "{}");
    sqlite
      .prepare(
        "INSERT INTO social_video_cache(platform,video_id,account,title,published_at) VALUES('youtube',?,?,?,?)",
      )
      .run(
        String(i).padStart(11, "0"),
        "@veobible-es",
        `Title ${i}`,
        "2026-10-01",
      );
  }
  const { detectVideos } = await import("./website-youtube");
  const first = await detectVideos(db);
  assert.equal(first.projects, 20);
  assert.equal(first.more, true);
  const second = await detectVideos(db);
  assert.equal(second.projects, 1);
  assert.equal(second.more, false);
});

test("book title templates use the localized book reference", async () => {
  const { sqlite, db } = database();
  const { saveSocialSettings, emptySocialSettings } =
    await import("./social-settings");
  const accounts = emptySocialSettings();
  accounts.es.youtube = "veobible-es";
  await saveSocialSettings(db, accounts);
  sqlite.exec(`INSERT INTO bible_versions(locale,code,label) VALUES('es','rv1909','RV1909');
 INSERT INTO video_projects(kind,bible_version_id,slug,title,passage,published) VALUES('book',1,'genesis','Génesis completo: RV1909','{"book":"genesis"}',1);
 INSERT INTO social_video_cache(platform,video_id,account,title,published_at) VALUES('youtube','abcdefghijk','@veobible-es','GÉNESIS','2026-10-01');`);
  const { detectVideos } = await import("./website-youtube");
  assert.equal((await detectVideos(db)).books, 1);
});
