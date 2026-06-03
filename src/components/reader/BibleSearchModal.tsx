'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/client'
import { fetchChapter } from '@/lib/bible/bibleDataCache'
import type { BookInfo } from '@/lib/bible/types'

// ── Icons ─────────────────────────────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)
const BookIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)
const RibbonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
  </svg>
)
const SpinnerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
    <path d="M21 12a9 9 0 11-6.219-8.56" />
  </svg>
)
const ChevronDownIcon = ({ open }: { open: boolean }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
)

// ── Types ─────────────────────────────────────────────────────────────────────
interface VerseHit {
  bookId: string
  bookSlug: string
  bookName: string
  testament: 'old' | 'new'
  chapter: number
  verse: number
  text: string
  /** The highlighted text split into segments: [plain, highlight, plain, …] */
  segments: Array<{ text: string; highlight: boolean }>
}

interface BookGroup {
  bookId: string
  bookSlug: string
  bookName: string
  testament: 'old' | 'new'
  hits: VerseHit[]
}

// Reset between calls
function matchSegments(text: string, query: string): Array<{ text: string; highlight: boolean }> {
  if (!query.trim()) return [{ text, highlight: false }]
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  let matched = false
  return parts.map((part) => {
    const isMatch = regex.test(part)
    regex.lastIndex = 0
    if (isMatch) matched = true
    return { text: part, highlight: isMatch }
  })
}

// ── Search worker (runs in a microtask queue to avoid blocking UI) ─────────────
interface SearchOptions {
  lang: string
  version: string
  query: string
  books: BookInfo[]
  scopeBookId?: string // undefined = whole Bible
  signal: AbortSignal
  onResult: (group: BookGroup) => void
  onDone: () => void
  onError: (err: unknown) => void
}

async function runSearch({
  lang,
  version,
  query,
  books,
  scopeBookId,
  signal,
  onResult,
  onDone,
  onError,
}: SearchOptions) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    onDone()
    return
  }

  const booksToSearch = scopeBookId ? books.filter((b) => b.id === scopeBookId) : books

  try {
    for (const book of booksToSearch) {
      if (signal.aborted) return
      const bookHits: VerseHit[] = []

      for (let ch = 1; ch <= book.chapters; ch++) {
        if (signal.aborted) return

        let verses: Array<{ verse: number; text: string }> = []
        try {
          verses = await fetchChapter(lang, version, book.id, ch, signal)
        } catch {
          if (signal.aborted) return
          continue
        }

        for (const v of verses) {
          if (v.text.toLowerCase().includes(normalizedQuery)) {
            bookHits.push({
              bookId: book.id,
              bookSlug: book.slug,
              bookName: book.name,
              testament: book.testament,
              chapter: ch,
              verse: v.verse,
              text: v.text,
              segments: matchSegments(v.text, query.trim()),
            })
          }
        }
      }

      if (bookHits.length > 0 && !signal.aborted) {
        onResult({
          bookId: book.id,
          bookSlug: book.slug,
          bookName: book.name,
          testament: book.testament,
          hits: bookHits,
        })
      }

      // Yield to the event loop between books
      await new Promise<void>((r) => setTimeout(r, 0))
    }
    if (!signal.aborted) onDone()
  } catch (err) {
    if (!signal.aborted) onError(err)
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function HighlightedText({ segments }: { segments: Array<{ text: string; highlight: boolean }> }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            style={{
              background: 'var(--brand-light)',
              color: 'var(--brand)',
              borderRadius: '2px',
              padding: '0 1px',
            }}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  )
}

interface BookGroupCardProps {
  group: BookGroup
  lang: string
  version: string
  onNavigate: (bookSlug: string, chapter: number) => void
  initiallyOpen?: boolean
}

