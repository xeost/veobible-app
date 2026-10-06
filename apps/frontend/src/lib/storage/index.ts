// Storage factory — exports the active adapter as a singleton.
// HybridStorageAdapter delegates to LocalStorageAdapter when the user is not
// authenticated, and also syncs mutations to the API when they are.

import { HybridStorageAdapter } from './hybrid-adapter'
import type { StorageRepository } from './types'

const adapter = new HybridStorageAdapter()

export const storage: StorageRepository = adapter

/** Narrowly-typed handle for UI operations not in the base repository contract. */
export const hybridStorage: Pick<HybridStorageAdapter, 'manualSync'> = adapter

/** Auto-sync interval in milliseconds — keep in sync with hybrid-adapter.ts. */
export const SYNC_INTERVAL_MS = 5 * 60 * 1000

// Re-export types for convenience
export type { Bookmark, BookmarkFolder, ReadingPosition, RibbonPosition, UserPreferences, StorageRepository } from './types'
