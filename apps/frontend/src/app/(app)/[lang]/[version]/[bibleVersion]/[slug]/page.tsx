import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  websiteContent,
  passageSections,
  sections,
  publicationPath,
  type Locale
} from '@/lib/website/content'
import { WebsiteVideo } from '@/components/ui/WebsiteVideo'
import { readerSegment } from '@/lib/reader/routes'
import { loadBibleIndex } from '@/lib/bible/loader'
type Params = {
  lang: string
  version: string
  bibleVersion: string
  slug: string
}
export const dynamicParams = false
export function generateStaticParams() {
  // Next 14 static export rejects an empty parameter list. Export a 404-only
  // placeholder and remove its files after export; it is never in the sitemap.
  const pages = websiteContent().publications.map((p) => ({
    lang: p.locale,
    version: sections[p.locale][p.kind],
    bibleVersion: p.version,
    slug: p.slug
  }))
  return pages.length
    ? pages
    : [
        {
          lang: 'en',
          version: 'daily-dose',
          bibleVersion: '_empty',
          slug: '_empty'
        }
      ]
}
function publication(params: Params) {
  return websiteContent().publications.find(
    (p) =>
      p.locale === params.lang &&
      sections[p.locale][p.kind] === params.version &&
      p.version === params.bibleVersion &&
      p.slug === params.slug
  )
}
export async function generateMetadata({
  params
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const p = publication(await params)
  if (!p) return {}
  const s = sections[p.locale]
  const title = p.title
  const description =
    p.description ||
    `${s[p.kind === 'short' ? 'shortTitle' : 'longTitle']} · ${p.title} · ${loadBibleIndex(p.locale, p.version).metadata.name}`
  return {
    title,
    description,
    alternates: { canonical: publicationPath(p), languages: {} },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'article',
      title,
      description,
      url: publicationPath(p),
      images: [`https://i.ytimg.com/vi/${p.youtubeId}/hqdefault.jpg`]
    }
  }
}
export default async function VideoPage({
  params
}: {
  params: Promise<Params>
}) {
  const p = publication(await params)
  if (!p) notFound()
  const s = sections[p.locale]
  const passages = passageSections(p)
  const first = passages[0]
  const siblings = websiteContent()
    .publications.filter(
      (v) =>
        v.locale === p.locale && v.version === p.version && v.kind === p.kind
    )
    .sort(
      (a, b) =>
        (a.passage.episode ?? a.projectId) - (b.passage.episode ?? b.projectId)
    )
  const i = siblings.findIndex((v) => v.projectId === p.projectId)
  return (
    <main
      className="min-h-screen px-4 py-10"
      style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}
    >
      <article className="max-w-3xl mx-auto">
        <a href={`/${p.locale}/${s[p.kind]}`}>
          ← {s[p.kind === 'short' ? 'shortTitle' : 'longTitle']}
        </a>
        <p className="mt-8 text-sm">
          {loadBibleIndex(p.locale, p.version).metadata.name}
          {p.kind === 'long' ? ` · ${s.day} ${p.passage.episode}` : ''}
        </p>
        <h1
          className="text-3xl md:text-4xl font-bold mt-3 mb-6"
          style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
        >
          {p.title}
        </h1>
        {p.description && (
          <p className="mb-8 whitespace-pre-line leading-relaxed">
            {p.description}
          </p>
        )}
        <WebsiteVideo
          id={p.youtubeId}
          title={p.title}
          label={s.play}
          short={p.kind === 'short'}
        />
        <div className="my-10 space-y-8">
          {passages.map(({ book, chapter, verses }) => (
            <section key={`${book.id}/${chapter}`}>
              <h2 className="text-xl font-semibold mb-4">
                {book.name} {chapter}
              </h2>
              <div
                className="space-y-3 text-lg leading-relaxed"
                style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
              >
                {verses.map((v) => (
                  <p key={v.verse}>
                    <sup className="mr-2 text-xs opacity-60">{v.verse}</sup>
                    {v.text}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <a
          href={`/${p.locale}/${readerSegment(p.locale)}/${p.version}/${first.book.slug}/${first.chapter}`}
        >
          {s.read} →
        </a>
        <nav
          className="flex justify-between gap-6 border-t mt-10 pt-6"
          style={{ borderColor: 'var(--border)' }}
        >
          {siblings[i - 1] ? (
            <a href={publicationPath(siblings[i - 1])}>
              ← {s.previous}: {siblings[i - 1].title}
            </a>
          ) : (
            <span />
          )}
          {siblings[i + 1] && (
            <a href={publicationPath(siblings[i + 1])}>
              {s.next}: {siblings[i + 1].title} →
            </a>
          )}
        </nav>
      </article>
    </main>
  )
}
