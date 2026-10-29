CREATE TABLE website_releases (
 revision TEXT PRIMARY KEY, content TEXT NOT NULL CHECK(json_valid(content)),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE website_state (
 id INTEGER PRIMARY KEY CHECK(id=1), revision TEXT REFERENCES website_releases(revision),
 dev_revision TEXT REFERENCES website_releases(revision), busy INTEGER NOT NULL DEFAULT 0,
 deployed_revision TEXT REFERENCES website_releases(revision)
);
INSERT INTO website_state(id) VALUES(1);
