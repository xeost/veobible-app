import { z } from "zod";
import { readPage, parsePagination } from "./pagination";
import { websiteProjectDetails, type WebsiteProject } from "./website";
import type { BibleVersionOption } from "./bible-versions";
export type VideoProjectPage = WebsiteProject & {
  kind: "short" | "long";
  version_id: number;
  label: string;
  updated_at: string | null;
};
const from = `FROM video_projects p JOIN bible_versions v ON v.id=p.bible_version_id LEFT JOIN pages_from_video_projects w ON w.video_project_id=p.id`;
export async function pageVideoProjectPages(
  db: D1Database,
  params: URLSearchParams,
) {
  const kind = z.enum(["short", "long"]).parse(params.get("kind"));
  const rawVersion = params.get("version");
  const version =
    rawVersion && rawVersion !== "all"
      ? z.coerce
          .number()
          .int()
          .positive()
          .max(Number.MAX_SAFE_INTEGER)
          .parse(rawVersion)
      : null;
  const filter = z
    .enum(["all", "included", "excluded", "missing-youtube"])
    .parse(params.get("filter") ?? "all");
  const query = z
    .string()
    .max(500)
    .parse(params.get("query") ?? "")
    .toLowerCase();
  const base = `p.published=1 AND p.kind=?${version ? " AND v.id=?" : ""}`;
  const baseArgs = [kind, ...(version ? [version] : [])];
  let text = "p.title || ' ' || p.id || ' ' || coalesce(w.description,'')";
  for (const upper of "ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑÇÝŸ")
    if (query.includes(upper.toLowerCase()))
      text = `replace(${text},'${upper}','${upper.toLowerCase()}')`;
  const match = `${query ? `instr(lower(${text}),?)>0` : "1"}${filter === "included" ? " AND coalesce(w.included,1)=1" : filter === "excluded" ? " AND coalesce(w.included,1)=0" : filter === "missing-youtube" ? " AND coalesce(json_extract(p.social_video_ids,'$.youtube'),'')=''" : ""}`;
  const searchArgs = query ? [query] : [];
  const [result, versions] = await Promise.all([
    readPage<VideoProjectPage>(
      db,
      parsePagination(params),
      db
        .prepare(
          `SELECT count(*) scopeTotal,coalesce(sum(coalesce(w.included,1)),0) included,coalesce(sum(1-coalesce(w.included,1)),0) excluded,coalesce(sum(CASE WHEN ${match} THEN 1 ELSE 0 END),0) total ${from} WHERE ${base}`,
        )
        .bind(...searchArgs, ...baseArgs),
      (limit, offset) =>
        db
          .prepare(
            `SELECT p.id,p.kind,p.slug,p.title,p.passage,v.locale,v.code AS version,v.id AS version_id,v.label,coalesce(json_extract(p.social_video_ids,'$.youtube'),'') youtube_id,coalesce(w.description,'') description,coalesce(w.included,1) included,strftime('%Y-%m-%dT%H:%M:%fZ',max(julianday(p.updated_at),coalesce(julianday(w.updated_at),0))) updated_at ${from} WHERE ${base} AND ${match} ORDER BY p.id ASC LIMIT ? OFFSET ?`,
          )
          .bind(...baseArgs, ...searchArgs, limit, offset),
    ),
    db
      .prepare(
        "SELECT id,locale,code,label FROM bible_versions ORDER BY locale,label,id",
      )
      .all<BibleVersionOption>(),
  ]);
  return {
    pages: result.rows.map((row) => {
      const { path, issue } = websiteProjectDetails(row);
      return { ...row, path, issue };
    }),
    pagination: result.pagination,
    summary: {
      total: result.counts.scopeTotal,
      included: result.counts.included,
      excluded: result.counts.excluded,
    },
    versions: versions.results,
  };
}
export const videoProjectPageUpdate = z
  .object({
    videoProjectId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    description: z.string().max(10000).optional(),
    included: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.description !== undefined || v.included !== undefined);
export async function saveVideoProjectPage(db: D1Database, input: unknown) {
  const value = videoProjectPageUpdate.parse(input);
  const result = await db
    .prepare(
      `INSERT INTO pages_from_video_projects(video_project_id,description,included)
 SELECT p.id,coalesce(?,w.description,''),coalesce(?,w.included,1) ${from} WHERE p.id=? AND p.published=1 AND p.kind IN ('short','long')
 ON CONFLICT(video_project_id) DO UPDATE SET description=excluded.description,included=excluded.included,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') RETURNING video_project_id`,
    )
    .bind(
      value.description ?? null,
      value.included === undefined ? null : Number(value.included),
      value.videoProjectId,
    )
    .all();
  return result.results.length > 0;
}
