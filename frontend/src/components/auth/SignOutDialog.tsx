'use client'

import { useId } from 'react'
import { createPortal } from 'react-dom'

interface SignOutDialogProps {
  open: boolean
  loading: boolean
  clearLocalData: boolean
  onClearLocalDataChange: (checked: boolean) => void
  onConfirm: () => void
  onCancel: () => void
}

// Translations bundled inline so the component is self-contained and can be
// used in both language contexts. Only two languages are currently supported.
const i18n = {
  en: {
    title: 'Sign out',
    body: 'Are you sure you want to sign out?',
    clearLabel: 'Delete local data before signing out',
    clearHint:
      'Clears bookmarks, reading positions, and preferences stored in this browser. ' +
      'Your cloud data is safe and will be available when you sign in again.',
    cancel: 'Cancel',
    confirm: 'Sign out',
    confirming: 'Signing out…',
  },
  es: {
    title: 'Cerrar sesión',
    body: '¿Estás seguro de que quieres cerrar sesión?',
    clearLabel: 'Borrar datos locales antes de salir',
    clearHint:
      'Elimina marcadores, posiciones de lectura y preferencias guardadas en este navegador. ' +
      'Tus datos en la nube están seguros y estarán disponibles al volver a iniciar sesión.',
    cancel: 'Cancelar',
    confirm: 'Cerrar sesión',
    confirming: 'Cerrando sesión…',
  },
} as const

type Lang = keyof typeof i18n

/** Detect the current UI language from the URL path (first segment). */
function detectLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  const seg = window.location.pathname.split('/').filter(Boolean)[0]
  return seg === 'es' ? 'es' : 'en'
}

export function SignOutDialog({
  open,
  loading,
  clearLocalData,
  onClearLocalDataChange,
  onConfirm,
  onCancel,
}: SignOutDialogProps) {
  const checkboxId = useId()
  const t = i18n[detectLang()]

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
      aria-modal="true"
      role="dialog"
      aria-labelledby="signout-dialog-title"
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          {/* Icon */}
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--bg-secondary)' }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              style={{ color: 'var(--text-secondary)' }}
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
          <h2
            id="signout-dialog-title"
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {t.title}
          </h2>
        </div>

        {/* Body */}
        <p className="mb-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t.body}
        </p>

        {/* Clear local data toggle */}
        <label
          htmlFor={checkboxId}
          className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-colors"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          {/* Custom checkbox */}
          <span
            className="relative mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded"
            style={{
              background: clearLocalData ? 'var(--brand)' : 'var(--bg-card)',
              border: clearLocalData ? '1.5px solid var(--brand)' : '1.5px solid var(--border)',
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            <input
              id={checkboxId}
              type="checkbox"
              checked={clearLocalData}
              onChange={(e) => onClearLocalDataChange(e.target.checked)}
              className="sr-only"
              aria-describedby="clear-data-hint"
            />
            {clearLocalData && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="1.5 6 4.5 9 10.5 3" />
              </svg>
            )}
          </span>

          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {t.clearLabel}
            </span>
            <span
              id="clear-data-hint"
              className="text-xs leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t.clearHint}
            </span>
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            {t.cancel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: 'var(--brand)', color: 'white' }}
          >
            {loading ? t.confirming : t.confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
