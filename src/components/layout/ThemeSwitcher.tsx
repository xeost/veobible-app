'use client'

import React from 'react'
import { useTheme } from 'next-themes'
import { Dropdown } from '@/components/ui/Dropdown'
import { useI18n } from '@/lib/i18n/client'

// Theme Icons
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

export function ThemeSwitcher() {
  const { t } = useI18n()
  const { theme, setTheme } = useTheme()

  const themeIcon = theme === 'dark' ? <MoonIcon /> : theme === 'light' ? <SunIcon /> : <MonitorIcon />

  const themeItems = [
    { label: t.theme.light, value: 'light', icon: <SunIcon />, active: theme === 'light' },
    { label: t.theme.dark, value: 'dark', icon: <MoonIcon />, active: theme === 'dark' },
    { label: t.theme.system, value: 'system', icon: <MonitorIcon />, active: theme === 'system' },
  ]

  return (
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
  )
}
