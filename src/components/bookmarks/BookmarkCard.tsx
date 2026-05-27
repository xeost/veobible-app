'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import type { Bookmark } from '@/lib/storage'
import { useI18n } from '@/lib/i18n/client'
import { toast } from '@/components/ui/Toast'
import { BookmarkTitleModal } from './BookmarkTitleModal'
import { Tooltip } from '@/components/ui/Tooltip'

// ── Icons ─────────────────────────────────────────────────────────────

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
)
const ExternalLinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)
const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)
const ChevronDownIcon = ({ open }: { open: boolean }) => (
  <svg
    width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)
// Six-dot grip handle for drag & drop
const GripIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
  </svg>
)

// ── Props ──────────────────────────────────────────────────────────────

interface BookmarkCardProps {
  bookmark: Bookmark
  lang: string
  bookName?: string         // Display name of the book (e.g. "Genesis")
  onRemove: (id: string) => Promise<void>
  onUpdateTitle: (id: string, title: string) => Promise<void>
  /** Whether the card is currently expanded (controlled externally) */
  isExpanded: boolean
  onToggleExpand: () => void
  /** When true, shows a drag handle and sets the card as draggable */
  draggable?: boolean
}

// ── Component ──────────────────────────────────────────────────────────

export function BookmarkCard({
  bookmark,
  lang,
  bookName,
  onRemove,
  onUpdateTitle,
  isExpanded,
  onToggleExpand,
  draggable,
}: BookmarkCardProps) {
  const { t } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const href = `/${lang}/${bookmark.versionSlug}/${bookmark.bookSlug}/${bookmark.chapter}#verse-${bookmark.verseStart}`
  const date = new Date(bookmark.createdAt).toLocaleDateString()

  // Verse reference with optional book name prefix
  const bookPrefix = bookName ? `${bookName} ` : ''
  const verseRef = `${bookPrefix}${bookmark.chapter}:${bookmark.verseStart}${bookmark.verseEnd !== bookmark.verseStart ? `–${bookmark.verseEnd}` : ''}`

  // Summary label: custom title or first words of selected text
  const summaryLabel = bookmark.title
    ? bookmark.title
    : bookmark.selectedText.replace(/\s+/g, ' ').trim()

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

      <div
        className="bookmark-card"
        draggable={draggable}
        onDragStart={draggable ? (e) => {
          e.dataTransfer.setData('bookmarkId', bookmark.id)
          // Also encode the book as a custom type — readable via types[] during dragover
          e.dataTransfer.setData(`application/x-bookmark-book-${bookmark.bookSlug.toLowerCase()}`, '1')
          e.dataTransfer.effectAllowed = 'move'
          setIsDragging(true)
        } : undefined}
        onDragEnd={draggable ? () => setIsDragging(false) : undefined}
        style={{ opacity: isDragging ? 0.45 : 1, transition: 'opacity 150ms' }}
      >
        {/* Grip handle (shown only when draggable) */}
        {draggable && (
          <div
            className="absolute left-0 top-0 bottom-0 flex items-center px-1.5 cursor-grab active:cursor-grabbing"
            style={{ color: 'var(--border-strong)' }}
          >
            <GripIcon />
          </div>
        )}

        {/* ── COLLAPSED VIEW — 2 lines ─────────────────────────────── */}

        {/* Line 1: verse ref · go-to link · expand toggle */}
        <div className="flex items-center gap-1.5">
          <span
            className="flex-1 text-xs font-semibold tabular-nums"
            style={{ color: 'var(--brand)' }}
          >
            {verseRef}
          </span>

          {/* Go-to link (always visible) */}
          <Tooltip content={t.bookmarks.goTo}>
            <Link
              href={href}
              className="btn-icon p-0.5 flex-shrink-0"
              aria-label={t.bookmarks.goTo}
              style={{ color: 'var(--text-muted)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLinkIcon />
            </Link>
          </Tooltip>

          {/* Expand / collapse toggle */}
          <button
            onClick={onToggleExpand}
            className="btn-icon p-0.5 flex-shrink-0"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronDownIcon open={isExpanded} />
          </button>
        </div>

        {/* Line 2: title or first words — always one line, truncated */}
        <Tooltip content={summaryLabel} className="block w-full">
          <div
            className="text-xs truncate mt-0.5 w-full text-left"
            style={{ color: bookmark.title ? 'var(--text-primary)' : 'var(--text-muted)' }}
          >
            {bookmark.title
              ? bookmark.title
              : <span className="italic">{summaryLabel}</span>
            }
          </div>
        </Tooltip>

        {/* ── EXPANDED DETAILS (shown only when expanded) ───────────── */}
        {isExpanded && (
          <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>

            {/* User-defined title with edit button */}
            <div className="flex items-start gap-1 mb-2">
              {bookmark.title ? (
                <p className="flex-1 text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {bookmark.title}
                </p>
              ) : (
                <p className="flex-1 text-xs italic" style={{ color: 'var(--text-muted)' }}>
                  {t.bookmarks.titleHint}…
                </p>
              )}
              <Tooltip content={t.bookmarks.editTitle}>
                <button
                  onClick={() => setEditingTitle(true)}
                  className="btn-icon p-1 flex-shrink-0"
                  aria-label={t.bookmarks.editTitle}
                  style={{ color: 'var(--text-muted)' }}
                  id={`bookmark-edit-title-${bookmark.id}`}
                >
                  <PencilIcon />
                </button>
              </Tooltip>
            </div>

            {/* Selected text */}
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

            {/* Date + actions row */}
            {!confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{date}</span>
                <button
                  onClick={() => setConfirming(true)}
                  className="ml-auto btn-icon p-1"
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
                  className="text-xs font-semibold px-2 py-0.5 rounded-md"
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
        )}
      </div>
    </>
  )
}
