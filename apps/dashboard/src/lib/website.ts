import { loadSocialSettings } from "./social-settings";
import {
  catalog,
  emptyContent,
  publicationPath,
  validateContent,
  youtubeId,
  type Publication,
  type SiteContent,
  type SiteSnapshot,
} from "../../../../packages/website/content";
export type WebsiteProject = {
  id: number;
  kind: "short" | "long" | "book";
  locale: "es" | "en" | "pt";
  version: string;
  slug: string;
  title: string;
  passage: string;
  youtube_id: string;
  description: string;
  included: number;
  issue?: string;
  path?: string;
};
export interface WebsiteService {
  deployed(): Promise<SiteSnapshot | null>;
  development(): Promise<SiteSnapshot | null>;
  devBuild(content: SiteContent, actor: string): Promise<string>;
  stage(content: SiteContent, actor: string): Promise<string>;
  finish(revision: string, success: boolean): Promise<void>;
}
export const defaultSources = [
  {
    locale: "es",
    version: "rv1909",
    since: "2026-10-01",
    enabled: true,
  },
  {
    locale: "es",
    version: "spabll",
    since: "2026-10-01",
    enabled: true,
  },
  {
    locale: "en",
    version: "kjv",
    since: "2026-10-01",
    enabled: true,
  },
  {
    locale: "en",
    version: "web",
    since: "2026-10-01",
    enabled: true,
  },
  {
    locale: "pt",
    version: "arc",
    since: "2026-10-01",
    enabled: true,
  },
];
export type WebsiteSource = (typeof defaultSources)[number] & {
  channel: string;
};
export async function websiteSources(db: D1Database): Promise<WebsiteSource[]> {
  const saved = await db
    .prepare("SELECT value FROM site_settings WHERE key='website_sources'")
    .first<{ value: string }>();
  const rules = saved
    ? (JSON.parse(saved.value) as typeof defaultSources)
    : defaultSources;
  const accounts = await loadSocialSettings(db);
  return rules.map((rule) => {
    const handle =
      accounts[rule.locale as keyof typeof accounts]?.youtube.trim() ?? "";
    return {
      locale: rule.locale,
      version: rule.version,
      since: rule.since,
      enabled: rule.enabled,
      channel: handle
        ? handle.startsWith("@") || /^UC[\w-]{22}$/.test(handle)
          ? handle
          : "@" + handle
        : "",
    };
  });
}
export function websiteProjectDetails(p: WebsiteProject): {
  issue?: string;
  path?: string;
  publication?: Publication;
} {
  if (!p.youtube_id) return { issue: "Missing YouTube video" };
  try {
    if (p.kind === "book") throw new Error("Not a website series");
    const publication: Publication = {
      projectId: p.id,
      kind: p.kind,
      locale: p.locale,
      version: p.version,
      slug: p.slug,
      title: p.title,
      description: p.description,
      youtubeId: p.youtube_id,
      passage: JSON.parse(p.passage),
    };
    validateContent({ ...emptyContent, publications: [publication] });
    return { path: publicationPath(publication), publication };
  } catch {
    return { issue: "Review the passage, episode and Bible version" };
  }
}
export async function websiteState(db: D1Database) {
  const socialProjects = (
    await db
      .prepare(
        `SELECT p.id,p.kind,p.slug,p.title,p.passage,v.locale,v.code AS version,coalesce(json_extract(p.social_video_ids,'$.youtube'),'') youtube_id,coalesce(w.description,'') description,coalesce(w.included,1) included FROM video_projects p JOIN bible_versions v ON v.id=p.bible_version_id LEFT JOIN pages_from_video_projects w ON w.video_project_id=p.id WHERE p.published=1 AND p.kind IN ('short','long','book') ORDER BY v.locale,v.code,p.kind,p.id`,
      )
      .all<WebsiteProject>()
  ).results;
  const projects = socialProjects.filter(
    (p): p is WebsiteProject & { kind: "short" | "long" } => p.kind !== "book",
  );
  const publications: Publication[] = [];
  for (const p of projects) {
    const details = websiteProjectDetails(p);
    p.issue = details.issue;
    p.path = details.path;
    if (details.publication && p.included)
      publications.push(details.publication);
  }
  const bookMap = new Map<string, SiteContent["bookVideos"][number]>();
  for (const [key, v] of Object.entries(catalog))
    for (const b of v.books) {
      const id = youtubeId(b.video ?? "");
      const [locale, version] = key.split("/");
      if (id)
        bookMap.set(`${key}/${b.id}`, {
          locale: locale as Publication["locale"],
          version,
          book: b.id,
          youtubeId: id,
        });
    }
  const bookCandidates = new Map<string, Set<string>>();
  for (const p of socialProjects.filter(
    (p) => p.kind === "book" && youtubeId(p.youtube_id),
  )) {
    try {
      const passage = JSON.parse(p.passage);
      const book = passage.book;
      if (
        !(catalog as Record<string, { books: { id: string }[] }>)[
          `${p.locale}/${p.version}`
        ]?.books.some((b) => b.id === book)
      )
        continue;
      const key = `${p.locale}/${p.version}/${book}`;
      const ids = bookCandidates.get(key) ?? new Set<string>();
      ids.add(p.youtube_id);
      bookCandidates.set(key, ids);
    } catch {
      /* An incomplete project cannot replace an existing book link. */
    }
  }
  for (const [key, ids] of bookCandidates)
    if (ids.size === 1) {
      const [locale, version, book] = key.split("/");
      bookMap.set(key, {
        locale: locale as Publication["locale"],
        version,
        book,
        youtubeId: [...ids][0],
      });
    }
  const bookVideos = [...bookMap.values()].sort((a, b) =>
    `${a.locale}/${a.version}/${a.book}`.localeCompare(
      `${b.locale}/${b.version}/${b.book}`,
    ),
  );
  return {
    projects,
    socialProjects,
    content: { schema: 1 as const, publications, bookVideos },
    sources: await websiteSources(db),
    catalog,
  };
}
export async function publicationContent(db: D1Database) {
  const state = await websiteState(db);
  if (state.projects.some((p) => p.included && p.issue))
    throw new Error("Review website videos before publishing.");
  return validateContent(state.content);
}
export async function contentRevision(content: SiteContent) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(validateContent(content))),
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export const normalizeTitle = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export { youtubeId };

export function publicationChanges(
  current: SiteContent,
  previous: SiteContent | null,
) {
  const before = new Map(
    (previous?.publications ?? []).map((p) => [publicationPath(p), p]),
  );
  const after = new Map(
    current.publications.map((p) => [publicationPath(p), p]),
  );
  return [
    ...current.publications.flatMap((p) => {
      const path = publicationPath(p);
      const old = before.get(path);
      return !old
        ? [{ action: "New page", title: p.title, path }]
        : JSON.stringify(old) !== JSON.stringify(p)
          ? [{ action: "Updated page", title: p.title, path }]
          : [];
    }),
    ...[...before.entries()]
      .filter(([path]) => !after.has(path))
      .map(([path, p]) => ({ action: "Page to remove", title: p.title, path })),
  ];
}
