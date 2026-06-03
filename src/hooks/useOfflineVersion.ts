'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BookInfo } from '@/lib/bible/types'
import {
  prefetchChapter,
  getCachedChapterCount,
  deleteVersionFromCache,
} from '@/lib/bible/bibleDataCache'

// ── Types ─────────────────────────────────────────────────────────────────────

/** The offline availability status of a Bible version. */
export type OfflineStatus = 'checking' | 'not-cached' | 'partial' | 'available'

export interface DownloadProgress {
  done: number
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
  const totalChapters = books.reduce((sum, b) => sum + b.chapters, 0)

  // ── Status check ─────────────────────────────────────────────────────────

  const recheckStatus = useCallback(async () => {
    const count = await getCachedChapterCount(lang, version)
    if (count === 0) setStatus('not-cached')
    else if (count >= totalChapters) setStatus('available')
    else setStatus('partial')
  }, [lang, version, totalChapters])

  // Check on mount and whenever lang/version/books change
  useEffect(() => {
    let cancelled = false
    setStatus('checking')
    getCachedChapterCount(lang, version).then((count) => {
      if (cancelled) return
      if (count === 0) setStatus('not-cached')
      else if (count >= totalChapters) setStatus('available')
      else setStatus('partial')
    })
    return () => {
      cancelled = true
    }
  }, [lang, version, totalChapters])

  // ── Download ──────────────────────────────────────────────────────────────

  const downloadVersion = useCallback(async () => {
    if (isDownloading) return

    const ctrl = new AbortController()
    abortRef.current = ctrl

    setIsDownloading(true)
    setStatus('checking')
    setProgress({ done: 0, total: totalChapters })

    // Build the full list of (bookId, chapter) tasks in canonical order
    const tasks: Array<{ bookId: string; chapter: number }> = []
    for (const book of books) {
      for (let ch = 1; ch <= book.chapters; ch++) {
        tasks.push({ bookId: book.id, chapter: ch })
      }
    }

    let done = 0
    let failed = 0
    let taskIdx = 0

    // Worker function — each worker grabs the next task until exhausted
    async function worker(): Promise<void> {
      while (taskIdx < tasks.length) {
        if (ctrl.signal.aborted) return
        const task = tasks[taskIdx++]
        try {
          await prefetchChapter(lang, version, task.bookId, task.chapter, ctrl.signal)
        } catch {
          if (ctrl.signal.aborted) return
          failed++
        }
        done++
        setProgress({ done, total: totalChapters })
      }
    }

    // Launch CONCURRENCY workers in parallel
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

    if (!ctrl.signal.aborted) {
      setIsDownloading(false)
      setStatus(failed === 0 ? 'available' : 'partial')
      setProgress(null)
    }
  }, [lang, version, books, totalChapters, isDownloading])

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
    totalChapters,
    downloadVersion,
    cancelDownload,
    deleteVersion,
  }
}
