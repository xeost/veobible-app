import { readSnapshot } from './store'
export async function exportContent(
  request: Request,
  env: { DB: D1Database; SITE_EXPORT_TOKEN?: string; SITE_LOCAL?: string }
) {
  const local = env.SITE_LOCAL === 'true'
  if (
    !local &&
    (!env.SITE_EXPORT_TOKEN ||
      request.headers.get('Authorization') !==
        `Bearer ${env.SITE_EXPORT_TOKEN}`)
  )
    return new Response('Unauthorized', { status: 401 })
  const snapshot = await readSnapshot(
    env.DB,
    local && new URL(request.url).searchParams.get('development') === '1'
  )
  return Response.json(snapshot ?? { error: 'No website release prepared' }, {
    status: snapshot ? 200 : 404,
    headers: { 'Cache-Control': 'private, no-store' }
  })
}
