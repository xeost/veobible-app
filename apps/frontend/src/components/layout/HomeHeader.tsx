'use client'

import { usePathname } from 'next/navigation'
import { BookOpen, Sun, CalendarDays } from 'lucide-react'
import { Logo } from './Logo'
import { LanguageToggle } from './LanguageToggle'
import { ThemeToggle } from './ThemeToggle'
import { AuthButton } from '@/components/auth/AuthButton'
import { HomeUserMenu } from './HomeUserMenu'
import { discovery } from '@/lib/i18n/discovery'
import { sections, type Locale } from '../../../../../packages/website/content'

export function HomeHeader({ currentLang, variant = 'default' }: { currentLang: string; variant?: 'default' | 'home' }) {
  const locale = currentLang as Locale
  const copy = discovery[locale]
  const s = sections[locale]
  const pathname = usePathname()
  const links = [`/${locale}#versions`, `/${locale}/${s.short}`, `/${locale}/${s.long}`]
  const collectionIndex = links.findIndex((href, index) => index > 0 && (pathname === href || pathname?.startsWith(`${href}/`)))
  const activeIndex = collectionIndex >= 0 ? collectionIndex : (pathname === `/${locale}` || pathname?.startsWith(`/${locale}/`) ? 0 : -1)
  const icons = [BookOpen, Sun, CalendarDays]
  return (
    <header className={`app-header site-header sticky top-0 z-30${variant === 'home' ? ' home-header' : ''}`}>
      <a className="skip-link" href="#main-content">{copy.skip}</a>
      <div className="site-container site-header-inner">
        <Logo currentLang={locale} />
        <nav className="site-nav" aria-label="VeoBible">
          {links.map((href, i) => {
            const Icon = icons[i]
            const active = i === activeIndex
            return <a key={href} href={href} aria-current={active ? 'page' : undefined}>
              <Icon size={17} aria-hidden="true" /><span>{copy.nav[i]}</span>
            </a>
          })}
        </nav>
        <div className="site-header-actions">{variant === 'home' ? <HomeUserMenu /> : <><LanguageToggle /><ThemeToggle /><AuthButton /></>}</div>
      </div>
    </header>
  )
}
