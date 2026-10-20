import { z } from "zod";

export const projectPublicationSchema = z.object({
  kind: z.enum(["short", "long", "book"]),
  ids: z
    .array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
    .min(1)
    .max(100)
    .transform((ids) => [...new Set(ids)]),
  published: z.boolean(),
});
export const publicationQueueSchema = z.object({
  items: z.array(
    z.object({
      projectId: z.number(),
      kind: z.string(),
      type: z.string(),
      status: z.string(),
    }),
  ),
});
export class ProjectPublicationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function updateProjectPublication(
  database: D1Database,
  input: z.infer<typeof projectPublicationSchema>,
  queue: z.infer<typeof publicationQueueSchema>["items"],
) {
  const ids = [...new Set(input.ids)];
  if (
    queue.some(
      (item) =>
        item.kind === input.kind &&
        item.type === "video" &&
        ids.includes(item.projectId) &&
        ["queued", "running"].includes(item.status),
    )
  )
    throw new ProjectPublicationError("Wait for generation to finish", 409);
  const selected = JSON.stringify(ids);
  // One atomic statement, including the scope/existence check. A stale or mixed
  // selection changes nothing. json_each keeps 100 selections below the bind limit.
  const result = await database
    .prepare(
      `
    UPDATE video_projects
    SET published=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE kind=? AND id IN (SELECT value FROM json_each(?))
      AND (SELECT count(*) FROM video_projects WHERE kind=? AND id IN (SELECT value FROM json_each(?)))=?
    RETURNING id
  `,
    )
    .bind(
      Number(input.published),
      input.kind,
      selected,
      input.kind,
      selected,
      ids.length,
    )
    .all<{ id: number }>();
  if (result.results.length !== ids.length)
    throw new ProjectPublicationError("Video not found", 404);
  return { updated: result.results.length };
}
