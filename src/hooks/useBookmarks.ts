'use client'

import { useCallback, useEffect, useState } from 'react'
import { storage } from '@/lib/storage'
import type { Bookmark, BookmarkFolder } from '@/lib/storage'

export function useBookmarks(versionSlug?: string) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [folders, setFolders] = useState<BookmarkFolder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [data, folderData] = await Promise.all([
          versionSlug
            ? storage.getBookmarksByVersion(versionSlug)
            : storage.getBookmarks(),
          versionSlug
            ? storage.getFoldersByVersion(versionSlug)
            : Promise.resolve([] as BookmarkFolder[]),
        ])
        setBookmarks(data)
        setFolders(folderData)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [versionSlug])

  // ── Bookmarks ──────────────────────────────────────────────────────

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

  // ── Folders ────────────────────────────────────────────────────────

  const addFolder = useCallback(
    async (data: Omit<BookmarkFolder, 'id' | 'createdAt'>) => {
      const saved = await storage.addFolder(data)
      setFolders((prev) => [...prev, saved].sort((a, b) => a.order - b.order))
      return saved
    },
    [],
  )

  const updateFolder = useCallback(
    async (id: string, patch: Partial<Omit<BookmarkFolder, 'id' | 'createdAt'>>) => {
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      )
      try {
        const updated = await storage.updateFolder(id, patch)
        setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)))
        return updated
      } catch (err) {
        const data = versionSlug ? await storage.getFoldersByVersion(versionSlug) : []
        setFolders(data)
        throw err
      }
    },
    [versionSlug],
  )

  const removeFolder = useCallback(async (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id))
    // Optimistically clear folderId from bookmarks that belonged to this folder
    setBookmarks((prev) =>
      prev.map((b) => (b.folderId === id ? { ...b, folderId: undefined } : b)),
    )
    try {
      await storage.removeFolder(id)
    } catch (err) {
      // Reload both on failure
      const [bData, fData] = await Promise.all([
        storage.getBookmarks(),
        versionSlug ? storage.getFoldersByVersion(versionSlug) : Promise.resolve([]),
      ])
      setBookmarks(bData)
      setFolders(fData as BookmarkFolder[])
      throw err
    }
  }, [versionSlug])

  const moveBookmarkToFolder = useCallback(
    async (bookmarkId: string, folderId: string | undefined) => {
      await updateBookmark(bookmarkId, { folderId })
    },
    [updateBookmark],
  )

  return {
    bookmarks,
    folders,
    loading,
    addBookmark,
    updateBookmark,
    removeBookmark,
    isBookmarked,
    addFolder,
    updateFolder,
    removeFolder,
    moveBookmarkToFolder,
  }
}
