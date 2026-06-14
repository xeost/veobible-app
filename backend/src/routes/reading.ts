import { Hono } from 'hono'
import { validateReadingPositionUpsert, validateReadingRibbonUpsert } from '../utils/validation.ts'
import {
  listReadingPositions,
  upsertReadingPosition,
  listReadingRibbons,
  upsertReadingRibbon,
  deleteReadingRibbon,
} from '../db/queries.ts'
import type { Bindings, Variables } from '../types/index.ts'

const reading = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── Positions ─────────────────────────────────────────────────────────────────

// GET /reading/positions
reading.get('/positions', async (c) => {
  const userId = c.get('userId')
  const data = await listReadingPositions(c.env.DB, userId)
  return c.json({ data })
})

// PUT /reading/positions/:versionSlug
reading.put('/positions/:versionSlug', async (c) => {
  const userId = c.get('userId')
  const versionSlug = c.req.param('versionSlug')

  const body = await c.req.json()
  const errors = validateReadingPositionUpsert(body)
  if (errors.length > 0) {
    return c.json(
      { error: 'validationFailed', message: 'Request body validation failed', details: errors },
      400,
    )
  }

  const position = { versionSlug, ...body }
  await upsertReadingPosition(c.env.DB, position, userId)
  return c.json({ data: position })
})

// ── Ribbons ───────────────────────────────────────────────────────────────────

// GET /reading/ribbons
reading.get('/ribbons', async (c) => {
  const userId = c.get('userId')
  const data = await listReadingRibbons(c.env.DB, userId)
  return c.json({ data })
})

// PUT /reading/ribbons/:versionSlug
reading.put('/ribbons/:versionSlug', async (c) => {
  const userId = c.get('userId')
  const versionSlug = c.req.param('versionSlug')

  const body = await c.req.json()
  const errors = validateReadingRibbonUpsert(body)
  if (errors.length > 0) {
    return c.json(
      { error: 'validationFailed', message: 'Request body validation failed', details: errors },
      400,
    )
  }

  const ribbon = { versionSlug, ...body }
  await upsertReadingRibbon(c.env.DB, ribbon, userId)
  return c.json({ data: ribbon })
})

// DELETE /reading/ribbons/:versionSlug
reading.delete('/ribbons/:versionSlug', async (c) => {
  const userId = c.get('userId')
  const versionSlug = c.req.param('versionSlug')

  const deleted = await deleteReadingRibbon(c.env.DB, versionSlug, userId)
  if (!deleted) {
    return c.json({ error: 'notFound', message: 'Ribbon not found' }, 404)
  }

  return new Response(null, { status: 204 })
})

export default reading
