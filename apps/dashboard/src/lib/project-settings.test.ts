import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  loadProjectSettings,
  saveProjectSettings,
  emptyProjectSettings,
  versionProjectSettings,
} from "./project-settings";

test("project defaults are manual and isolate matching version IDs by language and format", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec(
      readFileSync(
        new URL("../../migrations/0001_dashboard.sql", import.meta.url),
        "utf8",
      ),
    );
    const database = {
      prepare: (query: string) => ({
        bind: (...values: any[]) => ({
          first: async () => sqlite.prepare(query).get(...values) ?? null,
          run: async () => sqlite.prepare(query).run(...values),
        }),
      }),
    } as unknown as D1Database;
    const empty = await loadProjectSettings(database, "short");
    assert.deepEqual(empty, emptyProjectSettings());
    assert.deepEqual(versionProjectSettings(empty, "es", "shared"), {
      volumeMultiplier: 1,
    });
    assert.equal(
      sqlite.prepare("SELECT count(*) total FROM site_settings").get()?.total,
      0,
    );
    const settings = {
      es: { shared: { volumeMultiplier: 0 } },
      en: { shared: { volumeMultiplier: 2.5 } },
      pt: {},
    };
    await saveProjectSettings(database, "short", settings);
    assert.deepEqual(
      versionProjectSettings(
        await loadProjectSettings(database, "short"),
        "es",
        "shared",
      ),
      { volumeMultiplier: 0 },
    );
    assert.deepEqual(
      versionProjectSettings(
        await loadProjectSettings(database, "short"),
        "en",
        "shared",
      ),
      { volumeMultiplier: 2.5 },
    );
    assert.deepEqual(
      await loadProjectSettings(database, "long"),
      emptyProjectSettings(),
    );
    await saveProjectSettings(database, "long", {
      es: { shared: { volumeMultiplier: 4 } },
      en: {},
      pt: {},
    });
    await saveProjectSettings(database, "short", emptyProjectSettings());
    assert.equal(
      (await loadProjectSettings(database, "long")).es.shared.volumeMultiplier,
      4,
    );
    await assert.rejects(
      saveProjectSettings(database, "short", {
        es: { shared: { volumeMultiplier: 5 } },
        en: {},
        pt: {},
      }),
    );
    assert.equal(
      sqlite
        .prepare(
          "SELECT count(*) total FROM sqlite_master WHERE type='table' AND name='version_settings'",
        )
        .get()?.total,
      0,
    );
  } finally {
    sqlite.close();
  }
});

test("reading volume inherits current version defaults unless the project explicitly overrides them", async () => {
  const { effectiveReadingVolume } = await import("./project-settings");
  const { settingsSchema } = await import("./video-schema");
  const inherited = settingsSchema.parse({ volumeMultiplier: 3 });
  assert.equal(inherited.overrideReadingVolume, false);
  assert.equal(effectiveReadingVolume(inherited, 1.5), 1.5);
  assert.equal(effectiveReadingVolume(inherited, 2.5), 2.5);
  assert.equal(
    effectiveReadingVolume({ ...inherited, overrideReadingVolume: true }, 1.5),
    3,
  );
  assert.equal(
    effectiveReadingVolume(
      { volumeMultiplier: 0, overrideReadingVolume: true },
      1.5,
    ),
    0,
  );
  assert.equal(effectiveReadingVolume(inherited, 0), 0);
  assert.equal(
    settingsSchema.parse(
      JSON.parse(JSON.stringify({ ...inherited, overrideReadingVolume: true })),
    ).overrideReadingVolume,
    true,
  );
});
