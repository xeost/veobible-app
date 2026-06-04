'use client'

import React, { useEffect } from 'react'
import { ChapterReader } from '@/components/reader/ChapterReader'
import { useReaderContext } from '@/lib/context/ReaderContext'
import type { ChapterData } from '@/lib/bible/types'

interface ChapterClientProps {
  data: ChapterData
  lang: string
  version: string
}

/**
 * Thin client component for the chapter page.
 * The layout (ReaderLayoutClient) handles all sidebar/header state and
 * persists across chapter navigations. This component only mounts/unmounts
 * the reader content itself.
 */
export function ChapterClient({ data, lang, version }: ChapterClientProps) {
  const { addBookmark, isBookmarked } = useReaderContext()

  // Background pre-fetch of all chapters for the current book when online
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine) {
      const { book, chapterNum } = data
      const totalChapters = book.chapters
      const bookSlug = book.slug

      // Fetch other chapters' HTML and Next.js payloads in the background when idle
      const idleCallback = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 1000))
      
      idleCallback(() => {
        for (let ch = 1; ch <= totalChapters; ch++) {
          if (ch !== chapterNum) {
            const url = `/${lang}/${version}/${bookSlug}/${ch}`
            // Prefetch page HTML and page Next.js payload (.txt)
            fetch(url).catch(() => {})
            fetch(`${url}.txt`).catch(() => {})
          }
        }
      })
    }
  }, [data, lang, version])

  return (
    <ChapterReader
      data={data}
      lang={lang}
      version={version}
      addBookmark={addBookmark}
      isBookmarked={isBookmarked}
    />
  )
}
