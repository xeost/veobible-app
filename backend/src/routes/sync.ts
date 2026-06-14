import { Hono } from 'hono'
import { now, isValidISO } from '../utils/timestamps.ts'
import {
  pullSince,
  upsertBookmark,
  upsertFolder,
  upsertReadingPosition,
  upsertReadingRibbon,
  upsertPreferences,
} from '../db/queries.ts'
import type {
  Bindings,
  Variables,
  Bookmark,
  BookmarkFolder,
  ReadingPosition,
  ReadingRibbon,
  SyncConflict,
} from '../types/index.ts'

const sync = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET /sync?since=<ISO8601>
sync.get('/', async (c) => {
  const since = c.req.query('since')
  if (!since || !isValidISO(since)) {
    return c.json(
      { error: 'validationFailed', message: "Query param 'since' must be a valid ISO 8601 timestamp" },
      400,
    )
  }

  const userId = c.get('userId')
  const changes = await pullSince(c.env.DB, userId, since)

  return c.json({ ...changes, serverTime: now() })
})

// POST /sync
sync.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json() as {
    bookmarks?: unknown[]
    bookmarkFolders?: unknown[]
    readingPositions?: unknown[]
    readingRibbons?: unknown[]
    preferences?: unknown
  }

  let applied = 0
  const conflicts: SyncConflict[] = []

  // ── Bookmarks ──────────────────────────────────────────────────────────────
  if (Array.isArray(body.bookmarks) && body.bookmarks.length > 0) {
    const incoming = body.bookmarks as Array<Bookmark & { deletedAt?: string | null }>
    const ids = incoming.map((b) => b.id)
    const placeholders = ids.map(() => '?').join(',')

    const existing = await c.env.DB.prepare(
      `SELECT id, updatedAt FROM bookmarks WHERE id IN (${placeholders}) AND userId = ?`,
    ).bind(...ids, userId).all<{ id: string; updatedAt: string }>()

    const serverMap = new Map(existing.results.map((r) => [r.id, r.updatedAt]))

    for (const bm of incoming) {
      const serverTs = serverMap.get(bm.id)
      if (serverTs && serverTs > bm.updatedAt) {
        const server = await c.env.DB.prepare(
          'SELECT * FROM bookmarks WHERE id = ?',
        ).bind(bm.id).first<Bookmark>()
        conflicts.push({ type: 'bookmark', id: bm.id, serverVersion: server })
      } else {
        await upsertBookmark(c.env.DB, bm, userId)
        applied++
      }
    }
  }

  // ── Bookmark Folders ───────────────────────────────────────────────────────
  if (Array.isArray(body.bookmarkFolders) && body.bookmarkFolders.length > 0) {
    const incoming = body.bookmarkFolders as Array<BookmarkFolder & { deletedAt?: string | null }>
    const ids = incoming.map((f) => f.id)
    const placeholders = ids.map(() => '?').join(',')

    const existing = await c.env.DB.prepare(
      `SELECT id, updatedAt FROM bookmark_folders WHERE id IN (${placeholders}) AND userId = ?`,
    ).bind(...ids, userId).all<{ id: string; updatedAt: string }>()

    const serverMap = new Map(existing.results.map((r) => [r.id, r.updatedAt]))

    for (const fo of incoming) {
      const serverTs = serverMap.get(fo.id)
      if (serverTs && serverTs > fo.updatedAt) {
        const server = await c.env.DB.prepare(
          'SELECT * FROM bookmark_folders WHERE id = ?',
        ).bind(fo.id).first<BookmarkFolder>()
        conflicts.push({ type: 'bookmarkFolder', id: fo.id, serverVersion: server })
      } else {
        await upsertFolder(c.env.DB, fo, userId)
        applied++
      }
    }
  }

  // ── Reading Positions ──────────────────────────────────────────────────────
  if (Array.isArray(body.readingPositions) && body.readingPositions.length > 0) {
    const incoming = body.readingPositions as ReadingPosition[]

    for (const pos of incoming) {
      const server = await c.env.DB.prepare(
        'SELECT updatedAt FROM reading_positions WHERE userId = ? AND versionSlug = ?',
      ).bind(userId, pos.versionSlug).first<{ updatedAt: string }>()

      if (server && server.updatedAt > pos.updatedAt) {
        const full = await c.env.DB.prepare(
          'SELECT versionSlug, bookSlug, chapter, verseIndex, updatedAt FROM reading_positions WHERE userId = ? AND versionSlug = ?',
        ).bind(userId, pos.versionSlug).first<ReadingPosition>()
        conflicts.push({ type: 'readingPosition', id: pos.versionSlug, serverVersion: full })
      } else {
        await upsertReadingPosition(c.env.DB, pos, userId)
        applied++
      }
    }
  }

  // ── Reading Ribbons ────────────────────────────────────────────────────────
  if (Array.isArray(body.readingRibbons) && body.readingRibbons.length > 0) {
    const incoming = body.readingRibbons as ReadingRibbon[]

    for (const rib of incoming) {
      const server = await c.env.DB.prepare(
        'SELECT updatedAt FROM reading_ribbons WHERE userId = ? AND versionSlug = ?',
      ).bind(userId, rib.versionSlug).first<{ updatedAt: string }>()

      if (server && server.updatedAt > rib.updatedAt) {
        const full = await c.env.DB.prepare(
          'SELECT versionSlug, bookSlug, chapter, updatedAt FROM reading_ribbons WHERE userId = ? AND versionSlug = ?',
        ).bind(userId, rib.versionSlug).first<ReadingRibbon>()
        conflicts.push({ type: 'readingRibbon', id: rib.versionSlug, serverVersion: full })
      } else {
        await upsertReadingRibbon(c.env.DB, rib, userId)
        applied++
      }
    }
  }

  // ── Preferences ────────────────────────────────────────────────────────────
  if (body.preferences && typeof body.preferences === 'object') {
    await upsertPreferences(c.env.DB, body.preferences, userId)
    applied++
  }

  return c.json({ applied, conflicts, serverTime: now() })
})

export default sync
