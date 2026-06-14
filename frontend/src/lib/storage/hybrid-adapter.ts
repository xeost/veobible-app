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

const LAST_SYNC_KEY = 'veobible_last_sync'

function getLastSync(): string {
  if (typeof window === 'undefined') return new Date(0).toISOString()
  return localStorage.getItem(LAST_SYNC_KEY) ?? new Date(0).toISOString()
}

function setLastSync(time: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_SYNC_KEY, time)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// HybridStorageAdapter
//
// Writes always go to localStorage first (offline-safe), then are sent to
// the API in the background when authenticated. On first login, a full sync
// is performed: local data is pushed to the server and remote data is pulled.
// ────────────────────────────────────────────────────────────────────────────
export class HybridStorageAdapter implements StorageRepository {
  private readonly local: LocalStorageAdapter
  private readonly api: ApiClient
  private accessToken: string | null = null
  private isSyncing = false

  constructor() {
    this.local = new LocalStorageAdapter()
    this.api = new ApiClient(() => this.accessToken)

    if (typeof window !== 'undefined') {
      const supabase = getSupabaseClient()

      supabase.auth.getSession().then(({ data }) => {
        this.accessToken = data.session?.access_token ?? null
      })

      supabase.auth.onAuthStateChange(async (event, session) => {
        const wasAuthenticated = this.accessToken !== null
        this.accessToken = session?.access_token ?? null

        if (event === 'SIGNED_IN' && !wasAuthenticated) {
          this.performInitialSync().catch(console.error)
        }
      })
    }
  }

  private get isAuthenticated(): boolean {
    return this.accessToken !== null
  }

  // ── Initial sync (on first login) ────────────────────────────────────────

  async performInitialSync(): Promise<void> {
    if (!this.isAuthenticated || this.isSyncing) return
    this.isSyncing = true
    try {
      const [bookmarks, folders, positions, ribbons, prefs] = await Promise.all([
        this.local.getBookmarks(),
        this.local.getFoldersByVersion(''),
        Promise.resolve([] as ReadingPosition[]),
        Promise.resolve([] as RibbonPosition[]),
        this.local.getPreferences(),
      ])

      const allFolders = JSON.parse(
        typeof window !== 'undefined'
          ? (localStorage.getItem('veobible_bookmark_folders') ?? '[]')
          : '[]',
      ) as BookmarkFolder[]

      const syncablePrefs: Partial<Pick<UserPreferences, SyncablePreferenceKey>> = {}
      for (const key of SYNCABLE_PREFERENCE_KEYS) {
        if (prefs[key] !== undefined) {
          (syncablePrefs as Record<string, unknown>)[key] = prefs[key]
        }
      }

      const pushResponse = await this.api.push({
        bookmarks: bookmarks.map(({ syncStatus: _s, ...b }) => b),
        bookmarkFolders: allFolders,
        preferences: syncablePrefs,
      })

      if (pushResponse.conflicts.length > 0) {
        const { toast } = await import('@/components/ui/Toast')
        toast(
          `Sync: ${pushResponse.conflicts.length} conflict(s) resolved by server`,
          'info',
        )
      }

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
    try {
      const since = getLastSync()
      const pullResponse = await this.api.pull(since)
      await this.applyPull(pullResponse)
    } catch {
      // Silent failure — sync will retry next time
    } finally {
      this.isSyncing = false
    }
  }

  private async applyPull(
    pull: Awaited<ReturnType<ApiClient['pull']>>,
  ): Promise<void> {
    const allBookmarks = await this.local.getBookmarks()
    const allFolders: BookmarkFolder[] = typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('veobible_bookmark_folders') ?? '[]')
      : []

    // Apply remote bookmarks (LWW)
    for (const remote of pull.bookmarks) {
      const local = allBookmarks.find((b) => b.id === remote.id)
      if (!local || (remote.updatedAt && (!local.updatedAt || remote.updatedAt > local.updatedAt))) {
        if (remote.deletedAt) {
          await this.local.removeBookmark(remote.id)
        } else {
          const existing = allBookmarks.findIndex((b) => b.id === remote.id)
          if (existing === -1) {
            // Insert without going through addBookmark to preserve ID
            const updated = [{ ...remote, syncStatus: 'synced' as const }, ...allBookmarks]
            if (typeof window !== 'undefined') {
              localStorage.setItem('veobible_bookmarks', JSON.stringify(updated))
            }
          } else {
            await this.local.updateBookmark(remote.id, { ...remote, syncStatus: 'synced' })
          }
        }
      }
    }

    // Apply remote folders (LWW)
    for (const remote of pull.bookmarkFolders) {
      const local = allFolders.find((f) => f.id === remote.id)
      if (!local || remote.updatedAt > local.updatedAt) {
        const idx = allFolders.findIndex((f) => f.id === remote.id)
        if (idx === -1) {
          allFolders.push(remote)
        } else {
          allFolders[idx] = remote
        }
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('veobible_bookmark_folders', JSON.stringify(allFolders))
    }

    // Apply remote reading positions
    for (const pos of pull.readingPositions) {
      const local = await this.local.getReadingPosition(pos.versionSlug)
      if (!local || pos.updatedAt > local.updatedAt) {
        await this.local.setReadingPosition(pos)
      }
    }

    // Apply remote reading ribbons
    for (const ribbon of pull.readingRibbons) {
      const local = await this.local.getRibbonPosition(ribbon.versionSlug)
      if (!local || ribbon.updatedAt > local.updatedAt) {
        await this.local.setRibbonPosition(ribbon)
      }
    }

    // Apply remote preferences
    if (pull.preferences) {
      await this.local.setPreferences(pull.preferences)
    }

    setLastSync(pull.serverTime)
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
      this.api.updateBookmark(id, patch).catch(console.error)
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
      this.api.updateFolder(id, patch).catch(console.error)
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
