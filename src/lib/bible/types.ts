// ============================================================
// Bible data types
// ============================================================

export interface VersionMetadata {
  name: string
  shortname: string
  slug: string
  year: string
  language: string
  copyright: string
  description?: string
}

export interface BookInfo {
  id: string
  name: string
  slug: string
  abbr: string
  testament: 'old' | 'new'
  chapters: number
  versesPerChapter: number[]
}

export interface BibleIndex {
  metadata: VersionMetadata
  books: BookInfo[]
}

export interface Verse {
  verse: number
  text: string
}

export interface ChapterData {
  verses: Verse[]
  book: BookInfo
  chapterNum: number
  version: VersionMetadata
  prevChapter: { bookSlug: string; chapter: number } | null
  nextChapter: { bookSlug: string; chapter: number } | null
}

// ============================================================
// Route params types
// ============================================================

export interface ChapterRouteParams {
  lang: string
  version: string
  book: string
  chapter: string
}

export interface StaticChapterParam {
  lang: string
  version: string
  book: string
  chapter: string
}
