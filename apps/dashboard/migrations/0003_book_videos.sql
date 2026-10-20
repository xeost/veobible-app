CREATE TABLE video_projects_books (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 kind TEXT NOT NULL CHECK(kind IN ('short','long','book')),
 bible_version_id INTEGER NOT NULL REFERENCES bible_versions(id),
 slug TEXT NOT NULL,
 title TEXT NOT NULL,
 passage TEXT NOT NULL CHECK(json_valid(passage)),
 settings TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(settings)),
 published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(kind,bible_version_id,slug)
);

INSERT INTO video_projects_books SELECT * FROM video_projects;
UPDATE sqlite_sequence SET seq = MAX(seq, COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'video_projects'), 0)) WHERE name = 'video_projects_books';
DROP TABLE video_projects;
ALTER TABLE video_projects_books RENAME TO video_projects;
CREATE INDEX video_projects_kind_published ON video_projects(kind,published);
CREATE INDEX IF NOT EXISTS video_projects_kind_id ON video_projects(kind,id);
CREATE INDEX IF NOT EXISTS video_projects_kind_version_id ON video_projects(kind,bible_version_id,id);
CREATE INDEX IF NOT EXISTS video_projects_kind_version_published_id ON video_projects(kind,bible_version_id,published,id);
CREATE INDEX IF NOT EXISTS video_projects_version_id ON video_projects(bible_version_id);
CREATE INDEX IF NOT EXISTS video_projects_updated_id ON video_projects(updated_at DESC,id DESC);
