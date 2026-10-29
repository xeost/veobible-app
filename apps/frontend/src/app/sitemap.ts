import { websiteContent, sections, publicationPath } from '@/lib/website/content'
import type { MetadataRoute } from 'next'
import { BIBLE_VERSIONS } from '@/lib/bible/config'
export default function sitemap(): MetadataRoute.Sitemap {
 return ['/', '/en', '/es', '/pt', ...BIBLE_VERSIONS.map(v => `/${v.langCode}/${v.slug}`), ...Object.entries(sections).flatMap(([lang,s])=>[`/${lang}/${s.short}`,`/${lang}/${s.long}`]), ...websiteContent().publications.map(publicationPath)].map(path => ({ url: `https://veobible.com${path}` }))
}
