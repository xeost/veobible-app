/**
 * useReaderPreferences
 *
 * Reads and writes reader typography preferences (font family, font size,
 * line height) from localStorage.  Changes are applied instantly via CSS
 * custom properties set on <html>.
 */
'use client'

import React from 'react'
import { storage } from '@/lib/storage'
import type {
  ReaderFontFamily,
  ReaderFontSize,
  ReaderLineHeight,
} from '@/lib/storage/types'

// ── Defaults ──────────────────────────────────────────────────────────────────
export const DEFAULT_FONT_FAMILY: ReaderFontFamily = 'lora'
export const DEFAULT_FONT_SIZE: ReaderFontSize = 'md'
export const DEFAULT_LINE_HEIGHT: ReaderLineHeight = 'relaxed'

// ── Font metadata (label + CSS stack) ─────────────────────────────────────────
export interface FontMeta {
  label: string
  cssVar: string   // the CSS variable name injected by next/font
  category: 'serif' | 'sans'
  description: string
}

export const FONTS: Record<ReaderFontFamily, FontMeta> = {
  // ── Serif ────────────────────────────────────────────────────────────────
  'lora': {
    label: 'Lora',
    cssVar: '--font-lora',
    category: 'serif',
    description: 'Elegant balanced serif',
  },
  'merriweather': {
    label: 'Merriweather',
    cssVar: '--font-merriweather',
    category: 'serif',
    description: 'Designed for screen readability',
  },
  'eb-garamond': {
    label: 'EB Garamond',
    cssVar: '--font-eb-garamond',
    category: 'serif',
    description: 'Classic old-style, timeless',
  },
  'libre-baskerville': {
    label: 'Libre Baskerville',
    cssVar: '--font-libre-baskerville',
    category: 'serif',
    description: 'Traditional book typography',
  },
  'crimson-pro': {
    label: 'Crimson Pro',
    cssVar: '--font-crimson-pro',
    category: 'serif',
    description: 'Humanist old-style, warm',
  },
  'spectral': {
    label: 'Spectral',
    cssVar: '--font-spectral',
    category: 'serif',
    description: 'Optimized for digital reading',
  },
  // ── Sans-serif ────────────────────────────────────────────────────────────
  'inter': {
    label: 'Inter',
    cssVar: '--font-inter',
    category: 'sans',
    description: 'Modern, highly legible',
  },
  'source-sans': {
    label: 'Source Sans 3',
    cssVar: '--font-source-sans',
    category: 'sans',
    description: 'Adobe — designed for reading',
  },
  'nunito': {
    label: 'Nunito',
    cssVar: '--font-nunito',
    category: 'sans',
    description: 'Rounded, friendly & clear',
  },
  'open-sans': {
    label: 'Open Sans',
    cssVar: '--font-open-sans',
    category: 'sans',
    description: 'Humanist, universally loved',
  },
}

// Helper: return a static CSS font-family string (used for previews before DOM is ready)
export function getFontFamilyCSS(font: ReaderFontFamily): string {
  const meta = FONTS[font]
  if (!meta) return getFontFamilyCSS(DEFAULT_FONT_FAMILY)
  const fallback = meta.category === 'serif'
    ? 'Georgia, "Times New Roman", serif'
    : 'system-ui, sans-serif'
  return `var(${meta.cssVar}), ${fallback}`
}

// Helper: resolve the ACTUAL font name from the next/font CSS variable at runtime.
// next/font defines CSS vars on <body> — getComputedStyle reads them correctly.
// Falls back to a safe stack if the variable isn't loaded yet.
function resolveFont(font: ReaderFontFamily): string {
  const meta = FONTS[font]
  if (!meta) return resolveFont(DEFAULT_FONT_FAMILY)
  const fallback = meta.category === 'serif'
    ? 'Georgia, "Times New Roman", serif'
    : 'system-ui, sans-serif'
  if (typeof document === 'undefined') return fallback
  const computed = getComputedStyle(document.body).getPropertyValue(meta.cssVar).trim()
  return computed ? `${computed}, ${fallback}` : fallback
}

