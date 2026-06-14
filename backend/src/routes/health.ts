import { Hono } from 'hono'
import { now } from '../utils/timestamps.ts'
import type { Bindings, Variables } from '../types/index.ts'

const health = new Hono<{ Bindings: Bindings; Variables: Variables }>()

health.get('/', async (c) => {
  let dbStatus: 'ok' | 'error' = 'ok'
  try {
    await c.env.DB.prepare('SELECT 1').run()
  } catch {
    dbStatus = 'error'
  }

  return c.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    timestamp: now(),
    database: dbStatus,
  })
})

export default health
