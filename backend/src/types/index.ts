// ── Cloudflare Workers environment bindings ───────────────────────────────────

export type Bindings = {
  DB: D1Database
  SUPABASE_JWT_SECRET: string
}

export type Variables = {
  userId: string
}

// ── Domain types (mirror frontend StorageRepository types) ───────────────────

export interface Bookmark {
  id: string
  versionSlug: string
  bookSlug: string
  chapter: number
  verseStart: number
  verseEnd: number
  selectedText: string
  title: string | null
  note: string | null
  folderId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface BookmarkFolder {
  id: string
  versionSlug: string
  bookSlug: string
  name: string
  order: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ReadingPosition {
  versionSlug: string
  bookSlug: string
  chapter: number
  verseIndex: number | null
  updatedAt: string
}

export interface ReadingRibbon {
  versionSlug: string
  bookSlug: string
  chapter: number
  updatedAt: string
}

export type SyncablePreferenceKey = 'locale' | 'theme' | 'lastVersionSlug' | 'readerFontFamily'

export const SYNCABLE_PREFERENCE_KEYS: SyncablePreferenceKey[] = [
  'locale',
  'theme',
  'lastVersionSlug',
  'readerFontFamily',
]

export interface UserPreferences {
  locale?: string
  theme?: string
  lastVersionSlug?: string
  readerFontFamily?: string
  updatedAt?: string
}

// ── HTTP response shapes ──────────────────────────────────────────────────────

export interface ErrorBody {
  error: string
  message: string
  details?: Array<{ field: string; issue: string }>
}

export interface SyncPullResponse {
  bookmarks: Bookmark[]
  bookmarkFolders: BookmarkFolder[]
  readingPositions: ReadingPosition[]
  readingRibbons: ReadingRibbon[]
  preferences: UserPreferences
  serverTime: string
}

export interface SyncConflict {
  type: 'bookmark' | 'bookmarkFolder' | 'readingPosition' | 'readingRibbon' | 'preference'
  id: string
  serverVersion: unknown
}

export interface SyncPushResponse {
  applied: number
  conflicts: SyncConflict[]
  serverTime: string
}
