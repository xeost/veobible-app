'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, Globe2, KeyRound, LogIn, LogOut, Monitor, Moon, RefreshCw, Sun, UserRound } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/hooks/useAuth'
import { useSyncStatus, formatCountdown, formatLastSync } from '@/hooks/useSyncStatus'
import { useI18n } from '@/lib/i18n/client'
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/config'
import { storage } from '@/lib/storage'
import { AuthModal } from '@/components/auth/AuthModal'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'

const labels = {
  es: { account: 'Tu espacio', guest: 'Visitante', description: 'Estás navegando sin sincronización', signedIn: 'Sincronizado entre dispositivos', signIn: 'Ingresar', signOut: 'Cerrar sesión', signingOut: 'Cerrando sesión…', hint: 'Guarda y sincroniza tus lecturas.', error: 'No se pudo cerrar la sesión. Inténtalo de nuevo.' },
  en: { account: 'Your space', guest: 'Make it yours', description: 'A moment for you, a reading at your own pace.', signedIn: 'Synced across devices', signIn: 'Sign in', signOut: 'Sign out', signingOut: 'Signing out…', hint: 'Save and sync your reading.', error: 'Could not sign out. Please try again.' },
  pt: { account: 'Seu espaço', guest: 'Do seu jeito', description: 'Um momento para você, uma leitura no seu ritmo.', signedIn: 'Sincronizado entre dispositivos', signIn: 'Entrar', signOut: 'Sair', signingOut: 'Saindo…', hint: 'Salve e sincronize suas leituras.', error: 'Não foi possível sair. Tente novamente.' },
}
const languageNames = { es: 'Español', en: 'English', pt: 'Português' }
const passwordLabels = { es: 'Cambiar contraseña', en: 'Change password', pt: 'Alterar senha' }
const syncLabels = {
  es: { title: 'Sincronización', last: 'Última sincronización', next: 'Próxima sincronización', soon: 'pronto', now: 'Sincronizar ahora', syncing: 'Sincronizando…' },
  en: { title: 'Cloud sync', last: 'Last synced', next: 'Next sync', soon: 'soon', now: 'Sync now', syncing: 'Syncing…' },
  pt: { title: 'Sincronização', last: 'Última sincronização', next: 'Próxima sincronização', soon: 'em breve', now: 'Sincronizar agora', syncing: 'Sincronizando…' },
}
const themes = [{ value: 'light', icon: Sun }, { value: 'dark', icon: Moon }, { value: 'system', icon: Monitor }] as const
const sectionStorageKey = (section: 'theme' | 'language') => `veobible-home-menu-${section}-expanded`

