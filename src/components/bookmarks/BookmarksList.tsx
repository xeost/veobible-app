'use client'

import React from 'react'
import type { Bookmark } from '@/lib/storage'
import { BookmarkCard } from './BookmarkCard'
import { useI18n } from '@/lib/i18n/client'

const BookmarkEmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-20">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
)

interface BookmarksListProps {
  lang: string
  bookmarks: Bookmark[]
  loading: boolean
  removeBookmark: (id: string) => Promise<void>
}

export function BookmarksList({ lang, bookmarks, loading, removeBookmark }: BookmarksListProps) {
  const { t } = useI18n()

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
    <div className="flex flex-col gap-3 p-4">
      {bookmarks.map((bookmark) => (
        <BookmarkCard
          key={bookmark.id}
          bookmark={bookmark}
          lang={lang}
          onRemove={removeBookmark}
        />
      ))}
    </div>
  )
}
