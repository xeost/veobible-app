import type { AudioCatalogRow } from "./audio-listing";
import {
  advanceCurrentProjectMark,
  parseCurrentProjects,
  projectVersionKey,
  toggleCurrentProjectMark,
  type CurrentProjects,
} from "./current-video-projects";

export const currentAudioStorageKey = "veo-current-audio-projects";
export const parseCurrentAudioProjects = (value: string | null) =>
  parseCurrentProjects(value, "book");
const identity = (row: AudioCatalogRow) => ({
  id: row.id,
  locale: row.version.locale,
  version_code: row.version.code,
});
export const audioProjectVersionKey = (row: AudioCatalogRow) =>
  projectVersionKey(identity(row));
export const toggleCurrentAudioProject = (
  marks: CurrentProjects,
  row: AudioCatalogRow,
) => toggleCurrentProjectMark(marks, identity(row), "book");

export const advanceCurrentAudioProject = (
  marks: CurrentProjects,
  current: AudioCatalogRow,
  next: AudioCatalogRow,
) =>
  current.edition === next.edition
    ? advanceCurrentProjectMark(marks, identity(current), identity(next))
    : marks;
