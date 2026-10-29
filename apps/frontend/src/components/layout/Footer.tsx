import Link from '@/components/reader/ReaderLink'
import { discovery } from '@/lib/i18n/discovery'
import { sections, type Locale } from '../../../../../packages/website/content'

export function Footer({ lang }: { lang: string }) {
  const locale = lang as Locale
  const copy = discovery[locale]
  const s = sections[locale]
  return <footer className="site-footer">
    <div className="site-container">
      <div className="footer-grid">
        <div><Link href={`/${lang}`} className="footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" width={34} height={34} alt="" />VeoBible
        </Link><p>{copy.footer}</p></div>
        <div><h2>{copy.nav[0]}</h2><ul>
          <li><Link href="/es/rv1909">Reina Valera 1909</Link></li>
          <li><Link href="/en/kjv">King James Version</Link></li>
          <li><Link href="/pt/arc">Almeida Revista e Corrigida</Link></li>
          <li><Link href={`/${lang}#versions`}>{copy.all}</Link></li>
        </ul></div>
        <div><h2>{copy.explore}</h2><ul>
          <li><Link href={`/${lang}/${s.short}`}>{s.shortTitle}</Link></li>
          <li><Link href={`/${lang}/${s.long}`}>{s.longTitle}</Link></li>
        </ul></div>
      </div>
      <p className="footer-bottom">© {new Date().getFullYear()} VeoBible · {copy.free}</p>
    </div>
  </footer>
}
