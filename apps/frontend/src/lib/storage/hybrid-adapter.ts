import type {
  Bookmark,
  BookmarkFolder,
  ReadingPosition,
  RibbonPosition,
  StorageRepository,
  UserPreferences,
} from './types'
import { LocalStorageAdapter } from './local-adapter'
import { ApiClient, SYNCABLE_PREFERENCE_KEYS, type SyncablePreferenceKey } from '@/lib/api/client'
import { getSupabaseClient } from '@/lib/supabase/client'

// localStorage key constants — must match local-adapter.ts
const LS_BOOKMARKS = 'veobible_bookmarks'
const LS_FOLDERS   = 'veobible_bookmark_folders'
const LS_POSITIONS = 'veobible_reading_positions'
const LS_RIBBONS   = 'veobible_reading_ribbons'
const LAST_SYNC_KEY = 'veobible_last_sync'

// Background sync interval (5 minutes)
const SYNC_INTERVAL_MS = 5 * 60 * 1000

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

function getLastSync(): string {
  if (typeof window === 'undefined') return new Date(0).toISOString()
  return localStorage.getItem(LAST_SYNC_KEY) ?? new Date(0).toISOString()
}

function setLastSync(time: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(LAST_SYNC_KEY, time)
}

/**
 * Dispatches a custom event that hooks can listen for to re-read storage.
 * This is the signal that localStorage contents have changed due to a
 * sync operation (initial login pull, background pull, or sign-out clear).
 */
function dispatchSyncEvent(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('veobible:sync'))
  }
}

/** Dispatches a custom event to signal that a sync is in progress. */
function dispatchSyncingEvent(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('veobible:syncing'))
  }
}

function getAllPositions(): ReadingPosition[] {
  const record = lsGet<Record<string, ReadingPosition>>(LS_POSITIONS, {})
  return Object.values(record)
}

function getAllRibbons(): RibbonPosition[] {
  const record = lsGet<Record<string, RibbonPosition>>(LS_RIBBONS, {})
  return Object.values(record)
}

function buildSyncablePrefs(
  prefs: UserPreferences,
): Partial<Pick<UserPreferences, SyncablePreferenceKey>> {
  const out: Partial<Pick<UserPreferences, SyncablePreferenceKey>> = {}
  for (const key of SYNCABLE_PREFERENCE_KEYS) {
    if (prefs[key] !== undefined) {
      (out as Record<string, unknown>)[key] = prefs[key]
    }
  }
  return out
}

// ────────────────────────────────────────────────────────────────────────────
// HybridStorageAdapter
//
// Writes always go to localStorage first (offline-safe), then are sent to
// the API in the background when authenticated. On first login, a full sync
// is performed: local data is pushed to the server and remote data is pulled.
// Returning authenticated users get an incremental pull on app focus/interval.
// ────────────────────────────────────────────────────────────────────────────
export class HybridStorageAdapter implements StorageRepository {
  private readonly local: LocalStorageAdapter
  private readonly api: ApiClient
  private accessToken: string | null = null
  private isSyncing = false
  private syncInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.local = new LocalStorageAdapter()
    this.api = new ApiClient(() => this.accessToken)

