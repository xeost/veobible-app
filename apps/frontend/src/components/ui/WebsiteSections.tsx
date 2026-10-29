import { sections, type Locale } from '../../../../../packages/website/content'
export function WebsiteSections({ locale }: { locale: Locale }) {
  const s = sections[locale]
  return (
    <nav className="grid sm:grid-cols-2 gap-4 my-8" aria-label="VeoBible">
      <a
        className="book-link-card rounded-2xl p-6 font-semibold"
        href={`/${locale}/${s.short}`}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)'
        }}
      >
        {s.shortTitle} →
      </a>
      <a
        className="book-link-card rounded-2xl p-6 font-semibold"
        href={`/${locale}/${s.long}`}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)'
        }}
      >
        {s.longTitle} →
      </a>
    </nav>
  )
}
