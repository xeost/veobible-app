import { z } from "zod";
import {
  publicationTemplatesSchema,
  publicationPlatforms,
} from "../../../../tools/video-project-api/src/publication-templates";
export { publicationPlatforms };
export const publicationSettingsSchema = (kind: "short" | "long") => {
  const templates = publicationTemplatesSchema.refine((value) =>
    Object.keys(value).every((key) =>
      (publicationPlatforms(kind) as readonly string[]).includes(key),
    ),
  );
  return z.object({ en: templates, es: templates, pt: templates });
};
export type PublicationSettings = z.infer<
  ReturnType<typeof publicationSettingsSchema>
>;
export function emptyPublicationSettings(
  kind: "short" | "long",
): PublicationSettings {
  const empty = () =>
    Object.fromEntries(
      publicationPlatforms(kind).map((platform) => [platform, ""]),
    );
  return { en: empty(), es: empty(), pt: empty() };
}
export async function loadPublicationSettings(
  database: D1Database,
  kind: "short" | "long",
): Promise<PublicationSettings> {
  const row = await database
    .prepare("SELECT value FROM site_settings WHERE key=?")
    .bind(`publication_templates:${kind}`)
    .first<{ value: string }>();
  return row
    ? publicationSettingsSchema(kind).parse(JSON.parse(row.value))
    : emptyPublicationSettings(kind);
}
export async function savePublicationSettings(
  database: D1Database,
  kind: "short" | "long",
  input: unknown,
) {
  const templates = publicationSettingsSchema(kind).parse(input);
  await database
    .prepare(
      "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    )
    .bind(
      `publication_templates:${kind}`,
      JSON.stringify(templates),
      new Date().toISOString(),
    )
    .run();
  return templates;
}
