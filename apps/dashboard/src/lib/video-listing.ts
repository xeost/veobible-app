import { readPage, parsePagination } from "./pagination";
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
  const ids = z
    .array(z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER))
    .min(1)
    .max(80)
    .parse((rawIds ?? "").split(","));

  return (
    await database
      .prepare(
        `${listingSelect} WHERE p.kind=? AND p.id IN (${ids.map(() => "?").join(",")})${version && version !== "all" ? " AND v.id=?" : ""} ORDER BY p.id ASC`,
      )
      .bind(
        kind,
        ...ids,
        ...(version && version !== "all"
          ? [
              z.coerce
                .number()
                .int()
                .positive()
                .max(Number.MAX_SAFE_INTEGER)
                .parse(version),
            ]
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

export async function pageVideoProjects(
  database: D1Database,
  params: URLSearchParams,
) {
  const kind = z.enum(["short", "long"]).parse(params.get("kind"));
  const version = params.get("version");
  const versionId =
    version && version !== "all"
      ? z.coerce
          .number()
          .int()
          .positive()
          .max(Number.MAX_SAFE_INTEGER)
          .parse(version)
      : null;
  const query = (params.get("query") ?? "").toLowerCase();
  const publication = z
    .enum(["all", "published", "unpublished"])
    .parse(params.get("publication") ?? "all");
  const base = `p.kind=?${versionId ? " AND p.bible_version_id=?" : ""}`;
  const baseValues = [kind, ...(versionId ? [versionId] : [])];
  // SQLite's lower() covers ASCII. Fold the accented capitals used in the
  // supported interface/Bible languages as well, retaining literal substring search.
  let title = "p.title || ' ' || p.id";
  const accented = "ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑÇÝŸ";
  if (query && /[^\x00-\x7F]/.test(query)) {
    for (const upper of accented) {
      const lower = upper.toLowerCase();
      if (query.includes(lower))
        title = `replace(${title},'${upper}','${lower}')`;
    }
  }
  const search = query ? `instr(lower(${title}),?)>0` : "1";
  const match = `${search}${publication === "all" ? "" : ` AND p.published=${publication === "published" ? 1 : 0}`}`;
  const searchValues = query ? [query] : [];
  const result = await readPage<VideoRow>(
    database,
    parsePagination(params),
    database
      .prepare(
        `SELECT count(*) scopeTotal,coalesce(sum(p.published),0) published,coalesce(sum(1-p.published),0) unpublished,coalesce(sum(CASE WHEN ${match} THEN 1 ELSE 0 END),0) total FROM video_projects p WHERE ${base}`,
      )
      .bind(...searchValues, ...baseValues),
    (limit, offset) =>
      database
        .prepare(
          `${listingSelect} WHERE ${base} AND ${match} ORDER BY p.id ASC LIMIT ? OFFSET ?`,
        )
        .bind(...baseValues, ...searchValues, limit, offset),
  );
  return {
    videos: result.rows,
    pagination: result.pagination,
    summary: {
      total: result.counts.scopeTotal,
      published: result.counts.published,
      unpublished: result.counts.unpublished,
    },
  };
}
