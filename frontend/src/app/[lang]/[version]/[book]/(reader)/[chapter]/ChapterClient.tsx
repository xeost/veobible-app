'use client'

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
