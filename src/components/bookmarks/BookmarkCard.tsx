'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import type { Bookmark } from '@/lib/storage'
import { useI18n } from '@/lib/i18n/client'
import { toast } from '@/components/ui/Toast'
import { BookmarkTitleModal } from './BookmarkTitleModal'

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
)
const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)
const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

interface BookmarkCardProps {
  bookmark: Bookmark
  lang: string
  onRemove: (id: string) => Promise<void>
  onUpdateTitle: (id: string, title: string) => Promise<void>
}

export function BookmarkCard({ bookmark, lang, onRemove, onUpdateTitle }: BookmarkCardProps) {
  const { t } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)

  const href = `/${lang}/${bookmark.versionSlug}/${bookmark.bookSlug}/${bookmark.chapter}#verse-${bookmark.verseStart}`
  const date = new Date(bookmark.createdAt).toLocaleDateString()
  const location = `${bookmark.bookSlug.replace(/-/g, ' ')} ${bookmark.chapter}:${bookmark.verseStart}${bookmark.verseEnd !== bookmark.verseStart ? `–${bookmark.verseEnd}` : ''}`

  const handleRemove = async () => {
    try {
      await onRemove(bookmark.id)
      toast(t.reader.bookmarkRemoved)
    } catch {
      toast('Failed to delete bookmark', 'error')
    }
  }

  const handleSaveTitle = async (newTitle: string) => {
    setEditingTitle(false)
    try {
      await onUpdateTitle(bookmark.id, newTitle)
    } catch {
      toast('Failed to update title', 'error')
    }
  }

  return (
    <>
      {/* Edit-title modal */}
      <BookmarkTitleModal
        initialTitle={editingTitle ? (bookmark.title ?? '') : null}
        onSave={handleSaveTitle}
        onCancel={() => setEditingTitle(false)}
      />

      <div className="bookmark-card">
        {/* Location + date */}
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--brand)' }}
          >
            {bookmark.versionSlug.toUpperCase()} · {location}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{date}</span>
        </div>

        {/* User-defined title */}
        <div className="flex items-start gap-1 mb-2 min-h-[1.5rem]">
          {bookmark.title ? (
            <p className="flex-1 text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {bookmark.title}
            </p>
          ) : (
            <p className="flex-1 text-xs italic" style={{ color: 'var(--text-muted)' }}>
              {t.bookmarks.titleHint}…
            </p>
          )}
          <button
            onClick={() => setEditingTitle(true)}
            className="btn-icon p-1 flex-shrink-0"
            aria-label={t.bookmarks.editTitle}
            title={t.bookmarks.editTitle}
            style={{ color: 'var(--text-muted)' }}
            id={`bookmark-edit-title-${bookmark.id}`}
          >
            <PencilIcon />
          </button>
        </div>

        {/* Selected text preview */}
        <blockquote
          className="text-sm italic leading-relaxed mb-3 border-l-2 pl-3"
          style={{
            color: 'var(--text-primary)',
            borderColor: 'var(--brand)',
            fontFamily: 'var(--font-lora), Georgia, serif',
          }}
        >
          &ldquo;{bookmark.selectedText.length > 180
            ? bookmark.selectedText.slice(0, 180) + '…'
            : bookmark.selectedText}&rdquo;
        </blockquote>

        {/* Actions */}
        {!confirming ? (
          <div className="flex items-center gap-2">
            <Link
              href={href}
              className="text-xs font-medium flex items-center gap-1 transition-colors duration-100"
              style={{ color: 'var(--brand)' }}
            >
              <ExternalLinkIcon />
              {t.bookmarks.goTo}
            </Link>
            <button
              onClick={() => setConfirming(true)}
              className="ml-auto btn-icon p-1.5"
              aria-label={t.bookmarks.delete}
              style={{ color: 'var(--text-muted)' }}
            >
              <TrashIcon />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 animate-fade-in">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t.bookmarks.deleteConfirm}
            </span>
            <button
              onClick={handleRemove}
              className="text-xs font-semibold px-2 py-1 rounded-md"
              style={{ background: '#ef4444', color: 'white' }}
            >
              {t.bookmarks.deleteConfirmYes}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              {t.bookmarks.deleteConfirmNo}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
