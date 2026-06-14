'use client'

import React from 'react'
import type { Bookmark, BookmarkFolder } from '@/lib/storage'
import { BookmarkGroupByBook } from './BookmarkGroupByBook'
import { useI18n } from '@/lib/i18n/client'
import { useBibleIndex } from '@/hooks/useBibleIndex'

const BookmarkEmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-20">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
)

interface BookmarksListProps {
  lang: string
  versionSlug: string
  bookmarks: Bookmark[]
  folders: BookmarkFolder[]
  loading: boolean
  removeBookmark: (id: string) => Promise<void>
  updateBookmark: (id: string, patch: Partial<Omit<Bookmark, 'id' | 'createdAt'>>) => Promise<Bookmark>
  addFolder: (data: Omit<BookmarkFolder, 'id' | 'createdAt'>) => Promise<BookmarkFolder>
  updateFolder: (id: string, patch: Partial<Omit<BookmarkFolder, 'id' | 'createdAt'>>) => Promise<BookmarkFolder>
  removeFolder: (id: string) => Promise<void>
  moveBookmarkToFolder: (bookmarkId: string, folderId: string | undefined) => Promise<void>
}

export function BookmarksList({
  lang,
  versionSlug,
  bookmarks,
  folders,
  loading,
  removeBookmark,
  updateBookmark,
  addFolder,
  updateFolder,
  removeFolder,
  moveBookmarkToFolder,
}: BookmarksListProps) {
  const { t } = useI18n()
  const { books } = useBibleIndex(versionSlug)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--brand)' }}
        />
      </div>
    )
  }

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <BookmarkEmptyIcon />
        <p className="mt-4 font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
          {t.bookmarks.empty}
        </p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {t.bookmarks.emptyDescription}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 py-3 px-2">
      <BookmarkGroupByBook
        lang={lang}
        versionSlug={versionSlug}
        bookmarks={bookmarks}
        folders={folders}
        books={books}
        removeBookmark={removeBookmark}
        updateBookmark={updateBookmark}
        addFolder={addFolder}
        updateFolder={updateFolder}
        removeFolder={removeFolder}
        moveBookmarkToFolder={moveBookmarkToFolder}
      />
    </div>
  )
}
