export const socialVideoPlatforms = [
  "youtube",
  "instagram",
  "tiktok",
  "facebook",
  "x",
] as const;
export type SocialVideoPlatform = (typeof socialVideoPlatforms)[number];
export type SocialVideoCacheEntry = {
  platform: SocialVideoPlatform;
  video_id: string;
  account: string;
  title: string;
  published_at: string;
  description: string;
  metadata: Record<string, unknown>;
};
export type SocialVideoCacheRow = Omit<SocialVideoCacheEntry, "metadata"> & {
  metadata: string;
};
export async function cachedSocialVideos(
  db: D1Database,
  platform: SocialVideoPlatform,
  accounts: string[],
): Promise<SocialVideoCacheRow[]> {
  if (!accounts.length) return [];
  const unique = [...new Set(accounts)];
  return (
    await db
      .prepare(
        `SELECT * FROM social_video_cache WHERE platform=? AND account IN (${unique.map(() => "?").join(",")}) ORDER BY published_at DESC`,
      )
      .bind(platform, ...unique)
      .all<SocialVideoCacheRow>()
  ).results;
}
export async function cacheSocialVideos(
  db: D1Database,
  videos: SocialVideoCacheEntry[],
) {
  if (!videos.length) return 0;
  for (const v of videos) {
    if (
      !socialVideoPlatforms.includes(v.platform) ||
      !v.video_id.trim() ||
      !v.account.trim() ||
      !v.metadata ||
      Array.isArray(v.metadata) ||
      typeof v.metadata !== "object"
    )
      throw new Error("Invalid social video cache entry");
  }
  const rows = videos.map((v) => ({
    ...v,
    metadata: JSON.stringify(v.metadata),
  }));
  // Names are platform-neutral; IDs are opaque and unique within each platform.
  const result = await db
    .prepare(
      `INSERT INTO social_video_cache(platform,video_id,account,title,published_at,description,metadata)
    SELECT json_extract(value,'$.platform'),json_extract(value,'$.video_id'),json_extract(value,'$.account'),json_extract(value,'$.title'),json_extract(value,'$.published_at'),json_extract(value,'$.description'),json_extract(value,'$.metadata') FROM json_each(?) WHERE true
    ON CONFLICT(platform,video_id) DO UPDATE SET account=excluded.account,title=excluded.title,description=excluded.description,
    published_at=CASE WHEN excluded.published_at<>'' THEN excluded.published_at ELSE social_video_cache.published_at END,
    metadata=json_patch(social_video_cache.metadata,excluded.metadata)`,
    )
    .bind(JSON.stringify(rows))
    .run();
  return result.meta.changes;
}
