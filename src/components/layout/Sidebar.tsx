'use client'

import React from 'react'
import Link from 'next/link'
import type { BookInfo } from '@/lib/bible/types'
import { useI18n } from '@/lib/i18n/client'

interface SidebarProps {
  lang: string
  version: string
  books: BookInfo[]
  currentBookSlug?: string
  currentChapter?: number
}

export function Sidebar({ lang, version, books, currentBookSlug, currentChapter }: SidebarProps) {
  const { t } = useI18n()
  const [expandedBook, setExpandedBook] = React.useState<string | null>(currentBookSlug ?? null)

  const oldTestament = books.filter((b) => b.testament === 'old')
  const newTestament = books.filter((b) => b.testament === 'new')

  const renderBookGroup = (groupBooks: BookInfo[], testamentLabel: string) => (
    <div className="mb-4">
      <div className="px-4 py-2 testament-header">{testamentLabel}</div>
      {groupBooks.map((book) => {
        const isActive = book.slug === currentBookSlug
        const isExpanded = expandedBook === book.slug

        return (
          <div key={book.slug}>
            {/* Book row */}
            <button
              onClick={() => setExpandedBook(isExpanded ? null : book.slug)}
              className="w-full flex items-center justify-between px-4 py-2 text-sm transition-colors duration-100 rounded-lg mx-1"
              style={{
                color: isActive ? 'var(--brand)' : 'var(--text-primary)',
                background: isActive && !isExpanded ? 'var(--brand-light)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
                width: 'calc(100% - 0.5rem)',
              }}
            >
              <span className="truncate">{book.name}</span>
              <span className="flex-shrink-0 ml-2" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                {book.chapters}ch
              </span>
            </button>

            {/* Chapter grid */}
            {isExpanded && (
              <div className="px-3 pb-2 grid grid-cols-6 gap-1 animate-fade-in">
                {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => {
                  const isCurrentCh = isActive && currentChapter === ch
                  return (
                    <Link
                      key={ch}
                      href={`/${lang}/${version}/${book.slug}/${ch}`}
                      className="flex items-center justify-center text-xs rounded-md py-1.5 transition-all duration-100"
                      style={{
                        background: isCurrentCh ? 'var(--brand)' : 'var(--brand-light)',
                        color: isCurrentCh ? 'white' : 'var(--brand)',
                        fontWeight: isCurrentCh ? 700 : 400,
                      }}
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
    <nav className="h-full overflow-y-auto py-3">
      {/* Version header */}
      <div
        className="px-4 py-3 mb-2 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.version.label}</p>
        <p className="font-semibold text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>
          {version.toUpperCase()}
        </p>
      </div>

      {renderBookGroup(oldTestament, t.testament.old)}
      {renderBookGroup(newTestament, t.testament.new)}
    </nav>
  )
}
