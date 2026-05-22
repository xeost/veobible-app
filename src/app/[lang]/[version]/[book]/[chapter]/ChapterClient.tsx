'use client'

import React, { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { ChapterReader } from '@/components/reader/ChapterReader'
import { BookmarksList } from '@/components/bookmarks/BookmarksList'
import { Sheet } from '@/components/ui/Sheet'
import { useI18n } from '@/lib/i18n/client'
import type { ChapterData, BookInfo } from '@/lib/bible/types'

interface ChapterClientProps {
  data: ChapterData
  books: BookInfo[]
  lang: string
  version: string
}

export function ChapterClient({ data, books, lang, version }: ChapterClientProps) {
  const { t } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bookmarksOpen, setBookmarksOpen] = useState(false)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      {/* Header */}
      <Header
        currentLang={lang}
        currentVersion={version}
        onOpenSidebar={() => setSidebarOpen(true)}
        onOpenBookmarks={() => setBookmarksOpen(true)}
      />

      {/* Desktop: split layout */}
      <div className="flex max-w-7xl mx-auto">
        {/* Desktop sidebar */}
        <aside
          className="hidden md:block w-64 flex-shrink-0 sticky overflow-hidden sidebar"
          style={{
            background: 'var(--bg-sidebar)',
            top: 'calc(3.5rem + var(--sat))',
            height: 'calc(100vh - 3.5rem - var(--sat))',
          }}
        >
          <Sidebar
            lang={lang}
            version={version}
            versionName={data.version.name}
            books={books}
            currentBookSlug={data.book.slug}
            currentChapter={data.chapterNum}
          />
        </aside>

        {/* Main content */}
        <main
          className="flex-1 min-w-0 px-4 md:px-8 py-10"
          id="main-content"
          style={{ paddingBottom: 'calc(2.5rem + var(--sab))' }}
        >
          <ChapterReader data={data} lang={lang} version={version} />
        </main>
      </div>

      {/* Mobile sidebar sheet */}
      <Sheet
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        title={t.nav.tableOfContents}
        side="left"
      >
        <Sidebar
          lang={lang}
          version={version}
          books={books}
          currentBookSlug={data.book.slug}
          currentChapter={data.chapterNum}
        />
      </Sheet>

      {/* Bookmarks sheet */}
      <Sheet
        open={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
        title={t.nav.bookmarks}
        side="right"
      >
        <BookmarksList lang={lang} />
      </Sheet>
    </div>
  )
}
