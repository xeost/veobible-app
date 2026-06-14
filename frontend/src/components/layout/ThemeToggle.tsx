'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useI18n } from '@/lib/i18n/client'

// Theme Icons
const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
)

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
)

export function ThemeToggle() {
  const { t } = useI18n()
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check if the user has explicitly set a theme in localStorage
    const savedTheme = localStorage.getItem('theme')
    if (!savedTheme || savedTheme === 'system') {
      // If not, resolve the system theme and save it explicitly to localStorage
      const initialTheme = systemTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      setTheme(initialTheme)
    }
  }, [systemTheme, setTheme])

  const toggleTheme = () => {
    // Toggle theme between dark and light
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
  }

  // Render a placeholder button during SSR to prevent layout shifts/hydration mismatch
  if (!mounted) {
    return (
      <button className="btn-icon opacity-0" aria-hidden="true">
        <SunIcon />
      </button>
    )
  }

  const isDark = theme === 'dark'
  
  return (
    <button
      onClick={toggleTheme}
      className="btn-icon"
      aria-label={isDark ? t.theme.light : t.theme.dark}
      title={isDark ? t.theme.light : t.theme.dark}
      id="theme-toggle-btn"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
