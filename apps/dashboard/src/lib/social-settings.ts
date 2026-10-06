import { z } from "zod";
const handle = z
  .string()
  .trim()
  .max(100)
  .regex(/^(?:@?[\p{L}\p{N}_.-]+)?$/u);
export const socialAccountsSchema = z.object({
  youtube: handle,
  x: handle,
  instagram: handle,
  tiktok: handle,
  facebook: handle,
});
export const socialSettingsSchema = z.object({
  es: socialAccountsSchema,
  en: socialAccountsSchema,
  pt: socialAccountsSchema,
});
export type SocialSettings = z.infer<typeof socialSettingsSchema>;
export const socialSettingsKey = "social_accounts";
export function emptySocialSettings(): SocialSettings {
  const blank = () => ({
    youtube: "",
    x: "",
    instagram: "",
    tiktok: "",
    facebook: "",
  });
  return { es: blank(), en: blank(), pt: blank() };
}
export async function loadSocialSettings(
  database: D1Database,
): Promise<SocialSettings> {
  const row = await database
    .prepare("SELECT value FROM site_settings WHERE key=?")
    .bind(socialSettingsKey)
    .first<{ value: string }>();
  return row
    ? socialSettingsSchema.parse(JSON.parse(row.value))
    : emptySocialSettings();
}
export async function saveSocialSettings(database: D1Database, input: unknown) {
  const accounts = socialSettingsSchema.parse(input);
  await database
    .prepare(
      "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    )
    .bind(socialSettingsKey, JSON.stringify(accounts), new Date().toISOString())
    .run();
  return accounts;
}
