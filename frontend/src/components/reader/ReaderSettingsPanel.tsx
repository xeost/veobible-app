'use client'

/**
 * ReaderSettingsPanel
 *
 * Compact floating panel for reader typography customization:
 *  - Font family  — collapsible dropdown list of 10 curated reading fonts
 *  - Font size    — 6-step slider (XS → 2XL)
 *  - Line height  — 4-step slider (Tight → Loose)
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  useReaderPreferences,
  FONTS,
  FONT_SIZE_CSS,
  getFontFamilyCSS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_CONTENT_WIDTH,
} from '@/hooks/useReaderPreferences'
import type { ReaderFontFamily, ReaderFontSize, ReaderLineHeight } from '@/lib/storage/types'
import { useI18n } from '@/lib/i18n/client'
import { Tooltip } from '@/components/ui/Tooltip'

// ── Icons ───────────────────────────────────────────────────────────────────
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)
const ResetIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <polyline points="3 3 3 8 8 8" />
  </svg>
)
const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
)
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const ArrowUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="18 15 12 9 6 15" />
  </svg>
)
const ArrowDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
)
const WidthFullIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M6 12h12M6 12l3-3M6 12l3 3M18 12l-3-3M18 12l-3 3" />
  </svg>
)
const WidthNormalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M8 12h8M8 12l2-2M8 12l2 2M16 12l-2-2M16 12l-2 2" />
  </svg>
)
const WidthThinIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="7" y="5" width="10" height="14" rx="1.5" />
    <path d="M10 12h4" />
  </svg>
)
const WidthVeryThinIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9.5" y="5" width="5" height="14" rx="1" />
  </svg>
)

// ── Option data ──────────────────────────────────────────────────────────────
const FONT_SIZE_STEPS: ReaderFontSize[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl']
const LINE_HEIGHT_STEPS: ReaderLineHeight[] = ['tight', 'normal', 'relaxed', 'loose']

// Ordered display list
const SERIF_FONTS: ReaderFontFamily[] = ['lora', 'merriweather', 'eb-garamond', 'libre-baskerville', 'crimson-pro', 'spectral']
const SANS_FONTS: ReaderFontFamily[]  = ['inter', 'source-sans', 'nunito', 'open-sans', 'noto-sans', 'roboto']
const SCRIPT_FONTS: ReaderFontFamily[] = [
  'dancing-script',
  'playwrite-england',
  'almendra',
  'eagle-lake',
  'im-fell-english',
  'satisfy',
  'courgette',
  'allura',
  'kaushan-script',
  'sacramento',
  'fondamento'
]
const ALL_FONTS: ReaderFontFamily[]   = [...SERIF_FONTS, ...SANS_FONTS, ...SCRIPT_FONTS]

interface ReaderSettingsPanelProps {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement>
}

export function ReaderSettingsPanel({ open, onClose, anchorRef }: ReaderSettingsPanelProps) {
  const { t } = useI18n()
  const {
    fontFamily,
    fontSize,
    lineHeight,
    contentWidth,
    setFontFamily,
    setFontSize,
    setLineHeight,
    setContentWidth,
    resetPreferences,
  } = useReaderPreferences()
  const panelRef = useRef<HTMLDivElement>(null)
  const [fontListOpen, setFontListOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [isResetHovered, setIsResetHovered] = useState(false)

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const defaultLineHeight = isMobile ? 'normal' : 'relaxed'
  const isDefault =
    fontFamily === DEFAULT_FONT_FAMILY &&
    fontSize === DEFAULT_FONT_SIZE &&
    lineHeight === defaultLineHeight &&
    contentWidth === DEFAULT_CONTENT_WIDTH

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return

    const updatePosition = () => {
      const rect = anchorRef.current!.getBoundingClientRect()
      const panelWidth = 272 // 17rem
      const buttonCenter = rect.left + rect.width / 2
      let left = buttonCenter - panelWidth / 2

      const margin = 16
      const minLeft = margin
      const maxLeft = window.innerWidth - panelWidth - margin
      left = Math.max(minLeft, Math.min(left, maxLeft))

      setCoords({
        top: rect.bottom + 8,
        left,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [open, anchorRef])

  const handlePrevFont = () => {
    const idx = ALL_FONTS.indexOf(fontFamily)
    if (idx === -1) {
      setFontFamily(ALL_FONTS[0])
    } else {
      const prevIdx = (idx - 1 + ALL_FONTS.length) % ALL_FONTS.length
      setFontFamily(ALL_FONTS[prevIdx])
    }
  }

  const handleNextFont = () => {
    const idx = ALL_FONTS.indexOf(fontFamily)
    if (idx === -1) {
      setFontFamily(ALL_FONTS[0])
    } else {
      const nextIdx = (idx + 1) % ALL_FONTS.length
      setFontFamily(ALL_FONTS[nextIdx])
    }
  }

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose, anchorRef])

  // Close on Escape; collapse font list first if open
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (fontListOpen) setFontListOpen(false)
        else onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, fontListOpen])

  // Reset font list state when panel closes
  useEffect(() => {
    if (!open) setFontListOpen(false)
  }, [open])

  if (!open) return null

  const fontSizeIdx   = FONT_SIZE_STEPS.indexOf(fontSize)
  const lineHeightIdx = LINE_HEIGHT_STEPS.indexOf(lineHeight)
  const currentMeta   = FONTS[fontFamily]

  const baseSize = FONT_SIZE_CSS[fontSize]
  const num = parseFloat(baseSize)
  const unit = baseSize.replace(/[0-9.]/g, '')
  const adjust = currentMeta?.sizeAdjust || 1
  const previewSize = `${num * adjust}${unit}`

  const previewLineHeight = (1.4 * (currentMeta?.lineHeightAdjust || 1)).toFixed(2)

  const handleSelectFont = (key: ReaderFontFamily) => {
    setFontFamily(key)
    setFontListOpen(false)
  }

  const renderFontOption = (key: ReaderFontFamily) => {
    const meta = FONTS[key]
    const isActive = fontFamily === key
    return (
      <button
        key={key}
        onClick={() => handleSelectFont(key)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-100"
        style={{
          background: isActive ? 'var(--brand-light)' : 'transparent',
          color: isActive ? 'var(--brand)' : 'var(--text-primary)',
        }}
      >
        <span
          className="text-lg leading-none w-7 text-center flex-shrink-0"
          style={{ fontFamily: getFontFamilyCSS(key) }}
        >
          Aa
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium leading-tight">{meta.label}</span>
          <span className="block text-[11px] leading-tight" style={{ color: isActive ? 'var(--brand)' : 'var(--text-muted)' }}>
            {meta.description}
          </span>
        </span>
        {isActive && <CheckIcon />}
      </button>
    )
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t.reader.typography}
      className="fixed z-50 rounded-2xl shadow-2xl"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        top: coords ? `${coords.top}px` : 'calc(4rem + var(--sat) + 8px)',
        left: coords ? `${coords.left}px` : 'auto',
        right: coords ? 'auto' : '16px',
        width: '17rem',
      }}
    >
      {/* ── Panel header ───────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t.reader.typography}
        </p>
        <div className="flex items-center gap-1.5">
          <Tooltip content={t.reader.resetTypography}>
            <button
              onClick={resetPreferences}
              disabled={isDefault}
              onMouseEnter={() => setIsResetHovered(true)}
              onMouseLeave={() => setIsResetHovered(false)}
              className="btn-icon p-1 relative flex items-center justify-center transition-all duration-200"
              style={{
                opacity: isDefault ? 0.35 : 1,
                cursor: isDefault ? 'default' : 'pointer',
                color: 'var(--text-secondary)',
              }}
              aria-label={t.reader.resetTypography}
            >
              <span
                style={{
                  display: 'inline-flex',
                  transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: !isDefault && isResetHovered ? 'rotate(-180deg)' : 'none',
                }}
              >
                <ResetIcon />
              </span>
            </button>
          </Tooltip>
          <button onClick={onClose} className="btn-icon p-1" aria-label="Close">
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">

        {/* ── Font family ────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {t.reader.fontFamily}
            </label>
            <div className="flex items-center gap-1">
              <Tooltip content={t.reader.prevFont}>
                <button
                  onClick={handlePrevFont}
                  className="btn-icon p-1"
                  aria-label={t.reader.prevFont}
                >
                  <ArrowUpIcon />
                </button>
              </Tooltip>
              <Tooltip content={t.reader.nextFont}>
                <button
                  onClick={handleNextFont}
                  className="btn-icon p-1"
                  aria-label={t.reader.nextFont}
                >
                  <ArrowDownIcon />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Trigger button — shows selected font */}
          <button
            onClick={() => setFontListOpen((o) => !o)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150"
            style={{
              background: 'var(--bg-page)',
              border: `1.5px solid ${fontListOpen ? 'var(--brand)' : 'var(--border)'}`,
              color: 'var(--text-primary)',
            }}
          >
            <span
              className="text-lg leading-none w-7 text-center flex-shrink-0"
              style={{ fontFamily: getFontFamilyCSS(fontFamily) }}
            >
              Aa
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium leading-tight">{currentMeta?.label}</span>
              <span className="block text-[11px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                {t.reader[`fontCategory_${currentMeta?.category}` as keyof typeof t.reader] || currentMeta?.category}
              </span>
            </span>
            <ChevronDown open={fontListOpen} />
          </button>

          {/* Collapsible font list */}
          {fontListOpen && (
            <div
              className="mt-1.5 rounded-xl overflow-y-auto"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                maxHeight: '240px',
              }}
            >
              {/* Serif group */}
              <div className="px-3 pt-2 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{t.reader.fontCategory_serif}</p>
              </div>
              {SERIF_FONTS.map(renderFontOption)}

              {/* Divider */}
              <div className="mx-3 my-1" style={{ height: 1, background: 'var(--border)' }} />

              {/* Sans group */}
              <div className="px-3 pt-1 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{t.reader.fontCategory_sans}</p>
              </div>
              {SANS_FONTS.map(renderFontOption)}

              {/* Divider */}
              <div className="mx-3 my-1" style={{ height: 1, background: 'var(--border)' }} />

              {/* Script group */}
              <div className="px-3 pt-1 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{t.reader.fontCategory_script}</p>
              </div>
              {SCRIPT_FONTS.map(renderFontOption)}
              <div className="h-1.5" />
            </div>
          )}
        </section>

        {/* ── Font size ──────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {t.reader.fontSize}
            </label>
            <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
              {fontSize.toUpperCase()}
            </span>
          </div>
          {/* Live preview */}
          <p
            className="text-center mb-3 truncate"
            style={{
              fontFamily: getFontFamilyCSS(fontFamily),
              fontSize: previewSize,
              lineHeight: previewLineHeight,
              color: 'var(--reader-text)',
            }}
          >
            {t.reader.typographyPreview}
          </p>
          <input
            type="range" min={0} max={FONT_SIZE_STEPS.length - 1} step={1}
            value={fontSizeIdx}
            onChange={(e) => setFontSize(FONT_SIZE_STEPS[parseInt(e.target.value)])}
            className="w-full reader-slider"
            aria-label={t.reader.fontSize}
          />
          <div className="flex justify-between mt-1.5">
            {FONT_SIZE_STEPS.map((s, i) => (
              <span key={s} className="w-1.5 h-1.5 rounded-full" style={{ background: i <= fontSizeIdx ? 'var(--brand)' : 'var(--border-strong)' }} />
            ))}
          </div>
        </section>

        {/* ── Line height ────────────────────────────────────────────────── */}
        <section className="pb-1">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {t.reader.lineHeight}
            </label>
            <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
              {t.reader[`lineHeight_${lineHeight}` as keyof typeof t.reader]}
            </span>
          </div>
          <input
            type="range" min={0} max={LINE_HEIGHT_STEPS.length - 1} step={1}
            value={lineHeightIdx}
            onChange={(e) => setLineHeight(LINE_HEIGHT_STEPS[parseInt(e.target.value)])}
            className="w-full reader-slider"
            aria-label={t.reader.lineHeight}
          />
          <div className="flex justify-between mt-1.5">
            {LINE_HEIGHT_STEPS.map((s, i) => (
              <span key={s} className="w-1.5 h-1.5 rounded-full" style={{ background: i <= lineHeightIdx ? 'var(--brand)' : 'var(--border-strong)' }} />
            ))}
          </div>
        </section>

        {/* ── Content width ────────────────────────────────────────────────── */}
        <section className="hidden md:block pb-1">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {t.reader.contentWidth}
            </label>
            <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
              {t.reader[`contentWidth_${contentWidth === 'very-thin' ? 'veryThin' : contentWidth}` as keyof typeof t.reader]}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 p-0.5 rounded-xl" style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }}>
            {(['full', 'normal', 'thin', 'very-thin'] as const).map((w) => {
              const isActive = contentWidth === w
              let Icon = WidthNormalIcon
              if (w === 'full') Icon = WidthFullIcon
              if (w === 'thin') Icon = WidthThinIcon
              if (w === 'very-thin') Icon = WidthVeryThinIcon
              return (
                <Tooltip
                  key={w}
                  content={t.reader[`contentWidth_${w === 'very-thin' ? 'veryThin' : w}` as keyof typeof t.reader]}
                  placement="top"
                  className="flex-1"
                >
                  <button
                    onClick={() => setContentWidth(w)}
                    className="w-full flex items-center justify-center p-2 rounded-lg transition-all duration-150"
                    style={{
                      background: isActive ? 'var(--bg-card)' : 'transparent',
                      color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
                      boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                      border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                    }}
                    aria-label={t.reader[`contentWidth_${w === 'very-thin' ? 'veryThin' : w}` as keyof typeof t.reader]}
                  >
                    <Icon />
                  </button>
                </Tooltip>
              )
            })}
          </div>
        </section>

      </div>
    </div>
  )
}
