// Two-level cache for Bible chapter JSON files:
//  1. In-memory Map   — instant within the current page session
//  2. Cache API       — persisted across navigations / page reloads
//
// This module has no React dependencies and can be imported by any client module.
// All browser-API calls are guarded with typeof checks so SSR never throws.

import type { Verse } from '@/lib/bible/types'

const CACHE_NAME = 'veobible-bible-data'

// In-memory layer: URL → verse array
const memCache = new Map<string, Verse[]>()

// ── URL helpers ───────────────────────────────────────────────────────────────

export function chapterUrl(
  lang: string,
  version: string,
  bookId: string,
  chapter: number,
): string {
  return `/bible-data/${lang}/${version}/${bookId}/${chapter}.json`
}

// ── Cache API helpers ─────────────────────────────────────────────────────────

async function openCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null
  try {
    return await caches.open(CACHE_NAME)
  } catch {
    return null
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch a chapter's verses, falling through the two-level cache.
 *
 * Lookup order:
 *   memory → Cache API → network (stores result in both layers)
 *
 * In production the Service Worker (next-pwa / Workbox) intercepts the
 * network fetch and returns from its own pre-cache — so the "network" hop
 * is already effectively instant.
 */
export async function fetchChapter(
  lang: string,
  version: string,
  bookId: string,
  chapter: number,
  signal?: AbortSignal,
): Promise<Verse[]> {
  const url = chapterUrl(lang, version, bookId, chapter)

  // 1. Memory hit — fastest path
  const memHit = memCache.get(url)
  if (memHit) return memHit

  // 2. Cache API hit
  const cache = await openCache()
  if (cache) {
    try {
      const cached = await cache.match(url)
      if (cached) {
        const verses = (await cached.json()) as Verse[]
        memCache.set(url, verses) // promote to memory
        return verses
      }
    } catch {
      // Cache read failed — fall through to network
    }
  }

  // 3. Network fetch (goes through SW in production)
  const res = await fetch(url, signal ? { signal } : undefined)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const verses = (await res.json()) as Verse[]

  // Store in both layers (non-blocking, non-critical)
  memCache.set(url, verses)
  if (cache) {
    cache
      .put(
        url,
        new Response(JSON.stringify(verses), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .catch(() => {})
  }

  return verses
}

/**
 * Ensure a chapter is in the cache without returning its data.
 * Skips the fetch entirely if the chapter is already cached in either layer.
 * Used by the offline download flow.
 */
export async function prefetchChapter(
  lang: string,
  version: string,
  bookId: string,
  chapter: number,
  signal?: AbortSignal,
): Promise<void> {
  const url = chapterUrl(lang, version, bookId, chapter)

  // Already in memory — skip
  if (memCache.has(url)) return

  // Already in Cache API — skip
  const cache = await openCache()
  if (cache) {
    try {
      const existing = await cache.match(url)
      if (existing) return
    } catch {
      // Continue to fetch
    }
  }

  // Not cached — fetch and store
  await fetchChapter(lang, version, bookId, chapter, signal)
}

/**
 * Count how many chapter files for a version are stored in the Cache API.
 * Index files (index.json) are excluded from the count.
 */
export async function getCachedChapterCount(
  lang: string,
  version: string,
): Promise<number> {
  if (typeof caches === 'undefined') return 0
  try {
    const cache = await openCache()
    if (!cache) return 0
    const keys = await cache.keys()
    const prefix = `/bible-data/${lang}/${version}/`
    return keys.filter((req) => {
      const pathname = new URL(req.url).pathname
      return (
        pathname.startsWith(prefix) &&
        pathname.endsWith('.json') &&
        !pathname.endsWith('index.json')
      )
    }).length
  } catch {
    return 0
  }
}

/**
 * Remove all cached entries for a version from both the Cache API and memory.
 */
export async function deleteVersionFromCache(
  lang: string,
  version: string,
): Promise<void> {
  const prefix = `/bible-data/${lang}/${version}/`

  // Clear memory layer
  for (const key of Array.from(memCache.keys())) {
    if (key.startsWith(prefix)) memCache.delete(key)
  }

  // Clear Cache API layer
  if (typeof caches === 'undefined') return
  try {
    const cache = await openCache()
    if (!cache) return
    const keys = await cache.keys()
    await Promise.all(
      keys
        .filter((req) => new URL(req.url).pathname.startsWith(prefix))
        .map((req) => cache.delete(req)),
    )
  } catch {
    // Non-critical
  }
}
