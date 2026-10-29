import generated from '@/generated/website.json'
import fs from 'node:fs'
import path from 'node:path'
import {
  validateContent,
  type Publication,
  type SiteSnapshot
} from '../../../../../packages/website/content'
import { loadBibleIndex } from '@/lib/bible/loader'
export {
  sections,
  publicationPath,
  type Publication,
  type Locale
} from '../../../../../packages/website/content'
export function websiteContent(): SiteSnapshot {
  const input = generated as SiteSnapshot
  return { ...validateContent(input), revision: input.revision }
}
export function passageSections(p: Publication) {
  const index = loadBibleIndex(p.locale, p.version)
  const from = index.books.findIndex(
    (b) => b.id === p.passage.book || b.slug === p.passage.book
  )
  const to = index.books.findIndex(
    (b) =>
      b.id === (p.passage.endBook ?? p.passage.book) ||
      b.slug === (p.passage.endBook ?? p.passage.book)
  )
  if (from < 0 || to < from)
    throw new Error(`Invalid passage for ${p.projectId}`)
  return index.books.slice(from, to + 1).flatMap((book, offset) => {
    const start = offset === 0 ? p.passage.start.chapter : 1
    const end = offset === to - from ? p.passage.end.chapter : book.chapters
    return Array.from({ length: end - start + 1 }, (_, i) => {
      const chapter = start + i
      const verses = JSON.parse(
        fs.readFileSync(
          path.join(
            process.cwd(),
            'public/bible-data',
            p.locale,
            p.version,
            book.id,
            `${chapter}.json`
          ),
          'utf8'
        )
      ) as { verse: number; text: string }[]
      return {
        book,
        chapter,
        verses: verses.filter(
          (v) =>
            (offset !== 0 ||
              chapter !== p.passage.start.chapter ||
              v.verse >= p.passage.start.verse) &&
            (offset !== to - from ||
              chapter !== p.passage.end.chapter ||
              v.verse <= p.passage.end.verse)
        )
      }
    })
  })
}
