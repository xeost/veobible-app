import type { Translations } from './translations/en'
import { en } from './translations/en'
import { es } from './translations/es'
import { pt } from './translations/pt'
import type { Locale } from './config'

const translations: Record<Locale, Translations> = { en, es, pt }

export function getTranslations(locale: Locale): Translations {
  return translations[locale] ?? en
}
