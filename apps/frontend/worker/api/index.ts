import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth.ts'
import { notFound, onError } from './middleware/error.ts'
import health from './routes/health.ts'
import bookmarks from './routes/bookmarks.ts'
import folders from './routes/folders.ts'
import reading from './routes/reading.ts'
import preferences from './routes/preferences.ts'
import sync from './routes/sync.ts'
import type { Bindings, Variables } from './types/index.ts'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use('*', cors({
  origin: ['https://veobible.com', 'http://localhost:3000', 'http://127.0.0.1:3000'],
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type'],
  maxAge: 86400,
}))

// ── Public routes ─────────────────────────────────────────────────────────────
app.route('/v1/health', health)

// ── Authenticated routes ──────────────────────────────────────────────────────
app.use('/v1/*', authMiddleware)

app.route('/v1/bookmarks/folders', folders)
app.route('/v1/bookmarks', bookmarks)
app.route('/v1/reading', reading)
app.route('/v1/preferences', preferences)
app.route('/v1/sync', sync)

// ── Error handlers ────────────────────────────────────────────────────────────
app.notFound(notFound)
app.onError(onError)

export default app
