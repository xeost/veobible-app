import { Hono } from 'hono'
import { now } from '../utils/timestamps.ts'
import { validateBookmarkCreate, validateBookmarkUpdate } from '../utils/validation.ts'
import {
  listBookmarks,
  getBookmark,
  upsertBookmark,
  softDeleteBookmark,
} from '../db/queries.ts'
import type { Bindings, Variables } from '../types/index.ts'

const bookmarks = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET /bookmarks
bookmarks.get('/', async (c) => {
  const userId = c.get('userId')
  const versionSlug = c.req.query('versionSlug')
  const includeDeleted = c.req.query('includeDeleted') === 'true'

  const data = await listBookmarks(c.env.DB, userId, versionSlug, includeDeleted)
  return c.json({ data })
})

// POST /bookmarks
bookmarks.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()
  const errors = validateBookmarkCreate(body)
  if (errors.length > 0) {
    return c.json(
      { error: 'validationFailed', message: 'Request body validation failed', details: errors },
      400,
    )
  }

  await upsertBookmark(c.env.DB, body, userId)
  const created = await getBookmark(c.env.DB, body.id, userId)
  return c.json({ data: created }, 201)
})

// PATCH /bookmarks/:id
bookmarks.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const existing = await getBookmark(c.env.DB, id, userId)
  if (!existing || existing.deletedAt) {
    return c.json({ error: 'notFound', message: 'Bookmark not found' }, 404)
  }

  const body = await c.req.json()
  const errors = validateBookmarkUpdate(body)
  if (errors.length > 0) {
    return c.json(
      { error: 'validationFailed', message: 'Request body validation failed', details: errors },
      400,
    )
  }

  const updated = {
    ...existing,
    title: 'title' in body ? (body.title ?? null) : existing.title,
    note: 'note' in body ? (body.note ?? null) : existing.note,
    folderId: 'folderId' in body ? (body.folderId ?? null) : existing.folderId,
    updatedAt: body.updatedAt ?? now(),
  }
  await upsertBookmark(c.env.DB, updated, userId)

  const data = await getBookmark(c.env.DB, id, userId)
  return c.json({ data })
})

// DELETE /bookmarks/:id
bookmarks.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const deleted = await softDeleteBookmark(c.env.DB, id, userId)
  if (!deleted) {
    return c.json({ error: 'notFound', message: 'Bookmark not found' }, 404)
  }

  return new Response(null, { status: 204 })
})

export default bookmarks
