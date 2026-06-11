/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  // Disable next-pwa's built-in auto-registration: with output:'export' the
  // generated sw-register.js is never copied to the out/ directory, so the SW
  // never registers.  We handle registration manually in src/app/layout.tsx.
  register: false,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Cache pages visited via Next.js client-side navigation (Link / router.push).
  // Without this, navigating between chapters only caches via the runtime rule
  // but never stores the HTML — so only pages the user opened directly as a
  // full page load are guaranteed to be offline.
  cacheOnFrontEndNav: true,
  // Offline fallback: served when a navigation request fails and the page is
  // not in any cache.  next-pwa will automatically add /offline to the precache.
  fallbacks: {
    document: '/offline',
  },
  buildExcludes: [
    /app-build-manifest.json$/,
    /pages-manifest.json$/,
    /build-manifest.json$/,
    /react-loadable-manifest.json$/,
  ],
  // Exclude all bible-data JSON files from the automatic Workbox pre-cache.
  // These are static content files (5+ MB per version, many versions/languages)
  // that users should opt into explicitly via the offline download button.
  // The runtimeCaching rule below ensures they are still cached on first access.
  publicExcludes: ['!bible-data/**'],
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
        cacheableResponse: {
          statuses: [0, 200],
        },
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
      // StaleWhileRevalidate serves from cache instantly and revalidates in the
      // background — this is the key fix for offline support.  The /offline
      // fallback (configured above) covers the edge case where the page is not
      // in any cache at all.
      urlPattern: ({ url }) => {
        if (!(self.origin === url.origin)) return false
        return !url.pathname.startsWith('/api/')
      },
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pages',
        expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
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
