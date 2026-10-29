import { ArrowUpRight, Sun, Route } from 'lucide-react'
import { discovery } from '@/lib/i18n/discovery'
import { sections, type Locale } from '../../../../../packages/website/content'

export function WebsiteSections({ locale }: { locale: Locale }) {
  const s = sections[locale]
  const copy = discovery[locale]
  return (
    <div className="discovery-grid">
      <a className="discovery-card discovery-dose" href={`/${locale}/${s.short}`}>
        <div className="discovery-card-top"><Sun size={29} strokeWidth={1.5} aria-hidden="true" /><span className="eyebrow">{copy.shortLabel}</span><ArrowUpRight size={23} aria-hidden="true" /></div>
        <h3>{s.shortTitle}</h3>
        <p>{copy.shortDescription}</p>
        <span className="card-link">{copy.shortAction}<ArrowUpRight size={18} aria-hidden="true" /></span>
        <Sun className="discovery-art" size={160} strokeWidth={0.7} aria-hidden="true" />
      </a>
      <a className="discovery-card discovery-journey" href={`/${locale}/${s.long}`}>
        <div className="discovery-card-top"><Route size={29} strokeWidth={1.5} aria-hidden="true" /><span className="eyebrow">{copy.longLabel}</span><ArrowUpRight size={23} aria-hidden="true" /></div>
        <h3>{s.longTitle}</h3>
        <p>{copy.longDescription}</p>
        <span className="card-link">{copy.longAction}<ArrowUpRight size={18} aria-hidden="true" /></span>
        <span className="journey-art" aria-hidden="true">365</span>
      </a>
    </div>
  )
}
