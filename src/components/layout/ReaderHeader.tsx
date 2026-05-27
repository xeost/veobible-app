'use client'

import React from 'react'
import { useI18n } from '@/lib/i18n/client'
import { Logo } from './Logo'
import { LanguageToggle } from './LanguageToggle'
import { ThemeSwitcher } from './ThemeSwitcher'

// Icons
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

interface ReaderHeaderProps {
  currentLang: string
  currentVersion: string
  onOpenSidebar: () => void
  onOpenBookmarks: () => void
  isReadingMode: boolean
  onToggleReadingMode: () => void
  onOpenTypography: (anchor: HTMLButtonElement) => void
}

export function ReaderHeader({
  currentLang,
  currentVersion,
  onOpenSidebar,
  onOpenBookmarks,
  isReadingMode,
  onToggleReadingMode,
  onOpenTypography,
}: ReaderHeaderProps) {
  const { t } = useI18n()
  const readingModeLabel = isReadingMode ? t.nav.exitReadingMode : t.nav.readingMode

  return (
    <header className="app-header app-header-height sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center gap-2">
        {/* Mobile: ToC button — always visible when handler provided */}
        <button
          onClick={onOpenSidebar}
          className="btn-icon md:hidden"
          aria-label={t.nav.tableOfContents}
          id="open-sidebar-btn"
        >
          <MenuIcon />
        </button>

        <Logo currentLang={currentLang} />

        {/* Version badge */}
        <span
          className="hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
        >
          {currentVersion.toUpperCase()}
        </span>

        {/* Reading mode toggle — only in the reader, only desktop */}
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

        {/* Typography settings — only in the reader */}
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

        <LanguageToggle />
        <ThemeSwitcher />

        {/* Mobile: Bookmarks button — always visible when handler provided */}
        <button
          onClick={onOpenBookmarks}
          className="btn-icon md:hidden"
          aria-label={t.nav.bookmarks}
          id="open-bookmarks-btn"
        >
          <BookmarkIcon />
        </button>
      </div>
    </header>
  )
}
