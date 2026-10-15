import { listingSelect } from "./video-listing";

export async function loadDashboardSummary(database: D1Database) {
  const results = await database.batch([
    database.prepare(
      "SELECT kind,count(*) total,coalesce(sum(published),0) published FROM video_projects GROUP BY kind",
    ),
    database.prepare(
      `${listingSelect} ORDER BY p.updated_at DESC,p.id DESC LIMIT 8`,
    ),
  ]);
  const groups = results[0].results as {
    kind: string;
    total: number;
    published: number;
  }[];
  return {
    projects: groups.map(({ kind, total }) => ({ kind, total })),
    published: {
      total: groups.reduce((sum, group) => sum + group.published, 0),
    },
    unpublished: {
      total: groups.reduce(
        (sum, group) => sum + group.total - group.published,
        0,
      ),
    },
    recent: results[1].results as Record<string, unknown>[],
  };
}
