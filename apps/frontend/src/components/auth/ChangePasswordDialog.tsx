'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/components/ui/Toast'

// ── i18n ──────────────────────────────────────────────────────────────────────

const i18n = {
  en: {
    title:            'Change password',
    newPassword:      'New password',
    confirmPassword:  'Confirm password',
    placeholder:      '••••••••',
    mismatch:         'Passwords do not match.',
    tooShort:         'Password must be at least 8 characters.',
    submit:           'Update',
    loading:          'Updating…',
    cancel:           'Cancel',
    successToast:     'Password updated successfully',
    close:            'Close',
  },
  es: {
    title:            'Cambiar contraseña',
    newPassword:      'Nueva contraseña',
    confirmPassword:  'Confirmar contraseña',
    placeholder:      '••••••••',
    mismatch:         'Las contraseñas no coinciden.',
    tooShort:         'La contraseña debe tener al menos 8 caracteres.',
    submit:           'Actualizar',
    loading:          'Actualizando…',
    cancel:           'Cancelar',
    successToast:     'Contraseña actualizada correctamente',
    close:            'Cerrar',
  },
} as const

function detectLang(): 'en' | 'es' {
  if (typeof window === 'undefined') return 'en'
  return window.location.pathname.split('/').filter(Boolean)[0] === 'es' ? 'es' : 'en'
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ChangePasswordDialogProps {
  open: boolean
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const { updatePassword } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus first input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const reset = useCallback(() => {
    setNewPassword('')
    setConfirm('')
    setError(null)
    setLoading(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const t = i18n[detectLang()]
      setError(null)

      if (newPassword.length < 8) {
        setError(t.tooShort)
        return
      }
      if (newPassword !== confirm) {
        setError(t.mismatch)
        return
      }

      setLoading(true)
      const { error: authError } = await updatePassword(newPassword)
      setLoading(false)

      if (authError) {
        setError(authError.message)
      } else {
        toast(t.successToast, 'success')
        handleClose()
      }
    },
    [newPassword, confirm, updatePassword, handleClose],
  )

  if (!open || typeof document === 'undefined') return null

  const t = i18n[detectLang()]

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t.title}
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={t.close}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* New password */}
          <div>
            <label
              className="mb-1 block text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t.newPassword}
            </label>
            <input
              ref={inputRef}
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              placeholder={t.placeholder}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors disabled:opacity-50"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Confirm password */}
          <div>
            <label
              className="mb-1 block text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t.confirmPassword}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
              placeholder={t.placeholder}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors disabled:opacity-50"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs" style={{ color: '#ef4444' }}>
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: 'var(--brand)', color: 'white' }}
            >
              {loading ? t.loading : t.submit}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
