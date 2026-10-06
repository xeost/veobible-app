'use client'

import React, { useEffect, useRef, useState } from 'react'

interface DropdownItem {
  label: string
  value: string
  icon?: React.ReactNode
  active?: boolean
}

interface DropdownProps {
  trigger: React.ReactNode
  items: DropdownItem[]
  onSelect: (value: string) => void
  align?: 'left' | 'right'
  label?: string
}

export function Dropdown({ trigger, items, onSelect, align = 'right', label }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <div ref={ref} className="relative" aria-label={label}>
      <div onClick={() => setOpen((v) => !v)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpen((v) => !v) }}>
        {trigger}
      </div>

      {open && (
        <div
          className={`absolute top-full mt-2 z-50 min-w-[160px] rounded-xl overflow-hidden animate-scale-in shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
          }}
          role="menu"
        >
          {items.map((item) => (
            <button
              key={item.value}
              role="menuitem"
              onClick={() => {
                onSelect(item.value)
                setOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors duration-100"
              style={{
                color: item.active ? 'var(--brand)' : 'var(--text-primary)',
                background: item.active ? 'var(--brand-light)' : 'transparent',
                fontWeight: item.active ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (!item.active) (e.currentTarget as HTMLElement).style.background = 'var(--brand-light)'
              }}
              onMouseLeave={(e) => {
                if (!item.active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              {item.label}
              {item.active && (
                <span className="ml-auto">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
