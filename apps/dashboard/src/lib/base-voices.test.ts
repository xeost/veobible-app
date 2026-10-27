import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  defaultBaseVoices,
  loadBaseVoiceDefaults,
  saveBaseVoiceDefaults,
  projectBaseVoice,
  resolveProjectBaseVoices,
  baseVoiceDefaultsSchema,
  resolveAudioBaseVoice,
  baseVoiceCatalogSchema,
} from "./base-voices";
import { settingsSchema } from "./video-schema";
import { settingsSchema as workerSettingsSchema } from "../../../../tools/video-project-api/src/protocol";
import { audioSettingsSchema } from "../../../../tools/video-project-api/src/audio-project-schema";

test("voice catalogue preserves temporary auditions without marking them as saved", () => {
  const preview = {
    id: "7d79a360-612a-44fa-9ddf-e697ae1cc42e",
    text: "A temporary example.",
    generatedAt: "2026-10-27T12:00:00.000Z",
    available: true,
  };
  const sample = {
    voiceModel: "multilingual-v3",
    available: false,
    text: null,
    generatedAt: null,
    status: "done",
    progress: 100,
    preview,
  };
  const parsed = baseVoiceCatalogSchema.parse({
    voices: [
      {
        id: "en-1",
        locale: "en",
        ...sample,
        samples: [sample],
      },
    ],
  });
  assert.equal(parsed.voices[0].available, false);
  assert.equal(parsed.voices[0].samples[0].available, false);
  assert.deepEqual(parsed.voices[0].samples[0].preview, preview);
  const { preview: _, ...legacy } = sample;
  assert.doesNotThrow(() =>
    baseVoiceCatalogSchema.parse({
      voices: [
        {
          id: "en-1",
          locale: "en",
          ...legacy,
          samples: [legacy],
        },
      ],
    }),
  );
});

test("audio projects inherit the current reading voice only when explicitly selected", () => {
  const defaults = defaultBaseVoices();
  for (const locale of ["es", "en", "pt"] as const) {
    const saved = audioSettingsSchema.parse({
      baseVoice: `${locale}-2`,
      inheritBaseVoice: true,
    });
    defaults[locale].reading = `${locale}-3`;
    assert.equal(
      resolveAudioBaseVoice(saved, locale, defaults).baseVoice,
      `${locale}-3`,
    );
    defaults[locale].reading = `${locale}-4`;
    assert.equal(
      resolveAudioBaseVoice(saved, locale, defaults).baseVoice,
      `${locale}-4`,
    );
    assert.equal(saved.baseVoice, `${locale}-2`);
    for (const inheritBaseVoice of [false, undefined]) {
      assert.equal(
        resolveAudioBaseVoice({ ...saved, inheritBaseVoice }, locale, defaults)
          .baseVoice,
        `${locale}-2`,
      );
    }
  }
});

