'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { ChapterReader } from '@/components/reader/ChapterReader'
import { ReaderSettingsPanel } from '@/components/reader/ReaderSettingsPanel'
import { BookmarksList } from '@/components/bookmarks/BookmarksList'
import { Sheet } from '@/components/ui/Sheet'
import { useI18n } from '@/lib/i18n/client'
import { useBookmarks } from '@/hooks/useBookmarks'
import type { ChapterData, BookInfo } from '@/lib/bible/types'

interface ChapterClientProps {
  data: ChapterData
  books: BookInfo[]
  lang: string
  version: string
}

export function ChapterClient({ data, books, lang, version }: ChapterClientProps) {
  const { t } = useI18n()

  // Reading mode: sidebars collapse to width 0, content stays centered
  const [readingMode, setReadingMode] = useState(false)

  // Typography settings panel
  const [typographyOpen, setTypographyOpen] = useState(false)
  const typographyAnchorRef = useRef<HTMLButtonElement>(null)

  const handleOpenTypography = (anchor: HTMLButtonElement) => {
    // Store anchor reference for panel positioning (not used directly but good practice)
    ;(typographyAnchorRef as React.MutableRefObject<HTMLButtonElement>).current = anchor
    setTypographyOpen((o) => !o)
  }

  // Preserve scroll position across reading mode toggles so the
  // content column does not jump vertically when sidebars appear/disappear.
  const savedScrollY = useRef(0)

  const handleToggleReadingMode = () => {
    savedScrollY.current = window.scrollY
    setReadingMode((m) => !m)
  }

  // Restore scroll after every reading-mode change (runs after paint)
  useEffect(() => {
    // requestAnimationFrame ensures the new layout has been applied
    const raf = requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY.current, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(raf)
  }, [readingMode])

  // Sheet open states — used on mobile always, on desktop only in reading mode
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bookmarksOpen, setBookmarksOpen] = useState(false)

  // Single source of truth for bookmarks + folders
  const {
    bookmarks,
    folders,
    loading: bookmarksLoading,
    addBookmark,
    updateBookmark,
    removeBookmark,
    isBookmarked,
    addFolder,
    updateFolder,
    removeFolder,
    moveBookmarkToFolder,
  } = useBookmarks(version)

  // Shared BookmarksList props
  const bookmarksListProps = {
    lang,
    versionSlug: version,
    bookmarks,
    folders,
    loading: bookmarksLoading,
    removeBookmark,
    updateBookmark,
    addFolder,
    updateFolder,
    removeFolder,
    moveBookmarkToFolder,
  }

  // Shared Sidebar props
  const sidebarProps = {
    lang,
    version,
    versionName: data.version.name,
    books,
    currentBookSlug: data.book.slug,
    currentChapter: data.chapterNum,
  }

  // Sidebar widths (CSS variables / fixed values)
  const SIDEBAR_LEFT = '15rem'   // 240 px — matches w-60
  const SIDEBAR_RIGHT = '18rem'  // 288 px — matches xl:w-72

  // Sidebar transition: width collapses to 0 so the reading column stays
  // in place without any horizontal shift.
  const sidebarTransition = 'width 0.25s ease, opacity 0.25s ease'

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Header
        currentLang={lang}
        currentVersion={version}
        onOpenSidebar={() => setSidebarOpen(true)}
        onOpenBookmarks={() => setBookmarksOpen(true)}
        isReadingMode={readingMode}
        onToggleReadingMode={handleToggleReadingMode}
        onOpenTypography={handleOpenTypography}
      />

      {/* Typography settings panel */}
      <ReaderSettingsPanel
        open={typographyOpen}
        onClose={() => setTypographyOpen(false)}
        anchorRef={typographyAnchorRef}
      />

      {/* ── Desktop: unified single-DOM 3-column layout ─────────────────
          Sidebars stay mounted and animate their width to 0 in reading
          mode so the central column never shifts horizontally.           */}
      <div
        className="hidden md:flex mx-auto w-full"
        style={{ maxWidth: '1600px' }}
      >
        {/* Left sidebar — Table of Contents */}
        <aside
          className="flex-shrink-0 sticky overflow-hidden sidebar"
          style={{
            width: readingMode ? 0 : SIDEBAR_LEFT,
            opacity: readingMode ? 0 : 1,
            transition: sidebarTransition,
            background: 'var(--bg-sidebar)',
            borderRight: readingMode ? 'none' : '1px solid var(--border)',
            top: 'calc(3.5rem + var(--sat))',
            height: 'calc(100vh - 3.5rem - var(--sat))',
          }}
          aria-hidden={readingMode}
        >
          <Sidebar {...sidebarProps} />
        </aside>

        {/* Reading column — always flex-1, never changes position */}
        <main
          className="flex-1 min-w-0 px-8 xl:px-14 py-10"
          id="main-content"
          style={{ paddingBottom: 'calc(2.5rem + var(--sab))' }}
        >
          <ChapterReader
            data={data}
            lang={lang}
            version={version}
            addBookmark={addBookmark}
            isBookmarked={isBookmarked}
          />
        </main>

        {/* Right sidebar — Bookmarks */}
        <aside
          className="flex-shrink-0 sticky overflow-hidden"
          style={{
            width: readingMode ? 0 : SIDEBAR_RIGHT,
            opacity: readingMode ? 0 : 1,
            transition: sidebarTransition,
            background: 'var(--bg-sidebar)',
            borderLeft: readingMode ? 'none' : '1px solid var(--border)',
            top: 'calc(3.5rem + var(--sat))',
            height: 'calc(100vh - 3.5rem - var(--sat))',
          }}
          aria-hidden={readingMode}
        >
          {/* Sidebar header */}
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {t.nav.bookmarks}
            </p>
          </div>
          <div className="h-[calc(100%-3rem)] overflow-y-auto">
            <BookmarksList {...bookmarksListProps} />
          </div>
        </aside>
      </div>

      {/* ── Mobile: always full-width ──────────────────────────────────── */}
      <div className="md:hidden">
        <main
          className="px-6 py-8"
          id="main-content-mobile"
          style={{ paddingBottom: 'calc(2.5rem + var(--sab))' }}
        >
          <ChapterReader
            data={data}
            lang={lang}
            version={version}
            addBookmark={addBookmark}
            isBookmarked={isBookmarked}
          />
        </main>
      </div>

      {/* ── Sheet: ToC — mobile always; desktop only in reading mode ───── */}
      <Sheet
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        title={t.nav.tableOfContents}
        side="left"
      >
        <Sidebar {...sidebarProps} />
      </Sheet>

      {/* ── Sheet: Bookmarks — mobile always; desktop only in reading mode */}
      <Sheet
        open={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
        title={t.nav.bookmarks}
        side="right"
      >
        <BookmarksList {...bookmarksListProps} />
      </Sheet>
    </div>
  )
}
