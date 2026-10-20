import { z } from "zod";
export const baseVoiceSchema = z
  .string()
  .max(40)
  .regex(/^(es|en|pt)-[1-9]\d*$/);
export type VoiceLocale = "es" | "en" | "pt";
export function voiceForLocale(locale: VoiceLocale, selected?: string) {
  const id = baseVoiceSchema.parse(selected ?? `${locale}-1`);
  if (!id.startsWith(`${locale}-`))
    throw new Error("Base voice language mismatch");
  return id;
}
export const sampleTexts = {
  en: "Welcome. Today we share a message of hope and peace.",
  es: "Bienvenidos. Hoy compartimos un mensaje de esperanza y paz.",
  pt: "Bem-vindos. Hoje compartilhamos uma mensagem de esperança e paz.",
};
export const voiceRolesSchema = z.object({
  intro: baseVoiceSchema,
  outro: baseVoiceSchema,
  reading: baseVoiceSchema,
});
export type VoiceRole = "intro" | "outro" | "reading";
export const voiceRoles = ["intro", "outro", "reading"] as const;
export const roleLabels = {
  intro: "Introduction voice",
  outro: "Closing voice",
  reading: "Passage reading voice",
} as const;
export function selectedRoleVoice(
  settings: {
    baseVoice?: string;
    baseVoices?: Partial<Record<VoiceRole, string>>;
  },
  locale: VoiceLocale,
  role: VoiceRole = "intro",
) {
  return voiceForLocale(
    locale,
    settings.baseVoices?.[role] ?? settings.baseVoice,
  );
}
export const inheritedVoiceRoles = (id: string) => ({
  intro: id,
  outro: id,
  reading: id,
});
