'use client'

import { useSyncExternalStore } from 'react'

import { readerSegment } from './routes'
export function parseReaderPath(path: string) {
  const parts = path.split('/').filter(Boolean)
  if (parts.length !== 5) return null
  const [lang, segment, version, book, chapter] = parts
  if (!['en', 'es', 'pt'].includes(lang) || segment !== readerSegment(lang)) return null
  if (!version || !book || !/^\d+$/.test(chapter || '')) return null
  return { lang, version, book, chapter }
}
const subscribe = (listener: () => void) => {
  window.addEventListener('popstate', listener)
  window.addEventListener('veobible:navigate', listener)
  return () => {
    window.removeEventListener('popstate', listener)
    window.removeEventListener('veobible:navigate', listener)
  }
}
export function useReaderPath() {
  return useSyncExternalStore(subscribe, () => window.location.pathname, () => '')
}
export function useReaderLocation(): Partial<{ lang: string; version: string; book: string; chapter: string }> {
  return parseReaderPath(useReaderPath()) ?? {}
}
