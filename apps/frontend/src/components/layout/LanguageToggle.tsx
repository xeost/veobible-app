'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/client'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'
import { storage } from '@/lib/storage'

export function LanguageToggle() {
  const { t, locale } = useI18n()
  const router = useRouter()

  const currentIndex = SUPPORTED_LOCALES.indexOf(locale)
  const nextIndex = (currentIndex + 1) % SUPPORTED_LOCALES.length
  const nextLang = SUPPORTED_LOCALES[nextIndex >= 0 ? nextIndex : 0]

  const handleLangChange = async () => {
    await storage.setPreference('locale', nextLang as any)
    router.push(`/${nextLang}`)
  }

  return (
    <button
      onClick={handleLangChange}
      className="btn-icon px-2.5 text-xs font-bold tracking-wide rounded-lg"
      aria-label={t.language.label}
      id="lang-switcher-btn"
      title={t.language[nextLang] ?? nextLang.toUpperCase()}
    >
      {nextLang.toUpperCase()}
    </button>
  )
}
