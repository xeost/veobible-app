import Image from 'next/image'
import {
  websiteContent,
  sections,
  publicationPath,
  type Locale
} from '@/lib/website/content'
export function WebsiteListing({
  locale,
  kind
}: {
  locale: Locale
  kind: 'short' | 'long'
}) {
  const s = sections[locale]
  const pages = websiteContent()
    .publications.filter((p) => p.locale === locale && p.kind === kind)
    .sort((a, b) =>
      kind === 'long'
        ? (a.passage.episode ?? 0) - (b.passage.episode ?? 0)
        : b.projectId - a.projectId
    )
  return (
    <main
      className="min-h-screen px-4 py-10"
      style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}
    >
      <div className="max-w-5xl mx-auto">
        <a href={`/${locale}`}>← {s.back}</a>
        <h1
          className="text-3xl md:text-4xl font-bold my-8"
          style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
        >
          {s[kind === 'short' ? 'shortTitle' : 'longTitle']}
        </h1>
        {pages.length === 0 ? (
          <p>{s.empty}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {pages.map((p) => (
              <a
                href={publicationPath(p)}
                key={p.projectId}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)'
                }}
              >
                <Image
                  unoptimized
                  width={480}
                  height={360}
                  src={`https://i.ytimg.com/vi/${p.youtubeId}/hqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  className="aspect-video w-full object-cover"
                />
                <div className="p-5">
                  {kind === 'long' && (
                    <p className="text-sm mb-2">
                      {s.day} {p.passage.episode} · {p.version.toUpperCase()}
                    </p>
                  )}
                  <h2 className="font-semibold text-lg">{p.title}</h2>
                  {p.description && (
                    <p className="line-clamp-3 mt-2 text-sm">{p.description}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
