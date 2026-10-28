import type { MetadataRoute } from 'next'
import { BIBLE_VERSIONS } from '@/lib/bible/config'
export default function sitemap(): MetadataRoute.Sitemap {
 return ['/', '/en', '/es', '/pt', ...BIBLE_VERSIONS.map(v => `/${v.langCode}/${v.slug}`)].map(path => ({ url: `https://veobible.com${path}` }))
}
