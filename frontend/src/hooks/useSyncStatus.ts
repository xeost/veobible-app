'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { hybridStorage, SYNC_INTERVAL_MS } from '@/lib/storage'

// ── Constants ──────────────────────────────────────────────────────────────────

const LAST_SYNC_KEY = 'veobible_last_sync'

// ── Helpers ────────────────────────────────────────────────────────────────────

function readLastSyncMs(): number {
  if (typeof window === 'undefined') return 0
  const raw = localStorage.getItem(LAST_SYNC_KEY)
  if (!raw) return 0
  const t = new Date(raw).getTime()
  return isNaN(t) ? 0 : t
}

/** Format a duration in seconds as m:ss  (e.g. 3:07) */
export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0:00'
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Format a past timestamp as a relative label */
export function formatLastSync(ts: number, lang: 'en' | 'es'): string {
  if (ts === 0) {
    return lang === 'es' ? 'Nunca' : 'Never'
  }
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 10) return lang === 'es' ? 'Justo ahora' : 'Just now'
  if (diff < 60) return lang === 'es' ? `Hace ${diff}s` : `${diff}s ago`
  const mins = Math.floor(diff / 60)
  if (mins === 1) return lang === 'es' ? 'Hace 1 min' : '1 min ago'
  return lang === 'es' ? `Hace ${mins} min` : `${mins} min ago`
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export interface SyncStatus {
  /** Unix-ms timestamp of the last completed sync. 0 = never synced. */
  lastSyncMs: number
  /** Seconds remaining until the next automatic sync. */
  secondsUntilNext: number
  /** True while a sync is in progress. */
  isSyncing: boolean
  /** Trigger an immediate manual sync. */
  triggerSync: () => void
}

export function useSyncStatus(isAuthenticated: boolean): SyncStatus {
  const [lastSyncMs, setLastSyncMs] = useState<number>(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [secondsUntilNext, setSecondsUntilNext] = useState(0)
  // Keep a ref to avoid stale closure in countdown interval
  const lastSyncRef = useRef(0)

  // Initialise from localStorage
  useEffect(() => {
    const ts = readLastSyncMs()
    setLastSyncMs(ts)
    lastSyncRef.current = ts
  }, [])

  // Listen for sync lifecycle events from the storage adapter
  useEffect(() => {
    const onSyncing = () => setIsSyncing(true)
    const onSync = () => {
      const ts = readLastSyncMs()
      setLastSyncMs(ts)
      lastSyncRef.current = ts
      setIsSyncing(false)
    }
    const onError = () => setIsSyncing(false)

    window.addEventListener('veobible:syncing', onSyncing)
    window.addEventListener('veobible:sync', onSync)
    window.addEventListener('veobible:sync-error', onError)
    return () => {
      window.removeEventListener('veobible:syncing', onSyncing)
      window.removeEventListener('veobible:sync', onSync)
      window.removeEventListener('veobible:sync-error', onError)
    }
  }, [])

  // Countdown ticker — updates every second when authenticated and synced at least once
  useEffect(() => {
    if (!isAuthenticated) return

    const tick = () => {
      const elapsed = Date.now() - lastSyncRef.current
      const remaining = lastSyncRef.current === 0
        ? 0
        : Math.max(0, SYNC_INTERVAL_MS - elapsed)
      setSecondsUntilNext(Math.ceil(remaining / 1000))
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isAuthenticated, lastSyncMs])

  const triggerSync = useCallback(() => {
    if (!isAuthenticated) return
    hybridStorage.manualSync().catch(console.error)
  }, [isAuthenticated])

  return { lastSyncMs, secondsUntilNext, isSyncing, triggerSync }
}
