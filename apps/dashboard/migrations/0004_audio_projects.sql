CREATE TABLE audio_projects (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
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
 UNIQUE(edition,book)
);
CREATE INDEX audio_projects_version_edition ON audio_projects(bible_version_id,edition,book_order);
CREATE INDEX audio_projects_status ON audio_projects(status,updated_at);
-- Version identities cannot change while either kind of project refers to them.
CREATE TRIGGER audio_projects_protect_version_identity
BEFORE UPDATE OF code,locale ON bible_versions
WHEN (NEW.code != OLD.code OR NEW.locale != OLD.locale)
 AND EXISTS (SELECT 1 FROM audio_projects WHERE bible_version_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Bible version has audio projects'); END;
