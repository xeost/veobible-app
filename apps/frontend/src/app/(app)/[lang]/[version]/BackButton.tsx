'use client'

import { useRouter } from 'next/navigation'

const ChevronLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

/**
 * Navigates to the previous page in browser history if available,
 * or falls back to the language home page.
 */
export function BackButton({ fallbackHref, label }: { fallbackHref: string; label: string }) {
  const router = useRouter()

  function handleClick() {
    // If there is a previous entry in the session history, go back.
    // Otherwise fall back to the language home.
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-sm mb-8 transition-colors duration-100 cursor-pointer bg-transparent border-0 p-0"
      style={{ color: 'var(--text-muted)' }}
    >
      <ChevronLeftIcon />
      {label}
    </button>
  )
}
