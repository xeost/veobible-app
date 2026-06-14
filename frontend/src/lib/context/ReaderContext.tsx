'use client'

import React from 'react'
import type { Bookmark } from '@/lib/storage'

interface ReaderContextValue {
  addBookmark: (data: Omit<Bookmark, 'id' | 'createdAt' | 'syncStatus'>) => Promise<Bookmark>
  isBookmarked: (vSlug: string, bookSlug: string, chapter: number, verseStart: number) => boolean
}

export const ReaderContext = React.createContext<ReaderContextValue | null>(null)

export function useReaderContext(): ReaderContextValue {
  const ctx = React.useContext(ReaderContext)
  if (!ctx) throw new Error('useReaderContext must be used within ReaderLayoutClient')
  return ctx
}
