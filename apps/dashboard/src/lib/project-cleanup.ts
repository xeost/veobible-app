import { z } from "zod";

export const publishedCleanupSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), kind: z.enum(["short", "long"]) }),
  z.object({
    action: z.literal("delete"),
    kind: z.enum(["short", "long"]),
    ids: z.array(z.number().int().positive()).min(1).max(10000),
  }),
]);

export async function publishedCleanupProjects(
  database: D1Database,
  input: z.infer<typeof publishedCleanupSchema>,
) {
  // Recheck publication on deletion, and intersect with the exact IDs the user
  // reviewed. Never delete projects published after the confirmation opened.
  const selected = input.action === "delete" ? new Set(input.ids) : null;
  const rows = (
    await database
      .prepare(
        "SELECT p.id,p.slug,v.code version FROM video_projects p JOIN bible_versions v ON v.id=p.bible_version_id WHERE p.kind=? AND p.published=1 ORDER BY p.id",
      )
      .bind(input.kind)
      .all<{ id: number; slug: string; version: string }>()
  ).results;
  return rows.filter((project) => !selected || selected.has(project.id));
}
