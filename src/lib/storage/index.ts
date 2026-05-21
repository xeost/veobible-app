// Storage factory — export the active adapter as a singleton
// To add remote sync: replace LocalStorageAdapter with RemoteAdapter
// or HybridAdapter here without touching any other code

import { LocalStorageAdapter } from './local-adapter'
import type { StorageRepository } from './types'

export const storage: StorageRepository = new LocalStorageAdapter()

// Re-export types for convenience
export type { Bookmark, ReadingPosition, UserPreferences, StorageRepository } from './types'
