'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { VerseItem } from './VerseItem'
import { SelectionToolbar } from './SelectionToolbar'
import { useTextSelection } from '@/hooks/useTextSelection'
import { useReadingPosition } from '@/hooks/useReadingPosition'
import { toast } from '@/components/ui/Toast'
import type { ChapterData } from '@/lib/bible/types'
import type { Bookmark } from '@/lib/storage'
import { useI18n } from '@/lib/i18n/client'

const ChevronLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)
const ChevronRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
)

interface ChapterReaderProps {
  data: ChapterData
  lang: string
  version: string
  addBookmark: (data: Omit<Bookmark, 'id' | 'createdAt' | 'syncStatus'>) => Promise<Bookmark>
  isBookmarked: (vSlug: string, bookSlug: string, chapter: number, verseStart: number) => boolean
}

export function ChapterReader({ data, lang, version, addBookmark, isBookmarked }: ChapterReaderProps) {
  const { t } = useI18n()
  const { selection, containerRef, clearSelection } = useTextSelection()
  const { savePosition } = useReadingPosition(version)

  const { verses, book, chapterNum, prevChapter, nextChapter } = data

  // Save reading position when this chapter mounts
  useEffect(() => {
    savePosition(book.slug, chapterNum)
  }, [book.slug, chapterNum, savePosition])

  // Scroll position tracking — save verse in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          const verseEl = visible[0].target as HTMLElement
          const verseNum = parseInt(verseEl.id.replace('verse-', ''), 10)
          if (!isNaN(verseNum)) {
            savePosition(book.slug, chapterNum, verseNum)
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' },
    )

    document.querySelectorAll('[id^="verse-"]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [book.slug, chapterNum, savePosition])

  const handleBookmark = async () => {
    if (!selection) return
    try {
      await addBookmark({
        versionSlug: version,
        bookSlug: book.slug,
        chapter: chapterNum,
        verseStart: selection.verseStart,
        verseEnd: selection.verseEnd,
        selectedText: selection.text,
      })
      toast(t.reader.bookmarkAdded)
    } catch {
      toast('Failed to save bookmark', 'error')
    }
  }

  const buildNavUrl = (nav: { bookSlug: string; chapter: number }) =>
    `/${lang}/${version}/${nav.bookSlug}/${nav.chapter}`

  return (
    <div className="relative">
      {/* Selection toolbar — rendered globally in position */}
      <SelectionToolbar
        selection={selection}
        onBookmark={handleBookmark}
        onDismiss={clearSelection}
      />

      {/* Chapter header */}
      <div className="mb-10 text-center">
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--brand)' }}>
          {data.version.shortname}
        </p>
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-lora), Georgia, serif' }}>
          {book.name}
        </h1>
        <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
          {t.reader.chapter} {chapterNum}
        </p>
      </div>

      {/* Verses */}
      <div
        ref={containerRef}
        className="max-w-2xl mx-auto px-2"
        style={{ background: 'var(--reader-bg)', borderRadius: '12px', padding: '2rem 1.5rem' }}
      >
        {verses.map((verse) => (
          <VerseItem
            key={verse.verse}
            verseNum={verse.verse}
            text={verse.text}
            isBookmarked={isBookmarked(version, book.slug, chapterNum, verse.verse)}
          />
        ))}
      </div>

      {/* Chapter navigation */}
      <div className="flex gap-4 mt-12 max-w-2xl mx-auto">
        {prevChapter ? (
          <Link href={buildNavUrl(prevChapter)} className="chapter-nav-btn group" id="prev-chapter-btn">
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <ChevronLeftIcon /> {t.reader.previousChapter}
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {prevChapter.bookSlug !== book.slug
                ? `${prevChapter.bookSlug.replace(/-/g, ' ')} ${prevChapter.chapter}`
                : `${t.reader.chapter} ${prevChapter.chapter}`}
            </span>
          </Link>
        ) : (
          <div className="flex-1" />
        )}

        {nextChapter ? (
          <Link href={buildNavUrl(nextChapter)} className="chapter-nav-btn items-end group" id="next-chapter-btn">
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              {t.reader.nextChapter} <ChevronRightIcon />
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {nextChapter.bookSlug !== book.slug
                ? `${nextChapter.bookSlug.replace(/-/g, ' ')} ${nextChapter.chapter}`
                : `${t.reader.chapter} ${nextChapter.chapter}`}
            </span>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </div>
  )
}
