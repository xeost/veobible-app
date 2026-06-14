'use client'

import React, { useState, useMemo } from 'react'
import type { Bookmark, BookmarkFolder } from '@/lib/storage'
import { BookmarksList } from './BookmarksList'
import { useI18n } from '@/lib/i18n/client'
import { Tooltip } from '@/components/ui/Tooltip'
import { ReadingRibbonBar } from './ReadingRibbonBar'

// ── Icons ─────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const ExpandIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
)

const BookmarkEmptyIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-20">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
)

// ── Props ──────────────────────────────────────────────────────────────

export interface BookmarksPanelProps {
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
  /**
   * 'compact' — sidebar (narrower, tighter padding)
   * 'full'    — modal dialog (wider, more breathing room)
   */
  variant?: 'compact' | 'full'
  /** Callback to open the modal dialog — shown as an icon button in the header */
  onOpenModal?: () => void
  /** Current book slug visible in the reader (for the ribbon bar) */
  currentBookSlug?: string
  /** Current chapter visible in the reader (for the ribbon bar) */
  currentChapter?: number
  /** Display name of the current book (for the ribbon bar) */
  currentBookName?: string
}

// ── Helpers — search matching ──────────────────────────────────────────

function normalise(str: string) {
  // Remove diacritics using NFD decomposition + ASCII-range filter (ES5-safe)
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function bookmarkMatchesQuery(bm: Bookmark, query: string): boolean {
  const q = normalise(query)
  if (!q) return true
  const fields = [
    bm.title ?? '',
    bm.note ?? '',
    bm.selectedText,
    bm.bookSlug.replace(/-/g, ' '),
    `${bm.chapter}:${bm.verseStart}`,
    String(bm.chapter),
  ]
  return fields.some((f) => normalise(f).includes(q))
}

// ── Component ──────────────────────────────────────────────────────────

export function BookmarksPanel({
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
  variant = 'compact',
  onOpenModal,
  currentBookSlug,
  currentChapter,
  currentBookName,
}: BookmarksPanelProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const isFull = variant === 'full'

  // Filter bookmarks by search query
  const filteredBookmarks = useMemo(
    () => bookmarks.filter((bm) => bookmarkMatchesQuery(bm, query)),
    [bookmarks, query],
  )

  const listProps = {
    lang,
    versionSlug,
    bookmarks: filteredBookmarks,
    folders,
    loading,
    removeBookmark,
    updateBookmark,
    addFolder,
    updateFolder,
    removeFolder,
    moveBookmarkToFolder,
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Section header ──────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <p
          className="flex-1 text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
        >
          {t.bookmarks.titleWithNotes}
        </p>

        {/* Open modal button — only shown in compact (sidebar) mode */}
        {!isFull && onOpenModal && (
          <Tooltip content={t.bookmarks.openModal} placement="top">
            <button
              onClick={onOpenModal}
              className="btn-icon p-1 flex-shrink-0"
              aria-label={t.bookmarks.openModal}
              style={{ color: 'var(--text-muted)' }}
              id="open-bookmarks-modal-btn"
            >
              <ExpandIcon />
            </button>
          </Tooltip>
        )}
      </div>

      {/* ── Search bar ──────────────────────────────────────────────── */}
      {!loading && bookmarks.length > 0 && (
        <div
          className="flex-shrink-0 px-3 py-2 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all duration-150"
            style={{
              background: 'var(--bg-page)',
              border: '1.5px solid var(--border-strong)',
            }}
            onFocusCapture={(e) => {
              ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--brand)'
            }}
            onBlurCapture={(e) => {
              ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'
            }}
          >
            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.bookmarks.searchPlaceholder}
              aria-label={t.bookmarks.searchPlaceholder}
              className="flex-1 bg-transparent outline-none text-xs min-w-0"
              style={{ color: 'var(--text-primary)' }}
              id="bookmarks-search-input"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="flex-shrink-0 btn-icon p-0.5"
                aria-label="Clear search"
                style={{ color: 'var(--text-muted)' }}
              >
                <XIcon />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {query && filteredBookmarks.length === 0 && !loading ? (
          // No search results
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <BookmarkEmptyIcon />
            <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t.bookmarks.noResults}
            </p>
            <button
              onClick={() => setQuery('')}
              className="mt-3 text-xs font-medium underline underline-offset-2"
              style={{ color: 'var(--brand)' }}
            >
              {t.bookmarks.deleteConfirmNo}
            </button>
          </div>
        ) : (
          <BookmarksList {...listProps} />
        )}
      </div>

      {/* ── Reading ribbon ────────────────────────────────────── */}
      <ReadingRibbonBar
        versionSlug={versionSlug}
        lang={lang}
        currentBookSlug={currentBookSlug}
        currentChapter={currentChapter}
        currentBookName={currentBookName}
        variant={variant}
      />
    </div>
  )
}
