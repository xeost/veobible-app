import { getAllBookStaticParams } from '@/lib/bible/loader'

interface BookPageProps {
  params: Promise<{ lang: string; version: string; book: string }>
}

export async function generateStaticParams() {
  return getAllBookStaticParams()
}

export default async function BookPage({ params }: BookPageProps) {
  const { lang, version, book } = await params
  const target = `/${lang}/${version}/${book}/1`

  // Static-export-compatible redirect: uses both meta refresh and JS.
  // next/navigation redirect() only produces a JS-driven redirect which may
  // not work when Cloudflare serves the raw HTML file before hydration.
  return (
    <html lang={lang}>
      <head>
        <meta httpEquiv="refresh" content={`0; url=${target}`} />
        <link rel="canonical" href={target} />
        <script dangerouslySetInnerHTML={{ __html: `window.location.replace(${JSON.stringify(target)})` }} />
      </head>
      <body />
    </html>
  )
}

