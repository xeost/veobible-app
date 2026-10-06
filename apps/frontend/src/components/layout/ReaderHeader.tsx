'use client'

import React, { useState } from 'react'
import { useI18n } from '@/lib/i18n/client'
import { Logo } from './Logo'
import { LanguageToggle } from './LanguageToggle'
import { ThemeToggle } from './ThemeToggle'
import { Tooltip } from '@/components/ui/Tooltip'
import { OfflineVersionButton, type OfflineVersionButtonProps } from '@/components/reader/OfflineVersionButton'
import { AuthButton } from '@/components/auth/AuthButton'


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
const SearchIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
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
  /** Whether the typography panel is currently open — used to suppress its tooltip */
  isTypographyOpen: boolean
  onOpenSearch: () => void
  offline: OfflineVersionButtonProps
}

export function ReaderHeader({
  currentLang,
  currentVersion,
  onOpenSidebar,
  onOpenBookmarks,
  isReadingMode,
  onToggleReadingMode,
  onOpenTypography,
  isTypographyOpen,
  onOpenSearch,
  offline,
}: ReaderHeaderProps) {
  const { t } = useI18n()
  const readingModeLabel = isReadingMode ? t.nav.exitReadingMode : t.nav.readingMode
  // Track whether the offline dropdown is open so we can suppress its Tooltip
  const [offlinePanelOpen, setOfflinePanelOpen] = useState(false)

  return (
    <header className="app-header app-header-height sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between gap-2 relative">
        {/* Left side: Logo, Version, and ToC menu on mobile */}
        <div className="flex items-center gap-2 md:gap-3 justify-start min-w-0 z-10">
          <Logo currentLang={currentLang} />

          {/* Mobile: ToC button — always visible when handler provided */}
          <button
            onClick={onOpenSidebar}
            className="btn-icon md:hidden flex-shrink-0"
            aria-label={t.nav.tableOfContents}
            id="open-sidebar-btn"
          >
            <MenuIcon />
          </button>
        </div>

        {/* Center: Reading Mode & Typography Icon Buttons with Custom Tooltips */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center">
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-xl border shadow-sm"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--bg-card)',
            }}
          >
            {/* Reading mode toggle — only in the reader, only desktop */}
            <Tooltip content={readingModeLabel} className="hidden md:flex">
              <button
                onClick={onToggleReadingMode}
                className="btn-icon flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200"
                aria-label={readingModeLabel}
                id="reading-mode-btn"
                style={isReadingMode ? { background: 'var(--brand-light)', color: 'var(--brand)' } : {}}
              >
                {isReadingMode ? <ExitFocusIcon /> : <FocusIcon />}
              </button>
            </Tooltip>

            {/* Bible search — always visible */}
            <Tooltip content={t.search.open}>
              <button
                onClick={onOpenSearch}
                className="btn-icon flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200"
                aria-label={t.search.open}
                id="bible-search-btn"
              >
                <SearchIcon />
              </button>
            </Tooltip>

            {/* Offline version management */}
            <Tooltip content={t.offline.open} disabled={offlinePanelOpen}>
              <OfflineVersionButton
                {...offline}
                onOpenChange={setOfflinePanelOpen}
              />
            </Tooltip>

            {/* Typography settings — only in the reader */}
            <Tooltip content={t.reader.typography} disabled={isTypographyOpen}>
              <button
                onClick={(e) => onOpenTypography(e.currentTarget as HTMLButtonElement)}
                className="btn-icon flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200"
                aria-label={t.reader.typography}
                id="typography-settings-btn"
              >
                <TypographyIcon />
              </button>
            </Tooltip>
          </div>

        </div>

        {/* Right side: Language, Theme, and Bookmarks menu on mobile */}
        <div className="flex items-center gap-1.5 md:gap-2 justify-end z-10">
          <LanguageToggle />
          <ThemeToggle />
          <AuthButton />

          {/* Mobile: Bookmarks button — always visible when handler provided */}
          <button
            onClick={onOpenBookmarks}
            className="btn-icon md:hidden flex-shrink-0"
            aria-label={t.nav.bookmarks}
            id="open-bookmarks-btn"
          >
            <MenuIcon />
          </button>
        </div>
      </div>
    </header>
  )
}
