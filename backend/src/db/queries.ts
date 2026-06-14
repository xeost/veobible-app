import { now } from '../utils/timestamps.ts'
import type {
  Bookmark,
  BookmarkFolder,
  ReadingPosition,
  ReadingRibbon,
  SyncablePreferenceKey,
  UserPreferences,
} from '../types/index.ts'
import { SYNCABLE_PREFERENCE_KEYS } from '../types/index.ts'

// ── Bookmarks ─────────────────────────────────────────────────────────────────

export async function listBookmarks(
  db: D1Database,
  userId: string,
  versionSlug?: string,
  includeDeleted = false,
): Promise<Bookmark[]> {
  let sql = 'SELECT * FROM bookmarks WHERE userId = ?'
  const binds: unknown[] = [userId]
  if (versionSlug) { sql += ' AND versionSlug = ?'; binds.push(versionSlug) }
  if (!includeDeleted) sql += ' AND deletedAt IS NULL'
  sql += ' ORDER BY createdAt DESC'
  const result = await db.prepare(sql).bind(...binds).all<Bookmark>()
  return result.results
}

export async function getBookmark(
  db: D1Database,
  id: string,
  userId: string,
): Promise<Bookmark | null> {
  return db.prepare(
    'SELECT * FROM bookmarks WHERE id = ? AND userId = ?',
  ).bind(id, userId).first<Bookmark>()
}

export async function upsertBookmark(
  db: D1Database,
  data: Omit<Bookmark, 'userId'> & { deletedAt?: string | null },
  userId: string,
): Promise<void> {
  await db.prepare(`
    INSERT INTO bookmarks
      (id, userId, versionSlug, bookSlug, chapter, verseStart, verseEnd,
       selectedText, title, note, folderId, createdAt, updatedAt, deletedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      versionSlug  = excluded.versionSlug,
      bookSlug     = excluded.bookSlug,
      chapter      = excluded.chapter,
      verseStart   = excluded.verseStart,
      verseEnd     = excluded.verseEnd,
      selectedText = excluded.selectedText,
      title        = excluded.title,
      note         = excluded.note,
      folderId     = excluded.folderId,
      updatedAt    = excluded.updatedAt,
      deletedAt    = excluded.deletedAt
  `).bind(
    data.id, userId, data.versionSlug, data.bookSlug,
    data.chapter, data.verseStart, data.verseEnd, data.selectedText,
    data.title ?? null, data.note ?? null, data.folderId ?? null,
    data.createdAt, data.updatedAt, data.deletedAt ?? null,
  ).run()
}

export async function softDeleteBookmark(
  db: D1Database,
  id: string,
  userId: string,
): Promise<boolean> {
  const ts = now()
  const result = await db.prepare(
    'UPDATE bookmarks SET deletedAt = ?, updatedAt = ? WHERE id = ? AND userId = ? AND deletedAt IS NULL',
  ).bind(ts, ts, id, userId).run()
  return (result.meta.changes ?? 0) > 0
}

// ── Bookmark Folders ──────────────────────────────────────────────────────────

export async function listFolders(
  db: D1Database,
  userId: string,
  versionSlug?: string,
): Promise<BookmarkFolder[]> {
  let sql = 'SELECT * FROM bookmark_folders WHERE userId = ? AND deletedAt IS NULL'
  const binds: unknown[] = [userId]
  if (versionSlug) { sql += ' AND versionSlug = ?'; binds.push(versionSlug) }
  sql += ' ORDER BY "order" ASC'
  const result = await db.prepare(sql).bind(...binds).all<BookmarkFolder>()
  return result.results
}

export async function getFolder(
  db: D1Database,
  id: string,
  userId: string,
): Promise<BookmarkFolder | null> {
  return db.prepare(
    'SELECT * FROM bookmark_folders WHERE id = ? AND userId = ?',
  ).bind(id, userId).first<BookmarkFolder>()
}

export async function upsertFolder(
  db: D1Database,
  data: Omit<BookmarkFolder, 'userId'> & { deletedAt?: string | null },
  userId: string,
): Promise<void> {
  await db.prepare(`
    INSERT INTO bookmark_folders
      (id, userId, versionSlug, bookSlug, name, "order", createdAt, updatedAt, deletedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      versionSlug = excluded.versionSlug,
      bookSlug    = excluded.bookSlug,
      name        = excluded.name,
      "order"     = excluded."order",
      updatedAt   = excluded.updatedAt,
      deletedAt   = excluded.deletedAt
  `).bind(
    data.id, userId, data.versionSlug, data.bookSlug,
    data.name, data.order, data.createdAt, data.updatedAt, data.deletedAt ?? null,
  ).run()
}

export async function softDeleteFolder(
  db: D1Database,
  id: string,
  userId: string,
): Promise<boolean> {
  const ts = now()
  // Unassign bookmarks from this folder
  await db.prepare(
    'UPDATE bookmarks SET folderId = NULL, updatedAt = ? WHERE folderId = ? AND userId = ?',
  ).bind(ts, id, userId).run()
  const result = await db.prepare(
    'UPDATE bookmark_folders SET deletedAt = ?, updatedAt = ? WHERE id = ? AND userId = ? AND deletedAt IS NULL',
  ).bind(ts, ts, id, userId).run()
  return (result.meta.changes ?? 0) > 0
}

// ── Reading Positions ─────────────────────────────────────────────────────────

export async function listReadingPositions(
  db: D1Database,
  userId: string,
): Promise<ReadingPosition[]> {
  const result = await db.prepare(
    'SELECT versionSlug, bookSlug, chapter, verseIndex, updatedAt FROM reading_positions WHERE userId = ? ORDER BY updatedAt DESC',
  ).bind(userId).all<ReadingPosition>()
  return result.results
}

