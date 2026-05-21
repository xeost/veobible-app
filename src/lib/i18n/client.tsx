'use client'

import React, { createContext, useContext } from 'react'
import type { Translations } from './translations/en'
import { en } from './translations/en'
import { es } from './translations/es'
import type { Locale } from './config'

const translations: Record<Locale, Translations> = { en, es }

function getTranslations(locale: Locale): Translations {
  return translations[locale] ?? en
}

const I18nContext = createContext<{ locale: Locale; t: Translations }>({
  locale: 'en',
  t: en,
})

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  const t = getTranslations(locale)
  return <I18nContext.Provider value={{ locale, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
