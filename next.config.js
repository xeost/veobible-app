/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
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
  ],
})

const nextConfig = {
  output: 'export',
  transpilePackages: ["next-image-export-optimizer"],
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
