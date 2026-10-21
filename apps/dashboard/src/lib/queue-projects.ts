export type QueueProject = {
  id: number;
  kind: "short" | "long" | "book";
  title: string;
  version_code: string;
};

export async function loadQueueProjects(
  database: D1Database,
  projectIds: number[],
) {
  const ids = [
    ...new Set(projectIds.filter((id) => Number.isSafeInteger(id) && id > 0)),
  ];
  const projects: QueueProject[] = [];
  // Avoid full project payloads and stay below D1's bound-parameter limit.
  for (let offset = 0; offset < ids.length; offset += 90) {
    const batch = ids.slice(offset, offset + 90);
    const rows = await database
      .prepare(
        `SELECT p.id,p.kind,p.title,v.code version_code FROM video_projects p JOIN bible_versions v ON v.id=p.bible_version_id WHERE p.id IN (${batch.map(() => "?").join(",")})`,
      )
      .bind(...batch)
      .all<QueueProject>();
    projects.push(...rows.results);
  }
  return new Map(projects.map((project) => [project.id, project]));
}

type AudioQueueProject = {
  id: number;
  title: string;
  version_code: string;
  edition: string;
  book: string;
  output_environment: string;
};
async function loadAudioQueueProjects(database: D1Database, ids: number[]) {
  const unique = [
    ...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0)),
  ];
  const projects: AudioQueueProject[] = [];
  for (let offset = 0; offset < unique.length; offset += 90) {
    const batch = unique.slice(offset, offset + 90);
    projects.push(
      ...(
        await database
          .prepare(
            `SELECT p.id,p.title,p.edition,p.book,p.output_environment,v.code version_code FROM audio_projects p JOIN bible_versions v ON v.id=p.bible_version_id WHERE p.id IN (${batch.map(() => "?").join(",")})`,
          )
          .bind(...batch)
          .all<AudioQueueProject>()
      ).results,
    );
  }
  return new Map(projects.map((p) => [p.id, p]));
}

export async function loadQueueView<
  T extends {
    projectId: number;
    kind: string;
    status: string;
    outputEnvironment?: string;
  },
>(database: D1Database, entries: T[], includeHistory: boolean) {
  const active = entries.filter((item) =>
    ["queued", "running"].includes(item.status),
  );
  const history = includeHistory
    ? entries.filter((item) => ["done", "failed"].includes(item.status))
    : [];
  const projects = await loadQueueProjects(
    database,
    [...active, ...history]
      .filter((item) => item.kind !== "audio")
      .map((item) => item.projectId),
  );
  const audioProjects = await loadAudioQueueProjects(
    database,
    [...active, ...history]
      .filter((item) => item.kind === "audio")
      .map((item) => item.projectId),
  );
  const withProjects = (items: T[]) =>
    items.flatMap((item) => {
      if (item.kind === "audio") {
        const audio = audioProjects.get(item.projectId);
        return audio &&
          audio.output_environment === (item.outputEnvironment ?? "production")
          ? [
              {
                ...item,
                title: audio.title,
                version: audio.edition,
                href: `/audios/${encodeURIComponent(audio.edition)}/${encodeURIComponent(audio.book)}`,
              },
            ]
          : [];
      }
      const project = projects.get(item.projectId);
      return project?.kind === item.kind
        ? [
            {
              ...item,
              title: project.title,
              version: project.version_code,
              href: `/${item.kind === "short" ? "short-videos" : item.kind === "book" ? "book-videos" : "long-videos"}/${project.id}`,
            },
          ]
        : [];
    });
  return {
    items: withProjects(active),
    ...(includeHistory ? { history: withProjects(history) } : {}),
  };
}
