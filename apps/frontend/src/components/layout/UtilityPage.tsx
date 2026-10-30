'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { I18nProvider } from '@/lib/i18n/client'
import { detectLocale, isValidLocale, type Locale } from '@/lib/i18n/config'
import { PublicPage } from './PublicPage'

export function UtilityPage({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en')
  useEffect(() => {
    let next = detectLocale()
    try {
      const saved = JSON.parse(localStorage.getItem('veobible-preferences') ?? '{}').locale
      if (isValidLocale(saved)) next = saved
    } catch { /* Browser language remains the fallback. */ }
    setLocale(next)
  }, [])
  return <I18nProvider locale={locale}><PublicPage locale={locale}>{children}</PublicPage></I18nProvider>
}