function BookGroupCard({ group, lang, version, onNavigate, initiallyOpen = false }: BookGroupCardProps) {
  const [open, setOpen] = useState(initiallyOpen)

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'var(--bg-card)',
      }}
    >
      {/* Header row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 transition-all duration-150"
        style={{
          background: open ? 'var(--brand-light)' : 'transparent',
          color: open ? 'var(--brand)' : 'var(--text-primary)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <span style={{ color: open ? 'var(--brand)' : 'var(--text-muted)' }}>
            <BookIcon />
          </span>
          <span className="font-semibold text-sm">{group.bookName}</span>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: open ? 'var(--brand)' : 'var(--brand-light)',
              color: open ? 'white' : 'var(--brand)',
            }}
          >
            {group.hits.length}
          </span>
        </div>
        <ChevronDownIcon open={open} />
      </button>

      {/* Verse list */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {group.hits.map((hit, idx) => (
            <Link
              key={`${hit.chapter}-${hit.verse}`}
              href={`/${lang}/${version}/${hit.bookSlug}/${hit.chapter}#verse-${hit.verse}`}
              onClick={() => onNavigate(hit.bookSlug, hit.chapter)}
              className="block px-4 py-3 transition-all duration-150 group"
              style={{
                borderTop: idx > 0 ? '1px solid var(--border)' : undefined,
                textDecoration: 'none',
              }}
            >
              <div className="flex items-baseline gap-2 mb-0.5">
                <span
                  className="text-xs font-bold tabular-nums flex-shrink-0"
                  style={{ color: 'var(--brand)' }}
                >
                  {hit.chapter}:{hit.verse}
                </span>
                <span
                  className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                >
                  →
                </span>
              </div>
              <p
                className="text-sm leading-relaxed group-hover:text-brand transition-colors duration-150"
                style={{ color: 'var(--text-secondary)' }}
              >
                <HighlightedText segments={hit.segments} />
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
interface BibleSearchModalProps {
  open: boolean
  onClose: () => void
  lang: string
  version: string
  books: BookInfo[]
  currentBookId?: string
  currentBookSlug?: string
  currentChapter?: number
  onSetRibbon?: (bookSlug: string, chapter: number) => Promise<void>
}

export function BibleSearchModal({
  open,
  onClose,
  lang,
  version,
  books,
  currentBookId,
  currentBookSlug,
  currentChapter,
  onSetRibbon,
}: BibleSearchModalProps) {
  const { t } = useI18n()

  // Query state
  const [query, setQuery] = useState('')
  const [scopeCurrentBook, setScopeCurrentBook] = useState(false)
  const [setRibbonBeforeNav, setSetRibbonBeforeNav] = useState(false)

  // Results state
  const [results, setResults] = useState<BookGroup[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [totalHits, setTotalHits] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      setQuery('')
      setResults([])
      setSearching(false)
      setSearched(false)
      setTotalHits(0)
    }
  }, [open])

  const startSearch = useCallback(
    (q: string, scopeBook: boolean) => {
      // Cancel previous search
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      if (!q.trim() || q.trim().length < 2) {
        setResults([])
        setSearching(false)
        setSearched(false)
        setTotalHits(0)
        return
      }

      setResults([])
      setSearching(true)
      setSearched(false)
      setTotalHits(0)

      let count = 0

      runSearch({
        lang,
        version,
        query: q,
        books,
        scopeBookId: scopeBook && currentBookId ? currentBookId : undefined,
        signal: ctrl.signal,
        onResult(group) {
          count += group.hits.length
          setTotalHits(count)
          setResults((prev) => [...prev, group])
        },
        onDone() {
          setSearching(false)
          setSearched(true)
        },
        onError() {
          setSearching(false)
          setSearched(true)
        },
      })
    },
    [lang, version, books, currentBookId],
  )

  // Debounced search trigger
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      startSearch(q, scopeCurrentBook)
    }, 350)
  }

  const handleScopeChange = (scopeBook: boolean) => {
    setScopeCurrentBook(scopeBook)
    if (query.trim().length >= 2) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      startSearch(query, scopeBook)
    }
  }

  const handleNavigate = useCallback(
    async (bookSlug: string, chapter: number) => {
      if (setRibbonBeforeNav && onSetRibbon && currentBookSlug && currentChapter) {
        await onSetRibbon(currentBookSlug, currentChapter)
      }
      onClose()
    },
    [setRibbonBeforeNav, onSetRibbon, currentBookSlug, currentChapter, onClose],
  )

  if (!open) return null

  const hasCurrentBook = !!currentBookId
  const oldTestamentResults = results.filter((g) => g.testament === 'old')
  const newTestamentResults = results.filter((g) => g.testament === 'new')

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ background: 'var(--bg-overlay)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal panel */}
      <div
        className="relative w-full max-w-2xl mx-4 mt-16 mb-8 rounded-2xl shadow-2xl flex flex-col animate-fade-in"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          maxHeight: 'calc(100vh - 7rem)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t.search.title}
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {/* Search input */}
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            type="search"
            id="bible-search-input"
            value={query}
            onChange={handleQueryChange}
            placeholder={t.search.placeholder}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {searching && (
            <span style={{ color: 'var(--brand)', flexShrink: 0 }}>
              <SpinnerIcon />
            </span>
          )}
          <button
            onClick={onClose}
            className="btn-icon p-1.5 flex-shrink-0"
            aria-label={t.search.close}
            id="bible-search-close-btn"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Options bar ─────────────────────────────────────────────────── */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {/* Scope toggle */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ border: '1px solid var(--border)', background: 'var(--bg-page)' }}>
            <button
              onClick={() => handleScopeChange(false)}
              className="px-3 py-1 text-xs font-medium rounded-md transition-all duration-150"
              id="search-scope-all-btn"
              style={{
                background: !scopeCurrentBook ? 'var(--bg-card)' : 'transparent',
                color: !scopeCurrentBook ? 'var(--brand)' : 'var(--text-muted)',
                boxShadow: !scopeCurrentBook ? 'var(--shadow-sm)' : 'none',
                border: !scopeCurrentBook ? '1px solid var(--border)' : '1px solid transparent',
              }}
            >
              {t.search.scopeAll}
            </button>
            <button
              onClick={() => handleScopeChange(true)}
              disabled={!hasCurrentBook}
              className="px-3 py-1 text-xs font-medium rounded-md transition-all duration-150"
              id="search-scope-book-btn"
              style={{
                background: scopeCurrentBook ? 'var(--bg-card)' : 'transparent',
                color: scopeCurrentBook ? 'var(--brand)' : 'var(--text-muted)',
                boxShadow: scopeCurrentBook ? 'var(--shadow-sm)' : 'none',
                border: scopeCurrentBook ? '1px solid var(--border)' : '1px solid transparent',
                opacity: !hasCurrentBook ? 0.4 : 1,
                cursor: !hasCurrentBook ? 'not-allowed' : 'pointer',
              }}
            >
              {t.search.scopeBook}
            </button>
          </div>

          {/* Ribbon toggle */}
          <label
            className="flex items-center gap-1.5 cursor-pointer select-none"
            style={{ color: setRibbonBeforeNav ? 'var(--brand)' : 'var(--text-muted)' }}
          >
            <input
              type="checkbox"
              id="search-set-ribbon-checkbox"
              checked={setRibbonBeforeNav}
              onChange={(e) => setSetRibbonBeforeNav(e.target.checked)}
              className="sr-only"
            />
            {/* Custom checkbox */}
            <span
              className="flex items-center justify-center w-4 h-4 rounded transition-all duration-150"
              style={{
                border: `1.5px solid ${setRibbonBeforeNav ? 'var(--brand)' : 'var(--border-strong)'}`,
                background: setRibbonBeforeNav ? 'var(--brand)' : 'transparent',
              }}
            >
              {setRibbonBeforeNav && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              )}
            </span>
            <RibbonIcon />
            <span className="text-xs font-medium">{t.search.setRibbonBeforeNav}</span>
          </label>
        </div>

        {/* ── Results area ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

          {/* Empty / prompt state */}
          {!searched && !searching && query.trim().length < 2 && (
            <div className="flex flex-col items-center justify-center py-14 gap-3" style={{ color: 'var(--text-muted)' }}>
              <span style={{ opacity: 0.5 }}>
                <SearchIcon />
              </span>
              <p className="text-sm text-center">{t.search.hint}</p>
            </div>
          )}

          {/* Searching in progress (no results yet) */}
          {searching && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 gap-3" style={{ color: 'var(--text-muted)' }}>
              <SpinnerIcon />
              <p className="text-sm">{t.search.searching}</p>
            </div>
          )}

          {/* No results after search */}
          {searched && !searching && results.length === 0 && query.trim().length >= 2 && (
            <div className="flex flex-col items-center justify-center py-14 gap-3" style={{ color: 'var(--text-muted)' }}>
              <p className="text-sm font-medium">{t.search.noResults}</p>
              <p className="text-xs text-center">{t.search.noResultsHint}</p>
            </div>
          )}

          {/* Results summary */}
          {results.length > 0 && (
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {t.search.results(totalHits, results.length)}
                {searching && ` — ${t.search.stillSearching}`}
              </p>
            </div>
          )}

          {/* Old Testament results */}
          {oldTestamentResults.length > 0 && (
            <div>
              {newTestamentResults.length > 0 && (
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
                  {t.testament.old}
                </p>
              )}
              <div className="space-y-2">
                {oldTestamentResults.map((group) => (
                  <BookGroupCard
                    key={group.bookId}
                    group={group}
                    lang={lang}
                    version={version}
                    onNavigate={handleNavigate}
                    initiallyOpen={scopeCurrentBook || results.length <= 3}
                  />
                ))}
              </div>
            </div>
          )}

          {/* New Testament results */}
          {newTestamentResults.length > 0 && (
            <div>
              {oldTestamentResults.length > 0 && (
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2 mt-3 px-1" style={{ color: 'var(--text-muted)' }}>
                  {t.testament.new}
                </p>
              )}
              <div className="space-y-2">
                {newTestamentResults.map((group) => (
                  <BookGroupCard
                    key={group.bookId}
                    group={group}
                    lang={lang}
                    version={version}
                    onNavigate={handleNavigate}
                    initiallyOpen={scopeCurrentBook || results.length <= 3}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Bottom padding */}
          <div className="h-4" />
        </div>
      </div>
    </div>
  )
}
