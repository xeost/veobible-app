'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { storage } from '@/lib/storage'
import { detectLocale } from '@/lib/i18n/config'

// Root page — redirect to the user's preferred locale
// Priority: 1) saved preference, 2) browser language, 3) 'en'
export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    async function redirect() {
      const prefs = await storage.getPreferences()
      const locale = prefs.locale ?? detectLocale()
      router.replace(`/${locale}`)
    }
    redirect()
  }, [router])

  // Minimal loading state during redirect
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-page)' }}
    >
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--brand)' }}
      />
    </div>
  )
}
