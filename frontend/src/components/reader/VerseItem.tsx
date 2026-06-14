'use client'

import React from 'react'

interface VerseItemProps {
  verseNum: number
  text: string
  isBookmarked?: boolean
}

export function VerseItem({ verseNum, text, isBookmarked }: VerseItemProps) {
  // Strip the KJV paragraph marker ¶ from the beginning of verses
  const cleanText = text.replace(/^¶\s*/, '')

  return (
    <p
      className="reader-text mb-1 relative"
      data-verse={verseNum}
      id={`verse-${verseNum}`}
    >
      <span className="verse-num" data-verse={verseNum}>
        {verseNum}
      </span>
      <span
        data-verse={verseNum}
        style={{
          borderRadius: '2px',
          transition: 'background 0.2s',
          ...(isBookmarked
            ? { background: 'var(--reader-selection)', paddingLeft: 2, paddingRight: 2 }
            : {}),
        }}
      >
        {cleanText}
      </span>
    </p>
  )
}
