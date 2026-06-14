'use client'

import React from 'react'

interface ToastState {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

let listeners: Array<(toast: ToastState) => void> = []

export function toast(message: string, type: ToastState['type'] = 'success') {
  const id = Math.random().toString(36).slice(2)
  listeners.forEach((l) => l({ id, message, type }))
}

export function ToastContainer() {
  const [toasts, setToasts] = React.useState<ToastState[]>([])

  React.useEffect(() => {
    const handler = (t: ToastState) => {
      setToasts((prev) => [...prev, t])
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id))
      }, 3000)
    }
    listeners.push(handler)
    return () => {
      listeners = listeners.filter((l) => l !== handler)
    }
  }, [])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-slide-up px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg pointer-events-auto"
          style={{
            background: t.type === 'error' ? '#ef4444' : t.type === 'info' ? 'var(--bg-card)' : 'var(--brand)',
            color: t.type === 'info' ? 'var(--text-primary)' : 'white',
            border: '1px solid transparent',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
