import { audioPatchEventSchema } from "../../../../tools/video-project-api/src/audio-project-patch";
import { withAudioVersePause } from "./audio-settings";
import { inheritAudioVoiceDefaults } from "./project-voice-defaults";
import { loadBaseVoiceDefaults } from "./base-voices";
import { loadVoiceStyleDefaults } from "./voice-style-presets";
import { audioMixSettingsChanged } from "../../../../tools/video-project-api/src/audio-approvals";
import {
  audioProjectSchema,
  audioSaveSchema,
  audioEventSchema,
  type AudioProject,
  type AudioProjectSummary,
} from "../../../../tools/video-project-api/src/audio-project-schema";
export class AudioDatabaseError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export type AudioProjectRow = {
  id: number;
  bible_version_id: number;
  output_environment: AudioProject["outputEnvironment"];
  edition: string;
  book: string;
  title: string;
  book_order: number;
  chapter_count: number;
  verse_counts: string;
  settings: string;
  recordings: string;
  chapters: string;
  status: AudioProject["status"];
  progress: number;
  revision: number;
  active_job_id: string | null;
  callback_hash: string | null;
  job_sequence: number;
  updated_at: string;
  code: string;
  locale: AudioProject["version"]["locale"];
  label: string;
};
type Row = AudioProjectRow;
const select =
  "SELECT p.*,v.code,v.locale,v.label FROM audio_projects p JOIN bible_versions v ON v.id=p.bible_version_id";
