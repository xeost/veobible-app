import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const cleanupRequestSchema = z.object({
  kind: z.enum(["short", "long"]),
  outputEnvironment: z.enum(["production", "development"]),
  action: z.enum(["preview", "delete"]),
  projects: z
    .array(
      z.object({
        id: z.number().int().positive(),
        version: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      }),
    )
    .max(10000),
});

// Publication eligibility is checked by the dashboard against saved records.
// No path supplied by a client is accepted by this service.
export async function cleanupProjectFolders(
  request: z.infer<typeof cleanupRequestSchema>,
  root: string,
  activeIds: ReadonlySet<number>,
) {
  const input = cleanupRequestSchema.parse(request);
  const result = {
    eligibleIds: [] as number[],
    deletedIds: [] as number[],
    skippedIds: [] as number[],
    missingIds: [] as number[],
    failedIds: [] as number[],
  };
  let resolvedRoot: string;
  try {
    resolvedRoot = await fs.realpath(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    result.missingIds = input.projects.map((project) => project.id);
    return result;
  }
  const visited = new Set<string>();
  const activeDirectories = new Set(
    input.projects
      .filter((project) => activeIds.has(project.id))
      .map((project) => path.join(resolvedRoot, project.version, project.slug)),
  );
  for (const project of input.projects) {
    const directory = path.join(resolvedRoot, project.version, project.slug);
    if (visited.has(directory)) continue;
    visited.add(directory);
    if (activeDirectories.has(directory)) {
      result.skippedIds.push(project.id);
      continue;
    }
    try {
      // Reject links even if their destination is another legitimate project.
      for (const folder of [path.dirname(directory), directory]) {
        const stat = await fs.lstat(folder);
        if (!stat.isDirectory() || stat.isSymbolicLink())
          throw new Error("Unsafe project directory");
      }
      if ((await fs.realpath(directory)) !== directory)
        throw new Error("Unsafe project directory");
      if (input.action === "delete") {
        await fs.rm(directory, { recursive: true });
        result.deletedIds.push(project.id);
      } else result.eligibleIds.push(project.id);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        result.missingIds.push(project.id);
      else {
        console.error(`Project folder cleanup failed for ${project.id}`, error);
        result.failedIds.push(project.id);
      }
    }
  }
  return result;
}
