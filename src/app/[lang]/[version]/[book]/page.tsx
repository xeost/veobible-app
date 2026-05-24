import { redirect } from 'next/navigation'
import { getAllBookStaticParams } from '@/lib/bible/loader'

interface BookPageProps {
  params: Promise<{ lang: string; version: string; book: string }>
}

export async function generateStaticParams() {
  return getAllBookStaticParams()
}

export default async function BookPage({ params }: BookPageProps) {
  const { lang, version, book } = await params
  redirect(`/${lang}/${version}/${book}/1`)
}