export async function upsertReadingPosition(
  db: D1Database,
  data: ReadingPosition,
  userId: string,
): Promise<void> {
  await db.prepare(`
    INSERT INTO reading_positions (userId, versionSlug, bookSlug, chapter, verseIndex, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (userId, versionSlug) DO UPDATE SET
      bookSlug   = excluded.bookSlug,
      chapter    = excluded.chapter,
      verseIndex = excluded.verseIndex,
      updatedAt  = excluded.updatedAt
  `).bind(userId, data.versionSlug, data.bookSlug, data.chapter, data.verseIndex ?? null, data.updatedAt).run()
}

// ── Reading Ribbons ───────────────────────────────────────────────────────────

export async function listReadingRibbons(
  db: D1Database,
  userId: string,
): Promise<ReadingRibbon[]> {
  const result = await db.prepare(
    'SELECT versionSlug, bookSlug, chapter, updatedAt FROM reading_ribbons WHERE userId = ? ORDER BY updatedAt DESC',
  ).bind(userId).all<ReadingRibbon>()
  return result.results
}

export async function upsertReadingRibbon(
  db: D1Database,
  data: ReadingRibbon,
  userId: string,
): Promise<void> {
  await db.prepare(`
    INSERT INTO reading_ribbons (userId, versionSlug, bookSlug, chapter, updatedAt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (userId, versionSlug) DO UPDATE SET
      bookSlug  = excluded.bookSlug,
      chapter   = excluded.chapter,
      updatedAt = excluded.updatedAt
  `).bind(userId, data.versionSlug, data.bookSlug, data.chapter, data.updatedAt).run()
}

export async function deleteReadingRibbon(
  db: D1Database,
  versionSlug: string,
  userId: string,
): Promise<boolean> {
  const result = await db.prepare(
    'DELETE FROM reading_ribbons WHERE userId = ? AND versionSlug = ?',
  ).bind(userId, versionSlug).run()
  return (result.meta.changes ?? 0) > 0
}

// ── Preferences ───────────────────────────────────────────────────────────────

export async function getPreferences(
  db: D1Database,
  userId: string,
): Promise<UserPreferences> {
  const result = await db.prepare(
    'SELECT key, value, updatedAt FROM user_preferences WHERE userId = ? ORDER BY updatedAt DESC',
  ).bind(userId).all<{ key: string; value: string; updatedAt: string }>()

  const prefs: UserPreferences = {}
  let latestUpdatedAt = ''
  for (const row of result.results) {
    (prefs as Record<string, string>)[row.key] = row.value
    if (row.updatedAt > latestUpdatedAt) latestUpdatedAt = row.updatedAt
  }
  if (latestUpdatedAt) prefs.updatedAt = latestUpdatedAt
  return prefs
}

export async function upsertPreferences(
  db: D1Database,
  patch: UserPreferences,
  userId: string,
): Promise<void> {
  const ts = patch.updatedAt ?? now()
  const stmts: D1PreparedStatement[] = []

  for (const key of SYNCABLE_PREFERENCE_KEYS) {
    const value = (patch as Record<string, unknown>)[key]
    if (value !== undefined && value !== null && typeof value === 'string') {
      stmts.push(
        db.prepare(`
          INSERT INTO user_preferences (userId, key, value, updatedAt)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (userId, key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
        `).bind(userId, key, value, ts),
      )
    }
  }

  if (stmts.length > 0) await db.batch(stmts)
}

// ── Sync helpers ──────────────────────────────────────────────────────────────

export async function pullSince(
  db: D1Database,
  userId: string,
  since: string,
): Promise<{
  bookmarks: Bookmark[]
  bookmarkFolders: BookmarkFolder[]
  readingPositions: ReadingPosition[]
  readingRibbons: ReadingRibbon[]
  preferences: UserPreferences
}> {
  const [bm, fo, rp, rr, pr] = await Promise.all([
    db.prepare('SELECT * FROM bookmarks WHERE userId = ? AND updatedAt > ? ORDER BY updatedAt ASC')
      .bind(userId, since).all<Bookmark>(),
    db.prepare('SELECT * FROM bookmark_folders WHERE userId = ? AND updatedAt > ? ORDER BY updatedAt ASC')
      .bind(userId, since).all<BookmarkFolder>(),
    db.prepare('SELECT versionSlug, bookSlug, chapter, verseIndex, updatedAt FROM reading_positions WHERE userId = ? AND updatedAt > ?')
      .bind(userId, since).all<ReadingPosition>(),
    db.prepare('SELECT versionSlug, bookSlug, chapter, updatedAt FROM reading_ribbons WHERE userId = ? AND updatedAt > ?')
      .bind(userId, since).all<ReadingRibbon>(),
    db.prepare('SELECT key, value, updatedAt FROM user_preferences WHERE userId = ? AND updatedAt > ?')
      .bind(userId, since).all<{ key: string; value: string; updatedAt: string }>(),
  ])

  const preferences: UserPreferences = {}
  let latestPrefTs = ''
  for (const row of pr.results) {
    (preferences as Record<string, string>)[row.key as SyncablePreferenceKey] = row.value
    if (row.updatedAt > latestPrefTs) latestPrefTs = row.updatedAt
  }
  if (latestPrefTs) preferences.updatedAt = latestPrefTs

  return {
    bookmarks: bm.results,
    bookmarkFolders: fo.results,
    readingPositions: rp.results,
    readingRibbons: rr.results,
    preferences,
  }
}