// ── Context ────────────────────────────────────────────────────────────────────
export const FONT_SIZE_CSS: Record<ReaderFontSize, string> = {
  xs:   '0.875rem',   // 14 px
  sm:   '0.9375rem',  // 15 px
  md:   '1rem',       // 16 px (default)
  lg:   '1.125rem',   // 18 px
  xl:   '1.25rem',    // 20 px
  '2xl': '1.5rem',    // 24 px
}

// ── Line height scale ──────────────────────────────────────────────────────────
export const LINE_HEIGHT_CSS: Record<ReaderLineHeight, string> = {
  tight:   '1.5',
  normal:  '1.7',
  relaxed: '1.9',
  loose:   '2.2',
}

// ── Context ────────────────────────────────────────────────────────────────────
export interface ReaderPreferences {
  fontFamily: ReaderFontFamily
  fontSize: ReaderFontSize
  lineHeight: ReaderLineHeight
}

interface ReaderPreferencesContext extends ReaderPreferences {
  setFontFamily: (v: ReaderFontFamily) => void
  setFontSize: (v: ReaderFontSize) => void
  setLineHeight: (v: ReaderLineHeight) => void
}

const Context = React.createContext<ReaderPreferencesContext>({
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: DEFAULT_FONT_SIZE,
  lineHeight: DEFAULT_LINE_HEIGHT,
  setFontFamily: () => {},
  setFontSize: () => {},
  setLineHeight: () => {},
})

// ── Provider ───────────────────────────────────────────────────────────────────
export function ReaderPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = React.useState<ReaderPreferences>({
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: DEFAULT_FONT_SIZE,
    lineHeight: DEFAULT_LINE_HEIGHT,
  })

  // Load saved preferences on mount
  React.useEffect(() => {
    storage.getPreferences().then((saved) => {
      // Validate the saved font — old values like 'serif'/'sans'/'mono' won't
      // exist in FONTS after the migration, so we fall back to the default.
      const savedFont = saved.readerFontFamily
      const validFont: ReaderFontFamily =
        savedFont && FONTS[savedFont] ? savedFont : DEFAULT_FONT_FAMILY

      setPrefs({
        fontFamily: validFont,
        fontSize:   saved.readerFontSize   ?? DEFAULT_FONT_SIZE,
        lineHeight: saved.readerLineHeight ?? DEFAULT_LINE_HEIGHT,
      })
    })
  }, [])

  // Apply CSS custom properties to <html> whenever prefs change.
  // We use resolveFont() to read the actual computed font name from body
  // (where next/font defines its CSS vars) instead of nesting var() calls.
  React.useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--reader-font-family', resolveFont(prefs.fontFamily))
    root.style.setProperty('--reader-font-size',   FONT_SIZE_CSS[prefs.fontSize])
    root.style.setProperty('--reader-line-height', LINE_HEIGHT_CSS[prefs.lineHeight])
  }, [prefs])

  const setFontFamily = React.useCallback((v: ReaderFontFamily) => {
    setPrefs((p) => ({ ...p, fontFamily: v }))
    storage.setPreference('readerFontFamily', v)
  }, [])

  const setFontSize = React.useCallback((v: ReaderFontSize) => {
    setPrefs((p) => ({ ...p, fontSize: v }))
    storage.setPreference('readerFontSize', v)
  }, [])

  const setLineHeight = React.useCallback((v: ReaderLineHeight) => {
    setPrefs((p) => ({ ...p, lineHeight: v }))
    storage.setPreference('readerLineHeight', v)
  }, [])

  return (
    <Context.Provider value={{ ...prefs, setFontFamily, setFontSize, setLineHeight }}>
      {children}
    </Context.Provider>
  )
}

// ── Consumer hook ──────────────────────────────────────────────────────────────
export function useReaderPreferences() {
  return React.useContext(Context)
}
