import type { VideoRow, VideoKind } from "../components/video-project";

export type CurrentProjects = Record<string, number[]>;
export const currentProjectStorageKey = (kind: VideoKind) =>
  `veo-current-video-projects:${kind}`;
export const projectVersionKey = (
  row: Pick<VideoRow, "locale" | "version_code">,
) => `${row.locale}:${row.version_code}`;
export const currentProjectLimit = (kind: VideoKind) =>
  kind === "long" ? 2 : 1;

export function parseCurrentProjects(
  value: string | null,
  kind: VideoKind = "short",
): CurrentProjects {
  try {
    const parsed: unknown = JSON.parse(value ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) => {
        // Preserve marks stored before multiple long-video marks were supported.
        const ids = [
          ...new Set(
            (Array.isArray(value) ? value : [value]).filter(
              (id): id is number =>
                typeof id === "number" && Number.isSafeInteger(id) && id > 0,
            ),
          ),
        ].slice(0, currentProjectLimit(kind));
        return ids.length ? [[key, ids]] : [];
      }),
    );
  } catch {
    return {};
  }
}

export function removeCurrentProject(
  marks: CurrentProjects,
  row: Pick<VideoRow, "id" | "locale" | "version_code">,
): CurrentProjects {
  const key = projectVersionKey(row);
  const next = { ...marks };
  const remaining = (marks[key] ?? []).filter((id) => id !== row.id);
  if (remaining.length) next[key] = remaining;
  else delete next[key];
  return next;
}

export function toggleCurrentProjectMark(
  marks: CurrentProjects,
  row: Pick<VideoRow, "id" | "locale" | "version_code">,
  kind: VideoKind,
): CurrentProjects {
  const key = projectVersionKey(row);
  const ids = marks[key] ?? [];
  if (ids.includes(row.id)) return removeCurrentProject(marks, row);
  if (kind === "long" && ids.length >= currentProjectLimit(kind)) return marks;
  return { ...marks, [key]: kind === "short" ? [row.id] : [...ids, row.id] };
}

export function advanceCurrentProjectMark(
  marks: CurrentProjects,
  current: Pick<VideoRow, "id" | "locale" | "version_code">,
  next: Pick<VideoRow, "id" | "locale" | "version_code">,
): CurrentProjects {
  const key = projectVersionKey(current);
  const ids = marks[key] ?? [];
  if (
    projectVersionKey(next) !== key ||
    !ids.includes(current.id) ||
    ids.includes(next.id)
  )
    return marks;
  return {
    ...marks,
    [key]: ids.map((id) => (id === current.id ? next.id : id)),
  };
}
