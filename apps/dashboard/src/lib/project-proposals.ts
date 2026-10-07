import { z } from "zod";
import { settingsSchema } from "./video-schema";
import {
  loadProjectSettings,
  versionProjectSettings,
} from "./project-settings";
import type { BibleVersion } from "./bible-versions";
const identifier = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const point = z.object({
  book: identifier,
  chapter: z.number().int().positive(),
  verse: z.number().int().positive(),
});
export const projectProposalsSchema = z
  .array(
    z.object({
      id: z.number().int().positive(),
      slug: identifier,
      start: point,
      end: point,
      title: z.string().trim().min(1).max(500),
    }),
  )
  .superRefine((proposals, ctx) => {
    if (
      new Set(proposals.map((row) => row.slug)).size !== proposals.length ||
      new Set(proposals.map((row) => row.id)).size !== proposals.length
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate proposal identifier",
      });
  });
export async function syncVideoProjects(
  database: D1Database,
  kind: "short" | "long",
  version: BibleVersion,
  values: unknown,
  outputEnvironment: "production" | "development" = "production",
) {
  const proposals = projectProposalsSchema.parse(values);
  const settings = JSON.stringify(
    settingsSchema.parse(
      versionProjectSettings(
        await loadProjectSettings(database, kind),
        version.locale,
        version.code,
      ),
    ),
  );
  let added = 0;
  for (let offset = 0; offset < proposals.length; offset += 1400) {
    const statements = [];
    const batch = proposals.slice(offset, offset + 1400);
    for (let row = 0; row < batch.length; row += 14) {
      const values = batch.slice(row, row + 14).map((proposal) => {
        const passage = {
          id: proposal.slug,
          book: proposal.start.book,
          endBook: proposal.end.book,
          ...(kind === "long" ? { episode: proposal.id } : {}),
          start: {
            chapter: proposal.start.chapter,
            verse: proposal.start.verse,
          },
          end: { chapter: proposal.end.chapter, verse: proposal.end.verse },
        };
        return [
          kind,
          version.id,
          proposal.slug,
          proposal.title,
          JSON.stringify(passage),
          settings,
          outputEnvironment,
        ];
      });
      // Keep each statement below the 100 bound parameters supported by D1.
      statements.push(
        database
          .prepare(
            `INSERT INTO video_projects(kind,bible_version_id,slug,title,passage,settings,output_environment) VALUES ${values.map(() => "(?,?,?,?,?,?,?)").join(",")} ON CONFLICT(kind,bible_version_id,slug) DO NOTHING`,
          )
          .bind(...values.flat()),
      );
    }
    const results = await database.batch(statements);
    added += results.reduce((total, result) => total + result.meta.changes, 0);
  }
  return { added, total: proposals.length };
}
