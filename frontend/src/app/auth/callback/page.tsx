'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'

type PageState = 'loading' | 'recovery' | 'success' | 'error'

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = getSupabaseClient()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Read the URL hash to detect the flow type
    const params = new URLSearchParams(window.location.hash.slice(1))
    const type = params.get('type')

    if (type === 'recovery') {
      // Supabase SDK auto-processes the hash and establishes a session.
      // We just need to show the reset form.
      setPageState('recovery')
      return
    }

    // For any other callback (e.g. OAuth), wait for a SIGNED_IN event then redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.replace('/')
      } else if (event === 'PASSWORD_RECOVERY') {
        setPageState('recovery')
      }
    })

    // Timeout fallback: show error if no recognisable event arrives
    const timeout = setTimeout(() => setPageState((s) => s === 'loading' ? 'error' : s), 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    if (pageState === 'recovery') passwordRef.current?.focus()
  }, [pageState])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      passwordRef.current?.focus()
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      passwordRef.current?.focus()
      return
    }
    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      passwordRef.current?.focus()
    } else {
      setPageState('success')
      setTimeout(() => router.replace('/'), 2500)
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {pageState === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}
            />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Verifying link…</p>
          </div>
        )}

        {pageState === 'error' && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'var(--bg-secondary)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Invalid or expired link
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Please request a new password reset link.
              </p>
            </div>
            <button
              onClick={() => router.replace('/')}
              className="text-xs font-medium underline-offset-2 hover:underline"
              style={{ color: 'var(--brand)' }}
            >
              Go home
            </button>
          </div>
        )}

        {pageState === 'recovery' && (
          <>
            <h1 className="mb-6 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Set new password
            </h1>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  New password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  ref={passwordRef}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors disabled:opacity-50"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Confirm password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors disabled:opacity-50"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
                style={{ background: 'var(--brand)', color: 'white' }}
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}

        {pageState === 'success' && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'var(--bg-secondary)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--brand)' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Password updated</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Redirecting you to the app…
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
