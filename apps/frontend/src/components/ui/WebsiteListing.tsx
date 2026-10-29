import Image from 'next/image'
import { ArrowLeft, ArrowRight, BookOpen, Play } from 'lucide-react'
import { websiteContent, sections, publicationPath, type Locale } from '@/lib/website/content'
import { discovery } from '@/lib/i18n/discovery'
import { getDefaultVersionForLang } from '@/lib/bible/config'
import { readerSegment } from '@/lib/reader/routes'
import { HomeHeader } from '@/components/layout/HomeHeader'
import { Footer } from '@/components/layout/Footer'
import { WebsiteSections } from './WebsiteSections'

export function WebsiteListing({ locale, kind }: { locale: Locale; kind: 'short' | 'long' }) {
  const s = sections[locale]
  const copy = discovery[locale]
  const pages = websiteContent().publications
    .filter(p => p.locale === locale && p.kind === kind)
    .sort((a, b) => kind === 'long' ? (a.passage.episode ?? 0) - (b.passage.episode ?? 0) : b.projectId - a.projectId)
  const defaultVersion = getDefaultVersionForLang(locale)!
  return <div className="site-page">
    <HomeHeader currentLang={locale} />
    <main id="main-content" className="site-container collection-main">
      <a href={`/${locale}`} className="breadcrumb"><ArrowLeft size={16} aria-hidden="true" />{s.back}</a>
      <header className={`collection-hero ${kind === 'short' ? 'discovery-dose' : 'discovery-journey'}`}>
        <p className="eyebrow">{kind === 'short' ? copy.shortLabel : copy.longLabel}</p>
        <h1>{s[kind === 'short' ? 'shortTitle' : 'longTitle']}</h1>
        <p>{kind === 'short' ? copy.shortDescription : copy.longDescription}</p>
      </header>
      {pages.length === 0 ? <div className="collection-empty">
        <BookOpen size={36} strokeWidth={1.5} aria-hidden="true" />
        <h2>{copy.emptyTitle}</h2><p>{s.empty}</p>
        <a className="site-button primary" href={`/${locale}/${readerSegment(locale)}/${defaultVersion.slug}/genesis/1`}>{copy.emptyAction}<ArrowRight size={18} aria-hidden="true" /></a>
      </div> : <>
        <div className="collection-bar"><h2>{copy.readings}</h2><span className="collection-count">{pages.length}</span></div>
        <div className="publication-grid">
          {pages.map(p => <a href={publicationPath(p)} key={p.projectId} className="publication-card">
            <div className="publication-thumbnail">
              <Image unoptimized width={480} height={270} src={`https://i.ytimg.com/vi/${p.youtubeId}/hqdefault.jpg`} alt="" loading="lazy" />
              <span className="publication-play"><Play size={17} fill="currentColor" aria-hidden="true" /></span>
            </div>
            <div className="publication-card-body">
              <span className="eyebrow">{kind === 'long' ? `${s.day} ${p.passage.episode} · ` : ''}{p.version.toUpperCase()}</span>
              <h3>{p.title}</h3>
              {p.description && <p className="line-clamp-3">{p.description}</p>}
              <span className="card-link">{s.play}<ArrowRight size={16} aria-hidden="true" /></span>
            </div>
          </a>)}
        </div>
      </>}
      <section className="collection-other" aria-label={copy.explore}><WebsiteSections locale={locale} /></section>
    </main>
    <Footer lang={locale} />
  </div>
}
