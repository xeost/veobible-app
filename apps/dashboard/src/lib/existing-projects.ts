import { z } from "zod";
import { renderSchema, settingsSchema } from "./video-schema";
import type { BibleVersion } from "./bible-versions";

export const existingProjectsSchema = z.object({
  projects: z
    .array(
      z.object({
        slug: renderSchema.shape.passage.shape.id,
        version: z.object({
          locale: renderSchema.shape.version.shape.locale,
          code: renderSchema.shape.version.shape.id,
          label: z.string(),
        }),
        title: z.string().min(1).max(500),
        passage: renderSchema.shape.passage,
        settings: settingsSchema.partial(),
        published: z.boolean(),
      }),
    )
    .superRefine((projects, ctx) => {
      const keys = projects.map(
        (row) => `${row.version.locale}/${row.version.code}/${row.slug}`,
      );
      if (
        new Set(keys).size !== keys.length ||
        projects.some((row) => row.slug !== row.passage.id)
      )
        ctx.addIssue({
          code: "custom",
          message: "Invalid existing project identity",
        });
    }),
  skipped: z.number().int().nonnegative(),
  activeProjectIds: z.array(z.number().int().positive()).default([]),
});

export async function syncExistingProjects(
  database: D1Database,
  kind: "short" | "long",
  values: unknown,
) {
  const input = existingProjectsSchema.parse(values);
  const versions = (
    await database
      .prepare("SELECT id,locale,code FROM bible_versions")
      .all<BibleVersion>()
  ).results;
  const versionByIdentity = new Map(
    versions.map((version) => [`${version.locale}/${version.code}`, version]),
  );
  const requested = input.projects.flatMap((row) => {
    const version = versionByIdentity.get(
      `${row.version.locale}/${row.version.code}`,
    );
    return version ? [{ version: version.id, slug: row.slug }] : [];
  });
  const projects = requested.length
    ? (
        await database
          .prepare(
            "SELECT p.id,p.bible_version_id,p.slug,p.settings,p.published FROM json_each(?) selected JOIN video_projects p ON p.kind=? AND p.bible_version_id=json_extract(selected.value,'$.version') AND p.slug=json_extract(selected.value,'$.slug')",
          )
          .bind(JSON.stringify(requested), kind)
          .all<{
            id: number;
            bible_version_id: number;
            slug: string;
            settings: string;
            published: number;
          }>()
      ).results
    : [];
  const projectByIdentity = new Map(
    projects.map((project) => [
      `${project.bible_version_id}/${project.slug}`,
      project,
    ]),
  );
  const activeIds = new Set(input.activeProjectIds);
  let updated = 0,
    unchanged = 0,
    skipped = input.skipped;
  const statements: D1PreparedStatement[] = [];
  for (const row of input.projects) {
    const version = versionByIdentity.get(
      `${row.version.locale}/${row.version.code}`,
    );
    if (!version) continue;
    const existing = projectByIdentity.get(`${version.id}/${row.slug}`);
    if (!existing) continue;
    if (activeIds.has(existing.id)) {
      skipped++;
      continue;
    }
    const settings = JSON.stringify(
      settingsSchema.parse({
        ...JSON.parse(existing.settings),
        ...row.settings,
      }),
    );
    if (
      JSON.stringify(settingsSchema.parse(JSON.parse(existing.settings))) ===
        settings &&
      Boolean(existing.published) === row.published
    ) {
      unchanged++;
      continue;
    }
    statements.push(
      database
        .prepare(
          "UPDATE video_projects SET settings=?,published=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
        )
        .bind(settings, Number(row.published), existing.id),
    );
    updated++;
  }
  for (let offset = 0; offset < statements.length; offset += 100)
    await database.batch(statements.slice(offset, offset + 100));
  return {
    updated,
    unchanged,
    skipped,
    total: input.projects.length + input.skipped,
  };
}
