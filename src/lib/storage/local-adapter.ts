import { v4 as uuidv4 } from 'uuid'
import type {
  Bookmark,
  ReadingPosition,
  StorageRepository,
  UserPreferences,
} from './types'

const PREFIX = 'veobible_'

const KEYS = {
  bookmarks: `${PREFIX}bookmarks`,
  readingPositions: `${PREFIX}reading_positions`,
  preferences: `${PREFIX}preferences`,
} as const

// ────────────────────────────────────────────────────────────────────
// Helper: safe JSON parse (returns fallback on error)
// ────────────────────────────────────────────────────────────────────
function safeGet<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safePut<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

// ────────────────────────────────────────────────────────────────────
// LocalStorageAdapter — implements StorageRepository
//
// Design notes for future remote sync:
//  - All methods are async (Promise-based) so swapping to a remote
//    adapter requires zero changes to call sites
//  - Bookmark has syncStatus field for optimistic UI tracking
//  - addBookmark sets syncStatus: 'local' (not yet confirmed by server)
// ────────────────────────────────────────────────────────────────────
export class LocalStorageAdapter implements StorageRepository {
  // ── Bookmarks ────────────────────────────────────────────────────

  async getBookmarks(): Promise<Bookmark[]> {
    return safeGet<Bookmark[]>(KEYS.bookmarks, [])
  }

  async getBookmarksByVersion(versionSlug: string): Promise<Bookmark[]> {
    const all = await this.getBookmarks()
    return all.filter((b) => b.versionSlug === versionSlug)
  }

  async getBookmark(id: string): Promise<Bookmark | null> {
    const all = await this.getBookmarks()
    return all.find((b) => b.id === id) ?? null
  }

  async addBookmark(
    data: Omit<Bookmark, 'id' | 'createdAt' | 'syncStatus'>,
  ): Promise<Bookmark> {
    const all = await this.getBookmarks()
    const bookmark: Bookmark = {
      ...data,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'local', // will change to 'synced' when remote sync confirms
    }
    safePut(KEYS.bookmarks, [bookmark, ...all])
    return bookmark
  }

  async updateBookmark(
    id: string,
    patch: Partial<Omit<Bookmark, 'id' | 'createdAt'>>,
  ): Promise<Bookmark> {
    const all = await this.getBookmarks()
    const idx = all.findIndex((b) => b.id === id)
    if (idx === -1) throw new Error(`Bookmark ${id} not found`)
    const updated: Bookmark = {
      ...all[idx],
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    }
    all[idx] = updated
    safePut(KEYS.bookmarks, all)
    return updated
  }

  async removeBookmark(id: string): Promise<void> {
    const all = await this.getBookmarks()
    safePut(
      KEYS.bookmarks,
      all.filter((b) => b.id !== id),
    )
  }

  async clearBookmarks(): Promise<void> {
    safePut(KEYS.bookmarks, [])
  }

  // ── Reading Position ─────────────────────────────────────────────

  async getReadingPosition(versionSlug: string): Promise<ReadingPosition | null> {
    const all = safeGet<Record<string, ReadingPosition>>(KEYS.readingPositions, {})
    return all[versionSlug] ?? null
  }

  async setReadingPosition(position: ReadingPosition): Promise<void> {
    const all = safeGet<Record<string, ReadingPosition>>(KEYS.readingPositions, {})
    all[position.versionSlug] = {
      ...position,
      updatedAt: new Date().toISOString(),
    }
    safePut(KEYS.readingPositions, all)
  }

  // ── Preferences ──────────────────────────────────────────────────

  async getPreferences(): Promise<UserPreferences> {
    return safeGet<UserPreferences>(KEYS.preferences, {})
  }

  async setPreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ): Promise<void> {
    const prefs = await this.getPreferences()
    prefs[key] = value
    safePut(KEYS.preferences, prefs)
  }
}
