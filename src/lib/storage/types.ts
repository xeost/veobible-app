// ============================================================
// StorageRepository interface — the contract for all storage adapters
// All methods return Promises to be compatible with both local and remote adapters
// ============================================================

export interface Bookmark {
  id: string              // uuid v4
  versionSlug: string
  bookSlug: string
  chapter: number
  verseStart: number
  verseEnd: number
  selectedText: string
  title?: string          // Optional user-defined label for identification
  folderId?: string       // Optional reference to a BookmarkFolder id
  createdAt: string       // ISO 8601
  // Future sync fields (optional now, required when remote sync is added)
  syncStatus?: 'local' | 'synced' | 'pending' | 'conflict'
  serverId?: string
  updatedAt?: string
}

// Folders group bookmarks within a specific book of a version
export interface BookmarkFolder {
  id: string              // uuid v4
  versionSlug: string
  bookSlug: string        // folder is scoped to a single book
  name: string
  order: number           // for ordering folders within a book group
  createdAt: string       // ISO 8601
}

export interface ReadingPosition {
  versionSlug: string
  bookSlug: string
  chapter: number
  verseIndex?: number
  updatedAt: string       // ISO 8601
}

export interface UserPreferences {
  locale?: string
  theme?: 'light' | 'dark' | 'system'
  fontSize?: 'sm' | 'md' | 'lg' | 'xl'
  lastVersionSlug?: string
}

export interface StorageRepository {
  // ── Bookmarks ──────────────────────────────────────────────
  getBookmarks(): Promise<Bookmark[]>
  getBookmarksByVersion(versionSlug: string): Promise<Bookmark[]>
  getBookmark(id: string): Promise<Bookmark | null>
  addBookmark(data: Omit<Bookmark, 'id' | 'createdAt' | 'syncStatus'>): Promise<Bookmark>
  updateBookmark(id: string, patch: Partial<Omit<Bookmark, 'id' | 'createdAt'>>): Promise<Bookmark>
  removeBookmark(id: string): Promise<void>
  clearBookmarks(): Promise<void>

  // ── Bookmark Folders ───────────────────────────────────────
  getFoldersByVersion(versionSlug: string): Promise<BookmarkFolder[]>
  addFolder(data: Omit<BookmarkFolder, 'id' | 'createdAt'>): Promise<BookmarkFolder>
  updateFolder(id: string, patch: Partial<Omit<BookmarkFolder, 'id' | 'createdAt'>>): Promise<BookmarkFolder>
  removeFolder(id: string): Promise<void>

  // ── Reading Position (per version) ────────────────────────
  getReadingPosition(versionSlug: string): Promise<ReadingPosition | null>
  setReadingPosition(position: ReadingPosition): Promise<void>

  // ── User Preferences ──────────────────────────────────────
  getPreferences(): Promise<UserPreferences>
  setPreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ): Promise<void>
}
