'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/hooks/useAuth'
import { AuthModal } from './AuthModal'
import { SignOutDialog } from './SignOutDialog'
import { ChangePasswordDialog } from './ChangePasswordDialog'
import { toast } from '@/components/ui/Toast'
import { useSyncStatus, formatCountdown, formatLastSync } from '@/hooks/useSyncStatus'

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

// ── i18n ─────────────────────────────────────────────────────────────────────

const i18n = {
  en: {
    signOut: 'Sign out',
    changePassword: 'Change password',
    syncTitle: 'Cloud sync',
    lastSync: 'Last synced',
    nextSync: 'Next sync',
    nextSyncSoon: 'soon',
    syncNow: 'Sync now',
    syncing: 'Syncing…',
  },
  es: {
    signOut: 'Cerrar sesión',
    changePassword: 'Cambiar contraseña',
    syncTitle: 'Sincronización',
    lastSync: 'Última sincronización',
    nextSync: 'Próxima sincronización',
    nextSyncSoon: 'pronto',
    syncNow: 'Sincronizar ahora',
    syncing: 'Sincronizando…',
  },
} as const

type Lang = keyof typeof i18n

function detectLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  const seg = window.location.pathname.split('/').filter(Boolean)[0]
  return seg === 'es' ? 'es' : 'en'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AuthButton({ className }: { className?: string }) {
  const { user, loading, signOut } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false)
  const [clearLocalData, setClearLocalData] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const avatarRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })

  const { lastSyncMs, secondsUntilNext, isSyncing, triggerSync } = useSyncStatus(!!user)

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
    const lang = detectLang()
    const t = i18n[lang]
    const lastSyncLabel = formatLastSync(lastSyncMs, lang)
    const nextSyncLabel = secondsUntilNext > 0
      ? formatCountdown(secondsUntilNext)
      : t.nextSyncSoon

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
            className="fixed z-50 rounded-2xl shadow-xl overflow-hidden"
            style={{
              top: dropdownPos.top,
              right: dropdownPos.right,
              minWidth: 260,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            {/* User email */}
            <div className="px-4 pt-4 pb-3">
              <p
                className="text-xs font-medium truncate"
                style={{ color: 'var(--text-tertiary)' }}
                title={user.email ?? undefined}
              >
                {user.email}
              </p>
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />

            {/* Sync panel */}
            <div className="px-4 py-3">
              {/* Section header */}
              <div className="flex items-center gap-1.5 mb-3">
                <svg
                  width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ color: 'var(--brand)', flexShrink: 0 }}
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                  <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                </svg>
                <span
                  className="text-xs font-semibold tracking-wide"
                  style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.65rem' }}
                >
                  {t.syncTitle}
                </span>
              </div>

              {/* Stats grid */}
              <div
                className="rounded-xl px-3 py-2.5 mb-3"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t.lastSync}
                  </span>
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {lastSyncLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t.nextSync}
                  </span>
                  {isSyncing ? (
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      className="animate-spin"
                      aria-label={t.syncing}
                      style={{ color: 'var(--brand)', flexShrink: 0 }}
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                    </svg>
                  ) : (
                    <span
                      className="text-xs font-medium tabular-nums"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {nextSyncLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* Sync now button */}
              <button
                role="menuitem"
                onClick={triggerSync}
                disabled={isSyncing}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all disabled:opacity-60"
                style={{ background: 'var(--brand)', color: 'white' }}
              >
                <svg
                  width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                  className={isSyncing ? 'animate-spin' : ''}
                  style={{ animationDirection: isSyncing ? 'reverse' : undefined }}
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                  <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                </svg>
                {isSyncing ? t.syncing : t.syncNow}
              </button>
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />

            {/* Account actions */}
            <div className="px-2 pt-2 pb-1">
              {/* Change password */}
              <button
                role="menuitem"
                onClick={() => { setDropdownOpen(false); setChangePasswordOpen(true) }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-xl transition-colors hover:bg-[var(--bg-secondary)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                {t.changePassword}
              </button>

              <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />

              {/* Sign out */}
              <button
                role="menuitem"
                onClick={handleSignOutClick}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-xl transition-colors hover:bg-red-500/10"
                style={{ color: '#ef4444' }}
              >
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                {t.signOut}
              </button>
            </div>
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
        <ChangePasswordDialog
          open={changePasswordOpen}
          onClose={() => setChangePasswordOpen(false)}
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
        {/* Sync icon — signals that signing in enables cloud sync */}
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
          <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
        </svg>
        Sign in
      </button>
      <AuthModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
