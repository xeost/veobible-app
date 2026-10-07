PRAGMA foreign_keys = ON;
CREATE TABLE dashboard_users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL,
 email TEXT NOT NULL DEFAULT '',
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','editor')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 auth_version INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE bible_versions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 locale TEXT NOT NULL CHECK(locale IN ('es','en','pt')),
 code TEXT NOT NULL,
 label TEXT NOT NULL,
 UNIQUE(locale,code)
);
CREATE TABLE video_projects (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 kind TEXT NOT NULL CHECK(kind IN ('short','long')),
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
CREATE TABLE site_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL CHECK(json_valid(value) OR key LIKE 'deploy_hook:%'),updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE deployments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 status TEXT NOT NULL,
 external_id TEXT,
 message TEXT NOT NULL DEFAULT '',
 created_by INTEGER REFERENCES dashboard_users(id),details TEXT,
 target TEXT NOT NULL DEFAULT 'site',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 completed_at TEXT,
 duration_ms INTEGER
);
CREATE INDEX video_projects_kind_published ON video_projects(kind,published);
CREATE INDEX deployments_target_created ON deployments(target,created_at);
INSERT INTO dashboard_users(username,name,password_hash,role) VALUES ('admin','Admin','pbkdf2:100000:veobible-default-admin:f30b6acc5af87fc4112d9ea2c3294d037e8a5910ed1c08175159fffa7bf32141','admin');
