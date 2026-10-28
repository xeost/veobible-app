'use client'

import { useEffect, useState } from 'react'
import { useReaderPath, parseReaderPath } from '@/lib/reader/navigation'
import { fetchBook, fetchAndCacheIndex, readIndexFromCache } from '@/lib/bible/bibleDataCache'
import type { BibleIndex, ChapterData } from '@/lib/bible/types'
import { ReaderLayoutClient } from './ReaderLayoutClient'
import { ChapterClient } from './ChapterClient'

export function InteractiveReader() {
  const path = useReaderPath()
  const [loaded, setLoaded] = useState<{ path: string; index: BibleIndex; data: ChapterData } | null>(null)
  const [error, setError] = useState('')
  const route = parseReaderPath(path)
  useEffect(() => {
    if (!route) return
    const ctrl = new AbortController()
    setError('')
    ;(async () => {
      const { lang, version, book: slug, chapter } = route
      let index = await readIndexFromCache(lang, version)
      if (!index) { await fetchAndCacheIndex(lang, version, ctrl.signal); index = await readIndexFromCache(lang, version) }
      if (!index) throw new Error('Version unavailable offline')
      const i = index.books.findIndex(b => b.slug === slug)
      const book = index.books[i]
      const n = Number(chapter)
      if (!book || n < 1 || n > book.chapters) throw new Error('Invalid chapter')
      const chapters = await fetchBook(lang, version, book.id, book.chapters, ctrl.signal)
      const prev = n > 1 ? { bookSlug: slug, chapter: n - 1 } : i > 0 ? { bookSlug: index.books[i - 1].slug, chapter: index.books[i - 1].chapters } : null
      const next = n < book.chapters ? { bookSlug: slug, chapter: n + 1 } : i + 1 < index.books.length ? { bookSlug: index.books[i + 1].slug, chapter: 1 } : null
      if (!ctrl.signal.aborted) {
        setLoaded({ path, index, data: { book, chapterNum: n, version: index.metadata, verses: chapters[n], prevChapter: prev, nextChapter: next } })
        document.title = `${book.name} ${n} · ${index.metadata.name} | VeoBible`
        if (window.location.hash) setTimeout(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView(), 100)
      }
    })().catch(e => { if (!ctrl.signal.aborted) setError(e.message) })
    return () => ctrl.abort()
  // The pathname is the source of truth, including browser back/forward.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])
  if (!path) return <main className="p-8" aria-busy="true">VeoBible…</main>
  if (!route || error) return <main className="p-8" data-reader-error={error}><p role="alert">{route?.lang === 'es' ? 'No se pudo abrir el capítulo. Comprueba que la versión esté descargada o vuelve a intentarlo con conexión.' : route?.lang === 'pt' ? 'Não foi possível abrir o capítulo. Baixe a versão ou tente novamente com conexão.' : 'Unable to open this chapter. Download the version or retry with a connection.'}</p><a href={`/${route?.lang ?? 'en'}`}>VeoBible</a></main>
  if (!loaded) return <main className="p-8" aria-busy="true">VeoBible…</main>
  return <ReaderLayoutClient key={`${route.lang}/${route.version}`} lang={route.lang} version={route.version} versionName={loaded.index.metadata.name} books={loaded.index.books}>
    {loaded.path === path ? <ChapterClient key={path} data={loaded.data} lang={route.lang} version={route.version} /> : <p aria-busy="true">…</p>}
  </ReaderLayoutClient>
}
