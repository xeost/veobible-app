'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { Bookmark } from '@/lib/storage'
import { useI18n } from '@/lib/i18n/client'
import { toast } from '@/components/ui/Toast'
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
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const XIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
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
// Small note indicator icon for collapsed view
const NoteIndicatorIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="12" y2="17" />
  </svg>
)

// ── Inline edit field — shared for title (input) and note (textarea) ──

interface InlineEditFieldProps {
  id: string
  type: 'input' | 'textarea'
  value: string
  placeholder: string
  maxLength: number
  onConfirm: (value: string) => void
  onCancel: () => void
}

function InlineEditField({ id, type, value: initialValue, placeholder, maxLength, onConfirm, onCancel }: InlineEditFieldProps) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    // Focus and place cursor at end
    const el = inputRef.current
    if (el) {
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }, [])

  const sharedStyle: React.CSSProperties = {
    background: 'var(--bg-page)',
    border: '1.5px solid var(--brand)',
    color: 'var(--text-primary)',
    borderRadius: '8px',
    outline: 'none',
    fontSize: '0.75rem',
    lineHeight: '1.5',
    padding: '4px 8px',
    width: '100%',
    boxSizing: 'border-box',
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type === 'input') { e.preventDefault(); onConfirm(value.trim()) }
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div
      className="flex flex-col gap-1 w-full"
      // Prevent clicks inside the field from bubbling up to the card (which would toggle expand)
      onClick={(e) => e.stopPropagation()}
    >
      {type === 'input' ? (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          id={id}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          style={sharedStyle}
        />
      ) : (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={3}
          style={{ ...sharedStyle, resize: 'none' }}
        />
      )}
      <div className="flex items-center justify-between">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
          {value.length}/{maxLength}
        </span>
        <div className="flex items-center gap-1">
          {/* Cancel */}
          <button
            onMouseDown={(e) => { e.preventDefault(); onCancel() }}
            onTouchEnd={(e) => { e.preventDefault(); onCancel() }}
            className="btn-icon p-1 rounded-md"
            aria-label="Cancel"
            style={{ color: 'var(--text-muted)' }}
          >
            <XIcon />
          </button>
          {/* Confirm */}
          <button
            onMouseDown={(e) => { e.preventDefault(); onConfirm(value.trim()) }}
            onTouchEnd={(e) => { e.preventDefault(); onConfirm(value.trim()) }}
            className="btn-icon p-1 rounded-md"
            aria-label="Save"
            style={{ color: 'var(--brand)' }}
          >
            <CheckIcon />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────────────────

interface BookmarkCardProps {
  bookmark: Bookmark
  lang: string
  bookName?: string         // Display name of the book (e.g. "Genesis")
  onRemove: (id: string) => Promise<void>
  onUpdate: (id: string, patch: { title?: string; note?: string }) => Promise<void>
  /** Whether the card is currently expanded (controlled externally) */
  isExpanded: boolean
  onToggleExpand: () => void
  /** When true, shows a drag handle and sets the card as draggable */
  draggable?: boolean
  /**
   * Called on touchstart on the grip — enables touch drag-and-drop on mobile.
   * Signature mirrors useTouchDrag's onGripTouchStart.
   */
  onTouchDrop?: (
    e: React.TouchEvent,
    bookmarkId: string,
    bookSlug: string,
    cardEl: HTMLElement,
  ) => void
}

// ── Component ──────────────────────────────────────────────────────────

