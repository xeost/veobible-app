import { z } from "zod";
import type { VideoRow } from "../components/video-project";

export const listingSelect =
  "SELECT p.id,p.id project_id,p.kind,p.title,p.published,p.updated_at,v.id version_id,v.code version_code,v.locale,v.label" +
  " FROM video_projects p JOIN bible_versions v ON v.id=p.bible_version_id";

export async function listVideoProjects(
  database: D1Database,
  kind: "short" | "long",
  version: string | null,
  rawIds: string | null,
) {
  const ids =
    rawIds === null
      ? null
      : z
          .array(
            z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
          )
          .min(1)
          .max(80)
          .parse(rawIds.split(","));

  return (
    await database
      .prepare(
        `${listingSelect} WHERE p.kind=?${ids ? ` AND p.id IN (${ids.map(() => "?").join(",")})` : ""}${version && version !== "all" ? " AND v.id=?" : ""} ORDER BY p.id ASC`,
      )
      .bind(
        kind,
        ...(ids ?? []),
        ...(version && version !== "all"
          ? [z.coerce.number().int().positive().parse(version)]
          : []),
      )
      .all()
  ).results as VideoRow[];
}

export async function nextVideoProject(
  database: D1Database,
  id: number,
  exclude: number[] = [],
) {
  const rows = await database
    .prepare(
      `${listingSelect} JOIN video_projects current ON current.kind=p.kind AND current.bible_version_id=p.bible_version_id WHERE current.id=? AND p.id>current.id${exclude.length ? ` AND p.id NOT IN (${exclude.map(() => "?").join(",")})` : ""} ORDER BY p.id ASC LIMIT 1`,
    )
    .bind(id, ...exclude)
    .all<VideoRow>();
  return rows.results[0] ?? null;
}
