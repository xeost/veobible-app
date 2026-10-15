import { z } from "zod";

export type PageRequest = { page: number; pageSize: number };
export type PageInfo = PageRequest & { total: number; pages: number };
export function parsePagination(params: URLSearchParams): PageRequest {
  return z
    .object({
      page: z.coerce.number().int().min(1).max(1000000).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(10),
    })
    .parse({
      page: params.get("page") ?? undefined,
      pageSize: params.get("pageSize") ?? undefined,
    });
}
export function pageInfo(total: number, request: PageRequest): PageInfo {
  const pages = Math.max(1, Math.ceil(total / request.pageSize));
  return {
    total,
    pages,
    pageSize: request.pageSize,
    page: Math.min(request.page, pages),
  };
}

/** Count and fetch in one database round trip; recover a page removed by concurrent edits. */
export async function readPage<T>(
  database: D1Database,
  request: PageRequest,
  count: D1PreparedStatement,
  rows: (limit: number, offset: number) => D1PreparedStatement,
) {
  const result = await database.batch([
    count,
    rows(request.pageSize, (request.page - 1) * request.pageSize),
  ]);
  const counts = result[0].results[0] as Record<string, number>;
  const pagination = pageInfo(Number(counts.total), request);
  const items =
    pagination.page === request.page
      ? result[1].results
      : (
          await rows(
            pagination.pageSize,
            (pagination.page - 1) * pagination.pageSize,
          ).all()
        ).results;
  return { rows: items as T[], pagination, counts };
}
