import api from './api/index'
import catalog from './catalog.json'

type Env = Parameters<typeof api.fetch>[1] & { ASSETS: { fetch(request: Request): Promise<Response> } }
const segments: Record<string, string> = { es: 'leer', en: 'read', pt: 'ler' }
export default {
  async fetch(request: Request, env: Env, ctx: Parameters<typeof api.fetch>[2]) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      url.pathname = url.pathname.slice(4)
      const response = await api.fetch(new Request(url, request), env, ctx)
      const result = new Response(response.body, response)
      result.headers.set('Cache-Control', 'private, no-store')
      return result
    }
    const parts = url.pathname.split('/').filter(Boolean)
    const lang = parts[0]
    const reader = parts[1] === segments[lang]
    const version = parts[reader ? 2 : 1]
    const book = parts[reader ? 3 : 2]
    const chapter = parts[reader ? 4 : 3] ?? '1'
    const books = (catalog as Record<string, Record<string, number>>)[`${lang}/${version}`]
    if (books && book && books[book] && /^\d+$/.test(chapter) && Number(chapter) >= 1 && Number(chapter) <= books[book] && parts.length === (reader ? 5 : parts.length === 3 ? 3 : 4)) {
      if (!reader) {
        url.pathname = `/${lang}/${segments[lang]}/${version}/${book}/${chapter}`
        return Response.redirect(url.toString(), 301)
      }
      const shell = new URL(`/${lang}/${segments[lang]}`, url)
      const response = await env.ASSETS.fetch(new Request(shell, request))
      const result = new Response(response.body, response)
      result.headers.set('X-Robots-Tag', 'noindex, follow')
      return result
    }
    const response = await env.ASSETS.fetch(request)
    if (reader) {
      const result = new Response(response.body, { status: parts.length > 2 ? 404 : response.status, headers: response.headers })
      result.headers.set('X-Robots-Tag', 'noindex, follow')
      return result
    }
    return response
  },
}
