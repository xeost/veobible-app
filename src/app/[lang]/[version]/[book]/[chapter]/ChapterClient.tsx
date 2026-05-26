'use client'

import React, { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { ChapterReader } from '@/components/reader/ChapterReader'
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

  // Reading mode: sidebars collapse into sheets, content takes full width
  const [readingMode, setReadingMode] = useState(false)

  // Sheet open states — used in reading mode OR on mobile
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

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Header
        currentLang={lang}
        currentVersion={version}
        onOpenSidebar={() => setSidebarOpen(true)}
        onOpenBookmarks={() => setBookmarksOpen(true)}
        isReadingMode={readingMode}
        onToggleReadingMode={() => setReadingMode((m) => !m)}
      />

      {/* ── Desktop: 3-column layout (normal mode) ─────────────────────── */}
      {!readingMode && (
        <div
          className="hidden md:flex mx-auto w-full"
          style={{ maxWidth: '1600px' }}
        >
          {/* Left sidebar — Table of Contents */}
          <aside
            className="w-60 xl:w-64 flex-shrink-0 sticky overflow-hidden sidebar"
            style={{
              background: 'var(--bg-sidebar)',
              top: 'calc(3.5rem + var(--sat))',
              height: 'calc(100vh - 3.5rem - var(--sat))',
            }}
          >
            <Sidebar {...sidebarProps} />
          </aside>

          {/* Reading column */}
          <main
            className="flex-1 min-w-0 px-6 xl:px-10 py-10"
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
            className="w-60 xl:w-72 flex-shrink-0 sticky overflow-hidden"
            style={{
              background: 'var(--bg-sidebar)',
              borderLeft: '1px solid var(--border)',
              top: 'calc(3.5rem + var(--sat))',
              height: 'calc(100vh - 3.5rem - var(--sat))',
            }}
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
      )}

      {/* ── Desktop: reading mode — full-width centred column ─────────── */}
      {readingMode && (
        <div className="hidden md:flex justify-center px-4">
          <main
            className="w-full max-w-2xl py-10"
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
        </div>
      )}

      {/* ── Mobile: always full-width ──────────────────────────────────── */}
      <div className="md:hidden">
        <main
          className="px-4 py-8"
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

      {/* ── Sheet: ToC — always available on mobile; reading mode on desktop */}
      <Sheet
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        title={t.nav.tableOfContents}
        side="left"
      >
        <Sidebar {...sidebarProps} />
      </Sheet>

      {/* ── Sheet: Bookmarks — reading mode (both), mobile always */}
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
