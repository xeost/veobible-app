import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inheritAudioVoiceDefaults,
  inheritVideoVoiceDefaults,
} from "./project-voice-defaults";
import { defaultBaseVoices } from "./base-voices";
import { settingsSchema } from "./video-schema";
import { settingsSchema as workerSettingsSchema } from "../../../../tools/video-project-api/src/protocol";
import { audioSettingsSchema } from "../../../../tools/video-project-api/src/audio-project-schema";
import { narrationPresets } from "./narration-parameters";

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

test("legacy video projects inherit missing voices and copied defaults, preserving custom roles and styles", () => {
  const defaults = defaultBaseVoices();
  for (const locale of ["es", "en", "pt"] as const) {
    const upgraded = inheritVideoVoiceDefaults(
      settingsSchema.parse({
        baseVoices: {
          intro: `${locale}-1`,
          reading: `${locale}-4`,
          outro: `${locale}-1`,
        },
        voiceStylePresets: { intro: expressive, reading: relaxed },
        volumeMultiplier: 2,
      }),
      defaults[locale],
      { intro: expressive, reading: expressive },
    );
    assert.deepEqual(upgraded.inheritedBaseVoiceRoles, ["intro", "outro"]);
    assert.deepEqual(upgraded.voiceStylePresets, { reading: relaxed });
    assert.equal(upgraded.volumeMultiplier, 2);
    assert.equal(workerSettingsSchema.parse(upgraded).voiceDefaultsVersion, 1);
    assert.deepEqual(
      inheritVideoVoiceDefaults(settingsSchema.parse({}), defaults[locale], {})
        .inheritedBaseVoiceRoles,
      ["intro", "outro", "reading"],
    );
  }
});

test("video upgrades preserve explicit voice flags and never reinterpret upgraded selections", () => {
  const defaults = defaultBaseVoices().en;
  const upgraded = inheritVideoVoiceDefaults(
    settingsSchema.parse({
      inheritedBaseVoiceRoles: [],
      baseVoices: defaults,
    }),
    defaults,
    {},
  );
  assert.deepEqual(upgraded.inheritedBaseVoiceRoles, []);
  const explicit = { ...upgraded, voiceStylePresets: { intro: expressive } };
  assert.strictEqual(
    inheritVideoVoiceDefaults(explicit, defaults, { intro: expressive }),
    explicit,
  );
});

test("audio upgrades inherit copied format values and retain custom voices and narration presets", () => {
  const defaults = defaultBaseVoices();
  for (const locale of ["es", "en", "pt"] as const) {
    const inherited = inheritAudioVoiceDefaults(
      audioSettingsSchema.parse({
        baseVoice: `${locale}-1`,
        narrationPreset: expressive,
        pauses: { "1:1": 0.7 },
      }),
      locale,
      defaults,
      { reading: expressive },
    );
    assert.equal(inherited.inheritBaseVoice, true);
    assert.equal(inherited.narrationPreset, undefined);
    assert.deepEqual(inherited.pauses, { "1:1": 0.7 });
    const custom = inheritAudioVoiceDefaults(
      audioSettingsSchema.parse({
        baseVoice: `${locale}-3`,
        narrationPreset: relaxed,
      }),
      locale,
      defaults,
      { reading: expressive },
    );
    assert.equal(custom.inheritBaseVoice, false);
    assert.deepEqual(custom.narrationPreset, relaxed);
    const explicit = {
      ...inherited,
      inheritBaseVoice: false,
      narrationPreset: expressive,
    };
    assert.strictEqual(
      inheritAudioVoiceDefaults(explicit, locale, defaults, {
        reading: expressive,
      }),
      explicit,
    );
    assert.equal(
      inheritAudioVoiceDefaults(
        audioSettingsSchema.parse({
          baseVoice: `${locale}-1`,
          inheritBaseVoice: false,
        }),
        locale,
        defaults,
        {},
      ).inheritBaseVoice,
      false,
    );
  }
});
