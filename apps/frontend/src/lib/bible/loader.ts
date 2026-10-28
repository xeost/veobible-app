// Build-time data loader — uses Node.js fs (server/build only)
// Never import this in client components

import fs from 'fs'
import path from 'path'
import type { BibleIndex } from './types'

const BIBLE_DATA_ROOT = path.join(process.cwd(), 'public', 'bible-data')

export function loadBibleIndex(langCode: string, versionSlug: string): BibleIndex {
  const filePath = path.join(BIBLE_DATA_ROOT, langCode, versionSlug, 'index.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as BibleIndex
}
