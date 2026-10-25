import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  emptyChapterAudioSettings,
  loadChapterAudioSettings,
  saveChapterAudioSettings,
  resolveChapterAudio,
} from "./chapter-audio-settings";
import { settingsSchema } from "./video-schema";

test("chapter audio defaults persist separately for each format, language and Bible version", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    "CREATE TABLE site_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL)",
  );
  const database = {
    prepare: (query: string) => ({
      bind: (...values: (string | number)[]) => ({
        first: async () => sqlite.prepare(query).get(...values) ?? null,
        run: async () => sqlite.prepare(query).run(...values),
      }),
    }),
  } as unknown as D1Database;
  try {
    assert.deepEqual(
      await loadChapterAudioSettings(database, "short"),
      emptyChapterAudioSettings(),
    );
    const settings = {
      es: { shared: "shared-v2", other: "" },
      en: { shared: "shared-v3" },
      pt: {},
    };
    await saveChapterAudioSettings(database, "short", settings);
    assert.deepEqual(
      await loadChapterAudioSettings(database, "short"),
      settings,
    );
    for (const kind of ["long", "book"] as const) {
      assert.deepEqual(
        await loadChapterAudioSettings(database, kind),
        emptyChapterAudioSettings(),
      );
      await saveChapterAudioSettings(database, kind, {
        es: {},
        en: {},
        pt: { shared: "shared-v4" },
      });
    }
    await saveChapterAudioSettings(
      database,
      "short",
      emptyChapterAudioSettings(),
    );
    for (const kind of ["long", "book"] as const)
      assert.equal(
        (await loadChapterAudioSettings(database, kind)).pt.shared,
        "shared-v4",
      );
    await assert.rejects(
      saveChapterAudioSettings(database, "short", {
        es: { shared: "invalid" },
        en: {},
        pt: {},
      }),
    );
  } finally {
    sqlite.close();
  }
});

test("projects inherit current audio defaults while explicit editions and original recordings stay selected", () => {
  const inherited = resolveChapterAudio(settingsSchema.parse({}), "shared-v2");
  assert.equal(inherited.inheritAudioEdition, true);
  assert.equal(inherited.audioEdition, "shared-v2");
  const saved = settingsSchema.parse(JSON.parse(JSON.stringify(inherited)));
  assert.equal(
    resolveChapterAudio(saved, "shared-v3").audioEdition,
    "shared-v3",
  );
  assert.equal(resolveChapterAudio(saved, "").audioEdition, undefined);
  assert.equal(
    resolveChapterAudio(
      settingsSchema.parse({ audioEdition: "shared-v2" }),
      "shared-v3",
    ).audioEdition,
    "shared-v2",
  );
  const original = settingsSchema.parse({ inheritAudioEdition: false });
  assert.equal(
    resolveChapterAudio(original, "shared-v3").audioEdition,
    undefined,
  );
  const custom = settingsSchema.parse({
    inheritAudioEdition: false,
    audioEdition: "shared-v4",
  });
  assert.equal(
    resolveChapterAudio(custom, "shared-v3").audioEdition,
    "shared-v4",
  );
});
