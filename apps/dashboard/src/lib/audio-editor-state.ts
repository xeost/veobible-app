import type { AudioProject } from "../../../../tools/video-project-api/src/audio-project-schema";
import {
  AudioDatabaseError,
  applyAudioEvent,
  findAudioProject,
  findAudioProjectRow,
  type AudioProjectRow,
} from "./audio-projects";

type Forward = (path: string, body: unknown) => Promise<Response>;
export type AudioEditorHeader = Pick<
  AudioProjectRow,
  | "id"
  | "edition"
  | "book"
  | "book_order"
  | "chapter_count"
  | "revision"
  | "active_job_id"
  | "job_sequence"
  | "status"
  | "bible_version_id"
  | "code"
  | "locale"
  | "label"
> & {
  defaults_version: number | null;
  outputEnvironment: AudioProject["outputEnvironment"];
};

export async function audioEditorHeader(
  database: D1Database,
  edition: string,
  book: string,
  environment: AudioProject["outputEnvironment"],
) {
  const row = await database
    .prepare(
      `SELECT p.id,p.edition,p.book,
    p.book_order,p.chapter_count,p.revision,p.active_job_id,p.job_sequence,p.status,
    p.bible_version_id,v.code,v.locale,v.label,
    json_extract(p.settings,'$.voiceDefaultsVersion') defaults_version
    FROM audio_projects p JOIN bible_versions v ON v.id=p.bible_version_id
    WHERE p.edition=? AND p.book=?`,
    )
    .bind(edition, book)
    .first<Omit<AudioEditorHeader, "outputEnvironment">>();
  if (!row) throw new AudioDatabaseError("Audio project not found.", 404);
  return { ...row, outputEnvironment: environment };
}

/** Stored JSON was validated on write. Pass it through without parsing/cloning
 * every recording and trim merely to serialize it again for the browser. */
export function audioProjectRowJson(
  row: AudioProjectRow,
  environment: AudioProject["outputEnvironment"],
) {
  const scalar = JSON.stringify({
    outputEnvironment: environment,
    edition: row.edition,
    book: row.book,
    title: row.title,
    order: row.book_order,
    chapterCount: row.chapter_count,
    version: {
      id: row.bible_version_id,
      code: row.code,
      locale: row.locale,
      label: row.label,
    },
    revision: row.revision,
    status: row.status,
    progress: row.progress,
    updatedAt: row.updated_at,
  });
  return `${scalar.slice(0, -1)},"verseCounts":${row.verse_counts},"settings":${row.settings},"recordings":${row.recordings},"chapters":${row.chapters}}`;
}

export async function audioEditorState(
  database: D1Database,
  header: AudioEditorHeader,
  since: number | null,
  forward: Forward,
  extras: (header: AudioEditorHeader) => Promise<object>,
) {
  const { edition, book, outputEnvironment: environment } = header;
  const endpoint = `/v1/audio-projects/${edition}/${book}`;
  if (header.defaults_version !== 1)
    await findAudioProject(database, edition, book, environment);
  if (header.active_job_id && ["queued", "running"].includes(header.status)) {
    let response = await forward(`${endpoint}/updates`, {
      jobId: header.active_job_id,
      sequence: header.job_sequence,
    });
    if (response.status === 409) {
      // Cold/restarted services need the authoritative snapshot only once.
      const { project } = await findAudioProject(
        database,
        edition,
        book,
        environment,
      );
      response = await forward(endpoint, {
        project,
        jobId: header.active_job_id,
        sequence: header.job_sequence,
        includeContent: false,
      });
    }
    if (!response.ok)
      throw new AudioDatabaseError(
        "Could not load audio projects. Check that generation is available and try again.",
        503,
      );
    const update = (await response.json()) as {
      sequence: number;
      project?: AudioProject;
    } & Partial<AudioProject>;
    if (update.sequence > header.job_sequence) {
      const { sequence, ...snapshot } = update;
      await applyAudioEvent(database, header.id, header.active_job_id, {
        sequence,
        project: update.project ?? snapshot,
      });
    }
    // A callback can commit while the inspection is in flight.
    header = await audioEditorHeader(database, edition, book, environment);
  }
  if (since === header.revision)
    return Response.json(
      { unchanged: true, revision: header.revision },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  const [row, extra] = await Promise.all([
    findAudioProjectRow(database, edition, book, environment),
    since === null ? extras(header) : Promise.resolve({}),
  ]);
  return new Response(
    `{"project":${audioProjectRowJson(row, environment)},"extras":${JSON.stringify(extra)}}`,
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
