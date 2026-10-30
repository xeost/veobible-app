import { PublicPage } from '@/components/layout/PublicPage'
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
    <PublicPage locale={p.locale}>
      <main id="main-content" className="site-container publication-main">
      <article className="publication-article">
        <a className="breadcrumb" href={`/${p.locale}/${s[p.kind]}`}>
          ← {s[p.kind === 'short' ? 'shortTitle' : 'longTitle']}
        </a>
        <p className="publication-meta">
          {loadBibleIndex(p.locale, p.version).metadata.name}
          {p.kind === 'long' ? ` · ${s.day} ${p.passage.episode}` : ''}
        </p>
        <h1>
          {p.title}
        </h1>
        {p.description && (
          <p className="publication-description">
            {p.description}
          </p>
        )}
        <WebsiteVideo
          id={p.youtubeId}
          title={p.title}
          label={s.play}
          short={p.kind === 'short'}
        />
        <div className="passage-content">
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
          className="site-button primary"
          href={`/${p.locale}/${readerSegment(p.locale)}/${p.version}/${first.book.slug}/${first.chapter}`}
        >
          {s.read} →
        </a>
        <nav
          className="publication-pagination"
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
    </PublicPage>
  )
}
