'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface TextSelection {
  text: string
  verseStart: number
  verseEnd: number
  anchorEl: HTMLElement | null
  rect: DOMRect | null
}

export function useTextSelection() {
  const [selection, setSelection] = useState<TextSelection | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelection(null)
      return
    }

    const range = sel.getRangeAt(0)
    const text = sel.toString().trim()
    if (!text) {
      setSelection(null)
      return
    }

    // Walk up the DOM to find verse numbers
    const startNode = range.startContainer.parentElement
    const endNode = range.endContainer.parentElement

    const getVerseNum = (el: Element | null): number => {
      while (el) {
        const num = el.getAttribute('data-verse')
        if (num) return parseInt(num, 10)
        el = el.parentElement
      }
      return 0
    }

    const verseStart = getVerseNum(startNode)
    const verseEnd = getVerseNum(endNode) || verseStart

    const rect = range.getBoundingClientRect()

    setSelection({
      text,
      verseStart,
      verseEnd,
      anchorEl: startNode,
      rect,
    })
  }, [])

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges()
    setSelection(null)
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [handleSelectionChange])

  return { selection, containerRef, clearSelection }
}
