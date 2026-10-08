export type QueueProject = {
  id: number;
  kind: "short" | "long";
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

export async function loadQueueView<
  T extends { projectId: number; kind: string; status: string },
>(database: D1Database, entries: T[], includeHistory: boolean) {
  const active = entries.filter((item) =>
    ["queued", "running"].includes(item.status),
  );
  const history = includeHistory
    ? entries.filter((item) => ["done", "failed"].includes(item.status))
    : [];
  const projects = await loadQueueProjects(
    database,
    [...active, ...history].map((item) => item.projectId),
  );
  const withProjects = (items: T[]) =>
    items.flatMap((item) => {
      const project = projects.get(item.projectId);
      return project?.kind === item.kind
        ? [
            {
              ...item,
              title: project.title,
              version: project.version_code,
              href: `/${item.kind === "short" ? "short-videos" : "long-videos"}/${project.id}`,
            },
          ]
        : [];
    });
  return {
    items: withProjects(active),
    ...(includeHistory ? { history: withProjects(history) } : {}),
  };
}
