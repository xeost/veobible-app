'use client'

import React from 'react'
import { Logo } from './Logo'
import { LanguageToggle } from './LanguageToggle'
import { ThemeToggle } from './ThemeToggle'

interface HomeHeaderProps {
  currentLang: string
}

export function HomeHeader({ currentLang }: HomeHeaderProps) {
  return (
    <header className="app-header app-header-height sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-2">
        <Logo currentLang={currentLang} />
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  )
}
