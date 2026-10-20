-- Existing projects retain their production paths and identities.
CREATE TABLE audio_projects_environment (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 output_environment TEXT NOT NULL DEFAULT 'production' CHECK(output_environment IN ('production','development')),
 bible_version_id INTEGER NOT NULL REFERENCES bible_versions(id),
 edition TEXT NOT NULL CHECK(edition GLOB '*-v[2-9]*' OR edition GLOB '*-v1[0-9]*'),
 book TEXT NOT NULL,
 title TEXT NOT NULL,
 book_order INTEGER NOT NULL CHECK(book_order > 0),
 chapter_count INTEGER NOT NULL CHECK(chapter_count > 0),
 verse_counts TEXT NOT NULL CHECK(json_valid(verse_counts)),
 settings TEXT NOT NULL CHECK(json_valid(settings)),
 recordings TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(recordings)),
 chapters TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(chapters)),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','running','done','failed')),
 progress REAL NOT NULL DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
 active_job_id TEXT,
 callback_hash TEXT,
 job_sequence INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(output_environment,edition,book)
);
INSERT INTO audio_projects_environment(id,bible_version_id,edition,book,title,book_order,chapter_count,verse_counts,settings,recordings,chapters,status,progress,revision,active_job_id,callback_hash,job_sequence,created_at,updated_at) SELECT id,bible_version_id,edition,book,title,book_order,chapter_count,verse_counts,settings,recordings,chapters,status,progress,revision,active_job_id,callback_hash,job_sequence,created_at,updated_at FROM audio_projects;
-- Preserve the AUTOINCREMENT high-water mark even if higher IDs were deleted.
UPDATE sqlite_sequence SET seq=MAX(seq,COALESCE((SELECT seq FROM sqlite_sequence WHERE name='audio_projects'),0)) WHERE name='audio_projects_environment';
DROP TRIGGER audio_projects_protect_version_identity;
DROP TABLE audio_projects;
ALTER TABLE audio_projects_environment RENAME TO audio_projects;
CREATE INDEX audio_projects_version_edition ON audio_projects(output_environment,bible_version_id,edition,book_order);
CREATE INDEX audio_projects_bible_version ON audio_projects(bible_version_id);
CREATE INDEX audio_projects_status ON audio_projects(output_environment,status,updated_at);
-- Version identities cannot change while either kind of project refers to them.
CREATE TRIGGER audio_projects_protect_version_identity
BEFORE UPDATE OF code,locale ON bible_versions
WHEN (NEW.code != OLD.code OR NEW.locale != OLD.locale)
 AND EXISTS (SELECT 1 FROM audio_projects WHERE bible_version_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Bible version has audio projects'); END;
