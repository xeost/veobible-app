import type { Bookmark, BookmarkFolder, ReadingPosition, RibbonPosition, UserPreferences } from './types'
export type Operation = { id: string; key: string; method: string; args: unknown[] }
export type State = { bookmarks: Bookmark[]; folders: BookmarkFolder[]; positions: Record<string, ReadingPosition>; ribbons: Record<string, RibbonPosition>; preferences: UserPreferences; queue: Operation[]; lastSync: string }
export const emptyState = (): State => ({ bookmarks: [], folders: [], positions: {}, ribbons: {}, preferences: {}, queue: [], lastSync: '' })
let connection: Promise<IDBDatabase> | undefined
function db() {
  return connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('veobible-reader', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('accounts')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { connection = undefined; reject(request.error) }
  })
}
/** Read + write one account and its outbox atomically, also across tabs. */
export async function transaction<T>(scope: string, update: (state: State) => T): Promise<T> {
  const database = await db()
  return new Promise<T>((resolve, reject) => {
    const tx = database.transaction('accounts', 'readwrite')
    const store = tx.objectStore('accounts')
    let result: T
    const request = store.get(scope)
    request.onsuccess = () => {
      try {
        const state: State = request.result ?? emptyState()
        result = update(state)
        store.put(state, scope)
      } catch (error) { tx.abort(); reject(error) }
    }
    tx.oncomplete = () => resolve(result)
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Local storage transaction failed'))
  })
}

export async function importGuest(scope: string) {
  const database = await db()
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('accounts', 'readwrite'), store = tx.objectStore('accounts')
    const guestRequest = store.get('guest'), accountRequest = store.get(scope)
    let guestReady = false, accountReady = false
    const apply = () => {
      if (!guestReady || !accountReady) return
      const guest: State = guestRequest.result ?? emptyState(), account: State = accountRequest.result ?? emptyState()
      account.bookmarks.push(...guest.bookmarks.filter(b => !account.bookmarks.some(a => a.id === b.id)))
      account.folders.push(...guest.folders.filter(f => !account.folders.some(a => a.id === f.id)))
      account.positions = { ...guest.positions, ...account.positions }
      account.ribbons = { ...guest.ribbons, ...account.ribbons }
      account.preferences = { ...guest.preferences, ...account.preferences }
      account.queue.push(...guest.queue.filter(o => !account.queue.some(a => a.key === o.key)))
      store.put(account, scope); store.put(emptyState(), 'guest')
    }
    guestRequest.onsuccess = () => { guestReady = true; apply() }
    accountRequest.onsuccess = () => { accountReady = true; apply() }
    tx.oncomplete = () => resolve()
    tx.onabort = tx.onerror = () => reject(tx.error)
  })
}
