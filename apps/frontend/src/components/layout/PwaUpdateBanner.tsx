'use client'

import { useEffect, useState } from 'react'

// ── i18n ─────────────────────────────────────────────────────────────────────

const i18n = {
  en: {
    eyebrow: 'Update available',
    message: 'A new version of VeoBible is ready.',
    update:  'Reload now',
    dismiss: 'Later',
  },
  es: {
    eyebrow: 'Actualización disponible',
    message: 'Una nueva versión de VeoBible está lista.',
    update:  'Recargar ahora',
    dismiss: 'Después',
  },
} as const

function detectLang(): 'en' | 'es' {
  if (typeof window === 'undefined') return 'en'
  return window.location.pathname.split('/').filter(Boolean)[0] === 'es' ? 'es' : 'en'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PwaUpdateBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // Whether a SW was already controlling the page when this effect ran.
    // If a controllerchange fires AFTER that, it means a new SW took over → update.
    const hadController = !!navigator.serviceWorker.controller

    // ── Case 1: controllerchange fires after initial mount ──────────────────
    // With skipWaiting:true the new SW auto-activates without a waiting phase,
    // so controllerchange is the most reliable signal that an update was applied
    // while the user had the app open.
    let controllerChangeFired = false
    const onControllerChange = () => {
      // Ignore the very first controllerchange that fires when a SW first takes
      // control of an uncontrolled page (no old SW present).
      if (!hadController && !controllerChangeFired) {
        controllerChangeFired = true
        return
      }
      setVisible(true)
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    // ── Case 2: a waiting worker already exists on mount ────────────────────
    // This happens when the user opens the app while a new SW is still
    // in the waiting phase (skipWaiting not yet triggered).
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return

      // Already waiting when we mounted
      if (reg.waiting && navigator.serviceWorker.controller) {
        setVisible(true)
        return
      }

      // Watch for future updates found during this session
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          // With skipWaiting:true the worker jumps from installing → activated,
          // but the controllerchange listener above already covers that path.
          // This branch covers the case where skipWaiting is NOT active and
          // the worker parks in the waiting state.
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setVisible(true)
          }
        })
      })
    })

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const handleUpdate = () => {
    // The new SW is already active (skipWaiting:true) — just reload to serve
    // the new assets. No postMessage needed.
    window.location.reload()
  }

  const handleDismiss = () => setVisible(false)

  if (!visible) return null

  const t = i18n[detectLang()]

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        // Slide down from top
        animation: 'pwa-slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
    >
      <style>{`
        @keyframes pwa-slide-down {
          from { transform: translateY(-110%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Gradient ribbon */}
      <div
        style={{
          background: 'linear-gradient(90deg, #6d28d9 0%, #4f46e5 40%, #0ea5e9 100%)',
          boxShadow: '0 4px 24px rgba(79, 70, 229, 0.45)',
        }}
      >
        <div
          style={{
            maxWidth: '64rem',
            margin: '0 auto',
            padding: '0 1rem',
            height: '3rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          {/* Pulse dot */}
          <span
            style={{
              flexShrink: 0,
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.9)',
              boxShadow: '0 0 0 0 rgba(255,255,255,0.7)',
              animation: 'pwa-pulse 2s infinite',
            }}
          />
          <style>{`
            @keyframes pwa-pulse {
              0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.7); }
              70%  { box-shadow: 0 0 0 6px rgba(255,255,255,0); }
              100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
            }
          `}</style>

          {/* Eye-catcher label */}
          <span
            style={{
              flexShrink: 0,
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.75)',
              display: 'none',
            }}
            className="pwa-eyebrow"
          >
            {t.eyebrow}
          </span>

          {/* Message */}
          <p
            style={{
              flex: 1,
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: 'white',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <span style={{ fontWeight: 700, marginRight: '0.4rem' }}>{t.eyebrow} —</span>
            {t.message}
          </p>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            style={{
              flexShrink: 0,
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.65)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.5rem',
              transition: 'color 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,1)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
            aria-label={t.dismiss}
          >
            {t.dismiss}
          </button>

          {/* Reload CTA */}
          <button
            onClick={handleUpdate}
            style={{
              flexShrink: 0,
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#4f46e5',
              background: 'white',
              border: 'none',
              cursor: 'pointer',
              padding: '0.375rem 0.875rem',
              borderRadius: '6rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'
            }}
          >
            {t.update}
          </button>
        </div>
      </div>
    </div>
  )
}
