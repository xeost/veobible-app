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
  ReaderContentWidth,
} from '@/lib/storage/types'

// ── Defaults ──────────────────────────────────────────────────────────────────
export const DEFAULT_FONT_FAMILY: ReaderFontFamily = 'im-fell-english'
export const DEFAULT_FONT_SIZE: ReaderFontSize = 'lg'
export const DEFAULT_LINE_HEIGHT: ReaderLineHeight = 'relaxed'
export const DEFAULT_CONTENT_WIDTH: ReaderContentWidth = 'normal'

// ── Font metadata (label + CSS stack) ─────────────────────────────────────────
export interface FontMeta {
  label: string
  cssVar: string   // the CSS variable name injected by next/font
  category: 'serif' | 'sans' | 'script'
  description: string
  sizeAdjust?: number
  lineHeightAdjust?: number
}

export const FONTS: Record<ReaderFontFamily, FontMeta> = {
  // ── Serif ────────────────────────────────────────────────────────────────
  'lora': {
    label: 'Lora',
    cssVar: '--font-lora',
    category: 'serif',
    description: 'Elegant balanced serif',
    sizeAdjust: 1.0,
    lineHeightAdjust: 1.0,
  },
  'merriweather': {
    label: 'Merriweather',
    cssVar: '--font-merriweather',
    category: 'serif',
    description: 'Designed for screen readability',
    sizeAdjust: 0.90,
    lineHeightAdjust: 1.08,
  },
  'eb-garamond': {
    label: 'EB Garamond',
    cssVar: '--font-eb-garamond',
    category: 'serif',
    description: 'Classic old-style, timeless',
    sizeAdjust: 1.12,
    lineHeightAdjust: 0.88,
  },
  'libre-baskerville': {
    label: 'Libre Baskerville',
    cssVar: '--font-libre-baskerville',
    category: 'serif',
    description: 'Traditional book typography',
    sizeAdjust: 0.88,
    lineHeightAdjust: 1.08,
  },
  'crimson-pro': {
    label: 'Crimson Pro',
    cssVar: '--font-crimson-pro',
    category: 'serif',
    description: 'Humanist old-style, warm',
    sizeAdjust: 1.05,
    lineHeightAdjust: 0.96,
  },
  'spectral': {
    label: 'Spectral',
    cssVar: '--font-spectral',
    category: 'serif',
    description: 'Optimized for digital reading',
    sizeAdjust: 1.08,
    lineHeightAdjust: 0.92,
  },
  // ── Sans-serif ────────────────────────────────────────────────────────────
  'inter': {
    label: 'Inter',
    cssVar: '--font-inter',
    category: 'sans',
    description: 'Modern, highly legible',
    sizeAdjust: 0.96,
    lineHeightAdjust: 1.02,
  },
  'source-sans': {
    label: 'Source Sans 3',
    cssVar: '--font-source-sans',
    category: 'sans',
    description: 'Adobe — designed for reading',
    sizeAdjust: 0.96,
    lineHeightAdjust: 1.02,
  },
  'nunito': {
    label: 'Nunito',
    cssVar: '--font-nunito',
    category: 'sans',
    description: 'Rounded, friendly & clear',
    sizeAdjust: 1.0,
    lineHeightAdjust: 1.0,
  },
  'open-sans': {
    label: 'Open Sans',
    cssVar: '--font-open-sans',
    category: 'sans',
    description: 'Humanist, universally loved',
    sizeAdjust: 0.95,
    lineHeightAdjust: 1.02,
  },
  'noto-sans': {
    label: 'Noto Sans',
    cssVar: '--font-noto-sans',
    category: 'sans',
    description: 'Clean, universal and balanced',
    sizeAdjust: 0.94,
    lineHeightAdjust: 1.04,
  },
  'roboto': {
    label: 'Roboto',
    cssVar: '--font-roboto',
    category: 'sans',
    description: 'Modern, geometric and readable',
    sizeAdjust: 0.96,
    lineHeightAdjust: 1.02,
  },
  // ── Script ────────────────────────────────────────────────────────────────
  'dancing-script': {
    label: 'Dancing Script',
    cssVar: '--font-dancing-script',
    category: 'script',
    description: 'Cursive, friendly and readable',
    sizeAdjust: 1.30,
    lineHeightAdjust: 0.85,
  },
  'playwrite-england': {
    label: 'Playwrite England Joined',
    cssVar: '--font-playwrite-england',
    category: 'script',
    description: 'Connected handwriting style',
    sizeAdjust: 1.25,
    lineHeightAdjust: 0.95,
  },
  'almendra': {
    label: 'Almendra',
    cssVar: '--font-almendra',
    category: 'script',
    description: 'Blackletter fantasy style',
    sizeAdjust: 1.15,
    lineHeightAdjust: 0.96,
  },
  'eagle-lake': {
    label: 'Eagle Lake',
    cssVar: '--font-eagle-lake',
    category: 'script',
    description: 'Elegant, artistic script',
    sizeAdjust: 1.22,
    lineHeightAdjust: 0.92,
  },
  'im-fell-english': {
    label: 'IM Fell English',
    cssVar: '--font-im-fell-english',
    category: 'script',
    description: 'Ancient printed script style',
    sizeAdjust: 1.15,
    lineHeightAdjust: 0.96,
  },
  'satisfy': {
    label: 'Satisfy',
    cssVar: '--font-satisfy',
    category: 'script',
    description: 'Timeless brush script',
    sizeAdjust: 1.32,
    lineHeightAdjust: 0.82,
  },
  'courgette': {
    label: 'Courgette',
    cssVar: '--font-courgette',
    category: 'script',
    description: 'Medium-contrast elegant script',
    sizeAdjust: 1.20,
    lineHeightAdjust: 0.92,
  },
  'allura': {
    label: 'Allura',
    cssVar: '--font-allura',
    category: 'script',
    description: 'Soft, clean handwritten look',
    sizeAdjust: 1.36,
    lineHeightAdjust: 0.80,
  },
  'kaushan-script': {
    label: 'Kaushan Script',
    cssVar: '--font-kaushan-script',
    category: 'script',
    description: 'Artistic brush calligraphy',
    sizeAdjust: 1.22,
    lineHeightAdjust: 0.92,
  },
  'sacramento': {
    label: 'Sacramento',
    cssVar: '--font-sacramento',
    category: 'script',
    description: 'Thin, elegant handwriting',
    sizeAdjust: 1.42,
    lineHeightAdjust: 0.78,
  },
  'fondamento': {
    label: 'Fondamento',
    cssVar: '--font-fondamento',
    category: 'script',
    description: 'Calligraphic study style',
    sizeAdjust: 1.18,
    lineHeightAdjust: 0.94,
  },
}

