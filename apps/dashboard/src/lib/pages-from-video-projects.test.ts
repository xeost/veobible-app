import { test } from "node:test";
import assert from "node:assert/strict";
import { websiteDatabase } from "./test-support/website-database";
import {
  pageVideoProjectPages,
  saveVideoProjectPage,
} from "./pages-from-video-projects";
function fixture() {
  const result = websiteDatabase();
  const { sqlite } = result;
  sqlite.exec(
    "INSERT INTO bible_versions(locale,code,label) VALUES('es','rv1909','RV1909'),('en','kjv','KJV')",
  );
  const insert = (
    kind: string,
    title: string,
    published = 1,
    version = 1,
    youtube = "abcdefghijk",
  ) => {
    const passage = JSON.stringify({
      book: "genesis",
      start: { chapter: 1, verse: 1 },
      end: { chapter: 1, verse: 3 },
      ...(kind === "long" ? { episode: 1 } : {}),
    });
    return Number(
      sqlite
        .prepare(
          "INSERT INTO video_projects(kind,bible_version_id,slug,title,passage,published,social_video_ids) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          kind,
          version,
          `p-${crypto.randomUUID()}`,
          title,
          passage,
          published,
          JSON.stringify(youtube ? { youtube } : {}),
        ).lastInsertRowid,
    );
  };
  return {
    ...result,
    insert,
    list: (params: Record<string, string>) =>
      pageVideoProjectPages(
        result.db,
        new URLSearchParams({ kind: "short", ...params }),
      ),
  };
}
test("series listings paginate independently, scope to socially published projects and clamp stale pages", async () => {
  const { db, sqlite, insert, list } = fixture();
  try {
    for (let i = 1; i <= 23; i++) insert("short", `Daily ${i}`);
    insert("long", "Day 1");
    insert("book", "Book");
    insert("short", "Draft", 0);
    const first = await list({ page: "1", pageSize: "10" });
    assert.equal(first.pages.length, 10);
    assert.equal(first.pagination.total, 23);
    assert.equal(first.pagination.pages, 3);
    assert.equal(first.pages[0].id, 1);
    assert.ok(first.pages[0].path?.includes("/dosis-diaria/"));
    const last = await list({ page: "100", pageSize: "10" });
    assert.equal(last.pagination.page, 3);
    assert.equal(last.pages.length, 3);
    const long = await pageVideoProjectPages(
      db,
      new URLSearchParams({ kind: "long" }),
    );
    assert.equal(long.pages.length, 1);
    assert.ok(long.pages[0].path?.includes("/biblia-en-365-dias/"));
    await assert.rejects(() => list({ pageSize: "101" }));
    await assert.rejects(() => list({ kind: "book" }));
  } finally {
    sqlite.close();
  }
});
test("page search, versions and inclusion filters match their counts and preserve literal search", async () => {
  const { db, sqlite, insert, list } = fixture();
  try {
    const a = insert("short", "GÉNESIS 100%");
    const b = insert("short", "English", 1, 2);
    const c = insert("short", "Missing", 1, 1, "");
    await saveVideoProjectPage(db, {
      videoProjectId: a,
      description: "A special description",
      included: false,
    });
    assert.equal((await list({ query: "génesis" })).pages[0].id, a);
    assert.equal((await list({ query: "special description" })).pages[0].id, a);
    assert.equal((await list({ query: "%" })).pagination.total, 1);
    assert.equal((await list({ query: "no results" })).pagination.total, 0);
    assert.deepEqual(
      (await list({ version: "2" })).pages.map((p) => p.id),
      [b],
    );
    assert.deepEqual(
      (await list({ filter: "excluded" })).pages.map((p) => p.id),
      [a],
    );
    assert.deepEqual(
      (await list({ filter: "missing-youtube" })).pages.map((p) => p.id),
      [c],
    );
    const included = await list({ filter: "included" });
    assert.equal(included.pagination.total, 2);
    assert.deepEqual(included.summary, { total: 3, included: 2, excluded: 1 });
    assert.equal(
      included.pages.find((p) => p.id === c)?.issue,
      "Missing YouTube video",
    );
    await assert.rejects(() => list({ version: "1 OR 1=1" }));
    await assert.rejects(() => list({ filter: "invalid" }));
  } finally {
    sqlite.close();
  }
});
test("description-only edits preserve inclusion and social IDs, and inclusion-only edits preserve description", async () => {
  const { db, sqlite, insert, list } = fixture();
  try {
    const id = insert("short", "Page");
    assert.equal(
      await saveVideoProjectPage(db, {
        videoProjectId: id,
        description: "Description",
        included: false,
      }),
      true,
    );
    await saveVideoProjectPage(db, {
      videoProjectId: id,
      description: "Updated",
    });
    assert.equal((await list({})).pages[0].included, 0);
    await saveVideoProjectPage(db, { videoProjectId: id, included: true });
    const page = (await list({})).pages[0];
    assert.equal(page.description, "Updated");
    assert.equal(page.included, 1);
    assert.ok(page.updated_at?.endsWith("Z"));
    const project = sqlite
      .prepare(
        "SELECT published,social_video_ids FROM video_projects WHERE id=?",
      )
      .get(id)!;
    assert.equal(project.published, 1);
    assert.equal(
      JSON.parse(project.social_video_ids as string).youtube,
      "abcdefghijk",
    );
    await saveVideoProjectPage(db, { videoProjectId: id, description: "" });
    assert.equal((await list({})).pages[0].description, "");
    assert.equal(
      await saveVideoProjectPage(db, {
        videoProjectId: insert("book", "Book"),
        description: "Not a page",
      }),
      false,
    );
    assert.equal(
      await saveVideoProjectPage(db, {
        videoProjectId: insert("short", "Draft", 0),
        description: "Not published",
      }),
      false,
    );
    await assert.rejects(() =>
      saveVideoProjectPage(db, { videoProjectId: id }),
    );
    await assert.rejects(() =>
      saveVideoProjectPage(db, {
        videoProjectId: id,
        description: "x",
        url: "https://example.com",
      }),
    );
    sqlite.prepare("DELETE FROM video_projects WHERE id=?").run(id);
    assert.equal(
      sqlite
        .prepare("SELECT count(*) AS count FROM pages_from_video_projects")
        .get()?.count,
      0,
    );
  } finally {
    sqlite.close();
  }
});
