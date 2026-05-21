// Build-time data loader — uses Node.js fs (server/build only)
// Never import this in client components

import fs from 'fs'
import path from 'path'
import type { BibleIndex, BookInfo, ChapterData, StaticChapterParam, Verse } from './types'
import { BIBLE_VERSIONS } from './config'

const BIBLE_DATA_ROOT = path.join(process.cwd(), 'material', 'bible-versions')

export function loadBibleIndex(langCode: string, versionSlug: string): BibleIndex {
  const filePath = path.join(BIBLE_DATA_ROOT, langCode, versionSlug, 'index.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as BibleIndex
}

export function loadChapterVerses(
  langCode: string,
  versionSlug: string,
  bookSlug: string,
  chapterNum: number,
): Verse[] {
  const filePath = path.join(
    BIBLE_DATA_ROOT,
    langCode,
    versionSlug,
    bookSlug,
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

  const bookIndex = books.findIndex((b) => b.slug === bookSlug)
  if (bookIndex === -1) {
    throw new Error(`Book not found: ${bookSlug} in ${langCode}/${versionSlug}`)
  }
  const book = books[bookIndex]
  const verses = loadChapterVerses(langCode, versionSlug, bookSlug, chapterNum)

  // Compute prev/next navigation
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
          book: book.slug,
          chapter: String(ch),
        })
      }
    }
  }

  return params
}
