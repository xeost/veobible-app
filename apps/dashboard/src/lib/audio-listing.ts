import { z } from "zod";
import {
  audioEditionSchema,
  audioEnvironmentSchema,
  type AudioProject,
  type AudioVersion,
} from "../../../../tools/video-project-api/src/audio-project-schema";
import { parsePagination, readPage, type PageInfo } from "./pagination";
export type AudioCatalogRow = {
  id: number;
  edition: string;
  book: string;
  title: string;
  chapterCount: number;
  completedChapters: number;
  status: AudioProject["status"];
  progress: number;
  updatedAt: string;
  version: AudioVersion;
};
export type AudioEditionOption = AudioVersion & {
  edition: string;
  number: number;
};
export type AudioCatalog = {
  projects: AudioCatalogRow[];
  editions: AudioEditionOption[];
  pagination: PageInfo;
  summary: { total: number; generated: number; pending: number };
};
export async function pageAudioProjects(
  database: D1Database,
  params: URLSearchParams,
  environment: AudioProject["outputEnvironment"],
): Promise<AudioCatalog> {
  audioEnvironmentSchema.parse(environment);
  const requested = params.get("edition"),
    edition =
      requested && requested !== "all"
        ? audioEditionSchema.parse(requested)
        : null;
  const status = z
    .enum(["all", "draft", "queued", "running", "done", "failed"])
    .parse(params.get("status") ?? "all");
  const query = (params.get("query") ?? "").trim().toLowerCase();
  const ids = params.has("ids")
    ? z
        .array(z.coerce.number().int().positive().safe())
        .min(1)
        .max(80)
        .parse(params.get("ids")!.split(","))
    : null;
  const afterId = params.has("afterId")
    ? z.coerce.number().int().positive().safe().parse(params.get("afterId"))
    : null;
  const base = `1=1${edition ? " AND p.edition=?" : ""}${afterId !== null ? " AND p.id>?" : ""}${ids ? ` AND p.id IN (${ids.map(() => "?").join(",")})` : ""}`;
  const baseValues = [
    ...(edition ? [edition] : []),
    ...(afterId !== null ? [afterId] : []),
    ...(ids ?? []),
  ];
  let title = "p.title || ' ' || p.id || ' ' || v.label";
  for (const upper of "ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑÇÝŸ")
    if (query.includes(upper.toLowerCase()))
      title = `replace(${title},'${upper}','${upper.toLowerCase()}')`;
  const match = `${query ? `instr(lower(${title}),?)>0` : "1"}${status === "all" ? "" : " AND p.status=?"}`;
  const matchValues = [
    ...(query ? [query] : []),
    ...(status === "all" ? [] : [status]),
  ];
  const join =
    " FROM audio_projects p JOIN bible_versions v ON v.id=p.bible_version_id";
  type Row = {
    id: number;
    edition: string;
    book: string;
    title: string;
    chapter_count: number;
    completed_chapters: number;
    status: AudioProject["status"];
    progress: number;
    updated_at: string;
    version_id: number;
    code: string;
    locale: AudioVersion["locale"];
    label: string;
  };
  const result = await readPage<Row>(
    database,
    parsePagination(params),
    database
      .prepare(
        `SELECT count(*) scopeTotal,coalesce(sum(p.status='done'),0) generated,coalesce(sum(p.status!='done'),0) pending,coalesce(sum(CASE WHEN ${match} THEN 1 ELSE 0 END),0) total${join} WHERE ${base}`,
      )
      .bind(...matchValues, ...baseValues),
    (limit, offset) =>
      database
        .prepare(
          `SELECT p.id,p.edition,p.book,p.title,p.chapter_count,(SELECT count(*) FROM json_each(p.chapters)) completed_chapters,p.status,p.progress,p.updated_at,v.id version_id,v.code,v.locale,v.label${join} WHERE ${base} AND ${match} ORDER BY ${afterId !== null ? "p.id" : "v.label,CAST(substr(p.edition,length(v.code)+3) AS INTEGER),p.book_order,p.id"} LIMIT ? OFFSET ?`,
        )
        .bind(...baseValues, ...matchValues, limit, offset),
  );
  const editions = (
    await database
      .prepare(
        `SELECT DISTINCT p.edition,v.id,v.code,v.locale,v.label${join} ORDER BY v.locale,v.label,CAST(substr(p.edition,length(v.code)+3) AS INTEGER)`,
      )
      .all<AudioVersion & { edition: string }>()
  ).results;
  return {
    projects: result.rows.map((row) => ({
      id: row.id,
      edition: row.edition,
      book: row.book,
      title: row.title,
      chapterCount: row.chapter_count,
      completedChapters: row.completed_chapters,
      status: row.status,
      progress: row.progress,
      updatedAt: row.updated_at,
      version: {
        id: row.version_id,
        code: row.code,
        locale: row.locale,
        label: row.label,
      },
    })),
    editions: editions.map((row) => ({
      ...row,
      number: Number(row.edition.match(/-v(\d+)$/)?.[1]),
    })),
    pagination: result.pagination,
    summary: {
      total: result.counts.scopeTotal,
      generated: result.counts.generated,
      pending: result.counts.pending,
    },
  };
}
