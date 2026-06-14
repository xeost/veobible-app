// Custom image loader required by next-image-export-optimizer when loader: 'custom' is set
// This forwards to the optimizer's built-in loader logic
// See: https://github.com/Niels-IO/next-image-export-optimizer

interface ImageLoaderParams {
  src: string
  width: number
  quality?: number
}

export default function imageLoader({ src, width, quality }: ImageLoaderParams): string {
  // In development, return the src as-is
  if (process.env.NODE_ENV === 'development') {
    return src
  }
  // In production, next-image-export-optimizer handles conversion during build
  const storePicturesInWebp =
    process.env.nextImageExportOptimizer_storePicturesInWEBP === 'true'
  const exportFolderName =
    process.env.nextImageExportOptimizer_exportFolderName ?? 'nextImageExportOptimizer'
  const q = quality ?? 75

  const isRemote = src.startsWith('http')
  if (isRemote) return src

  const ext = storePicturesInWebp ? 'webp' : src.split('.').pop() ?? 'webp'
  const filename = src.split('/').pop()?.split('.')[0] ?? 'image'
  return `/${exportFolderName}/${filename}-opt-${width}.${ext}?q=${q}`
}