export function BookmarkCard({
  bookmark,
  lang,
  bookName,
  onRemove,
  onUpdate,
  isExpanded,
  onToggleExpand,
  draggable,
  onTouchDrop,
}: BookmarkCardProps) {
  const { t } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const href = `/${lang}/${bookmark.versionSlug}/${bookmark.bookSlug}/${bookmark.chapter}#verse-${bookmark.verseStart}`
  const date = new Date(bookmark.createdAt).toLocaleDateString()

  // Verse reference with optional book name prefix
  const bookPrefix = bookName ? `${bookName} ` : ''
  const verseRef = `${bookPrefix}${bookmark.chapter}:${bookmark.verseStart}${bookmark.verseEnd !== bookmark.verseStart ? `–${bookmark.verseEnd}` : ''}`

  // Summary label: custom title or first words of selected text
  const summaryLabel = bookmark.title
    ? bookmark.title
    : bookmark.selectedText.replace(/\s+/g, ' ').trim()

  // Close inline editors when card collapses
  useEffect(() => {
    if (!isExpanded) {
      setEditingTitle(false)
      setEditingNote(false)
    }
  }, [isExpanded])

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
      await onUpdate(bookmark.id, { title: newTitle || undefined })
    } catch {
      toast('Failed to update title', 'error')
    }
  }

  const handleSaveNote = async (newNote: string) => {
    setEditingNote(false)
    try {
      await onUpdate(bookmark.id, { note: newNote || undefined })
    } catch {
      toast('Failed to save note', 'error')
    }
  }

  // Clicking/tapping anywhere on the card that is not an interactive element toggles expand
  const handleCardClick = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement
    // Don't toggle if click was on a button, link, input, textarea, or their children
    if (target.closest('button, a, input, textarea, [role="button"]')) return
    onToggleExpand()
  }

  // Grip touch start — delegates to useTouchDrag (passed in as onTouchDrop)
  const handleGripTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation() // don't trigger card toggle
    if (onTouchDrop && cardRef.current) {
      onTouchDrop(e, bookmark.id, bookmark.bookSlug, cardRef.current)
    }
  }

  return (
    <div
      ref={cardRef}
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
      style={{ opacity: isDragging ? 0.45 : 1, transition: 'opacity 150ms', cursor: 'pointer' }}
      // Tap/click anywhere on the card to toggle expand
      onClick={handleCardClick}
    >
      {/* Grip handle (shown only when draggable) — handles both mouse and touch drag */}
      {draggable && (
        <div
          className="absolute left-0 top-0 bottom-0 flex items-center px-1.5 cursor-grab active:cursor-grabbing touch-none"
          style={{ color: 'var(--border-strong)' }}
          // Mouse drag is handled by the native draggable on the card div
          onMouseDown={(e) => e.stopPropagation()} // don't bubble to card click
          // Touch drag — custom implementation via useTouchDrag
          onTouchStart={handleGripTouchStart}
        >
          <GripIcon />
        </div>
      )}

      {/* ── COLLAPSED VIEW ───────────────────────────────────────── */}

      {/* Line 1: verse ref · go-to link · expand toggle */}
      <div className="flex items-center gap-1.5">
        <span
          className="flex-1 text-xs font-semibold tabular-nums"
          style={{ color: 'var(--brand)' }}
        >
          {verseRef}
        </span>

        {/* Go-to link — stopPropagation so it doesn't toggle expand */}
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

        {/* Chevron — visual cue only (card itself is the click target) */}
        <span
          className="flex items-center justify-center p-0.5 flex-shrink-0"
          style={{ color: 'var(--text-muted)', pointerEvents: 'none' }}
          aria-hidden
        >
          <ChevronDownIcon open={isExpanded} />
        </span>
      </div>

      {/* Line 2: title or first words — always one line, truncated */}
      <div
        className="text-xs truncate mt-0.5 w-full text-left"
        style={{ color: bookmark.title ? 'var(--text-primary)' : 'var(--text-muted)' }}
      >
        {bookmark.title
          ? bookmark.title
          : <span className="italic">{summaryLabel}</span>
        }
      </div>

      {/* Note indicator — icon + label when a note exists, collapsed view only */}
      {!isExpanded && bookmark.note && (
        <div
          className="flex items-center gap-1 mt-1 self-start"
          style={{ color: 'var(--brand)', opacity: 0.65 }}
          aria-label={t.bookmarks.hasNote}
        >
          <NoteIndicatorIcon />
          <span className="text-xs" style={{ fontSize: '0.65rem' }}>
            {t.bookmarks.hasNote}
          </span>
        </div>
      )}

      {/* ── EXPANDED DETAILS ─────────────────────────────────────── */}
      {isExpanded && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>

          {/* ── Title field ──────────────────────────────────────── */}
          <div className="mb-3">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-secondary)' }}>
                {t.reader.bookmarkTitleLabel}
              </span>
              {!editingTitle && (
                <Tooltip content={t.bookmarks.editTitle}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingNote(false); setEditingTitle(true) }}
                    className="btn-icon p-0.5 flex-shrink-0"
                    aria-label={t.bookmarks.editTitle}
                    id={`bookmark-edit-title-${bookmark.id}`}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <PencilIcon />
                  </button>
                </Tooltip>
              )}
            </div>

            {editingTitle ? (
              <InlineEditField
                id={`bookmark-title-inline-${bookmark.id}`}
                type="input"
                value={bookmark.title ?? ''}
                placeholder={t.reader.bookmarkTitlePlaceholder}
                maxLength={80}
                onConfirm={handleSaveTitle}
                onCancel={() => setEditingTitle(false)}
              />
            ) : (
              bookmark.title ? (
                <p
                  className="text-sm font-semibold leading-snug"
                  style={{ color: 'var(--text-primary)' }}
                  onClick={(e) => { e.stopPropagation(); setEditingNote(false); setEditingTitle(true) }}
                >
                  {bookmark.title}
                </p>
              ) : (
                <p
                  className="text-xs italic cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={(e) => { e.stopPropagation(); setEditingNote(false); setEditingTitle(true) }}
                >
                  {t.bookmarks.titleHint}…
                </p>
              )
            )}
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

          {/* ── Note field ───────────────────────────────────────── */}
          <div className="mb-3">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-secondary)' }}>
                {t.bookmarks.noteLabel}
              </span>
              {!editingNote && (
                <Tooltip content={t.bookmarks.editNote}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingTitle(false); setEditingNote(true) }}
                    className="btn-icon p-0.5 flex-shrink-0"
                    aria-label={t.bookmarks.editNote}
                    id={`bookmark-edit-note-${bookmark.id}`}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <PencilIcon />
                  </button>
                </Tooltip>
              )}
            </div>

            {editingNote ? (
              <InlineEditField
                id={`bookmark-note-inline-${bookmark.id}`}
                type="textarea"
                value={bookmark.note ?? ''}
                placeholder={t.bookmarks.notePlaceholder}
                maxLength={1000}
                onConfirm={handleSaveNote}
                onCancel={() => setEditingNote(false)}
              />
            ) : (
              bookmark.note ? (
                <p
                  className="text-xs leading-relaxed whitespace-pre-wrap cursor-pointer"
                  style={{ color: 'var(--text-primary)' }}
                  onClick={(e) => { e.stopPropagation(); setEditingTitle(false); setEditingNote(true) }}
                >
                  {bookmark.note}
                </p>
              ) : (
                <p
                  className="text-xs italic cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={(e) => { e.stopPropagation(); setEditingTitle(false); setEditingNote(true) }}
                >
                  {t.bookmarks.notePlaceholder}
                </p>
              )
            )}
          </div>

          {/* Date + actions row */}
          {!confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{date}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirming(true) }}
                className="ml-auto btn-icon p-1"
                aria-label={t.bookmarks.delete}
                style={{ color: 'var(--text-muted)' }}
              >
                <TrashIcon />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 animate-fade-in" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t.bookmarks.deleteConfirm}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove() }}
                className="text-xs font-semibold px-2 py-0.5 rounded-md"
                style={{ background: '#ef4444', color: 'white' }}
              >
                {t.bookmarks.deleteConfirmYes}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirming(false) }}
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
  )
}
