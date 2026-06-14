'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/client'

interface BookmarkTitleModalProps {
  /** null = closed; string = initial title value ('' for new) */
  initialTitle: string | null
  /** null = closed; string = initial note value ('' for new) */
  initialNote: string | null
  onSave: (title: string, note: string) => void
  onCancel: () => void
}

const BookmarkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
)

const PencilIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

export function BookmarkTitleModal({ initialTitle, initialNote, onSave, onCancel }: BookmarkTitleModalProps) {
  const { t } = useI18n()
  const [title, setTitle] = useState(initialTitle ?? '')
  const [note, setNote] = useState(initialNote ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const isEditing = (initialTitle ?? '').length > 0

  // Sync values when modal re-opens for a different bookmark
  useEffect(() => {
    setTitle(initialTitle ?? '')
    setNote(initialNote ?? '')
  }, [initialTitle, initialNote])

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(timer)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  const handleSave = () => onSave(title.trim(), note.trim())

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSave()
  }

  if (initialTitle === null) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: 'var(--bg-overlay)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? t.bookmarks.editTitle : t.reader.bookmarkTitleLabel}
    >
      {/* Panel */}
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 animate-fade-in"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <span
            className="flex items-center justify-center w-9 h-9 rounded-xl"
            style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
          >
            {isEditing ? <PencilIcon /> : <BookmarkIcon />}
          </span>
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {isEditing ? t.bookmarks.editTitle : t.bookmarks.addTitle}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t.bookmarks.titleHint}
            </p>
          </div>
        </div>

        {/* Title input */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="bookmark-title-modal-input"
            className="text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t.reader.bookmarkTitleLabel}
          </label>
          <input
            ref={inputRef}
            id="bookmark-title-modal-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.reader.bookmarkTitlePlaceholder}
            maxLength={80}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-150"
            style={{
              background: 'var(--bg-page)',
              border: '1.5px solid var(--border-strong)',
              color: 'var(--text-primary)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
          />
          <span className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>
            {title.length}/80
          </span>
        </div>

        {/* Note textarea */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="bookmark-note-modal-input"
            className="text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t.bookmarks.noteLabel}
          </label>
          <textarea
            id="bookmark-note-modal-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.bookmarks.notePlaceholder}
            maxLength={1000}
            rows={4}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none transition-all duration-150"
            style={{
              background: 'var(--bg-page)',
              border: '1.5px solid var(--border-strong)',
              color: 'var(--text-primary)',
              lineHeight: '1.6',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
          />
          <span className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>
            {note.length}/1000
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-all duration-150"
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
            }}
            id="bookmark-modal-cancel-btn"
          >
            {t.reader.bookmarkCancel}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-150"
            style={{ background: 'var(--brand)', color: 'var(--text-inverse)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-dark)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand)' }}
            id="bookmark-modal-save-btn"
          >
            {t.reader.bookmarkSave}
          </button>
        </div>
      </div>
    </div>
  )
}
