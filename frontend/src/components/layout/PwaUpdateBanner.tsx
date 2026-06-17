'use client'

import { useEffect, useState } from 'react'

// ── i18n ─────────────────────────────────────────────────────────────────────

const i18n = {
  en: {
    message: 'A new version is available',
    update: 'Update now',
    dismiss: 'Later',
  },
  es: {
    message: 'Hay una nueva versión disponible',
    update: 'Actualizar',
    dismiss: 'Después',
  },
} as const

function detectLang(): 'en' | 'es' {
  if (typeof window === 'undefined') return 'en'
  return window.location.pathname.split('/').filter(Boolean)[0] === 'es' ? 'es' : 'en'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PwaUpdateBanner() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [visible, setVisible] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const handleRegistration = (reg: ServiceWorkerRegistration) => {
      // A waiting worker means a new version has been downloaded and is ready
      // to activate. Show the banner.
      const onWaiting = () => {
        setWaitingWorker(reg.waiting)
        setVisible(true)
      }

      if (reg.waiting) {
        // Already waiting on mount (e.g. page was loaded after the SW updated)
        onWaiting()
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New SW installed while an old one is controlling the page
            setWaitingWorker(newWorker)
            setVisible(true)
          }
        })
      })
    }

    // Poll for an existing registration (the SW is registered via an inline
    // <Script> in layout.tsx, so it may already exist when this component mounts)
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) handleRegistration(reg)
    })

    // Also listen for future registrations
    const onControllerChange = () => {
      // A new SW has taken control — the page is about to reload
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const handleUpdate = () => {
    if (!waitingWorker) return
    setUpdating(true)

    // Tell the waiting SW to skip waiting and become active immediately.
    // Once the new SW controls the page, we reload to serve fresh assets.
    const onControllerChange = () => {
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }

  const handleDismiss = () => {
    setVisible(false)
  }

  if (!visible) return null

  const t = i18n[detectLang()]

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 animate-slide-up"
      style={{ width: 'min(calc(100vw - 2rem), 380px)' }}
    >
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Icon */}
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'color-mix(in srgb, var(--brand) 15%, transparent)' }}
        >
          <svg
            width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
            style={{ color: 'var(--brand)' }}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
          </svg>
        </span>

        {/* Text */}
        <p
          className="flex-1 text-sm font-medium"
          style={{ color: 'var(--text-primary)' }}
        >
          {t.message}
        </p>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          disabled={updating}
          className="text-xs transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}
          aria-label={t.dismiss}
        >
          {t.dismiss}
        </button>

        {/* Update CTA */}
        <button
          onClick={handleUpdate}
          disabled={updating}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-60"
          style={{ background: 'var(--brand)', color: 'white', whiteSpace: 'nowrap' }}
        >
          {updating ? (
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              className="animate-spin"
              aria-hidden="true"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
              <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
            </svg>
          ) : null}
          {t.update}
        </button>
      </div>
    </div>
  )
}