const now = () => new Date().toISOString();
export const audioTokenHash = async (token: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
export function audioProjectFromRow(row: Row): AudioProject {
  // Every write validates external input. Revalidating the entire persisted book
  // here clones thousands of recordings and trims on every editor request.
  return {
    outputEnvironment: row.output_environment,
    edition: row.edition,
    book: row.book,
    title: row.title,
    order: row.book_order,
    chapterCount: row.chapter_count,
    verseCounts: JSON.parse(row.verse_counts),
    version: {
      id: row.bible_version_id,
      code: row.code,
      locale: row.locale,
      label: row.label,
    },
    settings: JSON.parse(row.settings),
    recordings: JSON.parse(row.recordings),
    chapters: JSON.parse(row.chapters),
    status: row.status,
    progress: row.progress,
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}
export async function findAudioProjectRow(
  database: D1Database,
  edition: string,
  book: string,
  environment: AudioProject["outputEnvironment"] = "production",
) {
  const row = await database
    .prepare(
      `${select} WHERE p.edition=? AND p.book=? AND p.output_environment=?`,
    )
    .bind(edition, book, environment)
    .first<Row>();
  if (!row) throw new AudioDatabaseError("Audio project not found.", 404);
  return row;
}
export async function findAudioProject(
  database: D1Database,
  edition: string,
  book: string,
  environment: AudioProject["outputEnvironment"] = "production",
) {
  const row = await findAudioProjectRow(database, edition, book, environment);
  const project = audioProjectFromRow(row);
  if (project.settings.voiceDefaultsVersion !== 1) {
    const [defaults, styles] = await Promise.all([
      loadBaseVoiceDefaults(database, "audio"),
      loadVoiceStyleDefaults(database, "audio"),
    ]);
    project.settings = inheritAudioVoiceDefaults(
      project.settings,
      project.version.locale,
      defaults,
      styles[project.version.locale],
    );
    const upgraded = JSON.stringify(project.settings);
    const result = await database
      .prepare("UPDATE audio_projects SET settings=? WHERE id=? AND settings=?")
      .bind(upgraded, row.id, row.settings)
      .run();
    if (!result.meta.changes)
      throw new AudioDatabaseError(
        "This audio project changed. Reload it before saving.",
      );
    row.settings = upgraded;
  }
  return { row, project };
}
export async function listAudioProjects(
  database: D1Database,
  environment: AudioProject["outputEnvironment"] = "production",
): Promise<AudioProjectSummary[]> {
  // Listing is independent of the generation service and does not transfer verse recordings.
  const rows = (
    await database
      .prepare(
        `SELECT p.output_environment,p.edition,p.book,p.title,p.book_order,
      p.chapter_count,p.verse_counts,p.bible_version_id,p.chapters,p.status,p.progress,p.updated_at,
      v.code,v.locale,v.label FROM audio_projects p JOIN bible_versions v ON v.id=p.bible_version_id
      WHERE p.output_environment=? ORDER BY v.label,p.edition,p.book_order`,
      )
      .bind(environment)
      .all<Row>()
  ).results;
  return rows.map((row) => ({
    outputEnvironment: row.output_environment,
    edition: row.edition,
    book: row.book,
    title: row.title,
    order: row.book_order,
    chapterCount: row.chapter_count,
    verseCounts: JSON.parse(row.verse_counts),
    chapters: JSON.parse(row.chapters),
    status: row.status,
    progress: row.progress,
    updatedAt: row.updated_at,
    version: {
      id: row.bible_version_id,
      code: row.code,
      locale: row.locale,
      label: row.label,
    },
  }));
}
export async function insertAudioProjects(
  database: D1Database,
  values: unknown[],
  environment: AudioProject["outputEnvironment"] = "production",
) {
  const projects = values.map((value) => audioProjectSchema.parse(value));
  if (!projects.length)
    throw new AudioDatabaseError("Audio project not found.", 400);
  const version = projects[0].version,
    edition = projects[0].edition;
  if (
    projects.some(
      (p) =>
        p.outputEnvironment !== environment ||
        p.version.id !== version.id ||
        p.edition !== edition,
    )
  )
    throw new AudioDatabaseError(
      "Audio project does not match its folder.",
      400,
    );
  await database.batch(
    projects.map((p) =>
      database
        .prepare(
          `INSERT INTO audio_projects(output_environment,bible_version_id,edition,book,title,book_order,chapter_count,verse_counts,settings,recordings,chapters,status,progress,revision,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          p.outputEnvironment,
          p.version.id,
          p.edition,
          p.book,
          p.title,
          p.order,
          p.chapterCount,
          JSON.stringify(p.verseCounts),
          JSON.stringify(p.settings),
          JSON.stringify(p.recordings),
          JSON.stringify(p.chapters),
          p.status,
          p.progress,
          p.revision,
          p.updatedAt,
        ),
    ),
  );
}
function validReferences(project: AudioProject) {
  const refs = new Set(
    project.verseCounts.flatMap((count, c) =>
      Array.from({ length: count }, (_, v) => `${c + 1}:${v + 1}`),
    ),
  );
  if (project.verseCounts.length !== project.chapterCount)
    throw new AudioDatabaseError("Verse not found.", 400);
  return refs;
}
function validateSettings(project: AudioProject) {
  if (!project.settings.baseVoice.startsWith(`${project.version.locale}-`))
    throw new AudioDatabaseError(
      "Choose a voice in the project's language.",
      400,
    );
  const refs = validReferences(project);
  for (const ref of [
    ...Object.keys(project.settings.trims),
    ...Object.keys(project.settings.pauses),
    ...Object.keys(project.settings.approvals ?? {}),
    ...Object.keys(project.recordings),
  ])
    if (!refs.has(ref)) throw new AudioDatabaseError("Verse not found.", 400);
  for (const [ref, trim] of Object.entries(project.settings.trims))
    if (
      !project.recordings[ref] ||
      trim.endSeconds > project.recordings[ref].duration + 0.01
    )
      throw new AudioDatabaseError(
        "The audio trim is outside this verse.",
        400,
      );
}
export async function saveAudioProject(
  database: D1Database,
  edition: string,
  book: string,
  value: unknown,
  environment: AudioProject["outputEnvironment"] = "production",
) {
  const input = audioSaveSchema.parse(value),
    { row, project } = await findAudioProject(
      database,
      edition,
      book,
      environment,
    );
  if (["queued", "running"].includes(project.status))
    throw new AudioDatabaseError("Wait for audio generation to finish.");
  input.settings.voiceDefaultsVersion = 1;
  input.settings.inheritBaseVoice ??=
    input.settings.baseVoice === project.settings.baseVoice &&
    project.settings.inheritBaseVoice === true;
  const updated = { ...project, settings: input.settings };
  validateSettings(updated);
  const changed = audioMixSettingsChanged(project.settings, input.settings);
  const result = await database
    .prepare(
      `UPDATE audio_projects SET settings=?,chapters=?,status=?,revision=revision+1,active_job_id=NULL,callback_hash=NULL,job_sequence=0,updated_at=? WHERE id=? AND revision=? AND status NOT IN ('queued','running')`,
    )
    .bind(
      JSON.stringify(input.settings),
      JSON.stringify(changed ? {} : project.chapters),
      changed ? "draft" : project.status,
      now(),
      row.id,
      input.revision,
    )
    .run();
  if (!result.meta.changes)
    throw new AudioDatabaseError(
      "This audio project changed. Reload it before saving.",
    );
  return (await findAudioProject(database, edition, book, environment)).project;
}
export async function beginAudioJob(
  database: D1Database,
  edition: string,
  book: string,
  environment: AudioProject["outputEnvironment"] = "production",
  versePauseSeconds?: number,
) {
  const { row, project } = await findAudioProject(
    database,
    edition,
    book,
    environment,
  );
  const settings =
    versePauseSeconds === undefined
      ? project.settings
      : withAudioVersePause(
          project.settings,
          project.verseCounts,
          versePauseSeconds,
        );
  const jobId = crypto.randomUUID(),
    token = crypto.randomUUID() + crypto.randomUUID();
  const result = await database
    .prepare(
      `UPDATE audio_projects SET settings=?,status='queued',progress=0,active_job_id=?,callback_hash=?,job_sequence=0,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND status NOT IN ('queued','running')`,
    )
    .bind(
      JSON.stringify(settings),
      jobId,
      await audioTokenHash(token),
      now(),
      row.id,
      row.revision,
    )
    .run();
  if (!result.meta.changes)
    throw new AudioDatabaseError("Wait for audio generation to finish.");
  return {
    id: row.id,
    jobId,
    token,
    project: {
      ...project,
      settings,
      status: "queued" as const,
      progress: 0,
      revision: project.revision + 1,
    },
  };
}
export async function failAudioJob(
  database: D1Database,
  id: number,
  jobId: string,
) {
  await database
    .prepare(
      `UPDATE audio_projects SET status='failed',revision=revision+1,updated_at=? WHERE id=? AND active_job_id=? AND status IN ('queued','running')`,
    )
    .bind(now(), id, jobId)
    .run();
}
export async function applyAudioEvent(
  database: D1Database,
  id: number,
  jobId: string,
  value: unknown,
  token?: string,
) {
  const event = audioEventSchema.parse(value);
  const row = await database
    .prepare(`${select} WHERE p.id=?`)
    .bind(id)
    .first<Row>();
  if (!row) throw new AudioDatabaseError("Audio project not found.", 404);
  if (
    token !== undefined &&
    row.callback_hash !== (await audioTokenHash(token))
  )
    throw new AudioDatabaseError("Unauthorized", 401);
  if (
    row.active_job_id !== jobId ||
    event.sequence <= row.job_sequence ||
    !["queued", "running"].includes(row.status)
  )
    return { applied: false };
  const project = event.project;
  if (
    project.outputEnvironment !== row.output_environment ||
    project.edition !== row.edition ||
    project.book !== row.book ||
    project.version.id !== row.bible_version_id ||
    project.version.code !== row.code ||
    project.version.locale !== row.locale ||
    project.chapterCount !== row.chapter_count ||
    project.order !== row.book_order ||
    JSON.stringify(project.verseCounts) !== row.verse_counts
  )
    throw new AudioDatabaseError(
      "Audio project does not match its folder.",
      400,
    );
  validateSettings(project);
  for (const [chapter, asset] of Object.entries(project.chapters))
    if (
      Number(chapter) > project.chapterCount ||
      Number(chapter) < 1 ||
      asset.file !==
        `${String(project.order).padStart(2, "0")}-${project.book}-${chapter}.mp3`
    )
      throw new AudioDatabaseError("Invalid audio file.", 400);
  for (const recording of Object.values(project.recordings))
    if (
      !recording.file.startsWith(`${project.book}/`) ||
      recording.file.split(/[/\\]/).some((p) => p === ".." || p === ".")
    )
      throw new AudioDatabaseError("Invalid audio file.", 400);
  const result = await database
    .prepare(
      `UPDATE audio_projects SET settings=?,recordings=?,chapters=?,status=?,progress=?,job_sequence=?,revision=revision+1,updated_at=? WHERE id=? AND active_job_id=? AND job_sequence<? AND status IN ('queued','running')`,
    )
    .bind(
      JSON.stringify(project.settings),
      JSON.stringify(project.recordings),
      JSON.stringify(project.chapters),
      project.status,
      project.progress,
      event.sequence,
      now(),
      id,
      jobId,
      event.sequence,
    )
    .run();
  return { applied: !!result.meta.changes };
}
/** JSON merge patches are applied inside the database: cost in the Worker is
 * proportional to the changed verses, not to the accumulated book size. */
export async function applyAudioPatch(
  database: D1Database,
  id: number,
  jobId: string,
  value: unknown,
  token: string,
) {
  const { sequence, baseSequence, patch } = audioPatchEventSchema.parse(value);
  const row = await database
    .prepare(
      `SELECT p.id,book,book_order,chapter_count,verse_counts,
    locale,active_job_id,callback_hash,job_sequence,status
    FROM audio_projects p JOIN bible_versions v ON v.id=p.bible_version_id WHERE p.id=?`,
    )
    .bind(id)
    .first<
      Pick<
        Row,
        | "id"
        | "book"
        | "book_order"
        | "chapter_count"
        | "verse_counts"
        | "locale"
        | "active_job_id"
        | "callback_hash"
        | "job_sequence"
        | "status"
      >
    >();
  if (!row) throw new AudioDatabaseError("Audio project not found.", 404);
  if (row.callback_hash !== (await audioTokenHash(token)))
    throw new AudioDatabaseError("Unauthorized", 401);
  if (
    row.active_job_id !== jobId ||
    sequence <= row.job_sequence ||
    !["queued", "running"].includes(row.status)
  )
    return { applied: false };
  if (baseSequence !== row.job_sequence || sequence <= baseSequence)
    throw new AudioDatabaseError("Audio update needs a current snapshot.", 409);
  const verseCounts = JSON.parse(row.verse_counts) as number[];
  const refs = new Set([
    ...Object.keys(patch.recordings),
    ...Object.keys(patch.settings.trims ?? {}),
    ...Object.keys(patch.settings.pauses ?? {}),
    ...Object.keys(patch.settings.approvals ?? {}),
  ]);
  for (const ref of refs) {
    const [chapter, verse] = ref.split(":").map(Number);
    if (
      ref !== `${chapter}:${verse}` ||
      !verseCounts[chapter - 1] ||
      verse < 1 ||
      verse > verseCounts[chapter - 1]
    )
      throw new AudioDatabaseError("Verse not found.", 400);
  }
  if (
    patch.settings.baseVoice &&
    !patch.settings.baseVoice.startsWith(`${row.locale}-`)
  )
    throw new AudioDatabaseError(
      "Choose a voice in the project's language.",
      400,
    );
  for (const recording of Object.values(patch.recordings))
    if (
      recording &&
      (!recording.file.startsWith(`${row.book}/`) ||
        recording.file.split(/[/\\]/).some((p) => p === "." || p === ".."))
    )
      throw new AudioDatabaseError("Invalid audio file.", 400);
  for (const [chapter, asset] of Object.entries(patch.chapters))
    if (
      String(Number(chapter)) !== chapter ||
      Number(chapter) < 1 ||
      Number(chapter) > row.chapter_count ||
      (asset &&
        asset.file !==
          `${String(row.book_order).padStart(2, "0")}-${row.book}-${chapter}.mp3`)
    )
      throw new AudioDatabaseError("Invalid audio file.", 400);
  // Validate changed cuts against new recordings or only the referenced saved duration.
  for (const [ref, trim] of Object.entries(patch.settings.trims ?? {})) {
    if (!trim) continue;
    const duration = Object.hasOwn(patch.recordings, ref)
      ? patch.recordings[ref]?.duration
      : (
          await database
            .prepare(
              "SELECT json_extract(recordings,?) duration FROM audio_projects WHERE id=?",
            )
            .bind(`$."${ref}".duration`, id)
            .first<{ duration: number | null }>()
        )?.duration;
    if (!duration || trim.endSeconds > duration + 0.01)
      throw new AudioDatabaseError(
        "The audio trim is outside this verse.",
        400,
      );
  }
  const result = await database
    .prepare(
      `UPDATE audio_projects SET
    settings=json_patch(settings,?),recordings=json_patch(recordings,?),chapters=json_patch(chapters,?),
    status=?,progress=?,job_sequence=?,revision=revision+1,updated_at=?
    WHERE id=? AND active_job_id=? AND job_sequence=? AND status IN ('queued','running')`,
    )
    .bind(
      JSON.stringify(patch.settings),
      JSON.stringify(patch.recordings),
      JSON.stringify(patch.chapters),
      patch.status,
      patch.progress,
      sequence,
      now(),
      id,
      jobId,
      baseSequence,
    )
    .run();
  if (!result.meta.changes) {
    // Concurrent reconciliation may have advanced the cursor. Retry with a full snapshot.
    throw new AudioDatabaseError("Audio update needs a current snapshot.", 409);
  }
  return { applied: true };
}
export async function audioProjectCallback(
  req: Request,
  database: D1Database,
): Promise<Response | null> {
  const match =
    /^\/api\/audio-project-events\/([1-9]\d*)\/([0-9a-f-]{36})$/.exec(
      new URL(req.url).pathname,
    );
  if (!match) return null;
  if (req.method !== "POST")
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token || Number(req.headers.get("content-length") ?? 0) > 1024 * 1024)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const value = (await req.json()) as { patch?: unknown };
    return Response.json(
      value.patch
        ? await applyAudioPatch(
            database,
            Number(match[1]),
            match[2],
            value,
            token,
          )
        : await applyAudioEvent(
            database,
            Number(match[1]),
            match[2],
            value,
            token,
          ),
    );
  } catch (error) {
    return Response.json(
      { error: "Audio update rejected" },
      { status: error instanceof AudioDatabaseError ? error.status : 400 },
    );
  }
}
