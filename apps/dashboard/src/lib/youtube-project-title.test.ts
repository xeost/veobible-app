import { test } from "node:test";
import assert from "node:assert/strict";
import { youtubeProjectTitle } from "./youtube-project-title";
import { type PendingProject, detectVideos } from "./website-youtube";
import { websiteDatabase } from "./test-support/website-database";
import { emptySocialSettings, saveSocialSettings } from "./social-settings";
import {
  emptyPublicationSettings,
  savePublicationSettings,
} from "./publication-settings";
import { catalog } from "../../../../packages/website/content";
import {
  publicationDescriptions,
  publicationTitle,
} from "../../../../tools/video-project-api/src/publication";
const passage = {
  book: "john",
  start: { chapter: 3, verse: 14 },
  end: { chapter: 3, verse: 19 },
};
const project: PendingProject = {
  id: 1,
  kind: "short",
  title: "A custom editor label",
  slug: "john-3",
  locale: "es",
  version: "rv1909",
  passage: JSON.stringify(passage),
};

test("YouTube titles use the configured title section, Bible metadata and the generation values", () => {
  const template =
    "# Descripción\nUna descripción que no es el título.\n# Título\nHoy escuchamos {reference} — {version}.\n";
  const title = youtubeProjectTitle(project, template);
  assert.equal(title, "Hoy escuchamos Juan 3:14-19 — Reina Valera 1909.");
  const output = publicationDescriptions(
    "es",
    publicationTitle("es", "Juan 3:14-19", catalog["es/rv1909"].name, "short"),
    [],
    { youtube: template },
    "short",
  );
  assert.equal(output["3.2-youtube.txt"].trim(), title);
  for (const [locale, version, name] of [
    ["en", "kjv", "John"],
    ["pt", "arc", "João"],
  ] as const) {
    const p = { ...project, locale, version };
    const value = youtubeProjectTitle(
      p,
      "# Title\n{title} | {reference}\n# Description\nIgnored",
    );
    assert.ok(value?.includes(`${name} 3:14-19`));
    assert.ok(
      value?.startsWith(
        locale === "en" ? "This is your daily dose" : "Esta é a sua dose",
      ),
    );
  }
  assert.equal(
    youtubeProjectTitle(project, "Hoy escuchamos {reference}.\n\nDescription"),
    "Hoy escuchamos Juan 3:14-19.",
  );
  assert.equal(youtubeProjectTitle(project, ""), null);
  assert.equal(
    youtubeProjectTitle(project, "# Description\n{reference}"),
    null,
  );
  assert.equal(youtubeProjectTitle(project, "# Title\n{passage}"), null);
});

test("long and book titles retain full chapter, partial chapter and cross-book references", () => {
  const long = {
    ...project,
    kind: "long" as const,
    passage: JSON.stringify({
      book: "genesis",
      endBook: "exodus",
      start: { chapter: 50, verse: 1 },
      end: { chapter: 1, verse: 10 },
      episode: 17,
    }),
  };
  assert.equal(
    youtubeProjectTitle(
      long,
      "# Título\n{title} | Día {episode} | {reference}",
    ),
    "La Biblia en 365 días | Día 17 | Génesis 50 · Éxodo 1:1–10",
  );
  const book = {
    ...project,
    kind: "book" as const,
    passage: JSON.stringify({
      book: "john",
      start: { chapter: 1, verse: 1 },
      end: { chapter: 21, verse: 25 },
    }),
  };
  assert.equal(
    youtubeProjectTitle(book, "# Título\n{title} | {reference} | {version}"),
    "Libros de la Biblia | Juan 1–21 | Reina Valera 1909",
  );
  assert.equal(
    youtubeProjectTitle(
      { ...long, passage: JSON.stringify(passage) },
      "# Title\nDay {episode}",
    ),
    null,
  );
});
async function setup(template: string, dates = ["2026-10-01", "2026-10-01"]) {
  const { db, sqlite } = websiteDatabase();
  const accounts = emptySocialSettings();
  accounts.es.youtube = "veobible_es";
  await saveSocialSettings(db, accounts);
  sqlite.exec(
    "INSERT INTO bible_versions(locale,code,label) VALUES('es','rv1909','RV1909'),('es','spabll','SPABLL')",
  );
  sqlite
    .prepare("INSERT INTO site_settings(key,value) VALUES('website_sources',?)")
    .run(
      JSON.stringify(
        ["rv1909", "spabll"].map((version, i) => ({
          locale: "es",
          version,
          since: dates[i],
          enabled: true,
        })),
      ),
    );
  const settings = emptyPublicationSettings("short");
  settings.es.youtube = template;
  await savePublicationSettings(db, "short", settings);
  const add = (versionId: number) =>
    Number(
      sqlite
        .prepare(
          "INSERT INTO video_projects(kind,bible_version_id,slug,title,passage,published,social_video_ids) VALUES('short',?,?,?, ?,1,'{\"instagram\":\"keep\"}')",
        )
        .run(
          versionId,
          `project-${versionId}`,
          "Juan 3:14–19",
          JSON.stringify(passage),
        ).lastInsertRowid,
    );
  const cache = (id: string, title: string, date: string) =>
    sqlite
      .prepare(
        "INSERT INTO social_video_cache(platform,video_id,account,title,published_at,metadata) VALUES('youtube',?,'@veobible_es',?,?,'{\"tab\":\"shorts\"}')",
      )
      .run(id, title, date);
  return { db, sqlite, add, cache };
}

