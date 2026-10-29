ALTER TABLE video_projects ADD COLUMN social_video_ids TEXT NOT NULL DEFAULT '{}'
 CHECK(json_valid(social_video_ids) AND json_type(social_video_ids) = 'object');

-- The kind constraint already limits projects to short, long and book videos.
CREATE INDEX video_projects_pending_youtube ON video_projects(id DESC)
 WHERE published=1
 AND coalesce(json_extract(social_video_ids,'$.youtube'),'')='';

CREATE TABLE pages_from_video_projects (
 video_project_id INTEGER PRIMARY KEY REFERENCES video_projects(id) ON DELETE CASCADE,
 description TEXT NOT NULL DEFAULT '',
 included INTEGER NOT NULL DEFAULT 1 CHECK(included IN (0,1)), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE social_video_cache (
 platform TEXT NOT NULL CHECK(platform IN ('youtube','instagram','tiktok','facebook','x')),
 video_id TEXT NOT NULL, account TEXT NOT NULL, title TEXT NOT NULL,
 published_at TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 metadata TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata) AND json_type(metadata)='object'),
 PRIMARY KEY(platform,video_id)
);
CREATE INDEX social_video_cache_account_published ON social_video_cache(platform,account,published_at DESC);
ALTER TABLE deployments ADD COLUMN content_revision TEXT;
