import { HomeHeader } from '@/components/layout/HomeHeader'
import { Footer } from '@/components/layout/Footer'
import { discovery } from '@/lib/i18n/discovery'
import { sections, type Locale } from '@/lib/website/content'
import { WebsiteListing } from '@/components/ui/WebsiteListing'
import { readerSegment } from '@/lib/reader/routes'
import React from 'react'
import Link from '@/components/reader/ReaderLink'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { loadBibleIndex } from '@/lib/bible/loader'
import { findVersion, BIBLE_VERSIONS } from '@/lib/bible/config'
import { isValidLocale } from '@/lib/i18n/config'
import { getTranslations } from '@/lib/i18n/server'
import { BackButton } from './BackButton'

interface VersionPageProps {
  params: Promise<{ lang: string; version: string }>
}

export async function generateStaticParams() {
  return [...BIBLE_VERSIONS.map((v) => ({ lang: v.langCode, version: v.slug })), ...Object.entries(sections).flatMap(([lang,s])=>[s.short,s.long].map(version=>({lang,version})))]
}

export async function generateMetadata({ params }: VersionPageProps): Promise<Metadata> {
  const { lang, version } = await params
  const section=sections[lang as Locale]
  const kind=section && (version===section.short?'short':version===section.long?'long':null)
  if(kind) return {title:section[kind==='short'?'shortTitle':'longTitle'],alternates:{canonical:`/${lang}/${version}`,languages:{}},robots:{index:true,follow:true}}
  const versionInfo = findVersion(lang, version)
  if (!versionInfo) return {}
  const t = getTranslations(lang as any)
  return {
    title: versionInfo.name,
    description: lang === 'es' ? `Lee ${versionInfo.name} con notas, marcadores y lectura sin conexión.` : lang === 'pt' ? `Leia ${versionInfo.name} com notas, marcadores e leitura offline.` : `Read ${versionInfo.name} with notes, bookmarks and offline reading.`,
    alternates: { canonical: `/${lang}/${version}`, languages: {} },
  }
}

export default async function VersionPage({ params }: VersionPageProps) {
  const { lang, version } = await params

  if (!isValidLocale(lang)) notFound()
  const section=sections[lang as Locale]
  if(version===section.short || version===section.long) return <WebsiteListing locale={lang as Locale} kind={version===section.short?'short':'long'}/>
  const versionInfo = findVersion(lang, version)
  if (!versionInfo) notFound()

  const index = loadBibleIndex(lang, version)
  const t = getTranslations(lang as any)

  const oldTestament = index.books.filter((b) => b.testament === 'old')
  const newTestament = index.books.filter((b) => b.testament === 'new')

  const renderGroup = (books: typeof oldTestament, label: string) => (
    <section className="mb-10">
      <h2 className="testament-header mb-4">{label}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {books.map((book) => (
          <Link
            key={book.slug}
            href={`/${lang}/${readerSegment(lang)}/${version}/${book.slug}/1`}
            className="book-link-card rounded-xl px-3 py-3 transition-all duration-150 text-sm"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="font-medium truncate">{book.name}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {book.chapters} {t.reader.chapter.toLowerCase()}
              {book.chapters !== 1 ? 's' : ''}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <HomeHeader currentLang={lang} />
      <main id="main-content" className="site-container version-main">
        {/* Back link */}
        <BackButton fallbackHref={`/${lang}`} label={t.nav.back} />

        <div className="version-intro">
          <p className="eyebrow">{discovery[lang].libraryLabel}</p>
          <h1>
            {index.metadata.name}
          </h1>
          {index.metadata.description && (
            <p className="text-base mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {index.metadata.description}
            </p>
          )}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {index.metadata.year} · {index.metadata.copyright}
          </p>
        </div>

        {renderGroup(oldTestament, t.testament.old)}
        {renderGroup(newTestament, t.testament.new)}
      </main>
      <Footer lang={lang} />
    </div>
  )
}
