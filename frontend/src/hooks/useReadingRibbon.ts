'use client'

import { useCallback, useEffect, useState } from 'react'
import { storage } from '@/lib/storage'
import type { RibbonPosition } from '@/lib/storage'

export function useReadingRibbon(versionSlug: string) {
  const [ribbon, setRibbonState] = useState<RibbonPosition | null>(null)
  const [loading, setLoading] = useState(true)

  // Load from storage on mount / versionSlug change
  useEffect(() => {
    setLoading(true)
    storage.getRibbonPosition(versionSlug).then((pos) => {
      setRibbonState(pos)
      setLoading(false)
    })
  }, [versionSlug])

  const setRibbon = useCallback(
    async (bookSlug: string, chapter: number) => {
      const position: RibbonPosition = {
        versionSlug,
        bookSlug,
        chapter,
        updatedAt: new Date().toISOString(),
      }
      // Optimistic update
      setRibbonState(position)
      await storage.setRibbonPosition(position)
    },
    [versionSlug],
  )

  const clearRibbon = useCallback(async () => {
    setRibbonState(null)
    await storage.clearRibbonPosition(versionSlug)
  }, [versionSlug])

  return { ribbon, loading, setRibbon, clearRibbon }
}
