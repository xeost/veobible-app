'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/client'
import { storage } from '@/lib/storage'

export function LanguageToggle() {
  const { t, locale } = useI18n()
  const router = useRouter()

  const handleLangChange = async (lang: string) => {
    await storage.setPreference('locale', lang as any)
    router.push(`/${lang}`)
  }

  // The language the button will switch TO (the one that is not active)
  const otherLang = locale === 'es' ? 'en' : 'es'

  return (
    <button
      onClick={() => handleLangChange(otherLang)}
      className="btn-icon px-2.5 text-xs font-bold tracking-wide rounded-lg"
      aria-label={t.language.label}
      id="lang-switcher-btn"
      title={t.language[otherLang]}
    >
      {otherLang.toUpperCase()}
    </button>
  )
}
