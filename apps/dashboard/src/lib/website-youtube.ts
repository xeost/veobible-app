import { loadPublicationSettings } from "./publication-settings";
import { youtubeProjectTitle } from "./youtube-project-title";
import { cachedSocialVideos, cacheSocialVideos } from "./social-video-cache";
import { type WebsiteSource, normalizeTitle, websiteSources } from "./website";
import type { CatalogVideo, VideoMetadata } from "./youtube-html";
export type ChannelVideo = Omit<CatalogVideo, "metadata"> & {
  metadata?: string | VideoMetadata;
};
export type PendingProject = {
  id: number;
  kind: "short" | "long" | "book";
  title: string;
  slug: string;
  locale: string;
  version: string;
  passage: string;
  youtube_title?: string | null;
};
export function videoMetadata(video: ChannelVideo): VideoMetadata {
  try {
    return typeof video.metadata === "string"
      ? JSON.parse(video.metadata)
      : (video.metadata ?? {});
  } catch {
    return {};
  }
}
export async function pendingContext(db: D1Database, channel?: string) {
  const sources = (await websiteSources(db)).filter(
    (s) => s.enabled && s.channel && (!channel || s.channel === channel),
  );
  // All allowed video kinds need detection. Scan pending IDs in order before joining versions.
  const rows = (
    await db
      .prepare(
        `SELECT p.id,p.kind,p.title,p.slug,p.passage,v.locale,v.code AS version FROM video_projects p CROSS JOIN bible_versions v ON v.id=p.bible_version_id WHERE p.published=1 AND coalesce(json_extract(p.social_video_ids,'$.youtube'),'')='' ORDER BY p.id DESC`,
      )
      .all<PendingProject>()
  ).results;
  const projects = rows.filter((p) =>
    sources.some((s) => s.locale === p.locale && s.version === p.version),
  );
  const templates = new Map<
    string,
    Awaited<ReturnType<typeof loadPublicationSettings>>
  >();
  for (const kind of new Set(projects.map((p) => p.kind)))
    templates.set(kind, await loadPublicationSettings(db, kind));
  for (const p of projects) {
    const settings = templates.get(p.kind)!;
    p.youtube_title = youtubeProjectTitle(
      p,
      settings[p.locale as keyof typeof settings]?.youtube ?? "",
    );
  }
  return { sources, projects };
}

function eligibility(
  video: ChannelVideo,
  p: PendingProject,
  sources: WebsiteSource[],
): "yes" | "no" | "uncertain" {
  const source = sources.find(
    (s) =>
      s.enabled &&
      s.channel === video.channel &&
      s.locale === p.locale &&
      s.version === p.version,
  );
  if (!source) return "no";
  if (video.published_at)
    return video.published_at.slice(0, 10) >= source.since ? "yes" : "no";
  const range = videoMetadata(video).publishedRange;
  if (range) {
    if (range.end < source.since) return "no";
    if (range.start >= source.since) return "yes";
  }
  return "uncertain";
}
export async function detectVideos(db: D1Database, channel?: string) {
  const context = await pendingContext(db, channel);
  const channels = [...new Set(context.sources.map((s) => s.channel))];
  // Do not even read the video cache when there is no eligible pending project.
  const videos: ChannelVideo[] = context.projects.length
    ? (await cachedSocialVideos(db, "youtube", channels)).map((v) => ({
        youtube_id: v.video_id,
        channel: v.account,
        title: v.title,
        published_at: v.published_at,
        description: v.description,
        metadata: v.metadata,
      }))
    : [];
  let projects = 0,
    books = 0,
    ambiguous = 0,
    scheduled = 0,
    more = false;
  let verify: ChannelVideo | undefined;
  const searchable: PendingProject[] = [];
  const candidates = context.projects.map((p) => ({
    p,
    matches: p.youtube_title
      ? videos.filter(
          (v) =>
            normalizeTitle(v.title) === normalizeTitle(p.youtube_title!) &&
            (!videoMetadata(v).tab ||
              videoMetadata(v).tab ===
                (p.kind === "short" ? "shorts" : "videos")) &&
            eligibility(v, p, context.sources) !== "no",
        )
      : [],
  }));
  const owners = new Map<string, number>();
  for (const { matches } of candidates)
    for (const v of matches)
      owners.set(v.youtube_id, (owners.get(v.youtube_id) ?? 0) + 1);
  for (const { p, matches } of candidates) {
    if (!p.youtube_title) {
      ambiguous++;
      continue;
    }
    const eligible = matches.filter(
      (v) => eligibility(v, p, context.sources) === "yes",
    );
    const uncertain = matches.filter(
      (v) => eligibility(v, p, context.sources) === "uncertain",
    );
    if (uncertain.length) {
      const candidate = uncertain.find((v) => !videoMetadata(v).dateChecked);
      if (candidate && !verify) verify = candidate;
      if (!candidate) ambiguous++;
      continue;
    }
    if (
      eligible.length > 1 ||
      eligible.some((v) => owners.get(v.youtube_id)! > 1)
    ) {
      ambiguous++;
      continue;
    }
    if (eligible.length === 0) {
      searchable.push(p);
      continue;
    }
    if (scheduled >= 20) {
      more = true;
      continue;
    }
    scheduled++;
    const result = await db
      .prepare(
        "UPDATE video_projects SET social_video_ids=json_set(social_video_ids,'$.youtube',?),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND published=1 AND coalesce(json_extract(social_video_ids,'$.youtube'),'')=''",
      )
      .bind(eligible[0].youtube_id, p.id)
      .run();
    projects += result.meta.changes;
    if (p.kind === "book") books += result.meta.changes;
  }
  return {
    projects,
    books,
    ambiguous,
    missingTemplates: context.projects.filter((p) => !p.youtube_title).length,
    more,
    verify,
    searchable,
    pending: context.projects.length - projects,
    sources: context.sources,
  };
}
export async function cacheVideos(db: D1Database, videos: CatalogVideo[]) {
  return cacheSocialVideos(
    db,
    videos.map((v) => ({
      platform: "youtube",
      video_id: v.youtube_id,
      account: v.channel,
      title: v.title,
      published_at: v.published_at,
      description: v.description,
      metadata: { ...v.metadata },
    })),
  );
}
