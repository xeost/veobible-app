import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  emptyVoiceStyleDefaults,
  loadVoiceStyleDefaults,
  selectedVoiceStyleParameters,
  voiceStyleDefaultsSchema,
} from "./voice-style-presets";
import {
  defaultBaseVoices,
  loadBaseVoiceDefaults,
  saveBaseVoiceDefaults,
} from "./base-voices";
import { narrationPresets } from "./narration-parameters";
import { settingsSchema } from "./video-schema";
import { settingsSchema as workerSettingsSchema } from "../../../../tools/video-project-api/src/protocol";
import { audioSettingsSchema } from "../../../../tools/video-project-api/src/audio-project-schema";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
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
    batch: async (statements: any[]) => {
      sqlite.exec("BEGIN");
      try {
        for (const statement of statements) await statement.run();
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
  return { sqlite, database };
}
const expressive = {
  id: "expressive",
  name: "Expressive narration",
  settings: narrationPresets.expressive,
};
const relaxed = {
  id: "relaxed",
  name: "Slower voice",
  settings: narrationPresets.relaxed,
};

test("voice style defaults persist separately by format, language and narration role", async () => {
  const { sqlite, database } = fixture();
  try {
    assert.deepEqual(
      await loadVoiceStyleDefaults(database, "short"),
      emptyVoiceStyleDefaults(),
    );
    const defaults = emptyVoiceStyleDefaults();
    defaults.es = { intro: expressive, reading: relaxed };
    defaults.en = { outro: relaxed };
    const voices = defaultBaseVoices();
    voices.es.reading = "es-3";
    await saveBaseVoiceDefaults(
      database,
      "short",
      voices,
      undefined,
      undefined,
      defaults,
    );
    assert.deepEqual(await loadVoiceStyleDefaults(database, "short"), defaults);
    assert.deepEqual(await loadBaseVoiceDefaults(database, "short"), voices);
    assert.deepEqual(
      await loadVoiceStyleDefaults(database, "long"),
      emptyVoiceStyleDefaults(),
    );
    const audio = emptyVoiceStyleDefaults();
    audio.pt.reading = expressive;
    await saveBaseVoiceDefaults(
      database,
      "audio",
      defaultBaseVoices(),
      undefined,
      0.5,
      audio,
    );
    assert.deepEqual(await loadVoiceStyleDefaults(database, "audio"), audio);
    assert.deepEqual(await loadVoiceStyleDefaults(database, "short"), defaults);
    const invalid = structuredClone(defaults);
    invalid.es.intro!.settings.temperature = 9;
    await assert.rejects(
      saveBaseVoiceDefaults(
        database,
        "short",
        defaultBaseVoices(),
        undefined,
        undefined,
        invalid,
      ),
    );
    assert.deepEqual(await loadVoiceStyleDefaults(database, "short"), defaults);
    assert.deepEqual(await loadBaseVoiceDefaults(database, "short"), voices);
  } finally {
    sqlite.close();
  }
});

test("old separate reading values remain available as a saved style without changing other roles", async () => {
  const { sqlite, database } = fixture();
  try {
    const legacy = {
      exaggeration: 0.9,
      cfg_weight: 0.2,
      temperature: 1.1,
      repetition_penalty: 1.5,
    };
    await saveBaseVoiceDefaults(database, "long", defaultBaseVoices(), {
      en: null,
      es: legacy,
      pt: null,
    });
    const presets = await loadVoiceStyleDefaults(database, "long");
    assert.equal(presets.es.reading?.name, "Saved narration");
    assert.deepEqual(presets.es.reading?.settings, {
      ...narrationPresets.natural,
      ...legacy,
    });
    assert.deepEqual(presets.en, {});
    assert.equal(presets.es.intro, undefined);
    // Selecting the general default clears the former separate reading choice.
    await saveBaseVoiceDefaults(
      database,
      "long",
      defaultBaseVoices(),
      undefined,
      undefined,
      emptyVoiceStyleDefaults(),
    );
    assert.deepEqual(
      await loadVoiceStyleDefaults(database, "long"),
      emptyVoiceStyleDefaults(),
    );
  } finally {
    sqlite.close();
  }
});

test("generation selects the role's project preset before the format and global defaults", () => {
  const general = narrationPresets.natural;
  const defaults = { intro: expressive, reading: relaxed };
  const project = { reading: expressive };
  assert.deepEqual(
    selectedVoiceStyleParameters(general, defaults, project, "intro"),
    narrationPresets.expressive,
  );
  assert.deepEqual(
    selectedVoiceStyleParameters(general, defaults, project, "reading"),
    narrationPresets.expressive,
  );
  assert.deepEqual(
    selectedVoiceStyleParameters(general, defaults, project, "outro"),
    general,
  );
  assert.deepEqual(
    selectedVoiceStyleParameters(general, defaults, {}, "reading"),
    narrationPresets.relaxed,
  );
  const parameters = selectedVoiceStyleParameters(
    general,
    defaults,
    project,
    "reading",
  );
  parameters.temperature = 3;
  assert.equal(project.reading.settings.temperature, 0.8);
});

test("project and worker contracts retain preset snapshots, including styles removed from the library", () => {
  const custom = {
    id: "removed-style",
    name: "My reading style",
    settings: { ...narrationPresets.relaxed, temperature: 0.6 },
  };
  const settings = settingsSchema.parse({
    voiceStylePresets: { intro: expressive, outro: relaxed, reading: custom },
  });
  assert.deepEqual(
    workerSettingsSchema.parse(settings).voiceStylePresets,
    settings.voiceStylePresets,
  );
  assert.deepEqual(
    audioSettingsSchema.parse({ baseVoice: "es-2", narrationPreset: custom })
      .narrationPreset,
    custom,
  );
  assert.deepEqual(
    audioSettingsSchema.parse({ baseVoice: "es-2" }).narrationPreset,
    undefined,
  );
  assert.equal(
    voiceStyleDefaultsSchema.safeParse({
      ...emptyVoiceStyleDefaults(),
      es: {
        reading: { ...custom, settings: { ...custom.settings, cfg_weight: 8 } },
      },
    }).success,
    false,
  );
});
