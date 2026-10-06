'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BookInfo } from '@/lib/bible/types'
import {
  fetchBook,
  fetchAndCacheIndex,
  getCachedBookCount,
  deleteVersionFromCache,
} from '@/lib/bible/bibleDataCache'

// ── Types ─────────────────────────────────────────────────────────────────────

/** The offline availability status of a Bible version. */
export type OfflineStatus = 'checking' | 'not-cached' | 'partial' | 'available'

export interface DownloadProgress {
  /** Books fetched so far (out of 66). */
  done: number
  /** Total books (usually 66). */
  total: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum concurrent chapter fetches during download. */
const CONCURRENCY = 6

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useOfflineVersion(lang: string, version: string, books: BookInfo[]) {
  const [status, setStatus] = useState<OfflineStatus>('checking')
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const totalBooks = books.length // 66

  // ── Status check ─────────────────────────────────────────────────────────

  const recheckStatus = useCallback(async () => {
    const count = await getCachedBookCount(lang, version)
    if (count === 0) setStatus('not-cached')
    else if (count >= totalBooks) setStatus('available')
    else setStatus('partial')
  }, [lang, version, totalBooks])

  // Check on mount and whenever lang/version/books change
  useEffect(() => {
    let cancelled = false
    setStatus('checking')
    getCachedBookCount(lang, version).then((count) => {
      if (cancelled) return
      if (count === 0) setStatus('not-cached')
      else if (count >= totalBooks) setStatus('available')
      else setStatus('partial')
    })
    return () => {
      cancelled = true
    }
  }, [lang, version, totalBooks])

  // ── Download ──────────────────────────────────────────────────────────────

  const downloadVersion = useCallback(async () => {
    if (isDownloading) return

    const ctrl = new AbortController()
    abortRef.current = ctrl

    setIsDownloading(true)
    setStatus('checking')
    setProgress({ done: 0, total: totalBooks })

    // Cache index.json so the offline reader shell can reconstruct chapter
    // data without requiring the page HTML to be in the SW pages cache.
    try {
      await fetchAndCacheIndex(lang, version, ctrl.signal)
    } catch {
      // Non-critical — continue download even if this fails
    }
    if (ctrl.signal.aborted) {
      setIsDownloading(false)
      setProgress(null)
      return
    }

    let done = 0
    let failed = 0
    let bookIdx = 0

    // Worker function — each worker grabs the next book until exhausted
    async function worker(): Promise<void> {
      while (bookIdx < books.length) {
        if (ctrl.signal.aborted) return
        const book = books[bookIdx++]
        try {
          await fetchBook(lang, version, book.id, book.chapters, ctrl.signal)
        } catch {
          if (ctrl.signal.aborted) return
          failed++
        }
        done++
        setProgress({ done, total: totalBooks })
      }
    }

    // Launch CONCURRENCY workers in parallel
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

    if (!ctrl.signal.aborted) {
      setIsDownloading(false)
      setStatus(failed === 0 ? 'available' : 'partial')
      setProgress(null)
    }
  }, [lang, version, books, totalBooks, isDownloading])

  // ── Cancel ────────────────────────────────────────────────────────────────

  const cancelDownload = useCallback(() => {
    abortRef.current?.abort()
    setIsDownloading(false)
    setProgress(null)
    recheckStatus()
  }, [recheckStatus])

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteVersion = useCallback(async () => {
    await deleteVersionFromCache(lang, version)
    setStatus('not-cached')
    setProgress(null)
  }, [lang, version])

  // Cleanup abort controller on unmount
  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [],
  )

  return {
    status,
    progress,
    isDownloading,
    totalChapters: totalBooks, // keep prop name for UI compatibility
    downloadVersion,
    cancelDownload,
    deleteVersion,
  }
}
