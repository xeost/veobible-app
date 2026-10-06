'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useReadingRibbon } from '@/hooks/useReadingRibbon'
import { useBibleIndex } from '@/hooks/useBibleIndex'
import { useI18n } from '@/lib/i18n/client'
import { toast } from '@/components/ui/Toast'
import { Tooltip } from '@/components/ui/Tooltip'

// ── Icons ────────────────────────────────────────────────────────────

const RibbonIcon = () => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
  >
    {/* Bookmark / ribbon shape */}
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
)

const GoIcon = () => (
  <svg
    width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)

const RefreshIcon = () => (
  <svg
    width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  >
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
  </svg>
)

const TrashIcon = () => (
  <svg
    width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
)

const PlusIcon = () => (
  <svg
    width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

// ── Props ─────────────────────────────────────────────────────────────

export interface ReadingRibbonBarProps {
  versionSlug: string
  lang: string
  /** Current book slug visible in the reader (from URL params) */
  currentBookSlug?: string
  /** Current chapter number visible in the reader (from URL params) */
  currentChapter?: number
  /** Display name of the current book (e.g. "Genesis") */
  currentBookName?: string
  /** 'compact' = sidebar, 'full' = modal — controls single-row vs stacked layout */
  variant?: 'compact' | 'full'
}

// ── Component ─────────────────────────────────────────────────────────

export function ReadingRibbonBar({
  versionSlug,
  lang,
  currentBookSlug,
  currentChapter,
  currentBookName,
  variant = 'compact',
}: ReadingRibbonBarProps) {
  const { t } = useI18n()
  const { ribbon, loading, setRibbon, clearRibbon } = useReadingRibbon(versionSlug)
  const { books } = useBibleIndex(versionSlug)

  const getBookName = (bookSlug: string) => {
    if (bookSlug === currentBookSlug && currentBookName) {
      return currentBookName
    }
    const foundBook = books.find((b) => b.slug === bookSlug)
    if (foundBook) return foundBook.name
    // Capitalize slug fallback
    const formatted = bookSlug.replace(/-/g, ' ')
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  }
  const [confirmingClear, setConfirmingClear] = useState(false)

  const canSet = Boolean(currentBookSlug && currentChapter)

  // href to navigate to the ribbon position
  const ribbonHref = ribbon
    ? `/${lang}/${versionSlug}/${ribbon.bookSlug}/${ribbon.chapter}`
    : null

  const handleSet = async () => {
    if (!currentBookSlug || !currentChapter) return
    try {
      await setRibbon(currentBookSlug, currentChapter)
      toast(t.ribbon.setConfirm)
    } catch {
      toast('Failed to set ribbon', 'error')
    }
  }

  const handleClear = async () => {
    try {
      await clearRibbon()
      setConfirmingClear(false)
      toast(t.ribbon.clearConfirm)
    } catch {
      toast('Failed to remove ribbon', 'error')
    }
  }

  if (loading) return null

  return (
    <div
      className="flex-shrink-0 border-t"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Section header */}
      <div
        className="flex items-center gap-2 px-4 pt-3 pb-2"
      >
        <span style={{ color: 'var(--brand)', opacity: 0.85, flexShrink: 0 }}>
          <RibbonIcon />
        </span>
        <p
          className="flex-1 text-xs font-semibold uppercase tracking-widest truncate"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
        >
          {t.ribbon.label}
        </p>
      </div>

      {/* Body */}
      <div className="px-3 pb-3">
        {ribbon ? (
          // ── Ribbon set ───────────────────────────────────────────
          <div
            className="rounded-xl px-3 py-2.5"
            style={{
              background: 'var(--brand-light)',
              border: '1.5px solid var(--brand)',
            }}
          >
            {!confirmingClear ? (
              // Single row in full mode; stacked in compact mode
              variant === 'full' ? (
                // ── Full (modal): everything in one row ──────────────
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--brand)', flexShrink: 0 }}>
                    <RibbonIcon />
                  </span>
                  <span
                    className="flex-1 text-xs font-semibold truncate"
                    style={{ color: 'var(--brand)' }}
                  >
                    {`${getBookName(ribbon.bookSlug)} ${ribbon.chapter}`}
                  </span>
                  {/* Actions inline */}
                  {ribbonHref && (
                    <Tooltip content={t.ribbon.go} placement="top">
                      <Link
                        href={ribbonHref}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0 transition-all duration-150"
                        style={{ background: 'var(--brand)', color: 'white' }}
                      >
                        <GoIcon />
                        {t.ribbon.go}
                      </Link>
                    </Tooltip>
                  )}
                  {canSet && (
                    <Tooltip content={t.ribbon.update} placement="top">
                      <button
                        onClick={handleSet}
                        className="btn-icon p-1.5 flex-shrink-0"
                        aria-label={t.ribbon.update}
                        style={{ color: 'var(--brand)' }}
                      >
                        <RefreshIcon />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip content={t.ribbon.clear} placement="top">
                    <button
                      onClick={() => setConfirmingClear(true)}
                      className="btn-icon p-1.5 flex-shrink-0"
                      aria-label={t.ribbon.clear}
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <TrashIcon />
                    </button>
                  </Tooltip>
                </div>
              ) : (
                // ── Compact (sidebar): location row + actions row ────
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ color: 'var(--brand)', flexShrink: 0 }}>
                      <RibbonIcon />
                    </span>
                    <span
                      className="flex-1 text-xs font-semibold truncate"
                      style={{ color: 'var(--brand)' }}
                    >
                      {`${getBookName(ribbon.bookSlug)} ${ribbon.chapter}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {ribbonHref && (
                      <Tooltip content={t.ribbon.go} placement="top">
                        <Link
                          href={ribbonHref}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold flex-1 justify-center transition-all duration-150"
                          style={{ background: 'var(--brand)', color: 'white' }}
                        >
                          <GoIcon />
                          {t.ribbon.go}
                        </Link>
                      </Tooltip>
                    )}
                    {canSet && (
                      <Tooltip content={t.ribbon.update} placement="top">
                        <button
                          onClick={handleSet}
                          className="btn-icon p-1.5 flex-shrink-0"
                          aria-label={t.ribbon.update}
                          style={{ color: 'var(--brand)' }}
                        >
                          <RefreshIcon />
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip content={t.ribbon.clear} placement="top">
                      <button
                        onClick={() => setConfirmingClear(true)}
                        className="btn-icon p-1.5 flex-shrink-0"
                        aria-label={t.ribbon.clear}
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <TrashIcon />
                      </button>
                    </Tooltip>
                  </div>
                </>
              )
            ) : (
              // Confirm clear
              <div className="flex items-center gap-2 animate-fade-in">
                <button
                  onClick={handleClear}
                  className="text-xs font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: '#ef4444', color: 'white' }}
                >
                  {t.bookmarks.deleteConfirmYes}
                </button>
                <button
                  onClick={() => setConfirmingClear(false)}
                  className="text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {t.bookmarks.deleteConfirmNo}
                </button>
              </div>
            )}
          </div>
        ) : (
          // ── No ribbon set ─────────────────────────────────────────
          <div>
            {canSet ? (
              <button
                onClick={handleSet}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150"
                style={{
                  border: '1.5px dashed var(--brand)',
                  color: 'var(--brand)',
                  background: 'transparent',
                  opacity: 0.75,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.75' }}
              >
                <PlusIcon />
                {t.ribbon.set}
              </button>
            ) : (
              <p
                className="text-xs italic text-center py-2"
                style={{ color: 'var(--text-muted)' }}
              >
                {t.ribbon.none}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
