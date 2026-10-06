'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/lib/i18n/client'
import type { OfflineStatus, DownloadProgress } from '@/hooks/useOfflineVersion'

// ── Icons ─────────────────────────────────────────────────────────────────────

const CloudDownloadIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="8 17 12 21 16 17" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
  </svg>
)

const CloudCheckIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
    <polyline points="8 17 11 20 16 15" />
  </svg>
)

const CloudPartialIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
    <line x1="12" y1="13" x2="12" y2="17" />
    <line x1="12" y1="19" x2="12.01" y2="19" strokeWidth="2.5" />
  </svg>
)

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
)

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const XIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// ── Progress ring ─────────────────────────────────────────────────────────────

function ProgressRing({ progress, size = 17 }: { progress: number; size?: number }) {
  const r = (size - 2.5) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(1, progress)))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      {/* Background ring */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-strong)" strokeWidth="2" />
      {/* Progress ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
      />
    </svg>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface OfflineVersionButtonProps {
  status: OfflineStatus
  progress: DownloadProgress | null
  isDownloading: boolean
  totalChapters: number
  versionName: string
  onDownload: () => void
  onCancel: () => void
  onDelete: () => void
  /** Called whenever the dropdown opens (true) or closes (false) */
  onOpenChange?: (open: boolean) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OfflineVersionButton({
  status,
  progress,
  isDownloading,
  totalChapters,
  versionName,
  onDownload,
  onCancel,
  onDelete,
  onOpenChange,
}: OfflineVersionButtonProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [panelCoords, setPanelCoords] = useState<{ top: number; left: number } | null>(null)
  // Portal target — set to document.body on mount (client-only)
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)
  useEffect(() => { setPortalTarget(document.body) }, [])

  // ── Positioning ───────────────────────────────────────────────────────────
  // Compute panel coordinates synchronously when the button is clicked so the
  // panel renders in the correct position from the very first frame.
  const computeCoords = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const panelW = 280
    let left = rect.left + rect.width / 2 - panelW / 2
    const margin = 12
    left = Math.max(margin, Math.min(left, window.innerWidth - panelW - margin))
    setPanelCoords({ top: rect.bottom + 6, left })
  }, [])

  const handleToggle = useCallback(() => {
    const next = !open
    if (next) {
      // Compute before opening so first render has correct coords
      computeCoords()
    }
    setOpen(next)
    setConfirmDelete(false)
    onOpenChange?.(next)
  }, [open, computeCoords, onOpenChange])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setConfirmDelete(false)
        onOpenChange?.(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setConfirmDelete(false)
        onOpenChange?.(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onOpenChange])

  // Reset confirm-delete when panel closes
  useEffect(() => {
    if (!open) setConfirmDelete(false)
  }, [open])

  // ── Button icon & color based on status ──────────────────────────────────
  const progressFraction = progress ? progress.done / progress.total : 0

  const iconColor: React.CSSProperties = (() => {
    if (status === 'available') return { color: 'var(--brand)' }
    if (status === 'partial') return { color: 'var(--text-muted)' }
    if (isDownloading) return { color: 'var(--brand)' }
    return {}
  })()

  const activeStyle: React.CSSProperties =
    status === 'available' ? { background: 'var(--brand-light)', color: 'var(--brand)' } : {}

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef}>
      {/* Trigger button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="btn-icon flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200"
        aria-label={t.offline.open}
        id="offline-version-btn"
        style={{ ...iconColor, ...(open ? activeStyle : {}) }}
      >
        {isDownloading ? (
          <ProgressRing progress={progressFraction} />
        ) : status === 'available' ? (
          <CloudCheckIcon />
        ) : status === 'partial' ? (
          <CloudPartialIcon />
        ) : (
          <CloudDownloadIcon />
        )}
      </button>

      {/* Dropdown panel — portalled into document.body to escape CSS transform ancestors */}
      {open && panelCoords && portalTarget && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t.offline.title}
          className="fixed z-50 rounded-2xl shadow-2xl animate-fade-in"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            width: '17.5rem',
            top: `${panelCoords.top}px`,
            left: `${panelCoords.left}px`,
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span style={{ color: status === 'available' ? 'var(--brand)' : 'var(--text-muted)' }}>
              {status === 'available' ? <CloudCheckIcon /> : <CloudDownloadIcon />}
            </span>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t.offline.title}
            </p>
          </div>

          {/* Panel body */}
          <div className="px-4 py-4 space-y-4">
            {/* Version name */}
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {versionName}
            </p>

            {/* Description */}
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {isDownloading
                ? t.offline.descDownloading
                : status === 'available'
                  ? t.offline.descAvailable
                  : status === 'partial'
                    ? t.offline.descPartial
                    : t.offline.descNotCached}
            </p>

            {/* Progress bar (shown while downloading) */}
            {isDownloading && progress && (
              <div className="space-y-1.5">
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'var(--border-strong)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.round(progressFraction * 100)}%`,
                      background: 'var(--brand)',
                    }}
                  />
                </div>
                <p className="text-[10px] text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {t.offline.progress(progress.done, progress.total)}
                </p>
              </div>
            )}

            {/* Chapter count info (not downloading) */}
            {!isDownloading && status !== 'checking' && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {t.offline.chaptersInfo(totalChapters)}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              {isDownloading ? (
                /* Cancel button */
                <button
                  onClick={onCancel}
                  id="offline-cancel-btn"
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
                  style={{
                    background: 'color-mix(in srgb, var(--border-strong) 50%, transparent)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <XIcon />
                  {t.offline.cancel}
                </button>
              ) : status === 'available' ? (
                /* Delete section */
                confirmDelete ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-center" style={{ color: 'var(--text-secondary)' }}>
                      {t.offline.deleteConfirm}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setConfirmDelete(false) }}
                        className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
                        style={{
                          background: 'var(--bg-page)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {t.offline.cancelDelete}
                      </button>
                      <button
                        onClick={() => { onDelete(); setOpen(false) }}
                        id="offline-delete-confirm-btn"
                        className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
                        style={{
                          background: 'color-mix(in srgb, #ef4444 15%, transparent)',
                          color: '#ef4444',
                          border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
                        }}
                      >
                        {t.offline.deleteConfirmBtn}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    id="offline-delete-btn"
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150"
                    style={{
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <TrashIcon />
                    {t.offline.delete}
                  </button>
                )
              ) : (
                /* Download button */
                <button
                  onClick={() => { onDownload(); }}
                  id="offline-download-btn"
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'var(--brand)',
                    color: 'white',
                    border: '1px solid transparent',
                    boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
                  }}
                >
                  <DownloadIcon />
                  {t.offline.download}
                </button>
              )}
            </div>
          </div>
        </div>,
        portalTarget,
      )}
    </div>
  )
}
