import type {
  Bookmark,
  BookmarkFolder,
  ReadingPosition,
  RibbonPosition,
  UserPreferences,
} from '@/lib/storage/types'

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.veobible.com') + '/v1'

export const SYNCABLE_PREFERENCE_KEYS = [
  'locale',
  'theme',
  'lastVersionSlug',
  'readerFontFamily',
] as const

export type SyncablePreferenceKey = (typeof SYNCABLE_PREFERENCE_KEYS)[number]

// ── API response wrappers ──────────────────────────────────────────────────────

export interface ApiList<T> { data: T[] }
export interface ApiItem<T> { data: T }

// ── Sync shapes ────────────────────────────────────────────────────────────────

export interface SyncPullResponse {
  bookmarks: Bookmark[]
  bookmarkFolders: BookmarkFolder[]
  readingPositions: ReadingPosition[]
  readingRibbons: RibbonPosition[]
  preferences: Partial<Pick<UserPreferences, SyncablePreferenceKey>>
  serverTime: string
}

export interface SyncPushPayload {
  bookmarks?: Bookmark[]
  bookmarkFolders?: BookmarkFolder[]
  readingPositions?: ReadingPosition[]
  readingRibbons?: RibbonPosition[]
  preferences?: Partial<Pick<UserPreferences, SyncablePreferenceKey>>
}

export interface SyncConflict {
  type: string
  id: string
  message: string
}

export interface SyncPushResponse {
  applied: number
  conflicts: SyncConflict[]
  serverTime: string
}

// ── API client ─────────────────────────────────────────────────────────────────

export class ApiClient {
  constructor(private readonly getToken: () => string | null) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = this.getToken()
    if (!token) throw new Error('Not authenticated')

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
      const e = new Error(err.message ?? `HTTP ${res.status}`) as Error & { status: number }
      e.status = res.status
      throw e
    }

    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  // ── Bookmarks ────────────────────────────────────────────────────────────────

  getBookmarks() { return this.request<ApiList<Bookmark>>('GET', '/bookmarks') }
  createBookmark(b: Omit<Bookmark, 'syncStatus'>) { return this.request<ApiItem<Bookmark>>('POST', '/bookmarks', b) }
  updateBookmark(id: string, patch: Partial<Omit<Bookmark, 'id' | 'createdAt'>>) { return this.request<ApiItem<Bookmark>>('PATCH', `/bookmarks/${id}`, patch) }
  deleteBookmark(id: string) { return this.request<void>('DELETE', `/bookmarks/${id}`) }

  // ── Folders ──────────────────────────────────────────────────────────────────

  getFolders() { return this.request<ApiList<BookmarkFolder>>('GET', '/bookmarks/folders') }
  createFolder(f: BookmarkFolder) { return this.request<ApiItem<BookmarkFolder>>('POST', '/bookmarks/folders', f) }
  updateFolder(id: string, patch: Partial<Omit<BookmarkFolder, 'id' | 'createdAt'>>) { return this.request<ApiItem<BookmarkFolder>>('PATCH', `/bookmarks/folders/${id}`, patch) }
  deleteFolder(id: string) { return this.request<void>('DELETE', `/bookmarks/folders/${id}`) }

  // ── Reading positions ────────────────────────────────────────────────────────

  getReadingPositions() { return this.request<ApiList<ReadingPosition>>('GET', '/reading/positions') }
  upsertReadingPosition(p: ReadingPosition) { return this.request<ApiItem<ReadingPosition>>('PUT', `/reading/positions/${p.versionSlug}`, p) }

  // ── Reading ribbons ──────────────────────────────────────────────────────────

  getReadingRibbons() { return this.request<ApiList<RibbonPosition>>('GET', '/reading/ribbons') }
  upsertReadingRibbon(r: RibbonPosition) { return this.request<ApiItem<RibbonPosition>>('PUT', `/reading/ribbons/${r.versionSlug}`, r) }
  deleteReadingRibbon(versionSlug: string) { return this.request<void>('DELETE', `/reading/ribbons/${versionSlug}`) }

  // ── Preferences ──────────────────────────────────────────────────────────────

  getPreferences() { return this.request<ApiItem<Partial<Pick<UserPreferences, SyncablePreferenceKey>>>>('GET', '/preferences') }
  putPreferences(prefs: Partial<Pick<UserPreferences, SyncablePreferenceKey>>) { return this.request<ApiItem<Partial<Pick<UserPreferences, SyncablePreferenceKey>>>>('PUT', '/preferences', prefs) }

  // ── Sync ─────────────────────────────────────────────────────────────────────

  pull(since: string) {
    return this.request<SyncPullResponse>('GET', `/sync?since=${encodeURIComponent(since)}`)
  }

  push(payload: SyncPushPayload) {
    return this.request<SyncPushResponse>('POST', '/sync', payload)
  }
}
