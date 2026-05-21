'use client'

import React from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { Dropdown } from '@/components/ui/Dropdown'
import { useI18n } from '@/lib/i18n/client'
import { BIBLE_VERSIONS } from '@/lib/bible/config'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'
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
const GlobeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
  </svg>
)
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h18M3 6h18M3 18h18" />
  </svg>
)

interface HeaderProps {
  currentLang: string
  currentVersion?: string
  onOpenSidebar?: () => void
  onOpenBookmarks?: () => void
}

export function Header({ currentLang, currentVersion, onOpenSidebar, onOpenBookmarks }: HeaderProps) {
  const { t, locale } = useI18n()
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  const themeIcon = theme === 'dark' ? <MoonIcon /> : theme === 'light' ? <SunIcon /> : <MonitorIcon />

  const themeItems = [
    { label: t.theme.light, value: 'light', icon: <SunIcon />, active: theme === 'light' },
    { label: t.theme.dark, value: 'dark', icon: <MoonIcon />, active: theme === 'dark' },
    { label: t.theme.system, value: 'system', icon: <MonitorIcon />, active: theme === 'system' },
  ]

  const langItems = SUPPORTED_LOCALES.map((l) => ({
    label: t.language[l],
    value: l,
    active: l === locale,
  }))

  const handleLangChange = async (lang: string) => {
    await storage.setPreference('locale', lang as any)
    // Navigate to same path but with new lang
    router.push(`/${lang}`)
  }

  return (
    <header className="app-header sticky top-0 z-30 h-14">
      <div className="max-w-6xl mx-auto px-4 h-full flex items-center gap-2">
        {/* Sidebar toggle */}
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
          <span className="text-lg" style={{ color: 'var(--brand)' }}>✦</span>
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

        {/* Language switcher */}
        <Dropdown
          label={t.language.label}
          trigger={
            <button className="btn-icon" aria-label={t.language.label} id="lang-switcher-btn">
              <GlobeIcon />
            </button>
          }
          items={langItems}
          onSelect={handleLangChange}
          align="right"
        />

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

        {/* Bookmarks */}
        {onOpenBookmarks && (
          <button
            onClick={onOpenBookmarks}
            className="btn-icon"
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
