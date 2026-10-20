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
