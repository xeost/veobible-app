'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AuthModal } from './AuthModal'
import { toast } from '@/components/ui/Toast'

export function AuthButton({ className }: { className?: string }) {
  const { user, loading, signOut } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    toast('Signed out', 'info')
  }

  if (loading) {
    return (
      <div
        className={`h-8 w-8 rounded-full animate-pulse ${className ?? ''}`}
        style={{ background: 'var(--bg-secondary)' }}
      />
    )
  }

  if (user) {
    return (
      <button
        onClick={handleSignOut}
        title={user.email ?? 'Signed in'}
        className={`flex items-center justify-center rounded-full text-xs font-semibold transition-opacity hover:opacity-80 ${className ?? ''}`}
        style={{
          width: 32,
          height: 32,
          background: 'var(--brand)',
          color: 'white',
        }}
      >
        {(user.email?.[0] ?? '?').toUpperCase()}
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${className ?? ''}`}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        Sign in
      </button>
      <AuthModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
