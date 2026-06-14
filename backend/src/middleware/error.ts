import type { Context } from 'hono'

export function notFound(c: Context) {
  return c.json({ error: 'notFound', message: 'Route not found' }, 404)
}

export function onError(err: Error, c: Context) {
  console.error('[error]', err.message, err.stack)
  return c.json({ error: 'internalError', message: 'An unexpected error occurred' }, 500)
}
