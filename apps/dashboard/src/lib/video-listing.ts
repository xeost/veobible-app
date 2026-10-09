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
