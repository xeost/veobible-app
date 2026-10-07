import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  emptySocialSettings,
  loadSocialSettings,
  saveSocialSettings,
  socialSettingsSchema,
} from "./social-settings";
import { outroTitle as shortOutro } from "../../../../tools/video-project-api/src/engines/short/social";
import { outroTitle as longOutro } from "../../../../tools/video-project-api/src/engines/long/social";
test("social settings start empty without inserting rows and persist all languages without changing other site settings", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec(
      "CREATE TABLE site_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL)",
    );
    const database = {
      prepare: (query: string) => ({
        bind: (...values: any[]) => ({
          first: async () => sqlite.prepare(query).get(...values) ?? null,
          run: async () => sqlite.prepare(query).run(...values),
        }),
      }),
    } as unknown as D1Database;
    assert.deepEqual(await loadSocialSettings(database), emptySocialSettings());
    assert.equal(
      sqlite.prepare("SELECT count(*) total FROM site_settings").get()?.total,
      0,
    );
    sqlite
      .prepare(
        "INSERT INTO site_settings VALUES ('deploy_hook:veobible:site','preserved','before')",
      )
      .run();
    const accounts = emptySocialSettings();
    accounts.es.youtube = " @canal_es ";
    accounts.en.x = "english";
    accounts.pt.facebook = "pagina.pt";
    await saveSocialSettings(database, accounts);
    const stored = await loadSocialSettings(database);
    assert.equal(stored.es.youtube, "@canal_es");
    assert.equal(stored.en.x, "english");
    assert.equal(stored.pt.facebook, "pagina.pt");
    assert.equal(
      sqlite
        .prepare(
          "SELECT value FROM site_settings WHERE key='deploy_hook:veobible:site'",
        )
        .get()?.value,
      "preserved",
    );
    await saveSocialSettings(database, emptySocialSettings());
    assert.deepEqual(await loadSocialSettings(database), emptySocialSettings());
    assert.equal(
      socialSettingsSchema.safeParse({
        ...accounts,
        es: { ...accounts.es, youtube: "https://example.com" },
      }).success,
      false,
    );
  } finally {
    sqlite.close();
  }
});
test("both video formats use the supplied social accounts and omit empty networks instead of loading file defaults", async () => {
  for (const outro of [shortOutro, longOutro]) {
    assert.deepEqual((await outro("es", emptySocialSettings().es)).social, []);
    const accounts = {
      ...emptySocialSettings().pt,
      youtube: "canal_manual",
      facebook: "@pagina.pt",
    };
    assert.deepEqual((await outro("pt", accounts)).social, [
      { platform: "YouTube", handle: "@canal_manual" },
      { platform: "Facebook", handle: "@pagina.pt" },
    ]);
  }
});
