import './loader.mjs'
import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import { transaction, importGuest, emptyState } from '../src/lib/storage/database.ts'

test('account state and pending operations commit together, concurrent tabs do not lose changes', async () => {
  await Promise.all(Array.from({ length: 20 }, (_, i) => transaction('atomic', s => {
    s.bookmarks.push({ id: String(i), note: 'saved' })
    s.queue.push({ id: String(i), key: String(i), method: 'createBookmark', args: [] })
  })))
  const state = await transaction('atomic', s => s)
  assert.equal(state.bookmarks.length, 20)
  assert.equal(state.queue.length, 20)
  await assert.rejects(transaction('atomic', s => { s.bookmarks = []; throw Error('interrupted') }))
  assert.equal((await transaction('atomic', s => s)).bookmarks.length, 20)
})
test('guest migration transfers once and never leaks into another account', async () => {
  await transaction('guest', s => { s.bookmarks.push({ id: 'guest-note' }); s.queue.push({ id: 'op', key: 'bookmark:guest-note', method: 'createBookmark', args: [] }) })
  await importGuest('alice')
  await importGuest('bob')
  assert.equal((await transaction('alice', s => s)).bookmarks[0].id, 'guest-note')
  assert.equal((await transaction('alice', s => s)).queue.length, 1)
  assert.deepEqual(await transaction('bob', s => s), emptyState())
})
test('outbox survives network errors, coalesces edits and retries deletion', async () => {
  const target = new EventTarget(), values = new Map()
  globalThis.window = Object.assign(target, { location: { pathname: '/en/read/kjv/genesis/1' } })
  globalThis.document = Object.assign(new EventTarget(), { hidden: true })
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) }
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true })
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  values.set('sb-test-auth-token', JSON.stringify({ user: { id: 'retry' }, access_token: 'token' }))
  values.set('veobible_idb_migrated', 'retry')
  globalThis.__auth = { auth: { onAuthStateChange: () => {} } }
  const interval = globalThis.setInterval
  globalThis.setInterval = (...args) => { const timer = interval(...args); timer.unref(); return timer }
  const { HybridStorageAdapter } = await import('../src/lib/storage/hybrid-adapter.ts')
  const adapter = new HybridStorageAdapter()
  const b = await adapter.addBookmark({ versionSlug: 'kjv', bookSlug: 'genesis', chapter: 1, verseStart: 1, verseEnd: 1, selectedText: 'text' })
  await adapter.updateBookmark(b.id, { note: 'offline note' })
  assert.equal((await transaction('retry', s => s)).queue.length, 1)
  globalThis.fetch = async () => { throw Error('offline') }
  await assert.rejects(adapter.manualSync())
  assert.equal((await transaction('retry', s => s)).queue.length, 1)
  const remote = []
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') { remote.push(JSON.parse(options.body)); return Response.json({ data: remote.at(-1) }) }
    if (options.method === 'DELETE') { remote.length = 0; return new Response(null, { status: 204 }) }
    return Response.json({ bookmarks: remote, bookmarkFolders: [], readingPositions: [], readingRibbons: [], preferences: {}, serverTime: new Date().toISOString() })
  }
  await adapter.manualSync()
  assert.equal(remote[0].note, 'offline note')
  assert.equal((await transaction('retry', s => s)).queue.length, 0)
  await adapter.removeBookmark(b.id)
  await adapter.manualSync()
  assert.equal((await adapter.getBookmarks()).length, 0)
  assert.equal(remote.length, 0)
})
