import { createMiddleware } from 'hono/factory'
import { verify, decode } from 'hono/jwt'
import type { Bindings, Variables } from '../types/index.ts'

// ── JWKS cache (module-level, lives for the lifetime of the Worker isolate) ──

interface JWKEntry extends JsonWebKey { kid?: string }

let _jwksCache: { keys: JWKEntry[]; fetchedAt: number } | null = null
const JWKS_TTL_MS = 60 * 60 * 1000 // 1 hour

async function getPublicKey(supabaseUrl: string, kid?: string): Promise<CryptoKey> {
  const now = Date.now()
  if (!_jwksCache || now - _jwksCache.fetchedAt > JWKS_TTL_MS) {
    const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
    if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`)
    const data = await res.json() as { keys: JWKEntry[] }
    _jwksCache = { keys: data.keys, fetchedAt: now }
  }

  const jwk = kid ? _jwksCache.keys.find((k) => k.kid === kid) : _jwksCache.keys[0]
  if (!jwk) throw new Error(`No JWK found for kid=${String(kid)}`)

  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  )
}

// ── Middleware ────────────────────────────────────────────────────────────────

export const authMiddleware = createMiddleware<{
  Bindings: Bindings
  Variables: Variables
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      { error: 'unauthorized', message: 'Missing or invalid Bearer token' },
      401,
    )
  }

  const token = authHeader.slice(7)
  try {
    const { header: jwtHeader } = decode(token)
    const alg = (jwtHeader as { alg?: string }).alg ?? 'HS256'
    const kid = (jwtHeader as { kid?: string }).kid

    let payload
    if (alg === 'ES256') {
      const key = await getPublicKey(c.env.SUPABASE_URL, kid)
      payload = await verify(token, key, 'ES256')
    } else {
      payload = await verify(token, c.env.SUPABASE_JWT_SECRET, 'HS256')
    }

    const userId = payload.sub as string | undefined
    if (!userId) throw new Error('Missing sub claim')

    await c.env.DB.prepare(
      'INSERT INTO users (id) VALUES (?) ON CONFLICT (id) DO NOTHING',
    ).bind(userId).run()

    c.set('userId', userId)
  } catch (err) {
    console.error('[auth] JWT verification failed:', err instanceof Error ? err.message : err)
    return c.json(
      { error: 'invalidToken', message: 'Token verification failed' },
      401,
    )
  }

  await next()
})