    if (typeof window !== 'undefined') {
      const supabase = getSupabaseClient()

      supabase.auth.onAuthStateChange(async (event, session) => {
        const wasAuthenticated = this.accessToken !== null
        this.accessToken = session?.access_token ?? null

        if (session) {
          if (event === 'SIGNED_IN' && !wasAuthenticated) {
            // Fresh login: push local data then pull everything from server
            this.performInitialSync().catch(console.error)
          } else if (event === 'INITIAL_SESSION') {
            // App opened while already logged in: incremental pull only
            this.backgroundSync().catch(console.error)
          }
          this.startBackgroundSync()
        } else {
          // Signed out — notify hooks so they re-read the (now possibly
          // cleared) localStorage and update their in-memory state.
          this.stopBackgroundSync()
          dispatchSyncEvent()
        }
      })
    }
  }

  private get isAuthenticated(): boolean {
    return this.accessToken !== null
  }

  // ── Background sync scheduling ───────────────────────────────────────────

  private startBackgroundSync(): void {
    if (this.syncInterval) return

    // Sync on tab focus
    document.addEventListener('visibilitychange', this.onVisibilityChange)

    // Sync on interval
    this.syncInterval = setInterval(() => {
      if (!document.hidden) this.backgroundSync().catch(console.error)
    }, SYNC_INTERVAL_MS)
  }

  private stopBackgroundSync(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  private onVisibilityChange = () => {
    if (!document.hidden && this.isAuthenticated) {
      this.backgroundSync().catch(console.error)
    }
  }

  // ── Initial sync (on first login) ────────────────────────────────────────

  async performInitialSync(): Promise<void> {
    if (!this.isAuthenticated || this.isSyncing) return
    this.isSyncing = true
    dispatchSyncingEvent()
    try {
      const [bookmarks, allFolders, allPositions, allRibbons, prefs] = await Promise.all([
        this.local.getBookmarks(),
        Promise.resolve(lsGet<BookmarkFolder[]>(LS_FOLDERS, [])),
        Promise.resolve(getAllPositions()),
        Promise.resolve(getAllRibbons()),
        this.local.getPreferences(),
      ])

      const pushResponse = await this.api.push({
        bookmarks: bookmarks.map(({ syncStatus: _s, deletedAt: _d, ...b }) => b),
        bookmarkFolders: allFolders,
        readingPositions: allPositions,
        readingRibbons: allRibbons,
        preferences: buildSyncablePrefs(prefs),
      })

      if (pushResponse.conflicts.length > 0) {
        const { toast } = await import('@/components/ui/Toast')
        toast(`Sync: ${pushResponse.conflicts.length} conflict(s) resolved by server`, 'info')
      }

      // Pull everything since epoch so server state wins for any conflicts
      const pullResponse = await this.api.pull(new Date(0).toISOString())
      await this.applyPull(pullResponse)
    } finally {
      this.isSyncing = false
    }
  }

  // ── Incremental background sync ──────────────────────────────────────────

  async backgroundSync(): Promise<void> {
    if (!this.isAuthenticated || this.isSyncing) return
    this.isSyncing = true
    dispatchSyncingEvent()
    try {
      const pullResponse = await this.api.pull(getLastSync())
      await this.applyPull(pullResponse)
    } catch {
      // Silent failure — will retry on next trigger
      window.dispatchEvent(new CustomEvent('veobible:sync-error'))
    } finally {
      this.isSyncing = false
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Triggers an immediate incremental sync if authenticated and not already
   * syncing. Intended for use by the UI (e.g. a "Sync now" button).
   */
  public async manualSync(): Promise<void> {
    await this.backgroundSync()
  }

  // ── Apply pulled server data (LWW) ───────────────────────────────────────

  private async applyPull(
    pull: Awaited<ReturnType<ApiClient['pull']>>,
  ): Promise<void> {
    if (typeof window === 'undefined') return

    // ── Bookmarks ──────────────────────────────────────────────────────────
    // Work on a mutable copy so multiple insertions don't clobber each other
    const bookmarks = lsGet<Bookmark[]>(LS_BOOKMARKS, [])
    let bookmarksChanged = false

    for (const remote of pull.bookmarks) {
      const localIdx = bookmarks.findIndex((b) => b.id === remote.id)
      const localTs  = localIdx !== -1 ? bookmarks[localIdx].updatedAt : undefined
      const wins     = !remote.updatedAt || !localTs || remote.updatedAt >= localTs

      if (!wins) continue

      if (remote.deletedAt) {
        if (localIdx !== -1) { bookmarks.splice(localIdx, 1); bookmarksChanged = true }
      } else {
        const entry: Bookmark = { ...remote, syncStatus: 'synced' }
        if (localIdx === -1) {
          bookmarks.unshift(entry)
        } else {
          bookmarks[localIdx] = entry
        }
        bookmarksChanged = true
      }
    }
    if (bookmarksChanged) localStorage.setItem(LS_BOOKMARKS, JSON.stringify(bookmarks))

    // ── Folders ────────────────────────────────────────────────────────────
    const folders = lsGet<BookmarkFolder[]>(LS_FOLDERS, [])
    let foldersChanged = false

    for (const remote of pull.bookmarkFolders) {
      const idx = folders.findIndex((f) => f.id === remote.id)
      const localTs = idx !== -1 ? folders[idx].updatedAt : undefined
      if (!localTs || remote.updatedAt >= localTs) {
        if (idx === -1) { folders.push(remote) } else { folders[idx] = remote }
        foldersChanged = true
      }
    }
    if (foldersChanged) localStorage.setItem(LS_FOLDERS, JSON.stringify(folders))

    // ── Reading positions ──────────────────────────────────────────────────
    for (const pos of pull.readingPositions) {
      const local = await this.local.getReadingPosition(pos.versionSlug)
      if (!local || pos.updatedAt >= local.updatedAt) {
        await this.local.setReadingPosition(pos)
      }
    }

    // ── Reading ribbons ────────────────────────────────────────────────────
    for (const ribbon of pull.readingRibbons) {
      const local = await this.local.getRibbonPosition(ribbon.versionSlug)
      if (!local || ribbon.updatedAt >= local.updatedAt) {
        await this.local.setRibbonPosition(ribbon)
      }
    }

    // ── Preferences ────────────────────────────────────────────────────────
    if (pull.preferences && Object.keys(pull.preferences).length > 0) {
      // Strip server-internal fields (e.g. updatedAt) before storing
      const { updatedAt: _ts, ...cleanPrefs } = pull.preferences as typeof pull.preferences & { updatedAt?: string }
      await this.local.setPreferences(cleanPrefs)
    }

    setLastSync(pull.serverTime)

    // Notify React hooks that localStorage has been updated
    dispatchSyncEvent()
  }

  // ── StorageRepository implementation ────────────────────────────────────
  // All methods: write to local first, then fire-and-forget to API.

  async getBookmarks(): Promise<Bookmark[]> {
    return this.local.getBookmarks()
  }

  async getBookmarksByVersion(versionSlug: string): Promise<Bookmark[]> {
    return this.local.getBookmarksByVersion(versionSlug)
  }

  async getBookmark(id: string): Promise<Bookmark | null> {
    return this.local.getBookmark(id)
  }

  async addBookmark(data: Omit<Bookmark, 'id' | 'createdAt' | 'syncStatus'>): Promise<Bookmark> {
    const saved = await this.local.addBookmark(data)
    if (this.isAuthenticated) {
      const { syncStatus: _s, ...payload } = saved
      this.api.createBookmark(payload).catch(console.error)
    }
    return saved
  }

  async updateBookmark(
    id: string,
    patch: Partial<Omit<Bookmark, 'id' | 'createdAt'>>,
  ): Promise<Bookmark> {
    const updated = await this.local.updateBookmark(id, patch)
    if (this.isAuthenticated) {
      // Send the merged result so the required `updatedAt` is always present
      this.api.updateBookmark(id, {
        title: updated.title,
        note: updated.note,
        folderId: updated.folderId,
        updatedAt: updated.updatedAt,
      }).catch(console.error)
    }
    return updated
  }

  async removeBookmark(id: string): Promise<void> {
    await this.local.removeBookmark(id)
    if (this.isAuthenticated) {
      this.api.deleteBookmark(id).catch(console.error)
    }
  }

  async clearBookmarks(): Promise<void> {
    return this.local.clearBookmarks()
  }

  async getFoldersByVersion(versionSlug: string): Promise<BookmarkFolder[]> {
    return this.local.getFoldersByVersion(versionSlug)
  }

  async addFolder(
    data: Omit<BookmarkFolder, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BookmarkFolder> {
    const saved = await this.local.addFolder(data)
    if (this.isAuthenticated) {
      this.api.createFolder(saved).catch(console.error)
    }
    return saved
  }

  async updateFolder(
    id: string,
    patch: Partial<Omit<BookmarkFolder, 'id' | 'createdAt'>>,
  ): Promise<BookmarkFolder> {
    const updated = await this.local.updateFolder(id, patch)
    if (this.isAuthenticated) {
      // Send the merged result so the required `updatedAt` is always present
      this.api.updateFolder(id, {
        name: updated.name,
        order: updated.order,
        updatedAt: updated.updatedAt,
      }).catch(console.error)
    }
    return updated
  }

  async removeFolder(id: string): Promise<void> {
    await this.local.removeFolder(id)
    if (this.isAuthenticated) {
      this.api.deleteFolder(id).catch(console.error)
    }
  }

  async getReadingPosition(versionSlug: string): Promise<ReadingPosition | null> {
    return this.local.getReadingPosition(versionSlug)
  }

  async setReadingPosition(position: ReadingPosition): Promise<void> {
    await this.local.setReadingPosition(position)
    if (this.isAuthenticated) {
      this.api.upsertReadingPosition(position).catch(console.error)
    }
  }

  async getRibbonPosition(versionSlug: string): Promise<RibbonPosition | null> {
    return this.local.getRibbonPosition(versionSlug)
  }

  async setRibbonPosition(position: RibbonPosition): Promise<void> {
    await this.local.setRibbonPosition(position)
    if (this.isAuthenticated) {
      this.api.upsertReadingRibbon(position).catch(console.error)
    }
  }

  async clearRibbonPosition(versionSlug: string): Promise<void> {
    await this.local.clearRibbonPosition(versionSlug)
    if (this.isAuthenticated) {
      this.api.deleteReadingRibbon(versionSlug).catch(console.error)
    }
  }

  async getPreferences(): Promise<UserPreferences> {
    return this.local.getPreferences()
  }

  async setPreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ): Promise<void> {
    await this.local.setPreference(key, value)
    if (this.isAuthenticated && (SYNCABLE_PREFERENCE_KEYS as readonly string[]).includes(key as string)) {
      this.api.putPreferences({ [key]: value } as Partial<Pick<UserPreferences, SyncablePreferenceKey>>).catch(console.error)
    }
  }

  async setPreferences(patch: Partial<UserPreferences>): Promise<void> {
    await this.local.setPreferences(patch)
    if (this.isAuthenticated) {
      const syncable: Partial<Pick<UserPreferences, SyncablePreferenceKey>> = {}
      for (const key of SYNCABLE_PREFERENCE_KEYS) {
        if (key in patch) {
          (syncable as Record<string, unknown>)[key] = patch[key]
        }
      }
      if (Object.keys(syncable).length > 0) {
        this.api.putPreferences(syncable).catch(console.error)
      }
    }
  }
}
