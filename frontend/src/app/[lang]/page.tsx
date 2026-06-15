'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { HomeHeader } from '@/components/layout/HomeHeader'
import { useI18n } from '@/lib/i18n/client'
import { getVersionsForLang } from '@/lib/bible/config'
import { storage } from '@/lib/storage'
import { getVerseOfTheDay } from '@/lib/bible/verses-of-the-day'
import type { ReadingPosition } from '@/lib/storage'

interface LangHomePageProps {
  params: Promise<{ lang: string }>
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const BookOpenIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
)

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
)

const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L13.09 8.26L19 7L14.74 11.26L21 12L14.74 12.74L19 17L13.09 15.74L12 22L10.91 15.74L5 17L9.26 12.74L3 12L9.26 11.26L5 7L10.91 8.26L12 2Z" />
  </svg>
)

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const SmartphoneIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
)

const MonitorIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
)

const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
)

const AndroidIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.523 15.341c-.353 0-.64-.286-.64-.64V9.301c0-.354.287-.64.64-.64.354 0 .64.286.64.64v5.4c0 .354-.286.64-.64.64zm-11.046 0c-.354 0-.64-.286-.64-.64V9.301c0-.354.286-.64.64-.64.353 0 .64.286.64.64v5.4c0 .354-.287.64-.64.64zM8.5 4.5l-1.5-2.6M15.5 4.5l1.5-2.6M7 7h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm2.5 9v2.5a.5.5 0 0 0 1 0V16zm3 0v2.5a.5.5 0 0 0 1 0V16z" />
  </svg>
)

const ChromeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <line x1="21.17" y1="8" x2="12" y2="8" />
    <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
    <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
  </svg>
)

const YoutubeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
)

// ─── Verse of the Day ─────────────────────────────────────────────────────────

