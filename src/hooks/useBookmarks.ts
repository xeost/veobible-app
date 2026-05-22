'use client'

import { useCallback, useEffect, useState } from 'react'
import { storage } from '@/lib/storage'
import type { Bookmark } from '@/lib/storage'

export function useBookmarks(versionSlug?: string) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = versionSlug
          ? await storage.getBookmarksByVersion(versionSlug)
          : await storage.getBookmarks()
        setBookmarks(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [versionSlug])

  const addBookmark = useCallback(
    async (data: Omit<Bookmark, 'id' | 'createdAt' | 'syncStatus'>) => {
      // Optimistic update — add immediately to UI
      const optimisticId = `optimistic-${Date.now()}`
      const optimisticBookmark: Bookmark = {
        ...data,
        id: optimisticId,
        createdAt: new Date().toISOString(),
        syncStatus: 'local',
      }
      setBookmarks((prev) => [optimisticBookmark, ...prev])

      try {
        // Confirm with storage (local or remote in future)
        const saved = await storage.addBookmark(data)
        // Replace optimistic entry with real one
        setBookmarks((prev) =>
          prev.map((b) => (b.id === optimisticId ? saved : b)),
        )
        return saved
      } catch (err) {
        // Rollback on failure
        setBookmarks((prev) => prev.filter((b) => b.id !== optimisticId))
        throw err
      }
    },
    [],
  )

  const removeBookmark = useCallback(async (id: string) => {
    // Optimistic remove
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
    try {
      await storage.removeBookmark(id)
    } catch (err) {
      // Rollback: reload from storage
      const data = await storage.getBookmarks()
      setBookmarks(data)
      throw err
    }
  }, [])

  const updateBookmark = useCallback(
    async (id: string, patch: Partial<Omit<Bookmark, 'id' | 'createdAt'>>) => {
      // Optimistic update
      setBookmarks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      )
      try {
        const updated = await storage.updateBookmark(id, patch)
        setBookmarks((prev) => prev.map((b) => (b.id === id ? updated : b)))
        return updated
      } catch (err) {
        // Rollback: reload from storage
        const data = await storage.getBookmarks()
        setBookmarks(data)
        throw err
      }
    },
    [],
  )

  const isBookmarked = useCallback(
    (vSlug: string, bookSlug: string, chapter: number, verseStart: number) =>
      bookmarks.some(
        (b) =>
          b.versionSlug === vSlug &&
          b.bookSlug === bookSlug &&
          b.chapter === chapter &&
          b.verseStart === verseStart,
      ),
    [bookmarks],
  )

  return { bookmarks, loading, addBookmark, updateBookmark, removeBookmark, isBookmarked }
}
