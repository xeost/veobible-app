/** @type {import('next').NextConfig} */

// A unique timestamp captured once per build.  Used as the Workbox revision for
// the app-shell pages in additionalManifestEntries so that Workbox re-fetches
// them on every new deployment (ensuring users never serve stale HTML offline).
const BUILD_TIMESTAMP = Date.now().toString()

const withPWA = require('next-pwa')({
  dest: 'public',
  // Disable next-pwa's built-in auto-registration: with output:'export' the
  // generated sw-register.js is never copied to the out/ directory, so the SW
  // never registers.  We handle registration manually in src/app/layout.tsx.
  register: false,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Cache pages visited via Next.js client-side navigation (Link / router.push).
  cacheOnFrontEndNav: true,

  // NOTE: We intentionally do NOT use next-pwa's `fallbacks` option here.
  // That option builds a separate worker bundle via webpack + babel-loader.
  // On Cloudflare Pages (and other CI environments) this can produce a 0-byte
  // fallback worker when babel-loader is unavailable, which causes the SW's
  // precache step to fail, leaving the new SW in the "redundant" state while
  // the OLD SW (with NetworkFirst and no offline strategy) stays active.
  //
  // Instead, we implement the offline fallback via Workbox's `handlerDidError`
  // plugin directly on the pages runtime-cache rule (see below).

  buildExcludes: [
    /app-build-manifest.json$/,
    /pages-manifest.json$/,
    /build-manifest.json$/,
    /react-loadable-manifest.json$/,
  ],

  // Exclude all bible-data JSON files from the automatic Workbox pre-cache.
  // These are large static files that users opt into via the offline download
  // button.  The runtimeCaching CacheFirst rule below covers them on demand.
  publicExcludes: ['!bible-data/**'],

  // Explicitly precache the app shell pages so they are always available
  // offline — even on a user's very first offline visit.  Without this,
  // StaleWhileRevalidate only caches pages AFTER the user visits them while
  // online, meaning a first-offline navigation to /en or /es shows the offline
  // fallback page instead of the actual home page.
  //
  // BUILD_TIMESTAMP ensures Workbox treats each deployment as a new revision
  // and re-fetches these entries, so users never get stale cached HTML.
  additionalManifestEntries: [
    { url: '/',        revision: BUILD_TIMESTAMP },
    { url: '/en',      revision: BUILD_TIMESTAMP },
    { url: '/es',      revision: BUILD_TIMESTAMP },
    // /offline must stay in the precache so the handlerDidError plugin below
    // can always resolve it from cache when all routes and the network fail.
    { url: '/offline', revision: BUILD_TIMESTAMP },
    // App-shell assets that must be available immediately offline.
    // /logo.png is excluded from the auto-precache by publicExcludes and would
    // only be in the runtime static-image-assets cache after the first online
    // visit — without this entry the logo breaks on first offline load.
    { url: '/logo.png', revision: BUILD_TIMESTAMP },
    // Favicons and PWA icons — served as Next.js App Router metadata routes
    // (src/app/favicon.ico, icon.svg, etc.) and therefore absent from the
    // automatic Workbox precache.  Required so the browser can render them
    // correctly when the app is installed as a PWA or used offline.
    { url: '/favicon.ico',              revision: BUILD_TIMESTAMP },
    { url: '/icon.svg',                 revision: BUILD_TIMESTAMP },
    { url: '/icon.png',                 revision: BUILD_TIMESTAMP },
    { url: '/apple-icon.png',           revision: BUILD_TIMESTAMP },
    { url: '/web-app-manifest-192x192.png', revision: BUILD_TIMESTAMP },
    { url: '/web-app-manifest-512x512.png', revision: BUILD_TIMESTAMP },
    // Offline reader shell — one per language.  The SW serves these pages
    // instead of /offline when a chapter URL navigation fails offline,
    // so the user always sees the reader header and can navigate back home.
    { url: '/en/offline-reader', revision: BUILD_TIMESTAMP },
    { url: '/es/offline-reader', revision: BUILD_TIMESTAMP },
  ],

  runtimeCaching: [
    {
      // Bible chapter and book JSON files — cache on first access (CacheFirst).
      // Files are static and never change for a given content hash, so we can
      // serve them from cache indefinitely once downloaded.
      urlPattern: /\/bible-data\/.+\.json$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'veobible-bible-data',
        expiration: {
          // Keep up to 10,000 entries; each version has ~1,189 chapter files
          // plus 66 book files, so this covers ~7 full versions.
          maxEntries: 10000,
          // Keep for 1 year — bible text doesn't change
          maxAgeSeconds: 365 * 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-stylesheets',
        expiration: { maxEntries: 4, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font\.css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-font-assets',
        expiration: { maxEntries: 4, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-image-assets',
        expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/_next\/image\?url=.+$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image',
        expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:mp3|wav|ogg)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-audio-assets',
        expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:mp4)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-video-assets',
        expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:js)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-js-assets',
        expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-style-assets',
        expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-data',
        expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      // API routes — network-first with a short timeout, then cache fallback.
      urlPattern: ({ url }) => {
        if (!(self.origin === url.origin)) return false
        return url.pathname.startsWith('/api/')
      },
      handler: 'NetworkFirst',
      options: {
        cacheName: 'apis',
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 16, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      // All same-origin navigation requests (HTML pages).
      // StaleWhileRevalidate: serve instantly from cache, refresh in background.
      //
      // handlerDidError plugin: when BOTH the cache and the network fail (i.e.
      // the user is offline and the page was never cached), serve /offline
      // directly from the Workbox precache.  This replaces next-pwa's `fallbacks`
      // option which required babel-loader and produced an unreliable separate
      // worker bundle in production CI environments.
      urlPattern: ({ url }) => {
        if (!(self.origin === url.origin)) return false
        return !url.pathname.startsWith('/api/')
      },
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pages',
        expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
        plugins: [
          {
            // Called by Workbox when both the cache lookup and the network
            // fetch have failed.  Return the /offline page from the precache.
            handlerDidError: async ({ event }) => {
              if (event.request.destination === 'document') {
                if (new URL(event.request.url).pathname.split('/').length >= 5) {
                  return caches.match('/' + new URL(event.request.url).pathname.split('/')[1] + '/offline-reader', { ignoreSearch: true })
                }
                return caches.match('/offline', { ignoreSearch: true })
              }
              return undefined
            },
          },
        ],
      },
    },
    {
      // Cross-origin requests — network with short timeout, no offline fallback.
      urlPattern: ({ url }) => !(self.origin === url.origin),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'cross-origin',
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 },
      },
    },
  ],
})