function VerseOfTheDay({ locale, versionSlug }: { locale: string; versionSlug: string }) {
  const { t } = useI18n()
  const dailyVerse = getVerseOfTheDay()

  // Each locale has its own routing slug for the book
  const bookSlug = locale === 'es' ? dailyVerse.bookSlugEs : dailyVerse.bookSlug
  const reference = locale === 'es' ? dailyVerse.referenceEs : dailyVerse.reference

  // Fetch the real verse text from the public JSON file
  const [verseText, setVerseText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setVerseText(null)
    const url = `/bible-data/${locale}/${versionSlug}/${dailyVerse.bookSlug}/${dailyVerse.chapter}.json`
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Array<{ verse: number; text: string }>>
      })
      .then((verses) => {
        const found = verses.find((v) => v.verse === dailyVerse.verse)
        setVerseText(found?.text ?? null)
      })
      .catch(() => setVerseText(null))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, versionSlug, bookSlug, dailyVerse.chapter, dailyVerse.verse])

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-8 md:p-12"
      style={{
        background: 'var(--verse-card-bg)',
      }}
    >
      {/* Decorative orbs */}
      <div
        className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.06)', filter: 'blur(1px)' }}
      />
      <div
        className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.04)', filter: 'blur(1px)' }}
      />

      <div className="relative">
        {/* Label */}
        <div className="flex items-center gap-2 mb-6">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
          >
            <SparkleIcon />
            {t.home.verseOfTheDay}
          </div>
        </div>

        {/* Verse text — shimmer while loading */}
        {loading ? (
          <div className="mb-6 space-y-3">
            {[90, 75, 55].map((w) => (
              <div
                key={w}
                className="h-6 rounded-lg animate-pulse"
                style={{ width: `${w}%`, background: 'rgba(255,255,255,0.15)' }}
              />
            ))}
          </div>
        ) : verseText ? (
          <blockquote
            className="text-xl md:text-2xl lg:text-3xl font-medium leading-relaxed mb-6"
            style={{
              color: '#ffffff',
              fontFamily: 'var(--font-lora), Georgia, serif',
              textShadow: '0 1px 8px rgba(0,0,0,0.15)',
            }}
          >
            &ldquo;{verseText}&rdquo;
          </blockquote>
        ) : (
          <p className="text-white/60 italic mb-6">{reference}</p>
        )}

        {/* Reference + CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <p
            className="text-base font-semibold"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            — {reference}
          </p>
          <Link
            href={`/${locale}/${versionSlug}/${bookSlug}/${dailyVerse.chapter}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.3)',
              backdropFilter: 'blur(8px)',
            }}
            id="verse-of-the-day-link"
          >
            {t.home.readInContext}
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Install Step ─────────────────────────────────────────────────────────────

function InstallStep({ number, text }: { number: number; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
        style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
      >
        {number}
      </span>
      <span className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {text}
      </span>
    </li>
  )
}

// ─── Install Card ─────────────────────────────────────────────────────────────

function InstallCard({
  icon,
  title,
  steps,
  accentColor,
}: {
  icon: React.ReactNode
  title: string
  steps: string[]
  accentColor: string
}) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: accentColor + '1a', color: accentColor }}
        >
          {icon}
        </div>
        <h3 className="font-semibold text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
      </div>
      <ol className="flex flex-col gap-2.5">
        {steps.map((step, i) => (
          <InstallStep key={i} number={i + 1} text={step} />
        ))}
      </ol>
    </div>
  )
}

// ─── YouTube Section ──────────────────────────────────────────────────────────

function YouTubeSection() {
  const { t, locale } = useI18n()

  const channels = [
    {
      id: 'es',
      label: t.home.youtubeChannelEs,
      description: t.home.youtubeChannelEsDesc,
      url: 'https://www.youtube.com/@veobible-es',
      handle: '@veobible-es',
      lang: 'Español',
    },
    {
      id: 'en',
      label: t.home.youtubeChannelEn,
      description: t.home.youtubeChannelEnDesc,
      url: 'https://www.youtube.com/@veobible',
      handle: '@veobible',
      lang: 'English',
    },
  ]

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: '#FF00001a', color: '#FF0000' }}
        >
          <YoutubeIcon />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t.home.youtubeTitle}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t.home.youtubeSubtitle}
          </p>
        </div>
      </div>

      {/* Channel cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {channels.map((ch) => (
          <a
            key={ch.id}
            href={ch.url}
            target="_blank"
            rel="noopener noreferrer"
            id={`youtube-channel-${ch.id}`}
            className="group relative overflow-hidden rounded-2xl flex flex-col gap-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
              textDecoration: 'none',
            }}
          >
            {/* Thumbnail strip */}
            <div
              className="relative h-28 flex items-center justify-center overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #1a0000 0%, #2d0000 50%, #1a0000 100%)',
              }}
            >
              {/* Subtle grid pattern */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(255,255,255,0.4) 24px, rgba(255,255,255,0.4) 25px), repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(255,255,255,0.4) 24px, rgba(255,255,255,0.4) 25px)',
                }}
              />
              {/* Glow */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(255,0,0,0.18) 0%, transparent 70%)',
                }}
              />
              {/* Play button */}
              <div
                className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                style={{ background: '#FF0000', boxShadow: '0 4px 20px rgba(255,0,0,0.5)' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              {/* Lang badge */}
              <span
                className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(6px)' }}
              >
                {ch.lang}
              </span>
            </div>

            {/* Info */}
            <div className="p-5 flex flex-col gap-2 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#FF0000', opacity: 0.85 }}>
                YouTube
              </p>
              <h3 className="font-bold text-base leading-tight" style={{ color: 'var(--text-primary)' }}>
                {ch.label}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {ch.description}
              </p>
              <div className="mt-auto pt-3 flex items-center justify-between">
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {ch.handle}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 group-hover:scale-105"
                  style={{ background: '#FF00001a', color: '#FF0000' }}
                >
                  {t.home.youtubeSubscribe}
                  <ArrowRightIcon />
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}

// ─── PWA Install Guide ────────────────────────────────────────────────────────

function PwaInstallGuide() {
  const { t } = useI18n()

  const cards = [
    {
      icon: <AppleIcon />,
      title: t.home.installIos,
      steps: [t.home.installIosStep1, t.home.installIosStep2, t.home.installIosStep3, t.home.installIosStep4],
      accentColor: '#007AFF',
    },
    {
      icon: <AndroidIcon />,
      title: t.home.installAndroid,
      steps: [t.home.installAndroidStep1, t.home.installAndroidStep2, t.home.installAndroidStep3, t.home.installAndroidStep4],
      accentColor: '#34A853',
    },
    {
      icon: <ChromeIcon />,
      title: t.home.installDesktopChrome,
      steps: [t.home.installDesktopChromeStep1, t.home.installDesktopChromeStep2, t.home.installDesktopChromeStep3],
      accentColor: '#8b5cf6',
    },
    {
      icon: <AppleIcon />,
      title: t.home.installDesktopSafari,
      steps: [t.home.installDesktopSafariStep1, t.home.installDesktopSafariStep2, t.home.installDesktopSafariStep3],
      accentColor: '#0099FF',
    },
  ]

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
        >
          <DownloadIcon />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t.home.installTitle}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t.home.installSubtitle}
          </p>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card, i) => (
          <InstallCard key={i} {...card} />
        ))}
      </div>
    </section>
  )
}

