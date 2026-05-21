'use client'

import { useCallback, useEffect, useRef } from 'react'
import { storage } from '@/lib/storage'
import type { ReadingPosition } from '@/lib/storage'

export function useReadingPosition(versionSlug: string) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const savePosition = useCallback(
    (bookSlug: string, chapter: number, verseIndex?: number) => {
      // Debounce saves to avoid thrashing localStorage on every scroll event
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        storage.setReadingPosition({
          versionSlug,
          bookSlug,
          chapter,
          verseIndex,
          updatedAt: new Date().toISOString(),
        })
      }, 500)
    },
    [versionSlug],
  )

  const getLastPosition = useCallback(async (): Promise<ReadingPosition | null> => {
    return storage.getReadingPosition(versionSlug)
  }, [versionSlug])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  return { savePosition, getLastPosition }
}
