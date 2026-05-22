'use client'

import { useEffect, useState } from 'react'
import type { BookInfo } from '@/lib/bible/types'
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

    const url = `/bible-data/${version.publicPath}/index.json`

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setBooks((data as { books: BookInfo[] }).books ?? [])
      })
      .catch(() => {
        // Non-critical: if fetch fails we just won't sort by canonical order
        setBooks([])
      })
      .finally(() => setLoading(false))
  }, [versionSlug])

  return { books, loading }
}
