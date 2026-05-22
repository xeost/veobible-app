// Build-time data loader — uses Node.js fs (server/build only)
// Never import this in client components

import fs from 'fs'
import path from 'path'
import type { BibleIndex, BookInfo, ChapterData, StaticChapterParam, Verse } from './types'
import { BIBLE_VERSIONS } from './config'

const BIBLE_DATA_ROOT = path.join(process.cwd(), 'public', 'bible-data')

export function loadBibleIndex(langCode: string, versionSlug: string): BibleIndex {
  const filePath = path.join(BIBLE_DATA_ROOT, langCode, versionSlug, 'index.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as BibleIndex
}

export function loadChapterVerses(
  langCode: string,
  versionSlug: string,
  bookId: string,
  chapterNum: number,
): Verse[] {
  // Data directories are named after the book's English id, not the localized slug
  const filePath = path.join(
    BIBLE_DATA_ROOT,
    langCode,
    versionSlug,
    bookId,
    `${chapterNum}.json`,
  )
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as Verse[]
}

export function loadChapterData(
  langCode: string,
  versionSlug: string,
  bookSlug: string,
  chapterNum: number,
): ChapterData {
  const index = loadBibleIndex(langCode, versionSlug)
  const books = index.books

  // Match by book.slug (localized, used in URLs e.g. 'levitico' for Spanish)
  const bookIndex = books.findIndex((b) => b.slug === bookSlug)
  if (bookIndex === -1) {
    throw new Error(`Book not found: ${bookSlug} in ${langCode}/${versionSlug}`)
  }
  const book = books[bookIndex]
  // Use book.id (English) only for the filesystem path — directories are named in English
  const verses = loadChapterVerses(langCode, versionSlug, book.id, chapterNum)

  // Compute prev/next navigation using book.slug for URL consistency
  let prevChapter: ChapterData['prevChapter'] = null
  let nextChapter: ChapterData['nextChapter'] = null

  if (chapterNum > 1) {
    prevChapter = { bookSlug, chapter: chapterNum - 1 }
  } else if (bookIndex > 0) {
    const prevBook = books[bookIndex - 1]
    prevChapter = { bookSlug: prevBook.slug, chapter: prevBook.chapters }
  }

  if (chapterNum < book.chapters) {
    nextChapter = { bookSlug, chapter: chapterNum + 1 }
  } else if (bookIndex < books.length - 1) {
    const nextBook = books[bookIndex + 1]
    nextChapter = { bookSlug: nextBook.slug, chapter: 1 }
  }

  return {
    verses,
    book,
    chapterNum,
    version: index.metadata,
    prevChapter,
    nextChapter,
  }
}

// Generate all static params for all versions × books × chapters
export function getAllChapterStaticParams(): StaticChapterParam[] {
  const params: StaticChapterParam[] = []

  for (const version of BIBLE_VERSIONS) {
    const index = loadBibleIndex(version.langCode, version.slug)
    for (const book of index.books) {
      for (let ch = 1; ch <= book.chapters; ch++) {
        params.push({
          lang: version.langCode,
          version: version.slug,
          // Use book.slug (localized) — this is what appears in the URL
          book: book.slug,
          chapter: String(ch),
        })
      }
    }
  }

  return params
}