test("voice defaults are separate per format and never resolve an existing project's voice", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    "CREATE TABLE site_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT)",
  );
  const database = {
    prepare: (query: string) => ({
      bind: (...values: any[]) => ({
        first: async () => sqlite.prepare(query).get(...values) ?? null,
        run: async () => sqlite.prepare(query).run(...values),
      }),
    }),
  } as unknown as D1Database;
  try {
    assert.deepEqual(
      await loadBaseVoiceDefaults(database, "short"),
      defaultBaseVoices(),
    );
    const legacy = settingsSchema.parse({});
    const original = settingsSchema.parse({ baseVoice: "es-2" });
    await saveBaseVoiceDefaults(database, "short", {
      es: "es-3",
      en: "en-2",
      pt: "pt-1",
    });
    assert.equal(
      (await loadBaseVoiceDefaults(database, "short")).es.intro,
      "es-3",
    );
    assert.equal(
      (await loadBaseVoiceDefaults(database, "long")).es.intro,
      "es-1",
    );
    const newProject = settingsSchema.parse({
      baseVoice: (await loadBaseVoiceDefaults(database, "short")).es.intro,
    });
    await saveBaseVoiceDefaults(database, "short", {
      es: "es-4",
      en: "en-1",
      pt: "pt-1",
    });
    assert.equal(projectBaseVoice(legacy, "es"), "es-1");
    assert.equal(projectBaseVoice(original, "es"), "es-2");
    const roles = settingsSchema.parse({
      baseVoice: "es-2",
      baseVoices: { intro: "es-3", outro: "es-4", reading: "es-5" },
    });
    assert.equal(projectBaseVoice(roles, "es", "intro"), "es-3");
    assert.equal(projectBaseVoice(roles, "es", "outro"), "es-4");
    assert.equal(projectBaseVoice(roles, "es", "reading"), "es-5");
    assert.equal(projectBaseVoice(newProject, "es"), "es-3");
    assert.throws(() =>
      baseVoiceDefaultsSchema.parse({ es: "en-2", en: "en-1", pt: "pt-1" }),
    );
    assert.throws(() => projectBaseVoice({ baseVoice: "en-2" }, "es"));
    assert.throws(() => settingsSchema.parse({ baseVoice: "../../escape" }));
  } finally {
    sqlite.close();
  }
});

test("inherited project voices follow each format and language while custom voices stay fixed", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    "CREATE TABLE site_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT)",
  );
  const database = {
    prepare: (query: string) => ({
      bind: (...values: any[]) => ({
        first: async () => sqlite.prepare(query).get(...values) ?? null,
        run: async () => sqlite.prepare(query).run(...values),
      }),
    }),
  } as unknown as D1Database;
  try {
    for (const kind of ["short", "long", "book"] as const) {
      for (const locale of ["es", "en", "pt"] as const) {
        const project = settingsSchema.parse({
          baseVoices: {
            intro: `${locale}-1`,
            reading: `${locale}-5`,
            outro: `${locale}-1`,
          },
          inheritedBaseVoiceRoles: ["intro", "outro"],
        });
        const defaults = defaultBaseVoices();
        defaults[locale] = {
          intro: `${locale}-2`,
          reading: `${locale}-3`,
          outro: `${locale}-4`,
        };
        await saveBaseVoiceDefaults(database, kind, defaults);
        const first = resolveProjectBaseVoices(
          project,
          locale,
          (await loadBaseVoiceDefaults(database, kind))[locale],
        );
        assert.deepEqual(first.baseVoices, {
          intro: `${locale}-2`,
          reading: `${locale}-5`,
          outro: `${locale}-4`,
        });
        // Saved selections survive both dashboard and generation request parsing.
        const saved = settingsSchema.parse(
          JSON.parse(JSON.stringify(workerSettingsSchema.parse(first))),
        );
        defaults[locale] = {
          intro: `${locale}-3`,
          reading: `${locale}-4`,
          outro: `${locale}-2`,
        };
        await saveBaseVoiceDefaults(database, kind, defaults);
        const next = resolveProjectBaseVoices(
          saved,
          locale,
          (await loadBaseVoiceDefaults(database, kind))[locale],
        );
        assert.deepEqual(next.baseVoices, {
          intro: `${locale}-3`,
          reading: `${locale}-5`,
          outro: `${locale}-2`,
        });
        assert.equal(next.baseVoice, `${locale}-3`);
        // Requests already submitted keep their resolved voice snapshot.
        assert.equal(first.baseVoices.intro, `${locale}-2`);
        assert.equal(project.baseVoices?.intro, `${locale}-1`);
        // Returning a custom reading to Default applies the current reading choice.
        const inherited = resolveProjectBaseVoices(
          { ...saved, inheritedBaseVoiceRoles: ["intro", "reading", "outro"] },
          locale,
          defaults[locale],
        );
        assert.equal(inherited.baseVoices.reading, `${locale}-4`);
      }
    }
  } finally {
    sqlite.close();
  }
});
