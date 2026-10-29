'use client'

import { usePathname } from 'next/navigation'
import { BookOpen, Sun, CalendarDays } from 'lucide-react'
import { Logo } from './Logo'
import { LanguageToggle } from './LanguageToggle'
import { ThemeToggle } from './ThemeToggle'
import { AuthButton } from '@/components/auth/AuthButton'
import { discovery } from '@/lib/i18n/discovery'
import { sections, type Locale } from '../../../../../packages/website/content'

export function HomeHeader({ currentLang }: { currentLang: string }) {
  const locale = currentLang as Locale
  const copy = discovery[locale]
  const s = sections[locale]
  const pathname = usePathname()
  const links = [`/${locale}#versions`, `/${locale}/${s.short}`, `/${locale}/${s.long}`]
  const icons = [BookOpen, Sun, CalendarDays]
  return (
    <header className="app-header site-header sticky top-0 z-30">
      <a className="skip-link" href="#main-content">{copy.skip}</a>
      <div className="site-container site-header-inner">
        <Logo currentLang={locale} />
        <nav className="site-nav" aria-label="VeoBible">
          {links.map((href, i) => {
            const Icon = icons[i]
            const active = i > 0 && pathname?.startsWith(href)
            return <a key={href} href={href} aria-current={active ? 'page' : undefined}>
              <Icon size={17} aria-hidden="true" /><span>{copy.nav[i]}</span>
            </a>
          })}
        </nav>
        <div className="site-header-actions"><LanguageToggle /><ThemeToggle /><AuthButton /></div>
      </div>
    </header>
  )
}
