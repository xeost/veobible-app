// Storage factory — exports the active adapter as a singleton.
// HybridStorageAdapter delegates to LocalStorageAdapter when the user is not
// authenticated, and also syncs mutations to the API when they are.

import { HybridStorageAdapter } from './hybrid-adapter'
import type { StorageRepository } from './types'

export const storage: StorageRepository = new HybridStorageAdapter()

// Re-export types for convenience
export type { Bookmark, BookmarkFolder, ReadingPosition, RibbonPosition, UserPreferences, StorageRepository } from './types'
