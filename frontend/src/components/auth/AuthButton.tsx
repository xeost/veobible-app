'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/hooks/useAuth'
import { AuthModal } from './AuthModal'
import { SignOutDialog } from './SignOutDialog'
import { toast } from '@/components/ui/Toast'

// ── Local data helpers ────────────────────────────────────────────────────────

/** Prefix used by all veobible localStorage keys (matches local-adapter.ts). */
const LOCAL_DATA_PREFIX = 'veobible_'

/** Remove all veobible_* keys from localStorage. */
function clearLocalAppData(): void {
  if (typeof window === 'undefined') return
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(LOCAL_DATA_PREFIX)) keysToRemove.push(key)
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k))
}

export function AuthButton({ className }: { className?: string }) {
  const { user, loading, signOut } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false)
  const [clearLocalData, setClearLocalData] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const avatarRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        !avatarRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  const handleAvatarClick = () => {
    if (!dropdownOpen && avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
    setDropdownOpen((v) => !v)
  }

  const handleSignOutClick = () => {
    setDropdownOpen(false)
    // Reset state each time the dialog opens
    setClearLocalData(true)
    setSignOutDialogOpen(true)
  }

  const handleSignOutConfirm = async () => {
    setSigningOut(true)
    if (clearLocalData) {
      clearLocalAppData()
    }
    await signOut()
    setSigningOut(false)
    setSignOutDialogOpen(false)
    toast('Signed out', 'info')
  }

  const handleSignOutCancel = () => {
    if (!signingOut) setSignOutDialogOpen(false)
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
      <>
        <button
          ref={avatarRef}
          onClick={handleAvatarClick}
          aria-label={user.email ?? 'Account menu'}
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
          className={`flex items-center justify-center rounded-full text-xs font-semibold transition-opacity hover:opacity-80 ${className ?? ''}`}
          style={{ width: 32, height: 32, background: 'var(--brand)', color: 'white' }}
        >
          {(user.email?.[0] ?? '?').toUpperCase()}
        </button>

        {dropdownOpen && typeof document !== 'undefined' && createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            className="fixed z-50 min-w-[160px] rounded-xl py-1 shadow-lg"
            style={{
              top: dropdownPos.top,
              right: dropdownPos.right,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <p className="px-3 py-2 text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
              {user.email}
            </p>
            <div style={{ height: 1, background: 'var(--border)', margin: '0 8px' }} />
            <button
              role="menuitem"
              onClick={handleSignOutClick}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-secondary)]"
              style={{ color: 'var(--text-primary)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </div>,
          document.body,
        )}

        <SignOutDialog
          open={signOutDialogOpen}
          loading={signingOut}
          clearLocalData={clearLocalData}
          onClearLocalDataChange={setClearLocalData}
          onConfirm={handleSignOutConfirm}
          onCancel={handleSignOutCancel}
        />
      </>
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
