'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Sun } from 'lucide-react'
import Link from '@/components/reader/ReaderLink'
import { useI18n } from '@/lib/i18n/client'
import { getVerseOfTheDay, getDailyVerseReference } from '@/lib/bible/verses-of-the-day'
import { readerSegment } from '@/lib/reader/routes'

export function DailyVerse({ locale, versionSlug }: { locale: string; versionSlug: string }) {
  const { t } = useI18n()
  // Resolve the day after hydration so static exports never freeze the daily verse.
  const [dailyVerse, setDailyVerse] = useState<ReturnType<typeof getVerseOfTheDay> | null>(null)
  const [verseText, setVerseText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { setDailyVerse(getVerseOfTheDay()) }, [])
  useEffect(() => {
    if (!dailyVerse) return
    const controller = new AbortController()
    setLoading(true)
    setVerseText(null)
    fetch(`/bible-data/${locale}/${versionSlug}/${dailyVerse.bookSlug}/${dailyVerse.chapter}.json`, { signal: controller.signal })
      .then(res => { if (!res.ok) throw new Error('Verse unavailable'); return res.json() })
      .then((verses: { verse: number; text: string }[]) => setVerseText(verses.find(v => v.verse === dailyVerse.verse)?.text ?? null))
      .catch(() => { if (!controller.signal.aborted) setVerseText(null) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [dailyVerse, locale, versionSlug])
  const bookSlug = dailyVerse && (locale === 'es' ? dailyVerse.bookSlugEs : dailyVerse.bookSlug)
  return <section className="daily-verse" aria-label={t.home.verseOfTheDay}>
    <div className="verse-heading"><Sun size={20} aria-hidden="true" /><span>{t.home.verseOfTheDay}</span><span className="verse-dot" /></div>
    <div className="verse-body" aria-busy={loading}>
      <span className="verse-quote" aria-hidden="true">“</span>
      {loading ? <div className="verse-skeleton" aria-label={t.home.verseOfTheDay}><span /><span /><span /></div>
        : verseText ? <blockquote>{verseText}</blockquote>
        : <p>{dailyVerse && getDailyVerseReference(dailyVerse, locale)}</p>}
      {dailyVerse && <p className="verse-reference">{getDailyVerseReference(dailyVerse, locale)} <span>· {versionSlug.toUpperCase()}</span></p>}
    </div>
    {dailyVerse && <Link id="verse-of-the-day-link" className="verse-context" href={`/${locale}/${readerSegment(locale)}/${versionSlug}/${bookSlug}/${dailyVerse.chapter}#verse-${dailyVerse.verse}`}>
      {t.home.readInContext}<ArrowRight size={18} aria-hidden="true" />
    </Link>}
  </section>
}
