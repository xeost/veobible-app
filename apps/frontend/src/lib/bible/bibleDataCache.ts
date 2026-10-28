import type { Verse, BibleIndex } from './types'

const CACHE_NAME = 'veobible-bible-data'
const memory = new Map<string, unknown>()
export const chapterUrl = (lang: string, version: string, book: string, chapter: number) => `/bible-data/${lang}/${version}/${book}/${chapter}.json`
export const bookUrl = (lang: string, version: string, book: string) => `/bible-data/${lang}/${version}/${book}.json`
export const indexUrl = (lang: string, version: string) => `/bible-data/${lang}/${version}/index.json`
type Manifest = { revision: string; entries: Record<string, { sha256: string; bytes: number }> }
let manifestPromise: Promise<Manifest | null> | undefined
async function cache() { try { return await caches.open(CACHE_NAME) } catch { return null } }
async function manifest() {
  return manifestPromise ??= (async () => {
    const c = await cache()
    const saved = await c?.match('/bible-data/manifest.json')
    const refresh = async () => {
      const r = await fetch('/bible-data/manifest.json', { cache: 'no-cache', signal: AbortSignal.timeout(5000) })
      if (!r.ok) throw new Error('manifest')
      const data = await r.clone().json() as Manifest
      if (!data.entries || !data.revision) throw new Error('Invalid manifest')
      await c?.put('/bible-data/manifest.json', r)
      return data
    }
    if (saved) { void refresh().catch(() => {}); return saved.json() as Promise<Manifest> }
    try { return await refresh() } catch { return null }
  })()
}
async function load<T>(url: string, signal?: AbortSignal, persistent = false): Promise<T> {
  const c = await cache()
  const m = await manifest()
  const entry = m?.entries[url]
  const key = entry ? `${url}?revision=${entry.sha256}` : url
  if (!persistent && memory.has(key)) return memory.get(key) as T
  const saved = await c?.match(key)
  if (saved) { const data = await saved.json(); memory.set(key, data); return data }
  // Preserve downloads made by previous app versions when offline.
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const legacy = await c?.match(url)
    if (legacy) return legacy.json()
  }
  const response = await fetch(key, { signal })
  if (!response.ok) throw new Error(`Unable to download ${url}: ${response.status}`)
  const bytes = await response.arrayBuffer()
  if (entry) {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
    if (hash !== entry.sha256 || bytes.byteLength !== entry.bytes) throw new Error('Content integrity check failed')
  }
  const data = JSON.parse(new TextDecoder().decode(bytes)) as T
  if (c) {
    try { await c.put(key, new Response(bytes, { headers: { 'Content-Type': 'application/json' } })) }
    catch (e) { if (persistent) throw e }
  } else if (persistent) throw new Error('Offline storage unavailable')
  memory.set(key, data)
  return data
}
export async function fetchBook(lang: string, version: string, book: string, chapterCount: number, signal?: AbortSignal, persistent = false): Promise<Record<number, Verse[]>> {
  const data = await load<Record<number, Verse[]>>(bookUrl(lang, version, book), signal, persistent)
  for (let n = 1; n <= chapterCount; n++) if (!Array.isArray(data[n]) || !data[n].length || data[n].some(v => typeof v.text !== 'string')) throw new Error('Incomplete book')
  return data
}
export async function fetchChapter(lang: string, version: string, book: string, chapter: number, signal?: AbortSignal): Promise<Verse[]> {
  const index = await readIndexFromCache(lang, version)
  const info = index?.books.find(b => b.id === book)
  if (info) return (await fetchBook(lang, version, book, info.chapters, signal))[chapter]
  return load(chapterUrl(lang, version, book, chapter), signal)
}
export async function fetchAndCacheIndex(lang: string, version: string, signal?: AbortSignal, persistent = false) {
  await load<BibleIndex>(indexUrl(lang, version), signal, persistent)
}
export async function readIndexFromCache(lang: string, version: string): Promise<BibleIndex | null> {
  const url = indexUrl(lang, version)
  const c = await cache()
  const m = await manifest()
  const key = m?.entries[url] ? `${url}?revision=${m.entries[url].sha256}` : url
  if (memory.has(key)) return memory.get(key) as BibleIndex
  const response = await c?.match(key) ?? await c?.match(url)
  return response ? response.json() : null
}
export async function getCachedBookCount(lang: string, version: string) {
  const c = await cache()
  const index = await readIndexFromCache(lang, version)
  if (!c || !index) return 0
  const m = await manifest()
  let count = 0
  for (const book of index.books) {
    const url = bookUrl(lang, version, book.id)
    const key = m?.entries[url] ? `${url}?revision=${m.entries[url].sha256}` : url
    const r = await c.match(key) ?? await c.match(url)
    if (!r) continue
    try { const data = await r.json(); if (Array.from({ length: book.chapters }, (_, i) => i + 1).every(n => Array.isArray(data[n]) && data[n].length)) count++ } catch {}
  }
  return count
}
export async function deleteVersionFromCache(lang: string, version: string) {
  const prefix = `/bible-data/${lang}/${version}/`
  for (const key of Array.from(memory.keys())) if (key.startsWith(prefix)) memory.delete(key)
  const c = await cache()
  if (c) for (const request of await c.keys()) if (new URL(request.url).pathname.startsWith(prefix)) await c.delete(request)
}
