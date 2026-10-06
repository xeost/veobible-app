CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Keep previous dashboard requests separate from public-site publications.
ALTER TABLE deployments ADD COLUMN target TEXT NOT NULL DEFAULT 'dashboard';
ALTER TABLE deployments ADD COLUMN completed_at TEXT;
ALTER TABLE deployments ADD COLUMN duration_ms INTEGER;
CREATE INDEX deployments_target_created ON deployments(target, created_at);
