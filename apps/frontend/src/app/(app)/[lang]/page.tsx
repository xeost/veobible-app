'use client'

import '@/styles/home.css'
import '@/styles/home-header.css'
import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, Bookmark, Check, Download, Globe2, Monitor, Smartphone, Type } from 'lucide-react'
import Link from '@/components/reader/ReaderLink'
import { CloudScene } from '@/components/layout/CloudScene'
import { HomeHeader } from '@/components/layout/HomeHeader'
import { Footer } from '@/components/layout/Footer'
import { SupportBanner } from '@/components/ui/SupportBanner'
import { WebsiteSections } from '@/components/ui/WebsiteSections'
import { DailyVerse } from '@/components/home/DailyVerse'
import { useI18n } from '@/lib/i18n/client'
import { discovery } from '@/lib/i18n/discovery'
import { getVersionsForLang } from '@/lib/bible/config'
import { readerSegment } from '@/lib/reader/routes'
import { storage, type ReadingPosition } from '@/lib/storage'

export default function LangHomePage() {
  const { t, locale } = useI18n()
  const copy = discovery[locale]
  const versions = getVersionsForLang(locale)
  const primaryVersion = versions[0]
  const [lastPositions, setLastPositions] = useState<Record<string, ReadingPosition | null>>({})
  useEffect(() => {
    let active = true
    setLastPositions({})
    Promise.all(getVersionsForLang(locale).map(async v => [v.slug, await storage.getReadingPosition(v.slug)] as const))
      .then(entries => { if (active) setLastPositions(Object.fromEntries(entries)) })
      .catch(() => { /* Reading remains available when browser storage is restricted. */ })
    return () => { active = false }
  }, [locale])
  const readingHref = (slug: string) => {
    const position = lastPositions[slug]
    return `/${locale}/${readerSegment(locale)}/${slug}/${position?.bookSlug ?? 'genesis'}/${position?.chapter ?? 1}`
  }
  const installCards = [
    { title: t.home.installIos, icon: Smartphone, steps: [t.home.installIosStep1, t.home.installIosStep2, t.home.installIosStep3, t.home.installIosStep4] },
    { title: t.home.installAndroid, icon: Smartphone, steps: [t.home.installAndroidStep1, t.home.installAndroidStep2, t.home.installAndroidStep3, t.home.installAndroidStep4] },
    { title: t.home.installDesktopChrome, icon: Monitor, steps: [t.home.installDesktopChromeStep1, t.home.installDesktopChromeStep2, t.home.installDesktopChromeStep3] },
    { title: t.home.installDesktopSafari, icon: Monitor, steps: [t.home.installDesktopSafariStep1, t.home.installDesktopSafariStep2, t.home.installDesktopSafariStep3] },
  ]
  const featureIcons = [Type, Bookmark, Download]
  return <div className="site-page cloud-home">
    <HomeHeader currentLang={locale} variant="home" />
    <main id="main-content">
      <section className="home-sky">
        <CloudScene />
        <div className="site-container home-hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" />{copy.eyebrow}</p>
          <h1>{copy.title}<br /><span>{copy.titleAccent}</span></h1>
          <p className="hero-intro">{copy.intro}</p>
          <div className="hero-actions">
            {primaryVersion && <Link id={`start-reading-${primaryVersion.slug}`} href={readingHref(primaryVersion.slug)} className="site-button primary reading-cta">
              <BookOpen size={20} aria-hidden="true" />{lastPositions[primaryVersion.slug] ? t.home.continueReading : t.home.startReading}<ArrowRight size={18} aria-hidden="true" />
            </Link>}
            <a href="#versions" className="text-link">{copy.choose}<ArrowRight size={17} aria-hidden="true" /></a>
          </div>
          <div className="hero-notes"><span><Check size={15} aria-hidden="true" />{copy.free}</span><span><Globe2 size={15} aria-hidden="true" />{copy.languages}</span></div>
        </div>
        {primaryVersion && <DailyVerse locale={locale} versionSlug={primaryVersion.slug} />}
        </div>
      </section>

      <section className="site-container home-discover" aria-labelledby="discover-title">
        <div className="section-heading"><div><p className="eyebrow">{copy.daily}</p><h2 id="discover-title">{copy.explore}</h2></div><p>{copy.exploreIntro}</p></div>
        <WebsiteSections locale={locale} />
      </section>

      <section id="versions" className="library-section" aria-labelledby="versions-title">
        <div className="site-container">
          <div className="section-heading"><div><p className="eyebrow">{copy.libraryLabel}</p><h2 id="versions-title">{copy.library}</h2></div><p>{copy.libraryIntro}</p></div>
          <nav className="language-tabs" aria-label={t.language.label}>
            {(['es', 'en', 'pt'] as const).map(lang => <a href={`/${lang}#versions`} key={lang} aria-current={locale === lang ? 'page' : undefined}>{lang === 'es' ? 'Español' : lang === 'en' ? 'English' : 'Português'}<span>{getVersionsForLang(lang).length}</span></a>)}
          </nav>
          <div className="version-grid">
            {versions.map(v => <article className="version-card" key={v.slug}>
              <div className="version-card-heading"><span className="version-monogram"><BookOpen size={25} strokeWidth={1.5} aria-hidden="true" /></span><span className="eyebrow">{v.shortName.toUpperCase()}</span></div>
              <h3>{v.name}</h3>
              <p className="version-position">{lastPositions[v.slug] ? `${copy.resume}: ${lastPositions[v.slug]?.bookSlug.replace(/-/g, ' ')} ${lastPositions[v.slug]?.chapter}` : copy.free}</p>
              <div className="version-actions"><Link id={`version-card-${v.slug}`} href={readingHref(v.slug)} className="text-link">{lastPositions[v.slug] ? t.home.continueReading : t.home.startReading}<ArrowRight size={18} aria-hidden="true" /></Link><a href={`/${locale}/${v.slug}`}>{copy.books}</a></div>
            </article>)}
          </div>
        </div>
      </section>

      <section className="site-container everyday-section" aria-labelledby="everyday-title">
        <div className="section-heading"><div><p className="eyebrow">VeoBible</p><h2 id="everyday-title">{copy.everywhere}</h2></div><p>{copy.everywhereIntro}</p></div>
        <div className="feature-grid">{copy.features.map(([title, description], i) => { const Icon = featureIcons[i]; return <div key={title} className="feature-item"><Icon size={25} strokeWidth={1.5} aria-hidden="true" /><h3>{title}</h3><p>{description}</p></div> })}</div>
        <div className="install-panel"><div><span className="install-icon"><Download size={26} aria-hidden="true" /></span><h2>{copy.install}</h2><p>{copy.installIntro}</p></div>
          <div className="install-options">{installCards.map(({ title, icon: Icon, steps }) => <details key={title}><summary><Icon size={18} aria-hidden="true" /><span>{title}</span></summary><ol>{steps.map((step, i) => <li key={step}><span>{i + 1}</span>{step}</li>)}</ol></details>)}</div>
        </div>
      </section>
      <section className="site-container community-section"><p className="eyebrow">{copy.community}</p><SupportBanner /></section>
    </main>
    <Footer lang={locale} />
  </div>
}