// ─── Featured Version Card ────────────────────────────────────────────────────

function FeaturedVersionCard({
  version,
  lang,
  lastPosition,
}: {
  version: ReturnType<typeof getVersionsForLang>[0]
  lang: string
  lastPosition: ReadingPosition | null
}) {
  const { t } = useI18n()

  const href = lastPosition
    ? `/${lang}/${version.slug}/${lastPosition.bookSlug}/${lastPosition.chapter}`
    : `/${lang}/${version.slug}/genesis/1`

  return (
    <div
      className="relative overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* Gradient band at top */}
      <div
        className="h-2 w-full"
        style={{
          background: 'linear-gradient(90deg, var(--brand) 0%, var(--brand-dark) 100%)',
        }}
      />

      <div className="p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-6">
        {/* Icon */}
        <div
          className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%)',
            color: '#fff',
            boxShadow: '0 8px 24px rgba(139,92,246,0.35)',
          }}
        >
          <BookOpenIcon />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--brand)' }}>
            {version.langCode === 'en' ? 'English' : 'Español'}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-lora), Georgia, serif' }}>
            {version.name}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {version.shortName.toUpperCase()}
          </p>

          {lastPosition && (
            <div
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22V12M12 12V2M12 12H2M12 12h10" /></svg>
              {t.home.continueReading}: {lastPosition.bookSlug.replace(/-/g, ' ')} {lastPosition.chapter}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex-shrink-0">
          <Link
            href={href}
            className="btn-brand inline-flex items-center gap-2 px-6 py-3 text-base rounded-xl"
            id={`start-reading-${version.slug}`}
          >
            {lastPosition ? t.home.continueReading : t.home.startReading}
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LangHomePage({ params: _params }: LangHomePageProps) {
  const { t, locale } = useI18n()
  const [lastPositions, setLastPositions] = useState<Record<string, ReadingPosition | null>>({})
  const [mounted, setMounted] = useState(false)

  const versions = getVersionsForLang(locale)
  const primaryVersion = versions[0]

  useEffect(() => {
    setMounted(true)
    async function load() {
      const positions: Record<string, ReadingPosition | null> = {}
      for (const v of versions) {
        positions[v.slug] = await storage.getReadingPosition(v.slug)
      }
      setLastPositions(positions)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <HomeHeader currentLang={locale} />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 md:py-28 px-4">
        {/* Layered radial gradients */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(139,92,246,0.18) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-0 right-0 w-96 h-96 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 80% 20%, rgba(139,92,246,0.1) 0%, transparent 60%)',
          }}
        />

        <div className="relative max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-8 animate-fade-in"
            style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
          >
            {t.home.welcome}
          </div>

          {/* Headline */}
          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1] tracking-tight"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-lora), Georgia, serif',
            }}
          >
            {t.appTagline}
          </h1>

          {/* Sub-headline */}
          <p className="text-lg md:text-xl mb-12 max-w-xl mx-auto" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
            {locale === 'es'
              ? 'Lee, marca y retoma la lectura donde la dejaste, desde cualquier dispositivo.'
              : 'Read, bookmark, and continue where you left off, from any device.'}
          </p>

          {/* Stats strip */}
          <div className="flex flex-wrap justify-center gap-8 text-center">
            {[
              { value: '66', label: locale === 'es' ? 'Libros' : 'Books' },
              { value: '31K+', label: locale === 'es' ? 'Versículos' : 'Verses' },
              { value: locale === 'es' ? 'Gratis' : 'Free', label: locale === 'es' ? 'Para siempre' : 'Forever' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p
                  className="text-2xl font-bold"
                  style={{ color: 'var(--brand)' }}
                >
                  {value}
                </p>
                <p className="text-xs font-medium uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 pb-24 space-y-14">

        {/* Featured version */}
        {primaryVersion && (
          <FeaturedVersionCard
            version={primaryVersion}
            lang={locale}
            lastPosition={mounted ? lastPositions[primaryVersion.slug] ?? null : null}
          />
        )}

        {/* Verse of the day */}
        {primaryVersion && (
          <VerseOfTheDay locale={locale} versionSlug={primaryVersion.slug} />
        )}

        {/* YouTube channels */}
        <YouTubeSection />

        {/* Divider */}
        <div
          className="h-px w-full"
          style={{ background: 'var(--border)' }}
        />

        {/* PWA install guide */}
        <PwaInstallGuide />
      </div>
    </div>
  )
}
