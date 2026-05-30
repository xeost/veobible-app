'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { VerseItem } from './VerseItem'
import { SelectionToolbar } from './SelectionToolbar'
import { BookmarkTitleModal } from '@/components/bookmarks/BookmarkTitleModal'
import { useTextSelection } from '@/hooks/useTextSelection'
import { useReadingPosition } from '@/hooks/useReadingPosition'
import { toast } from '@/components/ui/Toast'
import type { ChapterData } from '@/lib/bible/types'
import type { Bookmark } from '@/lib/storage'
import type { TextSelection } from '@/hooks/useTextSelection'
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

  // Snapshot the selection at the moment the user taps "Bookmark" (before it clears)
  const pendingSelectionRef = useRef<TextSelection | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

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

  /**
   * Called via onMouseDown on the toolbar bookmark button.
   * At this point the selection is still alive; we snapshot it and open
   * the modal. The selection will collapse when the input gets focus — that's fine.
   */
  const handleOpenBookmarkModal = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!selection) return
    pendingSelectionRef.current = selection
    clearSelection() // dismiss the floating toolbar
    setModalOpen(true)
  }

  const handleModalSave = async (title: string, note: string) => {
    const sel = pendingSelectionRef.current
    if (!sel) return
    setModalOpen(false)
    pendingSelectionRef.current = null
    try {
      await addBookmark({
        versionSlug: version,
        bookSlug: book.slug,
        chapter: chapterNum,
        verseStart: sel.verseStart,
        verseEnd: sel.verseEnd,
        selectedText: sel.text,
        title: title || undefined,
        note: note || undefined,
      })
      toast(t.reader.bookmarkAdded)
    } catch {
      toast('Failed to save bookmark', 'error')
    }
  }

  const handleModalCancel = () => {
    setModalOpen(false)
    pendingSelectionRef.current = null
  }

  const buildNavUrl = (nav: { bookSlug: string; chapter: number }) =>
    `/${lang}/${version}/${nav.bookSlug}/${nav.chapter}`

  return (
    <div className="relative">
      {/* Floating selection toolbar */}
      <SelectionToolbar
        selection={selection}
        onBookmark={handleOpenBookmarkModal}
        onDismiss={clearSelection}
      />

      {/* Bookmark title modal — opened when user clicks bookmark in toolbar */}
      <BookmarkTitleModal
        initialTitle={modalOpen ? '' : null}
        initialNote={modalOpen ? '' : null}
        onSave={handleModalSave}
        onCancel={handleModalCancel}
      />

      {/* Chapter header */}
      <div className="mb-10 text-center mx-auto" style={{ maxWidth: 'var(--reader-max-width)' }}>
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
        className="mx-auto"
        style={{ background: 'transparent', borderRadius: '12px', padding: '2rem 0', maxWidth: 'var(--reader-max-width)' }}
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

      {/* YouTube Video invitation card */}
      {(() => {
        const hasVideo = !!book.video;
        const offset = book.chapterOffsets?.[chapterNum - 1] ?? 0;
        const videoUrl = book.video
          ? (book.video.includes('?') ? `${book.video}&t=${offset}s` : `${book.video}?t=${offset}s`)
          : '';

        if (!hasVideo) return null;

        return (
          <div
            className="mx-auto mb-10 p-5 sm:p-6 rounded-2xl border transition-all duration-300 group"
            style={{
              maxWidth: 'var(--reader-max-width)',
              borderColor: 'var(--border)',
              background: 'color-mix(in srgb, var(--bg-card) 60%, transparent)',
              backdropFilter: 'blur(12px)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-6">
              <div className="flex items-center gap-4 flex-1 w-full">
                {/* YouTube red-to-rose glowing icon container */}
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-500/10 dark:bg-red-500/15 flex items-center justify-center border border-red-500/20 dark:border-red-500/30 text-red-600 dark:text-red-500 shadow-inner group-hover:scale-105 group-hover:border-red-500/40 transition-all duration-300">
                  <svg className="w-6 h-6 fill-current transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24">
                    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.107C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.388.511a3.002 3.002 0 0 0-2.11 2.107C0 8.047 0 12 0 12s0 3.953.502 5.837a3.002 3.002 0 0 0 2.11 2.107C4.495 20.455 12 20.455 12 20.455s7.505 0 9.388-.511a3.002 3.002 0 0 0 2.11-2.107C24 15.953 24 12 24 12s0-3.953-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-lora), Georgia, serif' }}>
                    {t.reader.listenChapter}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {book.name} {chapterNum} · YouTube Audio Bible
                  </p>
                </div>
              </div>
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-xs shadow-md shadow-red-500/10 hover:shadow-red-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                {t.reader.watchYoutube}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-0.5">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>
        );
      })()}

      {/* Chapter navigation */}
      <div className="flex gap-4 mt-12 mx-auto" style={{ maxWidth: 'var(--reader-max-width)' }}>
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
