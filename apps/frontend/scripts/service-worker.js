/* Public app shell only: authenticated responses are never cached. */
const SHELL = 'veobible-shell-' + BUILD
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(PRECACHE)))
})
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Keep legacy Bible downloads and old build assets for open tabs.
    for (const name of await caches.keys()) {
      if (['apis', 'cross-origin', 'pages'].includes(name)) await caches.delete(name)
    }
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || request.headers.has('Authorization')) return
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const legacy = url.pathname.match(/^\/(en|es|pt)\/(kjv|web|rv1909|spabll|arc)\/([^/]+)(?:\/(\d+))?\/?$/)
      if (legacy) {
        url.pathname = `/${legacy[1]}/${{ en: 'read', es: 'leer', pt: 'ler' }[legacy[1]]}/${legacy[2]}/${legacy[3]}/${legacy[4] || '1'}`
        return Response.redirect(url.toString(), 301)
      }
      const match = url.pathname.match(/^\/(en\/read|es\/leer|pt\/ler)(?:\/|$)/)
      const cache = await caches.open(SHELL)
      if (match) {
        const shell = await cache.match('/' + match[1])
        // Clear Response.url: a cached shell URL must not replace the deep link.
        return shell ? new Response(shell.body, { status: shell.status, headers: shell.headers }) : fetch(request)
      }
      try { return await fetch(request) } catch { return (await cache.match(url.pathname)) || (await cache.match('/offline')) }
    })())
  } else if (PRECACHE.includes(decodeURI(url.pathname))) {
    event.respondWith(caches.open(SHELL).then(async cache => (await cache.match(url.pathname)) || (await cache.match(decodeURI(url.pathname))) || fetch(request)))
  }
})
