import type { Bookmark, BookmarkFolder, ReadingPosition, RibbonPosition, StorageRepository, UserPreferences } from './types'
import { ApiClient, SYNCABLE_PREFERENCE_KEYS } from '@/lib/api/client'
import { getSupabaseClient } from '@/lib/supabase/client'
import { importGuest, transaction, type State, type Operation } from './database'

const emit = (name = 'sync') => window.dispatchEvent(new Event(`veobible:${name}`))
const timestamp = () => new Date().toISOString()
const enqueue = (s: State, key: string, method: string, ...args: unknown[]) => {
  s.queue = s.queue.filter(op => op.key !== key)
  s.queue.push({ id: crypto.randomUUID(), key, method, args })
}
export class HybridStorageAdapter implements StorageRepository {
  private scope = 'guest'
  private token: string | null = null
  private syncing = new Set<string>()
  private timer?: ReturnType<typeof setTimeout>
  private initialized: Promise<unknown> = Promise.resolve()
  constructor() {
    if (typeof window === 'undefined') return
    // Recover account identity locally; token refresh must never gate local reads.
    const client = getSupabaseClient()
    const key = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`
    try { const session = JSON.parse(localStorage.getItem(key) ?? 'null'); if (session?.user?.id) { this.scope = session.user.id; this.token = session.access_token } } catch {}
    this.initialized = this.migrate(this.scope)
    client.auth.onAuthStateChange((event, session) => {
      const previous = this.scope
      this.scope = session?.user.id ?? 'guest'
      this.token = session?.access_token ?? null
      if (previous !== this.scope) {
        const scope = this.scope
        this.initialized = this.initialized.then(() => this.migrate(scope)).then(() => event === 'SIGNED_IN' && previous === 'guest' && scope !== 'guest' ? importGuest(scope) : undefined)
      }
      localStorage.removeItem('veobible_last_sync')
      this.initialized.then(() => { emit(); this.schedule() }).catch(console.error)
    })
    window.addEventListener('online', () => this.schedule())
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.schedule() })
    setInterval(() => { if (!document.hidden) this.schedule() }, 5 * 60 * 1000)
  }
  private async migrate(scope: string) {
    // Legacy keys remain untouched as a backup. Claim once, to the locally known account.
    if (!localStorage.getItem('veobible_idb_migrated')) {
      const read = (key: string, fallback: unknown) => { try { return JSON.parse(localStorage.getItem(`veobible_${key}`) ?? 'null') ?? fallback } catch { return fallback } }
      await transaction(scope, s => {
        if (s.bookmarks.length || s.lastSync) return
        s.bookmarks = read('bookmarks', []) as Bookmark[]
        s.folders = read('bookmark_folders', []) as BookmarkFolder[]
        s.positions = read('reading_positions', {}) as State['positions']
        s.ribbons = read('reading_ribbons', {}) as State['ribbons']
        s.preferences = read('preferences', {}) as UserPreferences
        for (const b of s.bookmarks) enqueue(s, `bookmark:${b.id}`, 'createBookmark', b)
        for (const f of s.folders) enqueue(s, `folder:${f.id}`, 'createFolder', f)
        for (const p of Object.values(s.positions)) enqueue(s, `position:${p.versionSlug}`, 'upsertReadingPosition', p)
        for (const r of Object.values(s.ribbons)) enqueue(s, `ribbon:${r.versionSlug}`, 'upsertReadingRibbon', r)
      })
      localStorage.setItem('veobible_idb_migrated', scope)
    }
  }
  private async access<T>(update: (s: State) => T, mutate = false) {
    const scope = this.scope
    await this.initialized
    const result = await transaction(scope, update)
    if (mutate) this.schedule()
    return result
  }
  private schedule() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.manualSync().catch(() => {}), 1000)
  }
  async manualSync() {
    const scope = this.scope, token = this.token
    if (!token || scope === 'guest' || this.syncing.has(scope) || !navigator.onLine) return
    await this.initialized
    this.syncing.add(scope); emit('syncing')
    const api = new ApiClient(() => token)
    try {
      for (;;) {
        const op = await transaction(scope, s => [...s.queue].sort((a, b) => {
          const rank = (o: Operation) => o.method === 'createFolder' ? 0 : o.method === 'deleteFolder' ? 3 : o.method.startsWith('delete') ? 2 : 1
          return rank(a) - rank(b)
        })[0])
        if (!op || this.scope !== scope) break
        try {
          const fn = api[op.method as keyof ApiClient] as (...args: unknown[]) => Promise<unknown>
          await fn.apply(api, op.args)
        } catch (error) {
          if (!(op.method.startsWith('delete') && (error as { status?: number }).status === 404)) throw error
        }
        await transaction(scope, s => { s.queue = s.queue.filter(q => q.id !== op.id) })
      }
      if (this.scope !== scope) return
      // Full snapshots also propagate hard-deleted ribbons and avoid timestamp cursor gaps.
      const remote = await api.pull(new Date(0).toISOString())
      await transaction(scope, s => {
        const pending = new Set(s.queue.map(op => op.key))
        const merge = <T extends { id: string; deletedAt?: string }>(local: T[], incoming: T[], kind: string) => {
          const map = new Map(local.map(b => [b.id, b]))
          for (const b of incoming) if (!pending.has(`${kind}:${b.id}`)) { if (b.deletedAt) map.delete(b.id); else map.set(b.id, b) }
          return Array.from(map.values())
        }
        s.bookmarks = merge(s.bookmarks, remote.bookmarks.map(b => ({ ...b, syncStatus: 'synced' as const })), 'bookmark')
        s.folders = merge(s.folders, remote.bookmarkFolders, 'folder')
        for (const p of remote.readingPositions) if (!pending.has(`position:${p.versionSlug}`)) s.positions[p.versionSlug] = p
        const ribbons = Object.fromEntries(remote.readingRibbons.map(r => [r.versionSlug, r]))
        for (const key of Object.keys(s.ribbons)) if (pending.has(`ribbon:${key}`)) ribbons[key] = s.ribbons[key]
        for (const key of Object.keys(ribbons)) if (pending.has(`ribbon:${key}`) && !s.ribbons[key]) delete ribbons[key]
        s.ribbons = ribbons
        if (!pending.has('preferences')) Object.assign(s.preferences, remote.preferences)
        s.lastSync = remote.serverTime
      })
      if (scope === this.scope) { localStorage.setItem('veobible_last_sync', remote.serverTime); emit() }
    } catch (error) { emit('sync-error'); throw error }
    finally { this.syncing.delete(scope) }
  }
  async clearDeviceData() {
    const scope = this.scope
    await this.initialized
    await transaction(scope, s => { Object.assign(s, { bookmarks: [], folders: [], positions: {}, ribbons: {}, preferences: {}, queue: [], lastSync: '' }) })
    // Remove only legacy user data; keep the migration marker to prevent reimport.
    for (const key of ['bookmarks', 'bookmark_folders', 'reading_positions', 'reading_ribbons', 'preferences', 'last_sync']) localStorage.removeItem(`veobible_${key}`)
    emit()
  }
  getBookmarks() { return this.access(s => s.bookmarks) }
  getBookmarksByVersion(version: string) { return this.access(s => s.bookmarks.filter(b => b.versionSlug === version)) }
  getBookmark(id: string) { return this.access(s => s.bookmarks.find(b => b.id === id) ?? null) }
  addBookmark(data: Omit<Bookmark, 'id' | 'createdAt' | 'syncStatus'>) {
    return this.access(s => { const b: Bookmark = { ...data, id: crypto.randomUUID(), createdAt: timestamp(), updatedAt: timestamp(), syncStatus: 'pending' }; s.bookmarks.unshift(b); enqueue(s, `bookmark:${b.id}`, 'createBookmark', b); return b }, true)
  }
  updateBookmark(id: string, patch: Partial<Omit<Bookmark, 'id' | 'createdAt'>>) {
    return this.access(s => { const b = s.bookmarks.find(b => b.id === id); if (!b) throw new Error('Bookmark missing'); const queued = s.queue.find(o => o.key === `bookmark:${id}`)?.args[0] as { baseUpdatedAt?: string } | undefined; const baseUpdatedAt = queued?.baseUpdatedAt ?? b.updatedAt; Object.assign(b, patch, { updatedAt: timestamp(), syncStatus: 'pending' }); enqueue(s, `bookmark:${id}`, 'createBookmark', { ...b, baseUpdatedAt, conflictId: crypto.randomUUID() }); return b }, true)
  }
  removeBookmark(id: string) { return this.access(s => { s.bookmarks = s.bookmarks.filter(b => b.id !== id); enqueue(s, `bookmark:${id}`, 'deleteBookmark', id) }, true) }
  clearBookmarks() { return this.access(s => { for (const b of s.bookmarks) enqueue(s, `bookmark:${b.id}`, 'deleteBookmark', b.id); s.bookmarks = [] }, true) }
  getFoldersByVersion(version: string) { return this.access(s => s.folders.filter(f => f.versionSlug === version).sort((a,b) => a.order - b.order)) }
  addFolder(data: Omit<BookmarkFolder, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.access(s => { const f = { ...data, id: crypto.randomUUID(), createdAt: timestamp(), updatedAt: timestamp() }; s.folders.push(f); enqueue(s, `folder:${f.id}`, 'createFolder', f); return f }, true)
  }
  updateFolder(id: string, patch: Partial<Omit<BookmarkFolder, 'id' | 'createdAt'>>) {
    return this.access(s => { const f = s.folders.find(f => f.id === id); if (!f) throw new Error('Folder missing'); Object.assign(f, patch, { updatedAt: timestamp() }); enqueue(s, `folder:${id}`, 'createFolder', f); return f }, true)
  }
  removeFolder(id: string) { return this.access(s => { s.folders = s.folders.filter(f => f.id !== id); for (const b of s.bookmarks) if (b.folderId === id) { b.folderId = undefined; enqueue(s, `bookmark:${b.id}`, 'createBookmark', b) } enqueue(s, `folder:${id}`, 'deleteFolder', id) }, true) }
  getReadingPosition(version: string) { return this.access(s => s.positions[version] ?? null) }
  setReadingPosition(p: ReadingPosition) { return this.access(s => { s.positions[p.versionSlug] = p; enqueue(s, `position:${p.versionSlug}`, 'upsertReadingPosition', p) }, true) }
  getRibbonPosition(version: string) { return this.access(s => s.ribbons[version] ?? null) }
  setRibbonPosition(r: RibbonPosition) { return this.access(s => { s.ribbons[r.versionSlug] = r; enqueue(s, `ribbon:${r.versionSlug}`, 'upsertReadingRibbon', r) }, true) }
  clearRibbonPosition(version: string) { return this.access(s => { delete s.ribbons[version]; enqueue(s, `ribbon:${version}`, 'deleteReadingRibbon', version) }, true) }
  getPreferences() { return this.access(s => s.preferences) }
  setPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) { return this.setPreferences({ [key]: value }) }
  setPreferences(patch: Partial<UserPreferences>) { return this.access(s => { Object.assign(s.preferences, patch); const syncable = Object.fromEntries(SYNCABLE_PREFERENCE_KEYS.filter(k => s.preferences[k] !== undefined).map(k => [k, s.preferences[k]])); enqueue(s, 'preferences', 'putPreferences', syncable) }, true) }
}
