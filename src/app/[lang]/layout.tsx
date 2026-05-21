import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isValidLocale } from '@/lib/i18n/config'
import { getTranslations } from '@/lib/i18n/server'
import { I18nProvider } from '@/lib/i18n/client'
import type { Locale } from '@/lib/i18n/config'

interface LangLayoutProps {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'es' }]
}

export async function generateMetadata({ params }: LangLayoutProps): Promise<Metadata> {
  const { lang } = await params
  if (!isValidLocale(lang)) return {}
  const t = getTranslations(lang as Locale)
  return {
    title: {
      default: t.meta.homeTitle,
      template: `%s | VeoBible`,
    },
    description: t.meta.homeDescription,
    alternates: {
      canonical: `/${lang}`,
      languages: { en: '/en', es: '/es' },
    },
    openGraph: {
      title: t.meta.homeTitle,
      description: t.meta.homeDescription,
      locale: lang,
    },
  }
}

export default async function LangLayout({ children, params }: LangLayoutProps) {
  const { lang } = await params
  if (!isValidLocale(lang)) notFound()

  return (
    <I18nProvider locale={lang as Locale}>
      <div lang={lang}>
        {children}
      </div>
    </I18nProvider>
  )
}
