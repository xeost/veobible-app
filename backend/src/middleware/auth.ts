import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import type { Bindings, Variables } from '../types/index.ts'

export const authMiddleware = createMiddleware<{
  Bindings: Bindings
  Variables: Variables
}>(async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json(
      { error: 'unauthorized', message: 'Missing or invalid Bearer token' },
      401,
    )
  }

  const token = header.slice(7)
  try {
    const payload = await verify(token, c.env.SUPABASE_JWT_SECRET, 'HS256')
    const userId = payload.sub as string | undefined
    if (!userId) throw new Error('Missing sub claim')

    // Upsert user record on first request
    await c.env.DB.prepare(
      'INSERT INTO users (id) VALUES (?) ON CONFLICT (id) DO NOTHING',
    ).bind(userId).run()

    c.set('userId', userId)
  } catch {
    return c.json(
      { error: 'invalidToken', message: 'Token verification failed' },
      401,
    )
  }

  await next()
})
