import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  loadVoiceSettings,
  saveVoiceSettings,
  emptyVoiceSettings,
  validVoiceTemplate,
} from "./voice-settings";
test("voice settings start empty without inserts and remain independent by format and language", async () => {
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
    assert.deepEqual(
      await loadVoiceSettings(database, "short"),
      emptyVoiceSettings(),
    );
    assert.deepEqual(
      await loadVoiceSettings(database, "long"),
      emptyVoiceSettings(),
    );
    assert.equal(
      sqlite.prepare("SELECT count(*) total FROM site_settings").get()?.total,
      0,
    );
    const short = emptyVoiceSettings(),
      long = emptyVoiceSettings();
    short.es.intro = " Cortos: {reference}. ";
    short.en.outro = "Short closing";
    long.es.intro = "Largos: {reference}.";
    long.pt.outro = "Fim: {book}.";
    await saveVoiceSettings(database, "short", short);
    await saveVoiceSettings(database, "long", long);
    assert.equal(
      (await loadVoiceSettings(database, "short")).es.intro,
      "Cortos: {reference}.",
    );
    assert.deepEqual(await loadVoiceSettings(database, "long"), long);
    await saveVoiceSettings(database, "short", emptyVoiceSettings());
    assert.deepEqual(await loadVoiceSettings(database, "long"), long);
    assert.equal(
      validVoiceTemplate(
        "{reference} {version} {book} {start} {end} {passage_id}",
      ),
      true,
    );
    assert.equal(validVoiceTemplate("{unsupported}"), false);
    assert.equal(validVoiceTemplate("{reference"), false);
  } finally {
    sqlite.close();
  }
});
