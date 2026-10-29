import catalog from './catalog.json' with { type: 'json' }
export { catalog }
/** Public editorial contract. Never includes rendering settings or account data. */
export type Locale = 'es' | 'en' | 'pt'
export type Point = { chapter: number; verse: number }
export type Publication = {
  projectId: number
  kind: 'short' | 'long'
  locale: Locale
  version: string
  slug: string
  title: string
  description: string
  youtubeId: string
  passage: {
    book: string
    endBook?: string
    start: Point
    end: Point
    episode?: number
  }
}
export type BookVideo = {
  locale: Locale
  version: string
  book: string
  youtubeId: string
}
export type SiteContent = {
  schema: 1
  publications: Publication[]
  bookVideos: BookVideo[]
}
export type SiteSnapshot = SiteContent & { revision: string }
export const emptyContent: SiteContent = {
  schema: 1,
  publications: [],
  bookVideos: []
}
export const sections = {
  es: {
    short: 'dosis-diaria',
    long: 'biblia-en-365-dias',
    shortTitle: 'Tu dosis diaria de la palabra de Dios',
    longTitle: 'La Biblia en 365 días',
    play: 'Ver video',
    read: 'Leer en la Biblia',
    back: 'Inicio',
    empty: 'Próximamente encontrarás aquí nuevas lecturas.',
    day: 'Día',
    previous: 'Anterior',
    next: 'Siguiente'
  },
  en: {
    short: 'daily-dose',
    long: 'bible-in-365-days',
    shortTitle: 'Your daily dose of the word of God',
    longTitle: 'The Bible in 365 days',
    play: 'Watch video',
    read: 'Read in the Bible',
    back: 'Home',
    empty: 'New readings will appear here soon.',
    day: 'Day',
    previous: 'Previous',
    next: 'Next'
  },
  pt: {
    short: 'dose-diaria',
    long: 'biblia-em-365-dias',
    shortTitle: 'Sua dose diária da palavra de Deus',
    longTitle: 'A Bíblia em 365 dias',
    play: 'Assistir ao vídeo',
    read: 'Ler na Bíblia',
    back: 'Início',
    empty: 'Em breve você encontrará novas leituras aqui.',
    day: 'Dia',
    previous: 'Anterior',
    next: 'Próximo'
  }
} as const
export const publicationPath = (p: Publication) =>
  `/${p.locale}/${sections[p.locale][p.kind]}/${p.version}/${p.slug}`
export function youtubeId(value: string): string | null {
  if (/^[\w-]{11}$/.test(value)) return value
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' || u.username || u.password || u.port)
      return null
    const id =
      u.hostname === 'youtu.be'
        ? u.pathname.slice(1)
        : ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(
              u.hostname
            )
          ? (u.searchParams.get('v') ??
            u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})\/?$/)?.[1])
          : null
    return id && /^[\w-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}
export function validateContent(input: unknown): SiteContent {
  const c = input as SiteContent
  const slug = (s: unknown) =>
    typeof s === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) &&
    s.length <= 160
  const locale = (s: unknown) => ['es', 'en', 'pt'].includes(s as string)
  const point = (p: Point) =>
    p &&
    Number.isInteger(p.chapter) &&
    p.chapter > 0 &&
    p.chapter <= 150 &&
    Number.isInteger(p.verse) &&
    p.verse > 0 &&
    p.verse <= 176
  if (
    !c ||
    c.schema !== 1 ||
    !Array.isArray(c.publications) ||
    !Array.isArray(c.bookVideos) ||
    c.publications.length > 20000 ||
    c.bookVideos.length > 1000
  )
    throw new Error('Invalid website content')
  const keys = new Set<string>()
  const ids = new Set<number>()
  for (const p of c.publications) {
    if (
      !p ||
      !Number.isSafeInteger(p.projectId) ||
      p.projectId <= 0 ||
      !['short', 'long'].includes(p.kind) ||
      !locale(p.locale) ||
      !slug(p.version) ||
      !slug(p.slug) ||
      typeof p.title !== 'string' ||
      !p.title.trim() ||
      p.title.length > 500 ||
      typeof p.description !== 'string' ||
      p.description.length > 10000 ||
      !/^[\w-]{11}$/.test(p.youtubeId) ||
      !p.passage ||
      !slug(p.passage.book) ||
      (p.passage.endBook !== undefined && !slug(p.passage.endBook)) ||
      !point(p.passage.start) ||
      !point(p.passage.end) ||
      (p.kind === 'long' &&
        (!Number.isInteger(p.passage.episode) ||
          p.passage.episode! < 1 ||
          p.passage.episode! > 365))
    )
      throw new Error('Invalid website publication')
    const version = (
      catalog as Record<
        string,
        {
          books: {
            id: string
            slug: string
            chapters: number
            versesPerChapter: number[]
          }[]
        }
      >
    )[`${p.locale}/${p.version}`]
    const a =
      version?.books.findIndex(
        (b) => b.id === p.passage.book || b.slug === p.passage.book
      ) ?? -1
    const b =
      version?.books.findIndex(
        (b) =>
          b.id === (p.passage.endBook ?? p.passage.book) ||
          b.slug === (p.passage.endBook ?? p.passage.book)
      ) ?? -1
    if (
      a < 0 ||
      b < a ||
      p.passage.start.verse >
        (version.books[a].versesPerChapter[p.passage.start.chapter - 1] ?? 0) ||
      p.passage.end.verse >
        (version.books[b].versesPerChapter[p.passage.end.chapter - 1] ?? 0) ||
      (a === b &&
        (p.passage.end.chapter < p.passage.start.chapter ||
          (p.passage.end.chapter === p.passage.start.chapter &&
            p.passage.end.verse < p.passage.start.verse)))
    )
      throw new Error('Invalid Bible passage')
    const key = publicationPath(p)
    if (keys.has(key) || ids.has(p.projectId))
      throw new Error('Duplicate website publication')
    keys.add(key)
    ids.add(p.projectId)
  }
  for (const b of c.bookVideos) {
    if (
      !b ||
      !locale(b.locale) ||
      !slug(b.version) ||
      !slug(b.book) ||
      !/^[\w-]{11}$/.test(b.youtubeId)
    )
      throw new Error('Invalid book video')
    if (
      !(catalog as Record<string, { books: { id: string }[] }>)[
        `${b.locale}/${b.version}`
      ]?.books.some((book) => book.id === b.book)
    )
      throw new Error('Invalid Bible book')
    const key = `${b.locale}/${b.version}/${b.book}`
    if (keys.has(key)) throw new Error('Duplicate book video')
    keys.add(key)
  }
  // Strip unexpected fields at the trust boundary.
  return {
    schema: 1,
    publications: c.publications.map((p) => ({
      projectId: p.projectId,
      kind: p.kind,
      locale: p.locale,
      version: p.version,
      slug: p.slug,
      title: p.title,
      description: p.description,
      youtubeId: p.youtubeId,
      passage: {
        book: p.passage.book,
        ...(p.passage.endBook ? { endBook: p.passage.endBook } : {}),
        start: {
          chapter: p.passage.start.chapter,
          verse: p.passage.start.verse
        },
        end: { chapter: p.passage.end.chapter, verse: p.passage.end.verse },
        ...(p.passage.episode ? { episode: p.passage.episode } : {})
      }
    })),
    bookVideos: c.bookVideos.map((b) => ({
      locale: b.locale,
      version: b.version,
      book: b.book,
      youtubeId: b.youtubeId
    }))
  }
}
