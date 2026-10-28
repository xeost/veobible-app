import { Hono } from 'hono'
import { validatePreferencesUpsert } from '../utils/validation.ts'
import { getPreferences, upsertPreferences } from '../db/queries.ts'
import type { Bindings, Variables } from '../types/index.ts'

const preferences = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET /preferences
preferences.get('/', async (c) => {
  const userId = c.get('userId')
  const data = await getPreferences(c.env.DB, userId)
  return c.json({ data })
})

// PUT /preferences
preferences.put('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()

  const errors = validatePreferencesUpsert(body)
  if (errors.length > 0) {
    return c.json(
      { error: 'validationFailed', message: 'Request body validation failed', details: errors },
      400,
    )
  }

  await upsertPreferences(c.env.DB, body, userId)
  const data = await getPreferences(c.env.DB, userId)
  return c.json({ data })
})

export default preferences
