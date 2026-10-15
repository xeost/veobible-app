import {
  alignmentSignatureMatches,
  alignmentWasApplied,
  mergeAlignment,
  type AlignmentJob,
} from "../../../../tools/video-project-api/src/forced-alignment-result";
import { settingsSchema } from "./video-schema";

type Settings = ReturnType<typeof settingsSchema.parse>;

/** Apply one retained result using the latest settings and an optimistic write. */
export async function applyStoredAlignment({
  jobId,
  currentSettings,
  expectedSettings,
  project,
  jobs,
  database,
}: {
  jobId: string;
  currentSettings: Settings;
  expectedSettings: string;
  project: {
    id: number;
    settings: string;
    kind: string;
    passage: string;
    version_code: string;
    locale: string;
  };
  jobs: AlignmentJob[];
  database: D1Database;
}): Promise<{ settings: Settings } | { error: string; status: number }> {
  const conflict = {
    error:
      "The project changed in another window. Reload it before applying the analysis.",
    status: 409,
  };
  if (project.settings !== expectedSettings) return conflict;
  const stored = settingsSchema.parse(JSON.parse(project.settings));
  if (alignmentWasApplied(stored, jobId))
    return {
      settings: {
        ...currentSettings,
        alignmentJobId: stored.alignmentJobId,
        alignmentAppliedJobIds: stored.alignmentAppliedJobIds,
      },
    };
  const job = jobs.find((item) => item.id === jobId);
  if (!job || job.status !== "done" || !job.result)
    return {
      error: "The timing analysis is not ready. Try again in a moment.",
      status: 409,
    };
  if (
    !alignmentSignatureMatches(job.result.signature, {
      kind: project.kind,
      version: { id: project.version_code, locale: project.locale },
      passage: JSON.parse(project.passage),
      settings: currentSettings,
    })
  )
    return {
      error: "The passage changed after analysis. Analyze its timing again.",
      status: 409,
    };
  const settings = settingsSchema.parse(
    mergeAlignment(
      {
        ...currentSettings,
        // Application history comes from persisted settings, independently of client edits.
        alignmentJobId: stored.alignmentJobId,
        alignmentAppliedJobIds: stored.alignmentAppliedJobIds,
      },
      job.result,
      jobId,
    ),
  );
  const updated = await database
    .prepare(
      "UPDATE video_projects SET settings=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND settings=?",
    )
    .bind(JSON.stringify(settings), project.id, project.settings)
    .run();
  if (updated.meta.changes !== 1) return conflict;
  return { settings };
}
