'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

export function ThemeColorUpdater() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    // #faf9f7 is the light background color (colors.surface.50)
    // #0f0e17 is the dark background color
    const themeColor = resolvedTheme === 'dark' ? '#0f0e17' : '#faf9f7'

    // Update or create a theme-color meta tag without a media attribute
    let metaTag = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement
    if (!metaTag) {
      metaTag = document.createElement('meta')
      metaTag.name = 'theme-color'
      document.head.appendChild(metaTag)
    }
    metaTag.content = themeColor

    // Update any media-conditioned theme-color meta tags to prevent conflicts
    const mediaMetaTags = document.querySelectorAll('meta[name="theme-color"][media]')
    mediaMetaTags.forEach((tag) => {
      tag.setAttribute('content', themeColor)
    })
  }, [resolvedTheme])

  return null
}
