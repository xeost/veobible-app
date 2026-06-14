'use client'

import { useEffect, useState } from 'react'
import { ReaderLayoutClient } from '@/app/[lang]/[version]/[book]/(reader)/ReaderLayoutClient'
import { ChapterClient } from '@/app/[lang]/[version]/[book]/(reader)/[chapter]/ChapterClient'
import { ReaderHeader } from '@/components/layout/ReaderHeader'
import { useI18n } from '@/lib/i18n/client'
import {
  readIndexFromCache,
  readChapterFromCache,
} from '@/lib/bible/bibleDataCache'
import type { ChapterData, BookInfo } from '@/lib/bible/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type LoadState = 'loading' | 'ready' | 'unavailable'

interface LoadedChapter {
  data: ChapterData
  lang: string
  version: string
  books: BookInfo[]
  versionName: string
}

// ── URL parser ────────────────────────────────────────────────────────────────

/**
 * Parse a reader URL of the form /[lang]/[version]/[bookSlug]/[chapter].
 * Returns null if the pathname does not match the expected pattern.
 */
function parseReaderUrl(pathname: string): {
  lang: string
  version: string
  bookSlug: string
  chapter: number
} | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length < 4) return null
  const [lang, version, bookSlug, chapterStr] = parts
  const chapter = parseInt(chapterStr, 10)
  if (isNaN(chapter) || chapter < 1) return null
  return { lang, version, bookSlug, chapter }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OfflineUnavailableContent({
  lang,
}: {
  lang: string
  version: string
}) {
  const { t } = useI18n()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100dvh - 4rem - var(--sat, 0px))',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '1.5rem',
          padding: '2.5rem 2rem',
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        }}
      >
        {/* Wifi-off icon */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--brand-light, rgba(124,106,247,0.15))',
            border: '1px solid rgba(124,106,247,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: 'var(--brand, #7c6af7)',
          }}
          aria-hidden="true"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <circle cx="12" cy="20" r="1" fill="currentColor" strokeWidth="0" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.625rem',
            lineHeight: 1.25,
          }}
        >
          {t.offline.versionNotAvailable}
        </h1>

        <p
          style={{
            fontSize: '0.9375rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: '1.75rem',
          }}
        >
          {t.offline.versionNotAvailableDesc}
        </p>

        <a
          href={`/${lang}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'var(--brand, #7c6af7)',
            color: '#fff',
            border: 'none',
            borderRadius: '0.75rem',
            fontSize: '0.9375rem',
            fontWeight: 600,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          {t.offline.offlinePage.goHome}
        </a>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Offline reader shell — served by the Service Worker as a document fallback
 * for reader chapter URLs that are not in the SW pages cache when the user
 * is offline.
 *
 * On mount, this component:
 *   1. Reads window.location.pathname to determine lang/version/book/chapter.
 *   2. Tries to load the Bible index and chapter verses from the
 *      veobible-bible-data Cache API (populated by the offline downloader).
 *   3a. If data is available → renders the full ReaderLayoutClient so the
 *       user gets a native reading experience with sidebars and navigation.
 *   3b. If data is not available → renders the reader header + an "offline
 *       unavailable" message so the user can navigate back to the home page.
 *
 * SSG (build-time) renders a loading skeleton. Bots crawl the real chapter
 * pages, not this shell, so SEO is unaffected.
 */
export function OfflineReaderClient() {
  const [pageState, setPageState] = useState<LoadState>('loading')
  const [loaded, setLoaded] = useState<LoadedChapter | null>(null)
  const [fallbackLang, setFallbackLang] = useState('en')
  const [fallbackVersion, setFallbackVersion] = useState('')

  useEffect(() => {
    const parsed = parseReaderUrl(window.location.pathname)
    if (!parsed) {
      setPageState('unavailable')
      return
    }

    const { lang, version, bookSlug, chapter } = parsed
    setFallbackLang(lang)
    setFallbackVersion(version)

    ;(async () => {
      try {
        const index = await readIndexFromCache(lang, version)
        if (!index) {
          setPageState('unavailable')
          return
        }

        const bookIdx = index.books.findIndex((b) => b.slug === bookSlug)
        if (bookIdx === -1) {
          setPageState('unavailable')
          return
        }

        const book = index.books[bookIdx]
        if (chapter < 1 || chapter > book.chapters) {
          setPageState('unavailable')
          return
        }

        const verses = await readChapterFromCache(lang, version, book.id, chapter)
        if (!verses) {
          setPageState('unavailable')
          return
        }

        const prevChapter =
          chapter > 1
            ? { bookSlug, chapter: chapter - 1 }
            : bookIdx > 0
              ? {
                  bookSlug: index.books[bookIdx - 1].slug,
                  chapter: index.books[bookIdx - 1].chapters,
                }
              : null

        const nextChapter =
          chapter < book.chapters
            ? { bookSlug, chapter: chapter + 1 }
            : bookIdx < index.books.length - 1
              ? { bookSlug: index.books[bookIdx + 1].slug, chapter: 1 }
              : null

        const chapterData: ChapterData = {
          verses,
          book,
          chapterNum: chapter,
          version: index.metadata,
          prevChapter,
          nextChapter,
        }

        setLoaded({
          data: chapterData,
          lang,
          version,
          books: index.books,
          versionName: index.metadata.name,
        })
        setPageState('ready')
      } catch {
        setPageState('unavailable')
      }
    })()
  }, [])

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
        <div
          className="app-header app-header-height sticky top-0 z-30"
          style={{ background: 'var(--bg-header)', borderBottom: '1px solid var(--border)' }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: '6rem',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '3px solid var(--brand-light, rgba(124,106,247,0.15))',
              borderTopColor: 'var(--brand, #7c6af7)',
              animation: 'offline-spin 0.8s linear infinite',
            }}
          />
        </div>
        <style>{`@keyframes offline-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Unavailable: reader header + offline message ───────────────────────────

  if (pageState === 'unavailable') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
        <ReaderHeader
          currentLang={fallbackLang}
          currentVersion={fallbackVersion}
          onOpenSidebar={() => {}}
          onOpenBookmarks={() => {}}
          isReadingMode={false}
          onToggleReadingMode={() => {}}
          onOpenTypography={() => {}}
          isTypographyOpen={false}
          onOpenSearch={() => {}}
          offline={{
            status: 'not-cached',
            progress: null,
            isDownloading: false,
            totalChapters: 66,
            versionName: fallbackVersion,
            onDownload: () => {},
            onCancel: () => {},
            onDelete: () => {},
          }}
        />
        <OfflineUnavailableContent lang={fallbackLang} version={fallbackVersion} />
      </div>
    )
  }

  // ── Ready: full reader layout with cached content ──────────────────────────

  if (pageState === 'ready' && loaded) {
    return (
      <ReaderLayoutClient
        lang={loaded.lang}
        version={loaded.version}
        versionName={loaded.versionName}
        books={loaded.books}
      >
        <ChapterClient data={loaded.data} lang={loaded.lang} version={loaded.version} />
      </ReaderLayoutClient>
    )
  }

  return null
}
