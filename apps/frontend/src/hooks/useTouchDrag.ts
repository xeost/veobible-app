'use client'

/**
 * useTouchDrag — lightweight touch-based drag-and-drop for bookmark cards.
 *
 * How it works:
 *  1. The grip handle calls `onGripTouchStart(e, bookmarkId, bookSlug, cardEl)` on touchstart.
 *  2. A semi-transparent ghost element follows the finger.
 *  3. On touchend, we call `document.elementsFromPoint` to find the drop target
 *     and read the `data-folder-id` / `data-book-slug` attributes set on
 *     FolderDropZone wrappers.
 *  4. If the target is valid (same book), we call `onDrop(bookmarkId, folderId)`.
 *  5. Drop zones show a highlight ring while a touch drag passes over them.
 *  6. `isTouchDragging` and `touchDraggingBookSlug` are exposed so consumers can
 *     render unfiled-zone hints during touch drag (mirrors the HTML5 drag hints).
 *
 * Drop zone elements must carry:
 *   data-touch-drop-zone="true"
 *   data-folder-id="<id>"          (or "unfiled" for the unfiled zone)
 *   data-book-slug="<slug>"
 */

import { useCallback, useRef, useState } from 'react'

interface TouchDragOptions {
  onDrop: (bookmarkId: string, folderId: string | undefined) => void
}

export interface TouchDragHandle {
  /** Attach to the grip element's onTouchStart */
  onGripTouchStart: (
    e: React.TouchEvent,
    bookmarkId: string,
    bookSlug: string,
    cardEl: HTMLElement,
  ) => void
  /** True while a touch drag gesture is active */
  isTouchDragging: boolean
  /** The bookSlug of the card currently being touch-dragged (or null) */
  touchDraggingBookSlug: string | null
}

/** Attribute helpers — used by both the hook and FolderDropZone */
export const TOUCH_DROP_ATTR = 'data-touch-drop-zone'
export const TOUCH_FOLDER_ATTR = 'data-folder-id'
export const TOUCH_BOOK_ATTR = 'data-book-slug'
export const TOUCH_DROP_ACTIVE_CLASS = 'touch-drop-active'

/** Find the nearest drop zone element at a point (skips the ghost overlay) */
function dropZoneAt(x: number, y: number): Element | null {
  const els = document.elementsFromPoint(x, y)
  return els.find((el) => el.getAttribute(TOUCH_DROP_ATTR) === 'true') ?? null
}

export function useTouchDrag({ onDrop }: TouchDragOptions): TouchDragHandle {
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef<{ bookmarkId: string; bookSlug: string } | null>(null)
  const lastDropZoneRef = useRef<Element | null>(null)
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const [isTouchDragging, setIsTouchDragging] = useState(false)
  const [touchDraggingBookSlug, setTouchDraggingBookSlug] = useState<string | null>(null)

  const highlightZone = useCallback((el: Element) => {
    const zone = el as HTMLElement
    zone.style.setProperty('outline', '2px solid var(--brand)', 'important')
    zone.style.setProperty('outline-offset', '-2px', 'important')
    zone.style.setProperty('border-radius', '10px', 'important')
  }, [])

  const unhighlightZone = useCallback((el: Element) => {
    const zone = el as HTMLElement
    zone.style.removeProperty('outline')
    zone.style.removeProperty('outline-offset')
  }, [])

  const cleanup = useCallback(() => {
    if (ghostRef.current) {
      ghostRef.current.remove()
      ghostRef.current = null
    }
    if (lastDropZoneRef.current) {
      unhighlightZone(lastDropZoneRef.current)
      lastDropZoneRef.current = null
    }
    draggingRef.current = null
    document.body.style.userSelect = ''
    setIsTouchDragging(false)
    setTouchDraggingBookSlug(null)
  }, [unhighlightZone])

  const onGripTouchStart = useCallback(
    (
      e: React.TouchEvent,
      bookmarkId: string,
      bookSlug: string,
      cardEl: HTMLElement,
    ) => {
      const touch = e.touches[0]
      startPosRef.current = { x: touch.clientX, y: touch.clientY }
      draggingRef.current = { bookmarkId, bookSlug }
      document.body.style.userSelect = 'none'
      setIsTouchDragging(true)
      setTouchDraggingBookSlug(bookSlug)

      // Build ghost
      const rect = cardEl.getBoundingClientRect()
      const ghost = document.createElement('div')
      ghost.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        opacity: 0.55;
        pointer-events: none;
        z-index: 9999;
        border-radius: 10px;
        background: var(--bg-card);
        border: 1.5px solid var(--brand);
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        transition: none;
      `
      document.body.appendChild(ghost)
      ghostRef.current = ghost

      const handleTouchMove = (ev: TouchEvent) => {
        ev.preventDefault()
        const t = ev.touches[0]
        const dx = t.clientX - startPosRef.current.x
        const dy = t.clientY - startPosRef.current.y
        if (ghostRef.current) {
          ghostRef.current.style.transform = `translate(${dx}px, ${dy}px)`
        }

        // Highlight drop zone under finger
        const zone = dropZoneAt(t.clientX, t.clientY)
        if (zone !== lastDropZoneRef.current) {
          if (lastDropZoneRef.current) unhighlightZone(lastDropZoneRef.current)
          if (zone && zone.getAttribute(TOUCH_BOOK_ATTR) === bookSlug) {
            highlightZone(zone)
            lastDropZoneRef.current = zone
          } else {
            lastDropZoneRef.current = null
          }
        }
      }

      const handleTouchEnd = (ev: TouchEvent) => {
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
        document.removeEventListener('touchcancel', handleTouchEnd)

        const t = ev.changedTouches[0]
        const zone = dropZoneAt(t.clientX, t.clientY)

        if (
          zone &&
          zone.getAttribute(TOUCH_BOOK_ATTR) === bookSlug &&
          draggingRef.current
        ) {
          const rawFolderId = zone.getAttribute(TOUCH_FOLDER_ATTR)
          const folderId = rawFolderId === 'unfiled' ? undefined : (rawFolderId ?? undefined)
          onDrop(bookmarkId, folderId)
        }

        cleanup()
      }

      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
      document.addEventListener('touchcancel', handleTouchEnd)
    },
    [cleanup, onDrop, highlightZone, unhighlightZone],
  )

  return { onGripTouchStart, isTouchDragging, touchDraggingBookSlug }
}