export function HomeUserMenu() {
  const { locale, t } = useI18n()
  const copy = labels[locale]
  const { user, loading, signOut } = useAuth()
  const { lastSyncMs, secondsUntilNext, isSyncing, triggerSync } = useSyncStatus(!!user)
  const syncCopy = syncLabels[locale]
  const lastSyncLabel = locale === 'pt'
    ? (lastSyncMs === 0 ? 'Nunca' : new Intl.RelativeTimeFormat('pt', { numeric: 'auto' }).format(Math.min(0, Math.floor((lastSyncMs - Date.now()) / 60000)), 'minute'))
    : formatLastSync(lastSyncMs, locale)
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState({ theme: true, language: true })
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    try {
      setExpanded({
        theme: localStorage.getItem(sectionStorageKey('theme')) !== 'false',
        language: localStorage.getItem(sectionStorageKey('language')) !== 'false',
      })
    } catch {
      // Both sections stay expanded when browser storage is unavailable.
    }
  }, [])

  const toggleSection = (section: 'theme' | 'language') => {
    const next = !expanded[section]
    setExpanded(previous => ({ ...previous, [section]: next }))
    try {
      localStorage.setItem(sectionStorageKey(section), String(next))
    } catch {
      // Folding still works for this visit when storage is unavailable.
    }
  }

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  const changeLanguage = async (language: Locale) => {
    try {
      await storage.setPreference('locale', language)
    } catch {
      // Navigation still works when browser storage is unavailable.
    }
    window.location.assign(`/${language}${window.location.hash}`)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    setError(false)
    try {
      await signOut()
      setOpen(false)
      triggerRef.current?.focus()
    } catch {
      setError(true)
    } finally {
      setSigningOut(false)
    }
  }

  return <>
    <div className="home-user-menu" ref={rootRef}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          setOpen(false)
          triggerRef.current?.focus()
        }
      }}>
      <button ref={triggerRef} type="button" className="home-user-trigger"
        aria-label={copy.account} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen(value => !value)}>
        <span className="home-user-avatar"><UserRound size={20} strokeWidth={1.6} aria-hidden="true" />{user && <span className="home-user-status" />}</span>
        <ChevronDown className="home-user-chevron" size={14} aria-hidden="true" />
      </button>

      {open && <div ref={panelRef} id={id} className="home-user-panel" role="dialog" aria-labelledby={`${id}-title`} tabIndex={-1}>
        <div className="home-user-heading">
          <span className="home-user-avatar"><UserRound size={22} strokeWidth={1.5} aria-hidden="true" /></span>
          <div><h2 id={`${id}-title`}>{user ? (user.email ?? copy.account) : copy.guest}</h2><p>{user ? copy.signedIn : copy.description}</p></div>
        </div>

        {user && <section className="home-menu-section home-sync-section" aria-labelledby={`${id}-sync`}>
          <h3 id={`${id}-sync`}><RefreshCw size={15} aria-hidden="true" />{syncCopy.title}</h3>
          <dl className="home-sync-stats">
            <div><dt>{syncCopy.last}</dt><dd>{lastSyncLabel}</dd></div>
            <div><dt>{syncCopy.next}</dt><dd>{isSyncing ? syncCopy.syncing : (secondsUntilNext > 0 ? formatCountdown(secondsUntilNext) : syncCopy.soon)}</dd></div>
          </dl>
          <button type="button" className="home-sync-action" onClick={triggerSync} disabled={isSyncing || signingOut} aria-busy={isSyncing}>
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : undefined} aria-hidden="true" />
            {isSyncing ? syncCopy.syncing : syncCopy.now}
          </button>
        </section>}

        <section className="home-menu-section">
          <h3><button type="button" className="home-section-toggle" id={`${id}-theme-label`} aria-expanded={expanded.theme} aria-controls={`${id}-theme`} onClick={() => toggleSection('theme')}>
            <Sun size={15} aria-hidden="true" />{t.theme.label}<ChevronDown size={14} aria-hidden="true" />
          </button></h3>
          <fieldset className="home-theme-fieldset" id={`${id}-theme`} hidden={!expanded.theme} aria-labelledby={`${id}-theme-label`}>
            <div className="home-theme-options">
              {themes.map(({ value, icon: Icon }) => <label key={value}>
                <input type="radio" name={`${id}-theme`} value={value} checked={(theme ?? 'system') === value} onChange={() => setTheme(value)} />
                <span><Icon size={18} strokeWidth={1.6} aria-hidden="true" />{t.theme[value]}</span>
              </label>)}
            </div>
          </fieldset>
        </section>

        <div className="home-menu-section">
          <h3 id={`${id}-language`}><button type="button" className="home-section-toggle" aria-expanded={expanded.language} aria-controls={`${id}-language-content`} onClick={() => toggleSection('language')}>
            <Globe2 size={15} aria-hidden="true" />{t.language.label}<ChevronDown size={14} aria-hidden="true" />
          </button></h3>
          <div id={`${id}-language-content`} hidden={!expanded.language}>
            <nav className="home-language-options" aria-labelledby={`${id}-language`}>
              {SUPPORTED_LOCALES.map(language => <a key={language} href={`/${language}`} lang={language}
                aria-current={locale === language ? 'true' : undefined}
                onClick={event => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault()
                  if (language !== locale) void changeLanguage(language)
                }}>
                <span className="home-language-code" aria-hidden="true">{language.toUpperCase()}</span>
                <span>{languageNames[language]}</span>
                {locale === language && <Check size={16} aria-hidden="true" />}
              </a>)}
            </nav>
          </div>
        </div>

        <div className="home-menu-footer">
          {error && <p role="alert">{copy.error}</p>}
          {user && <button type="button" className="home-password-action" disabled={signingOut}
            onClick={() => { setOpen(false); setChangePasswordOpen(true) }}>
            <KeyRound size={17} aria-hidden="true" />{passwordLabels[locale]}
          </button>}
          <button type="button" className={`home-session-action${user ? ' is-signed-in' : ''}`} disabled={loading || signingOut}
            onClick={() => {
              if (user) void handleSignOut()
              else { setOpen(false); setAuthOpen(true) }
            }}>
            {user ? <LogOut size={17} aria-hidden="true" /> : <LogIn size={17} aria-hidden="true" />}
            {user ? (signingOut ? copy.signingOut : copy.signOut) : copy.signIn}
          </button>
          {!user && <p>{copy.hint}</p>}
        </div>
      </div>}
    </div>
    <AuthModal open={authOpen} onClose={() => { setAuthOpen(false); triggerRef.current?.focus() }} />
    <ChangePasswordDialog open={changePasswordOpen} onClose={() => { setChangePasswordOpen(false); triggerRef.current?.focus() }} />
  </>
}
