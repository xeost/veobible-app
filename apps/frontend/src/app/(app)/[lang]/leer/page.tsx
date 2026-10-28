import type { Metadata } from 'next'
import { InteractiveReader } from '@/components/reader/InteractiveReader'
export const metadata: Metadata = { title: 'VeoBible', robots: { index: false, follow: true }, alternates: { canonical: null, languages: {} } }
export default function ReaderPage() { return <InteractiveReader /> }
