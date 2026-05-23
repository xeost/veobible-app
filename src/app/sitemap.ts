import type { MetadataRoute } from 'next'
import { getAllChapterStaticParams } from '@/lib/bible/loader'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://veobible.com'

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/en`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/es`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/en/kjv`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/es/rv1909`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ]

  const chapters = getAllChapterStaticParams()
  const chapterRoutes: MetadataRoute.Sitemap = chapters.map((c) => ({
    url: `${baseUrl}/${c.lang}/${c.version}/${c.book}/${c.chapter}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [...staticRoutes, ...chapterRoutes]
}
