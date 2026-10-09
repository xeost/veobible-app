import type { VideoRow } from "../components/video-project";

export const currentProjectStorageKey = (kind: "short" | "long") =>
  `veo-current-video-projects:${kind}`;

export const projectVersionKey = (row: VideoRow) =>
  `${row.locale}:${row.version_code}`;
export function parseCurrentProjects(
  value: string | null,
): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(value ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, id]) =>
          typeof id === "number" && Number.isSafeInteger(id) && id > 0,
      ),
    );
  } catch {
    return {};
  }
}
