import { test } from "node:test";
import assert from "node:assert/strict";
import { websiteDatabase } from "./test-support/website-database";
import {
  cacheSocialVideos,
  cachedSocialVideos,
  socialVideoPlatforms,
  type SocialVideoCacheEntry,
} from "./social-video-cache";
const video = (
  platform: SocialVideoCacheEntry["platform"],
  title = "Video",
): SocialVideoCacheEntry => ({
  platform,
  video_id: "shared-id",
  account: "@account",
  title,
  published_at: "2026-10-28",
  description: "Description",
  metadata: { source: "original" },
});
test("the cache supports all dashboard platforms and isolates identical video IDs", async () => {
  const { db, sqlite } = websiteDatabase();
  await cacheSocialVideos(
    db,
    socialVideoPlatforms.map((platform) => video(platform, platform)),
  );
  assert.equal(
    sqlite.prepare("SELECT count(*) AS total FROM social_video_cache").get()
      ?.total,
    5,
  );
  for (const platform of socialVideoPlatforms) {
    const rows = await cachedSocialVideos(db, platform, ["@account"]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, platform);
    assert.equal(rows[0].platform, platform);
  }
  await cacheSocialVideos(db, [video("youtube", "Updated YouTube")]);
  assert.equal(
    (await cachedSocialVideos(db, "youtube", ["@account"]))[0].title,
    "Updated YouTube",
  );
  assert.equal(
    (await cachedSocialVideos(db, "instagram", ["@account"]))[0].title,
    "instagram",
  );
  assert.equal((await cachedSocialVideos(db, "youtube", ["@other"])).length, 0);
});
test("cache refresh retains known dates and merges platform-specific metadata", async () => {
  const { db } = websiteDatabase();
  await cacheSocialVideos(db, [video("tiktok")]);
  await cacheSocialVideos(db, [
    { ...video("tiktok"), published_at: "", metadata: { extra: "new" } },
  ]);
  const row = (await cachedSocialVideos(db, "tiktok", ["@account"]))[0];
  assert.equal(row.published_at, "2026-10-28");
  assert.deepEqual(JSON.parse(row.metadata), {
    source: "original",
    extra: "new",
  });
});
test("platform and JSON object constraints are enforced by the migration", () => {
  const { sqlite } = websiteDatabase();
  assert.throws(
    () =>
      sqlite
        .prepare(
          "INSERT INTO social_video_cache(platform,video_id,account,title,published_at) VALUES(?,?,?,?,?)",
        )
        .run("unsupported", "id", "account", "title", ""),
    /CHECK/,
  );
  assert.throws(
    () =>
      sqlite
        .prepare(
          "INSERT INTO social_video_cache(platform,video_id,account,title,published_at,metadata) VALUES(?,?,?,?,?,?)",
        )
        .run("youtube", "id", "account", "title", "", "[]"),
    /CHECK/,
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='website_videos'",
      )
      .get(),
    undefined,
  );
});
