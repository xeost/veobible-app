'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ReaderHeader } from '@/components/layout/ReaderHeader'
import { Sidebar } from '@/components/layout/Sidebar'
import { ReaderSettingsPanel } from '@/components/reader/ReaderSettingsPanel'
import { BookmarksPanel } from '@/components/bookmarks/BookmarksPanel'
import { BookmarksModal } from '@/components/bookmarks/BookmarksModal'
import { Sheet } from '@/components/ui/Sheet'
import { useI18n } from '@/lib/i18n/client'
import { useBookmarks } from '@/hooks/useBookmarks'
import { ReaderContext } from '@/lib/context/ReaderContext'
import type { BookInfo } from '@/lib/bible/types'

interface ReaderLayoutClientProps {
  lang: string
  version: string
  versionName: string
  books: BookInfo[]
  children: React.ReactNode
}

export function ReaderLayoutClient({
  lang,
  version,
  versionName,
  books,
  children,
}: ReaderLayoutClientProps) {
  const { t } = useI18n()

  // Read the current book/chapter from the URL so the sidebar can highlight
  // the active item without requiring a full remount on navigation.
  const params = useParams<{ book?: string; chapter?: string }>()
  const currentBookSlug = params.book
  const currentChapterRaw = params.chapter ? parseInt(params.chapter, 10) : undefined
  const currentChapter =
    currentChapterRaw !== undefined && !isNaN(currentChapterRaw) ? currentChapterRaw : undefined

  // ── Reading mode ────────────────────────────────────────────────────────────
  const [readingMode, setReadingMode] = useState(false)

  // ── Typography settings panel ───────────────────────────────────────────────
  const [typographyOpen, setTypographyOpen] = useState(false)
  const typographyAnchorRef = useRef<HTMLButtonElement>(null)

  const handleOpenTypography = (anchor: HTMLButtonElement) => {
    ;(typographyAnchorRef as React.MutableRefObject<HTMLButtonElement>).current = anchor
    setTypographyOpen((o) => !o)
  }

  // Preserve page scroll position across reading-mode toggles so the content
  // column does not jump vertically when sidebars appear/disappear.
  const savedScrollY = useRef(0)

  const handleToggleReadingMode = () => {
    savedScrollY.current = window.scrollY
    setReadingMode((m) => !m)
  }

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY.current, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(raf)
  }, [readingMode])

  // Reset the reader active flag when leaving the reader layout.
  // We wrap this in a timeout so that transitions between books (which cause
  // layout unmounting/remounting) do not clear the flag during the mount
  // phase of the new layout.
  useEffect(() => {
    return () => {
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          ;(window as any).__is_reader_active = false
        }
      }, 0)
    }
  }, [])

  // ── Sheet / Modal open states ───────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bookmarksOpen, setBookmarksOpen] = useState(false)
  const [bookmarksModalOpen, setBookmarksModalOpen] = useState(false)

  // ── Bookmarks ───────────────────────────────────────────────────────────────
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

  const bookmarksPanelProps = {
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

  const sidebarProps = {
    lang,
    version,
    versionName,
    books,
    currentBookSlug,
    currentChapter,
  }

  // Sidebar widths
  const SIDEBAR_LEFT = '18rem'
  const SIDEBAR_RIGHT = '18rem'
  const sidebarTransition = 'width 0.25s ease, opacity 0.25s ease'

  return (
    <ReaderContext.Provider value={{ addBookmark, isBookmarked }}>
      <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <ReaderHeader
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

        {/* ── Desktop: unified 3-column layout ──────────────────────────────── */}
        <div className="hidden md:flex mx-auto w-full" style={{ maxWidth: '1600px' }}>
          {/* Left sidebar — Table of Contents */}
          <aside
            className="flex-shrink-0 sticky overflow-hidden sidebar"
            style={{
              width: readingMode ? 0 : SIDEBAR_LEFT,
              opacity: readingMode ? 0 : 1,
              transition: sidebarTransition,
              background: 'var(--bg-sidebar)',
              borderRight: readingMode ? 'none' : '1px solid var(--border)',
              top: 'calc(4rem + var(--sat))',
              height: 'calc(100vh - 4rem - var(--sat))',
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
            {children}
          </main>

          {/* Right sidebar — Bookmarks with Notes */}
          <aside
            className="flex-shrink-0 sticky overflow-hidden flex flex-col"
            style={{
              width: readingMode ? 0 : SIDEBAR_RIGHT,
              opacity: readingMode ? 0 : 1,
              transition: sidebarTransition,
              background: 'var(--bg-sidebar)',
              borderLeft: readingMode ? 'none' : '1px solid var(--border)',
              top: 'calc(4rem + var(--sat))',
              height: 'calc(100vh - 4rem - var(--sat))',
            }}
            aria-hidden={readingMode}
          >
            <BookmarksPanel
              {...bookmarksPanelProps}
              variant="compact"
              onOpenModal={() => setBookmarksModalOpen(true)}
            />
          </aside>
        </div>

        {/* ── Mobile: full-width ─────────────────────────────────────────────── */}
        <div className="md:hidden">
          <main
            className="px-6 py-8"
            id="main-content-mobile"
            style={{ paddingBottom: 'calc(2.5rem + var(--sab))' }}
          >
            {children}
          </main>
        </div>

        {/* ── Sheet: ToC — mobile always; desktop only in reading mode ────────── */}
        <Sheet
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          title={t.nav.tableOfContents}
          side="left"
        >
          <Sidebar {...sidebarProps} />
        </Sheet>

        {/* ── Sheet: Bookmarks — mobile always; desktop only in reading mode ─── */}
        <Sheet
          open={bookmarksOpen}
          onClose={() => setBookmarksOpen(false)}
          title={t.bookmarks.titleWithNotes}
          side="right"
        >
          {/* Use BookmarksPanel in full mode inside the Sheet for better UX */}
          <BookmarksPanel {...bookmarksPanelProps} variant="full" />
        </Sheet>

        {/* ── Modal dialog: Bookmarks with Notes ────────────────────────────── */}
        <BookmarksModal
          open={bookmarksModalOpen}
          onClose={() => setBookmarksModalOpen(false)}
          {...bookmarksPanelProps}
        />
      </div>
    </ReaderContext.Provider>
  )
}
