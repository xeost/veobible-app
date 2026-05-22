'use client'

import React, { useEffect, useRef } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  side?: 'left' | 'right' | 'bottom'
  children: React.ReactNode
}

export function Sheet({ open, onClose, title, side = 'right', children }: SheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const sideStyles: Record<string, React.CSSProperties> = {
    left: {
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border)',
      paddingTop: 'var(--sat)',
      paddingLeft: 'var(--sal)',
    },
    right: {
      background: 'var(--bg-sidebar)',
      borderLeft: '1px solid var(--border)',
      paddingTop: 'var(--sat)',
      paddingRight: 'var(--sar)',
    },
    bottom: {
      background: 'var(--bg-sidebar)',
      paddingBottom: 'var(--sab)',
      paddingLeft: 'var(--sal)',
      paddingRight: 'var(--sar)',
    },
  }

  const slideClasses = {
    left: open ? 'translate-x-0' : '-translate-x-full',
    right: open ? 'translate-x-0' : 'translate-x-full',
    bottom: open ? 'translate-y-0' : 'translate-y-full',
  }

  const positionClasses = {
    left: 'left-0 top-0 h-full w-80 max-w-full',
    right: 'right-0 top-0 h-full w-80 max-w-full',
    bottom: 'bottom-0 left-0 w-full max-h-[80vh] rounded-t-2xl',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={onClose}
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'var(--bg-overlay)' }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed z-50 flex flex-col overflow-hidden shadow-2xl transition-transform duration-300 ease-out ${positionClasses[side]} ${slideClasses[side]}`}
        style={sideStyles[side]}
      >
        {title && (
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className="btn-icon"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  )
}
