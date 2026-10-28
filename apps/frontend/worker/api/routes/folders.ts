import { Hono } from 'hono'
import { now } from '../utils/timestamps.ts'
import { validateFolderCreate, validateFolderUpdate } from '../utils/validation.ts'
import {
  listFolders,
  getFolder,
  upsertFolder,
  softDeleteFolder,
} from '../db/queries.ts'
import type { Bindings, Variables } from '../types/index.ts'

const folders = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET /bookmarks/folders
folders.get('/', async (c) => {
  const userId = c.get('userId')
  const versionSlug = c.req.query('versionSlug')

  const data = await listFolders(c.env.DB, userId, versionSlug)
  return c.json({ data })
})

// POST /bookmarks/folders
folders.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()
  const errors = validateFolderCreate(body)
  if (errors.length > 0) {
    return c.json(
      { error: 'validationFailed', message: 'Request body validation failed', details: errors },
      400,
    )
  }

  await upsertFolder(c.env.DB, body, userId)
  const created = await getFolder(c.env.DB, body.id, userId)
  return c.json({ data: created }, 201)
})

// PATCH /bookmarks/folders/:id
folders.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const existing = await getFolder(c.env.DB, id, userId)
  if (!existing || existing.deletedAt) {
    return c.json({ error: 'notFound', message: 'Folder not found' }, 404)
  }

  const body = await c.req.json()
  const errors = validateFolderUpdate(body)
  if (errors.length > 0) {
    return c.json(
      { error: 'validationFailed', message: 'Request body validation failed', details: errors },
      400,
    )
  }

  const updated = {
    ...existing,
    name: body.name ?? existing.name,
    order: body.order !== undefined ? body.order : existing.order,
    updatedAt: body.updatedAt ?? now(),
  }
  await upsertFolder(c.env.DB, updated, userId)

  const data = await getFolder(c.env.DB, id, userId)
  return c.json({ data })
})

// DELETE /bookmarks/folders/:id
folders.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const deleted = await softDeleteFolder(c.env.DB, id, userId)
  if (!deleted) {
    return c.json({ error: 'notFound', message: 'Folder not found' }, 404)
  }

  return new Response(null, { status: 204 })
})

export default folders
