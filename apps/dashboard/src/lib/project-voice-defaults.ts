import type { z } from "zod";
import type { settingsSchema } from "./video-schema";
import type { AudioSettings } from "../../../../tools/video-project-api/src/audio-project-schema";
import {
  voiceRoles,
  type VoiceLocale,
  type BaseVoiceDefaults,
} from "./base-voices";
import type {
  VoiceStylePresets,
  NarrationPresetSelection,
} from "./voice-style-presets";

function matchesDefault(
  selection: NarrationPresetSelection | undefined,
  fallback: NarrationPresetSelection | undefined,
) {
  return (
    selection !== undefined &&
    fallback !== undefined &&
    JSON.stringify(selection) === JSON.stringify(fallback)
  );
}

// Older projects stored copies of format defaults without selection provenance.
// Upgrade once; explicit selections made after this upgrade stay explicit.
export function inheritVideoVoiceDefaults(
  settings: z.infer<typeof settingsSchema>,
  defaults: BaseVoiceDefaults["en"],
  styles: VoiceStylePresets,
) {
  if (settings.voiceDefaultsVersion === 1) return settings;
  const inherited =
    settings.inheritedBaseVoiceRoles ??
    voiceRoles.filter((role) => {
      const selected = settings.baseVoices?.[role] ?? settings.baseVoice;
      return selected === undefined || selected === defaults[role];
    });
  const presets = { ...settings.voiceStylePresets };
  for (const role of voiceRoles)
    if (matchesDefault(presets[role], styles[role])) delete presets[role];
  return {
    ...settings,
    voiceDefaultsVersion: 1 as const,
    inheritedBaseVoiceRoles: inherited,
    voiceStylePresets: presets,
  };
}

export function inheritAudioVoiceDefaults(
  settings: AudioSettings,
  locale: VoiceLocale,
  defaults: BaseVoiceDefaults,
  styles: VoiceStylePresets,
): AudioSettings {
  if (settings.voiceDefaultsVersion === 1) return settings;
  const upgraded: AudioSettings = {
    ...settings,
    voiceDefaultsVersion: 1,
    inheritBaseVoice:
      settings.inheritBaseVoice ??
      settings.baseVoice === defaults[locale].reading,
  };
  if (matchesDefault(settings.narrationPreset, styles.reading))
    delete upgraded.narrationPreset;
  return upgraded;
}
