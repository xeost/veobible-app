-- Cover catalogue filters/order, version counts, home activity and publication history.
CREATE INDEX IF NOT EXISTS video_projects_kind_id ON video_projects(kind,id);
CREATE INDEX IF NOT EXISTS video_projects_kind_version_id ON video_projects(kind,bible_version_id,id);
CREATE INDEX IF NOT EXISTS video_projects_kind_version_published_id ON video_projects(kind,bible_version_id,published,id);
CREATE INDEX IF NOT EXISTS video_projects_version_id ON video_projects(bible_version_id);
CREATE INDEX IF NOT EXISTS video_projects_updated_id ON video_projects(updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS bible_versions_display_order ON bible_versions(locale,label,id);
CREATE INDEX IF NOT EXISTS deployments_pending_created ON deployments(target,created_at DESC,id DESC) WHERE external_id IS NOT NULL AND status IN ('requested','queued','building','deploying');
CREATE INDEX IF NOT EXISTS dashboard_users_created_id ON dashboard_users(created_at,id);
