'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  children: React.ReactNode
  content: string
  className?: string
  placement?: 'top' | 'bottom'
}

export function Tooltip({ children, content, className = '', placement = 'bottom' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    return () => {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
    }
  }, [])

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    
    const left = rect.left + rect.width / 2
    let top = 0

    if (placement === 'top') {
      top = rect.top - 8
    } else {
      top = rect.bottom + 8
    }

    setCoords({ top, left })
  }, [placement])

  useEffect(() => {
    if (visible && mounted) {
      updatePosition()
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
    }
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [visible, mounted, updatePosition])

  const isTouchRef = useRef(false)
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleTouchStart = () => {
    isTouchRef.current = true
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
    
    touchTimerRef.current = setTimeout(() => {
      updatePosition()
      setVisible(true)
    }, 600)
  }

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
    setVisible(false)
    // Keep isTouchRef.current active for 500ms to block subsequent emulated mouse/focus events
    setTimeout(() => {
      isTouchRef.current = false
    }, 500)
  }

  const handleMouseEnter = () => {
    if (isTouchRef.current) return
    updatePosition()
    setVisible(true)
  }

  const handleMouseLeave = () => {
    setVisible(false)
  }

  const handleFocus = () => {
    if (isTouchRef.current) return
    updatePosition()
    setVisible(true)
  }

  const isFlex = !/\b(block|inline-block|grid|inline-flex)\b/.test(className)
  const defaultClass = isFlex ? 'flex items-center justify-center' : ''

  if (!mounted) {
    return (
      <div className={`relative ${defaultClass} ${className}`}>
        {children}
      </div>
    )
  }

  return (
    <>
      <div
        ref={triggerRef}
        className={`relative ${defaultClass} ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {children}
      </div>

      {createPortal(
        <div
          className="fixed z-[9999] px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap shadow-md border"
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            transform: `translateX(-50%) ${placement === 'top' ? 'translateY(-100%)' : ''} ${visible ? 'scale(1)' : 'scale(0.95)'}`,
            opacity: visible ? 1 : 0,
            pointerEvents: 'none',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            transition: 'opacity 150ms cubic-bezier(0.16, 1, 0.3, 1), transform 150ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  )
}
