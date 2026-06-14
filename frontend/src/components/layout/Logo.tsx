import React from 'react'
import Link from 'next/link'

interface LogoProps {
  currentLang: string
}

export function Logo({ currentLang }: LogoProps) {
  return (
    <Link
      href={`/${currentLang}`}
      className="flex items-center gap-3 mr-auto font-semibold text-lg"
      style={{ color: 'var(--text-primary)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="VeoBible"
        width={28}
        height={28}
        loading="eager"
        // Graceful offline fallback: if the image fails to load (e.g. before
        // the SW precache is populated), hide the broken-image icon and reveal
        // the letter fallback so the header never looks broken.
        onError={(e) => {
          const img = e.currentTarget
          img.style.display = 'none'
          const fallback = img.nextElementSibling as HTMLElement | null
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      {/* Shown only if the PNG fails to load (offline + precache miss, etc.) */}
      <span
        aria-hidden="true"
        style={{
          display: 'none',
          width: 28,
          height: 28,
          borderRadius: 6,
          background: 'var(--accent, #6366f1)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        V
      </span>
      <span className="hidden sm:inline">VeoBible</span>
    </Link>
  )
}
