'use client'

import React, { useEffect } from 'react'
import { BookmarksPanel, type BookmarksPanelProps } from './BookmarksPanel'
import { useI18n } from '@/lib/i18n/client'

// ── Icons ──────────────────────────────────────────────────────────────

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

const BookmarksNoteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    <line x1="9" y1="11" x2="15" y2="11" />
    <line x1="9" y1="15" x2="13" y2="15" />
  </svg>
)

// ── Props ──────────────────────────────────────────────────────────────

interface BookmarksModalProps extends Omit<BookmarksPanelProps, 'variant' | 'onOpenModal'> {
  open: boolean
  onClose: () => void
}

// ── Component ──────────────────────────────────────────────────────────

export function BookmarksModal({ open, onClose, ...panelProps }: BookmarksModalProps) {
  const { t } = useI18n()

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll while modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8 animate-fade-in"
      style={{ background: 'var(--bg-overlay)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={t.bookmarks.titleWithNotes}
    >
      {/* Dialog panel */}
      <div
        className="relative w-full flex flex-col overflow-hidden rounded-2xl animate-fade-in"
        style={{
          maxWidth: '720px',
          height: 'min(85vh, 860px)',
          background: 'var(--bg-sidebar)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal title bar */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <span style={{ color: 'var(--brand)' }}>
            <BookmarksNoteIcon />
          </span>
          <h2
            className="flex-1 font-semibold text-base"
            style={{ color: 'var(--text-primary)' }}
          >
            {t.bookmarks.titleWithNotes}
          </h2>
          <button
            onClick={onClose}
            className="btn-icon p-1"
            aria-label={t.bookmarks.closeModal}
            id="bookmarks-modal-close-btn"
            style={{ color: 'var(--text-muted)' }}
          >
            <XIcon />
          </button>
        </div>

        {/* Shared panel — full variant */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <BookmarksPanel {...panelProps} variant="full" />
        </div>
      </div>
    </div>
  )
}
