-- Migration 0001: Initial schema
-- Users (minimal — auth is managed by Supabase)
CREATE TABLE users (
  id        TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Bookmark Folders (defined before bookmarks due to FK reference)
CREATE TABLE bookmark_folders (
  id          TEXT    PRIMARY KEY,
  userId      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  versionSlug TEXT    NOT NULL,
  bookSlug    TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  "order"     INTEGER NOT NULL DEFAULT 0,
  createdAt   TEXT    NOT NULL,
  updatedAt   TEXT    NOT NULL,
  deletedAt   TEXT,
  UNIQUE(userId, id)
);

CREATE INDEX idx_folders_user_version ON bookmark_folders(userId, versionSlug);
CREATE INDEX idx_folders_user_updated ON bookmark_folders(userId, updatedAt);

-- Bookmarks
CREATE TABLE bookmarks (
  id           TEXT    PRIMARY KEY,
  userId       TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  versionSlug  TEXT    NOT NULL,
  bookSlug     TEXT    NOT NULL,
  chapter      INTEGER NOT NULL,
  verseStart   INTEGER NOT NULL,
  verseEnd     INTEGER NOT NULL,
  selectedText TEXT    NOT NULL,
  title        TEXT,
  note         TEXT,
  folderId     TEXT    REFERENCES bookmark_folders(id) ON DELETE SET NULL,
  createdAt    TEXT    NOT NULL,
  updatedAt    TEXT    NOT NULL,
  deletedAt    TEXT,
  UNIQUE(userId, id)
);

CREATE INDEX idx_bookmarks_user_version ON bookmarks(userId, versionSlug);
CREATE INDEX idx_bookmarks_user_updated ON bookmarks(userId, updatedAt);

-- Reading Positions (one per user per version)
CREATE TABLE reading_positions (
  userId      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  versionSlug TEXT    NOT NULL,
  bookSlug    TEXT    NOT NULL,
  chapter     INTEGER NOT NULL,
  verseIndex  INTEGER,
  updatedAt   TEXT    NOT NULL,
  PRIMARY KEY (userId, versionSlug)
);

-- Reading Ribbons (one per user per version)
CREATE TABLE reading_ribbons (
  userId      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  versionSlug TEXT    NOT NULL,
  bookSlug    TEXT    NOT NULL,
  chapter     INTEGER NOT NULL,
  updatedAt   TEXT    NOT NULL,
  PRIMARY KEY (userId, versionSlug)
);

-- User Preferences (key-value, syncable keys only)
-- Device-dependent keys (readerFontSize, readerLineHeight, readerContentWidth)
-- remain in localStorage and are never stored here.
CREATE TABLE user_preferences (
  userId    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key       TEXT NOT NULL CHECK (key IN ('locale', 'theme', 'lastVersionSlug', 'readerFontFamily')),
  value     TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (userId, key)
);

CREATE INDEX idx_preferences_user_updated ON user_preferences(userId, updatedAt);