const fs = require('fs')

let NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
let NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
let NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL

try {
  const wrangler = fs.readFileSync('./wrangler.jsonc', 'utf8')
  const extract = (key) => {
    const match = wrangler.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`))
    return match ? match[1] : undefined
  }
  NEXT_PUBLIC_SUPABASE_URL = NEXT_PUBLIC_SUPABASE_URL || extract('NEXT_PUBLIC_SUPABASE_URL')
  NEXT_PUBLIC_SUPABASE_ANON_KEY = NEXT_PUBLIC_SUPABASE_ANON_KEY || extract('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  NEXT_PUBLIC_API_URL = NEXT_PUBLIC_API_URL || extract('NEXT_PUBLIC_API_URL')
} catch (e) {}

const nextConfig = {
  output: 'export',
  transpilePackages: ['next-image-export-optimizer'],
  images: {
    loader: 'custom',
    loaderFile: './src/lib/imageLoader.ts',
    imageSizes: [],
    deviceSizes: [384, 750],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL,
    nextImageExportOptimizer_imageFolderPath: 'public/images',
    nextImageExportOptimizer_exportFolderPath: 'out',
    nextImageExportOptimizer_quality: '75',
    nextImageExportOptimizer_storePicturesInWEBP: 'true',
    nextImageExportOptimizer_exportFolderName: 'nextImageExportOptimizer',
    nextImageExportOptimizer_generateAndUseBlurImages: 'true',
    nextImageExportOptimizer_remoteImageCacheTTL: '0',
  },
}

module.exports = withPWA(nextConfig)
