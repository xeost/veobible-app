import { notFound } from 'next/navigation'
import { findVersion } from '@/lib/bible/config'
import { loadBibleIndex } from '@/lib/bible/loader'
import { isValidLocale } from '@/lib/i18n/config'
import { ReaderLayoutClient } from './ReaderLayoutClient'

interface ReaderLayoutProps {
  children: React.ReactNode
  params: Promise<{ lang: string; version: string; book: string }>
}

/**
 * Server layout for the reader (persistent across chapter navigations).
 * Loads books list and version info once; passes them to ReaderLayoutClient
 * which renders the header, sidebars, and the reading column (children).
 */
export default async function ReaderLayout({ children, params }: ReaderLayoutProps) {
  const { lang, version } = await params

  if (!isValidLocale(lang)) notFound()
  const versionInfo = findVersion(lang, version)
  if (!versionInfo) notFound()

  const index = loadBibleIndex(lang, version)

  return (
    <ReaderLayoutClient
      lang={lang}
      version={version}
      versionName={versionInfo.name}
      books={index.books}
    >
      {children}
    </ReaderLayoutClient>
  )
}
