import { z } from "zod";
const fields = new Set([
  "reference",
  "version",
  "book",
  "start",
  "end",
  "passage_id",
]);
export function validVoiceTemplate(text: string) {
  return !/[{}]/.test(
    text.replace(/\{([^{}]+)\}/g, (token, field: string) =>
      fields.has(field) ? "" : token,
    ),
  );
}
const text = z.string().trim().max(10000).refine(validVoiceTemplate);
export const voiceTemplatesSchema = z.object({ intro: text, outro: text });
export const voiceSettingsSchema = z.object({
  es: voiceTemplatesSchema,
  en: voiceTemplatesSchema,
  pt: voiceTemplatesSchema,
});
export type VoiceSettings = z.infer<typeof voiceSettingsSchema>;
export function emptyVoiceSettings(): VoiceSettings {
  return {
    es: { intro: "", outro: "" },
    en: { intro: "", outro: "" },
    pt: { intro: "", outro: "" },
  };
}
export async function loadVoiceSettings(
  database: D1Database,
  kind: "short" | "long",
): Promise<VoiceSettings> {
  const row = await database
    .prepare("SELECT value FROM site_settings WHERE key=?")
    .bind(`voice_templates:${kind}`)
    .first<{ value: string }>();
  return row
    ? voiceSettingsSchema.parse(JSON.parse(row.value))
    : emptyVoiceSettings();
}
export async function saveVoiceSettings(
  database: D1Database,
  kind: "short" | "long",
  input: unknown,
) {
  const templates = voiceSettingsSchema.parse(input);
  await database
    .prepare(
      "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    )
    .bind(
      `voice_templates:${kind}`,
      JSON.stringify(templates),
      new Date().toISOString(),
    )
    .run();
  return templates;
}
