import { z } from "zod";

export const bibleVersionSchema = z.object({
  locale: z.enum(["es", "en", "pt"]),
  code: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: z.string().trim().min(1).max(120),
});
export type BibleVersion = z.infer<typeof bibleVersionSchema> & {
  id: number;
  project_count: number;
};
export class BibleVersionError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const select =
  "SELECT v.*,count(p.id) project_count FROM bible_versions v LEFT JOIN video_projects p ON p.bible_version_id=v.id";
export async function listBibleVersions(database: D1Database) {
  return (
    await database
      .prepare(`${select} GROUP BY v.id ORDER BY v.locale,v.label,v.id`)
      .all<BibleVersion>()
  ).results;
}
async function findVersion(database: D1Database, id: number) {
  const version = await database
    .prepare(`${select} WHERE v.id=? GROUP BY v.id`)
    .bind(id)
    .first<BibleVersion>();
  if (!version) throw new BibleVersionError("Versión inexistente", 404);
  return version;
}
const inUse = () =>
  new BibleVersionError(
    "Esta versión tiene proyectos asociados. Puedes cambiar su nombre, pero no su idioma o código ni eliminarla.",
    409,
  );
function duplicate(error: unknown): never {
  if (/UNIQUE constraint failed/i.test(String(error)))
    throw new BibleVersionError(
      "Ya existe una versión con este código en el idioma seleccionado.",
      409,
    );
  throw error;
}
export async function saveBibleVersion(
  database: D1Database,
  value: unknown,
  id?: number,
) {
  const input = bibleVersionSchema.parse(value);
  if (id !== undefined) {
    const current = await findVersion(database, id);
    const identityChanged =
      current.code !== input.code || current.locale !== input.locale;
    if (identityChanged && current.project_count > 0) throw inUse();
    try {
      const result = await database
        .prepare(
          `UPDATE bible_versions SET locale=?,code=?,label=? WHERE id=?${identityChanged ? " AND NOT EXISTS (SELECT 1 FROM video_projects WHERE bible_version_id=?)" : ""}`,
        )
        .bind(
          input.locale,
          input.code,
          input.label,
          id,
          ...(identityChanged ? [id] : []),
        )
        .run();
      if (!result.meta.changes) throw inUse();
    } catch (error) {
      duplicate(error);
    }
    return findVersion(database, id);
  }
  try {
    const result = await database
      .prepare("INSERT INTO bible_versions(locale,code,label) VALUES (?,?,?)")
      .bind(input.locale, input.code, input.label)
      .run();
    return findVersion(database, Number(result.meta.last_row_id));
  } catch (error) {
    duplicate(error);
  }
}
export async function deleteBibleVersion(database: D1Database, id: number) {
  const current = await findVersion(database, id);
  if (current.project_count) throw inUse();
  const result = await database
    .prepare(
      "DELETE FROM bible_versions WHERE id=? AND NOT EXISTS (SELECT 1 FROM video_projects WHERE bible_version_id=?)",
    )
    .bind(id, id)
    .run();
  if (!result.meta.changes) throw inUse();
}

export async function syncBibleVersions(database: D1Database, values: unknown) {
  const versions = z.array(bibleVersionSchema).parse(values);
  let added = 0;
  for (let offset = 0; offset < versions.length; offset += 100) {
    const results = await database.batch(
      versions
        .slice(offset, offset + 100)
        .map((version) =>
          database
            .prepare(
              "INSERT INTO bible_versions(locale,code,label) VALUES (?,?,?) ON CONFLICT(locale,code) DO NOTHING",
            )
            .bind(version.locale, version.code, version.label),
        ),
    );
    added += results.reduce((total, result) => total + result.meta.changes, 0);
  }
  return { added };
}
