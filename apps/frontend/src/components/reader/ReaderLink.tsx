'use client'

import React from 'react'
import { parseReaderPath } from '@/lib/reader/navigation'

/** Native links remain usable before hydration and in a new tab. */
export default function ReaderLink({ href, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...props} href={href} onClick={(event) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === '_blank') return
    const target = new URL(href, window.location.href)
    const current = parseReaderPath(window.location.pathname)
    if (current && target.origin === window.location.origin && parseReaderPath(target.pathname)?.lang === current.lang) {
      event.preventDefault()
      history.pushState(null, '', target)
      window.dispatchEvent(new Event('veobible:navigate'))
      if (target.hash) setTimeout(() => document.getElementById(target.hash.slice(1))?.scrollIntoView(), 100)
      else window.scrollTo(0, 0)
    }
  }} />
}
