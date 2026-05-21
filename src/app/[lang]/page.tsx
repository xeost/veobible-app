'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { useI18n } from '@/lib/i18n/client'
import { BIBLE_VERSIONS, getVersionsForLang } from '@/lib/bible/config'
import { storage } from '@/lib/storage'
import type { ReadingPosition } from '@/lib/storage'

interface LangHomePageProps {
  params: Promise<{ lang: string }>
}

interface VersionCardProps {
  version: (typeof BIBLE_VERSIONS)[0]
  lang: string
  lastPosition: ReadingPosition | null
}

function VersionCard({ version, lang, lastPosition }: VersionCardProps) {
  const { t } = useI18n()

  const href = lastPosition
    ? `/${lang}/${version.slug}/${lastPosition.bookSlug}/${lastPosition.chapter}`
    : `/${lang}/${version.slug}/genesis/1`

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Card gradient header */}
      <div
        className="h-24 flex items-end px-6 pb-4"
        style={{
          background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%)',
        }}
      >
        <div>
          <p className="text-white/70 text-xs font-medium uppercase tracking-widest">
            {version.langCode === 'en' ? 'English' : 'Español'}
          </p>
          <h2 className="text-white text-2xl font-bold leading-tight">{version.shortName}</h2>
        </div>
      </div>

      {/* Card body */}
      <div className="p-6">
        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
          {version.name}
        </p>

        {lastPosition && (
          <div
            className="mt-3 mb-4 px-3 py-2 rounded-lg text-xs"
            style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
          >
            <span className="font-medium">{t.home.continueReading}: </span>
            {lastPosition.bookSlug.replace(/-/g, ' ')} {lastPosition.chapter}
          </div>
        )}

        <Link
          href={href}
          className="btn-brand w-full justify-center mt-2"
          id={`start-reading-${version.slug}`}
        >
          {lastPosition ? t.home.continueReading : t.home.startReading}
        </Link>
      </div>
    </div>
  )
}

export default function LangHomePage({ params: paramsPromise }: LangHomePageProps) {
  const { t, locale } = useI18n()
  const [lastPositions, setLastPositions] = useState<Record<string, ReadingPosition | null>>({})
  const [mounted, setMounted] = useState(false)

  const versions = getVersionsForLang(locale)

  useEffect(() => {
    setMounted(true)
    const vers = getVersionsForLang(locale)
    async function load() {
      const positions: Record<string, ReadingPosition | null> = {}
      for (const v of vers) {
        positions[v.slug] = await storage.getReadingPosition(v.slug)
      }
      setLastPositions(positions)
    }
    load()
  }, [locale])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <Header currentLang={locale} />

      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-4 text-center">
        {/* Background decoration */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139,92,246,0.15) 0%, transparent 70%)',
          }}
        />

        <div className="relative max-w-2xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6"
            style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
          >
            <span>✦</span> VeoBible
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-lora), Georgia, serif' }}>
            {t.appTagline}
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            {t.home.availableVersions}
          </p>
        </div>
      </section>

      {/* Version cards */}
      <section className="max-w-4xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {versions.map((version) => (
            <VersionCard
              key={version.slug}
              version={version}
              lang={locale}
              lastPosition={mounted ? lastPositions[version.slug] ?? null : null}
            />
          ))}
        </div>

        {/* About section */}
        <div
          className="mt-16 rounded-2xl p-8 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {locale === 'es'
              ? 'VeoBible te permite leer la Biblia en múltiples versiones, guardar marcadores y retomar la lectura donde lo dejaste, desde cualquier dispositivo.'
              : 'VeoBible lets you read the Bible in multiple versions, save bookmarks, and resume reading where you left off from any device.'}
          </p>
        </div>
      </section>
    </div>
  )
}
