import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { loadBibleIndex } from '@/lib/bible/loader'
import { findVersion } from '@/lib/bible/config'
import { isValidLocale } from '@/lib/i18n/config'
import { getTranslations } from '@/lib/i18n/server'

interface VersionPageProps {
  params: Promise<{ lang: string; version: string }>
}

export async function generateStaticParams() {
  return [
    { lang: 'en', version: 'kjv' },
    { lang: 'es', version: 'rv1909' },
  ]
}

export async function generateMetadata({ params }: VersionPageProps): Promise<Metadata> {
  const { lang, version } = await params
  const versionInfo = findVersion(lang, version)
  if (!versionInfo) return {}
  const t = getTranslations(lang as any)
  return {
    title: versionInfo.name,
    description: `Read the complete ${versionInfo.name} Bible online.`,
    alternates: { canonical: `/${lang}/${version}` },
  }
}

export default async function VersionPage({ params }: VersionPageProps) {
  const { lang, version } = await params

  if (!isValidLocale(lang)) notFound()
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
            href={`/${lang}/${version}/${book.slug}/1`}
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
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Back link */}
        <Link
          href={`/${lang}`}
          className="inline-flex items-center gap-1.5 text-sm mb-8 transition-colors duration-100"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          {t.nav.home}
        </Link>

        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-lora), Georgia, serif' }}>
            {index.metadata.name}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {index.metadata.year} · {index.metadata.copyright}
          </p>
        </div>

        {renderGroup(oldTestament, t.testament.old)}
        {renderGroup(newTestament, t.testament.new)}
      </div>
    </div>
  )
}
