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
  ...(process.env.NODE_ENV === 'production'
    ? { output: 'export' }
    : {
        async rewrites() {
          return [
            { source: '/api/:path*', destination: 'http://127.0.0.1:8787/:path*' },
            ...['read', 'leer', 'ler'].map(segment => ({
              source: `/:lang/${segment}/:rest*`,
              destination: `/:lang/${segment}`,
            })),
          ]
        },
      }),
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

module.exports = nextConfig
