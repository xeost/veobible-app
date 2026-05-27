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
      <img src="/logo.png" alt="VeoBible" width={28} height={28} />
      <span className="hidden sm:inline">VeoBible</span>
    </Link>
  )
}
