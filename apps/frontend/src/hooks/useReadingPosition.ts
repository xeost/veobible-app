'use client'

import { useCallback, useEffect, useRef } from 'react'
import { storage } from '@/lib/storage'
import type { ReadingPosition } from '@/lib/storage'

export function useReadingPosition(versionSlug: string) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pending = useRef<ReadingPosition | null>(null)
  const flush = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    if (pending.current) { const position = pending.current; pending.current = null; void storage.setReadingPosition(position).catch(console.error) }
  }, [])
  const savePosition = useCallback(
    (bookSlug: string, chapter: number, verseIndex?: number) => {
      // Debounce saves to avoid thrashing localStorage on every scroll event
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      pending.current = { versionSlug, bookSlug, chapter, verseIndex, updatedAt: new Date().toISOString() }
      saveTimeoutRef.current = setTimeout(flush, 500)
    },
    [versionSlug, flush],
  )

  const getLastPosition = useCallback(async (): Promise<ReadingPosition | null> => {
    return storage.getReadingPosition(versionSlug)
  }, [versionSlug])

  // Cleanup on unmount
  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush); flush() }
  }, [flush])

  return { savePosition, getLastPosition }
}