// Helper: return a static CSS font-family string (used for previews before DOM is ready)
export function getFontFamilyCSS(font: ReaderFontFamily): string {
  const meta = FONTS[font]
  if (!meta) return getFontFamilyCSS(DEFAULT_FONT_FAMILY)
  const fallback = meta.category === 'serif'
    ? 'Georgia, "Times New Roman", serif'
    : meta.category === 'script'
    ? 'cursive, sans-serif'
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
    : meta.category === 'script'
    ? 'cursive, sans-serif'
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

// ── Content width scale ────────────────────────────────────────────────────────
export const CONTENT_WIDTH_CSS: Record<ReaderContentWidth, string> = {
  'full': '100%',
  'normal': '42rem',
  'thin': '32rem',
  'very-thin': '24rem',
}

// ── Context ────────────────────────────────────────────────────────────────────
export interface ReaderPreferences {
  fontFamily: ReaderFontFamily
  fontSize: ReaderFontSize
  lineHeight: ReaderLineHeight
  contentWidth: ReaderContentWidth
}

interface ReaderPreferencesContext extends ReaderPreferences {
  setFontFamily: (v: ReaderFontFamily) => void
  setFontSize: (v: ReaderFontSize) => void
  setLineHeight: (v: ReaderLineHeight) => void
  setContentWidth: (v: ReaderContentWidth) => void
}

const Context = React.createContext<ReaderPreferencesContext>({
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: DEFAULT_FONT_SIZE,
  lineHeight: DEFAULT_LINE_HEIGHT,
  contentWidth: DEFAULT_CONTENT_WIDTH,
  setFontFamily: () => {},
  setFontSize: () => {},
  setLineHeight: () => {},
  setContentWidth: () => {},
})

// ── Provider ───────────────────────────────────────────────────────────────────
export function ReaderPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = React.useState<ReaderPreferences>({
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: DEFAULT_FONT_SIZE,
    lineHeight: DEFAULT_LINE_HEIGHT,
    contentWidth: DEFAULT_CONTENT_WIDTH,
  })

  // Load saved preferences on mount
  React.useEffect(() => {
    storage.getPreferences().then((saved) => {
      // Validate the saved font — old values like 'serif'/'sans'/'mono' won't
      // exist in FONTS after the migration, so we fall back to the default.
      const savedFont = saved.readerFontFamily
      const validFont: ReaderFontFamily =
        savedFont && FONTS[savedFont] ? savedFont : DEFAULT_FONT_FAMILY

      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
      const fallbackLh = isMobile ? 'normal' : 'relaxed'

      setPrefs({
        fontFamily: validFont,
        fontSize:   saved.readerFontSize   ?? DEFAULT_FONT_SIZE,
        lineHeight: saved.readerLineHeight ?? fallbackLh,
        contentWidth: saved.readerContentWidth ?? DEFAULT_CONTENT_WIDTH,
      })
    })
  }, [])

  // Apply CSS custom properties to <html> whenever prefs change.
  // We use resolveFont() to read the actual computed font name from body
  // (where next/font defines its CSS vars) instead of nesting var() calls.
  React.useEffect(() => {
    const root = document.documentElement
    const meta = FONTS[prefs.fontFamily]
    const baseSize = FONT_SIZE_CSS[prefs.fontSize]
    const baseLineHeight = parseFloat(LINE_HEIGHT_CSS[prefs.lineHeight])
    
    // Parse the size value to adjust fonts
    const num = parseFloat(baseSize)
    const unit = baseSize.replace(/[0-9.]/g, '')
    const sizeAdjust = meta?.sizeAdjust || 1
    const adjustedSize = `${num * sizeAdjust}${unit}`

    // Parse the line height to adjust fonts
    const lhAdjust = meta?.lineHeightAdjust || 1
    const adjustedLineHeight = (baseLineHeight * lhAdjust).toFixed(2)

    root.style.setProperty('--reader-font-family', resolveFont(prefs.fontFamily))
    root.style.setProperty('--reader-font-size',   adjustedSize)
    root.style.setProperty('--reader-line-height', adjustedLineHeight)
    root.style.setProperty('--reader-max-width',   CONTENT_WIDTH_CSS[prefs.contentWidth])
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

  const setContentWidth = React.useCallback((v: ReaderContentWidth) => {
    setPrefs((p) => ({ ...p, contentWidth: v }))
    storage.setPreference('readerContentWidth', v)
  }, [])

  return (
    <Context.Provider value={{ ...prefs, setFontFamily, setFontSize, setLineHeight, setContentWidth }}>
      {children}
    </Context.Provider>
  )
}

// ── Consumer hook ──────────────────────────────────────────────────────────────
export function useReaderPreferences() {
  return React.useContext(Context)
}
