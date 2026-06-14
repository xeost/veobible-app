/**
 * Offline reader shell page — /[lang]/offline-reader
 *
 * This page is statically exported and registered in the Workbox precache.
 * The Service Worker serves it as a document fallback for any reader chapter
 * URL (/[lang]/[version]/[book]/[chapter]) that is not in the SW pages cache
 * when the device is offline.
 *
 * The actual work is done client-side by OfflineReaderClient, which reads
 * window.location.pathname to identify the requested chapter, looks it up in
 * the veobible-bible-data Cache API, and renders either the full reader (if
 * the version was downloaded for offline) or an "unavailable offline" message
 * with the reader header still visible so the user can navigate back.
 *
 * Not indexed by search engines — real chapter pages cover SEO.
 */

import type { Metadata } from 'next'
import { OfflineReaderClient } from './OfflineReaderClient'

export const metadata: Metadata = {
  title: 'VeoBible',
  robots: { index: false, follow: false },
}

export default function OfflineReaderPage() {
  return <OfflineReaderClient />
}
