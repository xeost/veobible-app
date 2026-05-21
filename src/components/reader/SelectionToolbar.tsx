'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { TextSelection } from '@/hooks/useTextSelection'
import { useI18n } from '@/lib/i18n/client'

interface SelectionToolbarProps {
  selection: TextSelection | null
  onBookmark: () => void
  onDismiss: () => void
}

const BookmarkPlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    <line x1="12" y1="7" x2="12" y2="13" />
    <line x1="9" y1="10" x2="15" y2="10" />
  </svg>
)

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
)

export function SelectionToolbar({ selection, onBookmark, onDismiss }: SelectionToolbarProps) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Compute position above selection
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!selection?.rect) return
    const rect = selection.rect
    const TOOLBAR_H = 48
    const TOOLBAR_W = 200

    setPos({
      top: rect.top + window.scrollY - TOOLBAR_H - 8,
      left: Math.max(8, rect.left + rect.width / 2 - TOOLBAR_W / 2),
    })
  }, [selection])

  if (!selection) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selection.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div
      ref={toolbarRef}
      className="selection-toolbar"
      style={{ top: pos.top, left: pos.left, pointerEvents: 'all' }}
    >
      {/* Bookmark button */}
      <button
        onClick={() => { onBookmark(); onDismiss() }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-100"
        style={{ color: 'var(--brand)', background: 'var(--brand-light)' }}
        id="selection-bookmark-btn"
      >
        <BookmarkPlusIcon />
        {t.reader.bookmark}
      </button>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="btn-icon p-2"
        aria-label={t.reader.copyText}
        id="selection-copy-btn"
      >
        {copied ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <CopyIcon />
        )}
      </button>

      {/* Arrow pointer */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
        style={{
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid var(--border)',
        }}
      />
    </div>
  )
}
