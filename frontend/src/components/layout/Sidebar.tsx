'use client'

import React from 'react'
import Link from 'next/link'
import type { BookInfo } from '@/lib/bible/types'
import { useI18n } from '@/lib/i18n/client'
import { Tooltip } from '@/components/ui/Tooltip'

interface SidebarProps {
  lang: string
  version: string
  versionName?: string
  books: BookInfo[]
  currentBookSlug?: string
  currentChapter?: number
}

function isReaderPath(path: string): boolean {
  const segments = path.split('/').filter(Boolean)
  if (segments.length !== 4) return false
  const chapter = parseInt(segments[3], 10)
  return !isNaN(chapter)
}

export function Sidebar({ lang, version, versionName, books, currentBookSlug, currentChapter }: SidebarProps) {
  const { t } = useI18n()
  const [expandedBook, setExpandedBook] = React.useState<string | null>(currentBookSlug ?? null)
  const navRef = React.useRef<HTMLElement>(null)
  // Ref attached to the active book's button so we can scroll it into view on first load
  const activeBookRef = React.useRef<HTMLButtonElement>(null)

  // Expand active book when slug changes
  React.useEffect(() => {
    if (currentBookSlug) {
      setExpandedBook(currentBookSlug)
    }
  }, [currentBookSlug])

  // Save manual scroll position on scroll
  const handleScroll = React.useCallback(() => {
    if (navRef.current && typeof window !== 'undefined') {
      (window as any).__sidebar_scroll = navRef.current.scrollTop
    }
  }, [])

  // On mount decide how to position the sidebar:
  //   • First time entering the reading page -> scroll active book to the top of the sidebar.
  //   • Navigating within the reading page -> preserve the exact manual scroll position.
  React.useLayoutEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as any
      const currentPath = window.location.pathname
      const lastPath = win.__prev_pathname || ''

      const isNavigatingWithinReader = isReaderPath(currentPath) && isReaderPath(lastPath)

      if (!isNavigatingWithinReader && activeBookRef.current) {
        requestAnimationFrame(() => {
          activeBookRef.current?.scrollIntoView({ block: 'start' })
        })
      } else {
        const savedScroll = win.__sidebar_scroll
        if (savedScroll !== undefined && navRef.current) {
          navRef.current.scrollTop = savedScroll
        }
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const oldTestament = books.filter((b) => b.testament === 'old')
  const newTestament = books.filter((b) => b.testament === 'new')

  const renderBookGroup = (groupBooks: BookInfo[], testamentLabel: string) => (
    <div className="mb-4">
      <div className="px-4 py-2 testament-header">{testamentLabel}</div>
      {groupBooks.map((book) => {
        // Use book.slug (localized) for URL routing and active state
        const isActive = book.slug === currentBookSlug
        const isExpanded = expandedBook === book.slug

        return (
          <div key={book.slug}>
            {/* Book row */}
            <button
              ref={isActive ? activeBookRef : undefined}
              onClick={() => setExpandedBook(isExpanded ? null : book.slug)}
              className={`w-full flex items-center justify-between px-4 py-2 text-sm rounded-lg mx-1 sidebar-book-btn ${
                isActive ? 'is-active' : ''
              } ${isExpanded ? 'is-expanded' : ''}`}
            >
              <span className="truncate">{book.name}</span>
              <Tooltip content={t.version.chaptersTooltip(book.chapters)}>
                <span
                  className="flex-shrink-0 ml-2 animate-fade-in"
                  style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}
                >
                  {book.chapters}
                </span>
              </Tooltip>
            </button>

            {/* Chapter grid */}
            {isExpanded && (
              <div className="px-3 pb-2 grid grid-cols-7 gap-1 animate-fade-in">
                {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => {
                  const isCurrentCh = isActive && currentChapter === ch
                  return (
                    <Link
                      key={ch}
                      href={`/${lang}/${version}/${book.slug}/${ch}`}
                      className={`flex items-center justify-center text-xs rounded-md py-1.5 sidebar-chapter-btn ${
                        isCurrentCh ? 'is-current' : ''
                      }`}
                    >
                      {ch}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <nav ref={navRef} onScroll={handleScroll} className="h-full overflow-y-auto py-3">
      {/* Version header */}
      <div
        className="px-4 py-3 mb-2 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.version.label}</p>
        <Link
          href={`/${lang}/${version}`}
          className="font-semibold text-sm mt-0.5 block transition-colors duration-100 version-link"
        >
          {versionName ?? version.toUpperCase()}
        </Link>
      </div>

      {renderBookGroup(oldTestament, t.testament.old)}
      {renderBookGroup(newTestament, t.testament.new)}
    </nav>
  )
}