test("different Bible versions can publish on the same day, matched by their templates rather than date ownership", async () => {
  const { db, sqlite, add, cache } = await setup(
    "# Título\nHoy escuchamos {reference} — {version}.",
  );
  add(1);
  add(2);
  cache(
    "3P_Nt23tKFM",
    "Hoy escuchamos Juan 3:14–19 — Reina Valera 1909.",
    "2026-10-24",
  );
  cache(
    "abcdefghijk",
    `Hoy escuchamos Juan 3:14–19 — ${catalog["es/spabll"].name}.`,
    "2026-10-24",
  );
  const result = await detectVideos(db);
  assert.equal(result.projects, 2);
  assert.equal(result.ambiguous, 0);
  const rows = sqlite
    .prepare("SELECT social_video_ids FROM video_projects ORDER BY id")
    .all();
  assert.deepEqual(
    rows.map((r) => JSON.parse(r.social_video_ids as string)),
    [
      { instagram: "keep", youtube: "3P_Nt23tKFM" },
      { instagram: "keep", youtube: "abcdefghijk" },
    ],
  );
});
test("a later starting version never takes videos away from an earlier one; each date is only a minimum", async () => {
  const { db, add, cache } = await setup("# Título\n{reference} | {version}", [
    "2026-10-01",
    "2026-10-15",
  ]);
  add(1);
  add(2);
  cache("3P_Nt23tKFM", "Juan 3:14-19 | Reina Valera 1909", "2026-10-24");
  cache(
    "abcdefghijk",
    `Juan 3:14-19 | ${catalog["es/spabll"].name}`,
    "2026-10-14",
  );
  const result = await detectVideos(db);
  assert.equal(result.projects, 1);
  assert.equal(result.pending, 1);
});
test("identical template titles across versions remain ambiguous instead of assigning by rule order", async () => {
  const { db, sqlite, add, cache } = await setup("# Título\n{reference}");
  add(1);
  add(2);
  cache("3P_Nt23tKFM", "Juan 3:14-19", "2026-10-24");
  const result = await detectVideos(db);
  assert.equal(result.projects, 0);
  assert.equal(result.ambiguous, 2);
  assert.equal(result.searchable.length, 0);
  assert(
    sqlite
      .prepare("SELECT social_video_ids FROM video_projects")
      .all()
      .every((r) => !JSON.parse(r.social_video_ids as string).youtube),
  );
});
test("cached titles must match the full format template, and a template change takes effect immediately", async () => {
  const { db, add, cache } = await setup(
    "# Título\nHoy escuchamos {reference} — {version}.",
  );
  add(1);
  cache("abcdefghijk", "Juan 3:14-19 | Un momento con la Biblia", "2026-10-24");
  assert.equal((await detectVideos(db)).projects, 0);
  const settings = emptyPublicationSettings("short");
  settings.es.youtube = "# Título\n{reference} | Un momento con la Biblia";
  await savePublicationSettings(db, "short", settings);
  assert.equal((await detectVideos(db)).projects, 1);
});
