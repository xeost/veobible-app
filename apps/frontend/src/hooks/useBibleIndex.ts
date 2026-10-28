'use client'

import { useEffect, useState } from 'react'
import type { BookInfo } from '@/lib/bible/types'
import { fetchAndCacheIndex, readIndexFromCache } from '@/lib/bible/bibleDataCache'
import { BIBLE_VERSIONS } from '@/lib/bible/config'

interface BibleIndexState {
  books: BookInfo[]
  loading: boolean
}

// Returns the ordered list of books for a given version, fetched from the
// public bible-data index.json. Used client-side to determine canonical book order.
export function useBibleIndex(versionSlug: string): BibleIndexState {
  const [books, setBooks] = useState<BookInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const version = BIBLE_VERSIONS.find((v) => v.slug === versionSlug)
    if (!version) {
      setLoading(false)
      return
    }

    fetchAndCacheIndex(version.langCode, version.slug)
      .then(() => readIndexFromCache(version.langCode, version.slug))
      .then(data => setBooks(data?.books ?? []))
      .catch(() => {
        // Non-critical: if fetch fails we just won't sort by canonical order
        setBooks([])
      })
      .finally(() => setLoading(false))
  }, [versionSlug])

  return { books, loading }
}
