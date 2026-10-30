import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n/config'
import { HomeHeader } from './HomeHeader'
import { Footer } from './Footer'
import { CloudScene } from './CloudScene'
import '@/styles/home.css'
import '@/styles/home-header.css'
import '@/styles/public-pages.css'

/** Used explicitly by public pages so reader routes never inherit this layout. */
export function PublicPage({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <div className="site-page cloud-home cloud-page">
    <div className="home-sky page-sky" aria-hidden="true"><CloudScene /></div>
    <HomeHeader currentLang={locale} variant="home" />
    {children}
    <Footer lang={locale} />
  </div>
}
