'use client'

import React from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { Dropdown } from '@/components/ui/Dropdown'
import { useI18n } from '@/lib/i18n/client'
import { storage } from '@/lib/storage'

// Icons
const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
)
const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
)
const MonitorIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
  </svg>
)
const BookmarkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
)
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h18M3 6h18M3 18h18" />
  </svg>
)
// Reading mode: focused single column vs. three-panel layout
const FocusIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {/* Single centred column */}
    <rect x="7" y="3" width="10" height="18" rx="1" />
    {/* Collapse arrows pointing inward */}
    <path d="M3 8l-2 4 2 4M21 8l2 4-2 4" />
  </svg>
)
const ExitFocusIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {/* Three columns */}
    <rect x="2" y="3" width="5" height="18" rx="1" />
    <rect x="9.5" y="3" width="5" height="18" rx="1" />
    <rect x="17" y="3" width="5" height="18" rx="1" />
  </svg>
)
const TypographyIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" y1="20" x2="15" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </svg>
)

interface HeaderProps {
  currentLang: string
  currentVersion?: string
  onOpenSidebar?: () => void
  onOpenBookmarks?: () => void
  /** Only provided in the reader; when set the reading-mode button is shown */
  isReadingMode?: boolean
  onToggleReadingMode?: () => void
  /** Only provided in the reader; opens the typography settings panel */
  onOpenTypography?: (anchor: HTMLButtonElement) => void
}

export function Header({
  currentLang,
  currentVersion,
  onOpenSidebar,
  onOpenBookmarks,
  isReadingMode,
  onToggleReadingMode,
  onOpenTypography,
}: HeaderProps) {
  const { t, locale } = useI18n()
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  const themeIcon = theme === 'dark' ? <MoonIcon /> : theme === 'light' ? <SunIcon /> : <MonitorIcon />

  const themeItems = [
    { label: t.theme.light, value: 'light', icon: <SunIcon />, active: theme === 'light' },
    { label: t.theme.dark, value: 'dark', icon: <MoonIcon />, active: theme === 'dark' },
    { label: t.theme.system, value: 'system', icon: <MonitorIcon />, active: theme === 'system' },
  ]

  const handleLangChange = async (lang: string) => {
    await storage.setPreference('locale', lang as any)
    router.push(`/${lang}`)
  }

  // The language the button will switch TO (the one that is not active)
  const otherLang = locale === 'es' ? 'en' : 'es'

  const readingModeLabel = isReadingMode ? t.nav.exitReadingMode : t.nav.readingMode

  return (
    <header className="app-header app-header-height sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center gap-2">

        {/* Mobile: ToC button — always visible when handler provided */}
        {onOpenSidebar && (
          <button
            onClick={onOpenSidebar}
            className="btn-icon md:hidden"
            aria-label={t.nav.tableOfContents}
            id="open-sidebar-btn"
          >
            <MenuIcon />
          </button>
        )}

        {/* Logo */}
        <Link
          href={`/${currentLang}`}
          className="flex items-center gap-2 mr-auto font-semibold text-base"
          style={{ color: 'var(--text-primary)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="VeoBible" width={28} height={28} />
          <span className="hidden sm:inline">VeoBible</span>
        </Link>

        {/* Version badge */}
        {currentVersion && (
          <span
            className="hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
          >
            {currentVersion.toUpperCase()}
          </span>
        )}

        {/* Reading mode toggle — only in the reader, only desktop */}
        {onToggleReadingMode && (
          <button
            onClick={onToggleReadingMode}
            className="hidden md:inline-flex btn-icon items-center gap-1.5 px-3 text-xs font-semibold rounded-lg transition-all duration-200"
            aria-label={readingModeLabel}
            id="reading-mode-btn"
            title={readingModeLabel}
            style={isReadingMode ? { background: 'var(--brand-light)', color: 'var(--brand)' } : {}}
          >
            {isReadingMode ? <ExitFocusIcon /> : <FocusIcon />}
            <span className="hidden lg:inline">{readingModeLabel}</span>
          </button>
        )}

        {/* Typography settings — only in the reader */}
        {onOpenTypography && (
          <button
            onClick={(e) => onOpenTypography(e.currentTarget as HTMLButtonElement)}
            className="btn-icon flex items-center gap-1.5 px-2 md:px-3 text-xs font-semibold rounded-lg transition-all duration-200"
            aria-label={t.reader.typography}
            id="typography-settings-btn"
            title={t.reader.typography}
          >
            <TypographyIcon />
            <span className="hidden md:inline">{t.reader.typography}</span>
          </button>
        )}

        {/* Language toggle — one click switches to the other language */}
        <button
          onClick={() => handleLangChange(otherLang)}
          className="btn-icon px-2.5 text-xs font-bold tracking-wide rounded-lg"
          aria-label={t.language.label}
          id="lang-switcher-btn"
          title={t.language[otherLang]}
        >
          {otherLang.toUpperCase()}
        </button>

        {/* Theme switcher */}
        <Dropdown
          label={t.theme.label}
          trigger={
            <button className="btn-icon" aria-label={t.theme.label} id="theme-switcher-btn">
              {themeIcon}
            </button>
          }
          items={themeItems}
          onSelect={setTheme}
          align="right"
        />

        {/* Mobile: Bookmarks button — always visible when handler provided */}
        {onOpenBookmarks && (
          <button
            onClick={onOpenBookmarks}
            className="btn-icon md:hidden"
            aria-label={t.nav.bookmarks}
            id="open-bookmarks-btn"
          >
            <BookmarkIcon />
          </button>
        )}
      </div>
    </header>
  )
}
