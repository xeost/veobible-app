import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllChapterStaticParams, loadChapterData } from '@/lib/bible/loader'
import { findVersion } from '@/lib/bible/config'
import { isValidLocale } from '@/lib/i18n/config'
import { getTranslations } from '@/lib/i18n/server'
import { ChapterClient } from './ChapterClient'

interface PageProps {
  params: Promise<{
    lang: string
    version: string
    book: string
    chapter: string
  }>
}

export async function generateStaticParams() {
  return getAllChapterStaticParams()
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, version, book, chapter } = await params

  if (!isValidLocale(lang)) return {}
  const versionInfo = findVersion(lang, version)
  if (!versionInfo) return {}

  const t = getTranslations(lang as any)
  const chapterNum = parseInt(chapter, 10)

  try {
    const data = loadChapterData(lang, version, book, chapterNum)
    const firstVerse = data.verses[0]?.text?.replace(/^¶\s*/, '').slice(0, 120) ?? ''
    const title = t.meta.chapterTitle(data.book.name, chapterNum, data.version.shortname)
    const description = t.meta.chapterDescription(
      data.book.name,
      chapterNum,
      data.version.name,
      firstVerse,
    )
    const canonicalUrl = `/${lang}/${version}/${book}/${chapter}`

    // JSON-LD breadcrumb
    const breadcrumbJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'VeoBible', item: '/' },
        { '@type': 'ListItem', position: 2, name: versionInfo.name, item: `/${lang}/${version}` },
        { '@type': 'ListItem', position: 3, name: data.book.name, item: `/${lang}/${version}/${book}/1` },
        { '@type': 'ListItem', position: 4, name: `Chapter ${chapterNum}`, item: canonicalUrl },
      ],
    }

    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      robots: { index: true, follow: true },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        type: 'article',
        siteName: 'VeoBible',
        locale: lang,
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
      other: {
        'script:ld+json': JSON.stringify(breadcrumbJsonLd),
      },
    }
  } catch {
    return { title: 'VeoBible' }
  }
}

export default async function ChapterPage({ params }: PageProps) {
  const { lang, version, book, chapter } = await params

  if (!isValidLocale(lang)) notFound()
  const versionInfo = findVersion(lang, version)
  if (!versionInfo) notFound()

  const chapterNum = parseInt(chapter, 10)
  if (isNaN(chapterNum) || chapterNum < 1) notFound()

  let data
  try {
    data = loadChapterData(lang, version, book, chapterNum)
  } catch {
    notFound()
  }

  // books are no longer needed here — the persistent ReaderLayoutClient
  // (in the (reader)/layout.tsx) already has them and won't remount.
  return (
    <ChapterClient
      data={data}
      lang={lang}
      version={version}
    />
  )
}
