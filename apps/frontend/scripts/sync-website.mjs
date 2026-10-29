import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { validateContent } from '../../../packages/website/content.ts'
try {
  process.loadEnvFile('.env.local')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const file = new URL('../src/generated/website.json', import.meta.url)
export async function syncWebsite({ development = false } = {}) {
  const source = process.env.SITE_CONTENT_FILE
  let snapshot
  if (source) snapshot = JSON.parse(await readFile(source, 'utf8'))
  else if (process.env.SITE_ALLOW_EMPTY === '1' && !development)
    snapshot = {
      schema: 1,
      revision: 'empty',
      publications: [],
      bookVideos: []
    }
  else {
    const endpoint =
      process.env.SITE_CONTENT_URL ??
      (development
        ? 'http://127.0.0.1:8787/site-export?development=1'
        : 'https://veobible.com/api/site-export')
    const response = await fetch(endpoint, {
      headers: process.env.SITE_EXPORT_TOKEN
        ? { Authorization: `Bearer ${process.env.SITE_EXPORT_TOKEN}` }
        : {},
      signal: AbortSignal.timeout(15000),
      cache: 'no-store'
    })
    if (development && response.status === 404)
      snapshot = {
        schema: 1,
        revision: 'empty',
        publications: [],
        bookVideos: []
      }
    else {
      if (!response.ok)
        throw new Error(
          `Website content export failed (${response.status}); build stopped to preserve published pages`
        )
      snapshot = await response.json()
    }
  }
  if (
    typeof snapshot.revision !== 'string' ||
    !snapshot.revision ||
    snapshot.revision.length > 100
  )
    throw new Error('Invalid website revision')
  snapshot = { ...validateContent(snapshot), revision: snapshot.revision }
  const text = JSON.stringify(snapshot) + '\n'
  await mkdir(new URL('../src/generated/', import.meta.url), {
    recursive: true
  })
  const old = await readFile(file, 'utf8').catch(() => null)
  if (old !== text) {
    const temporary=new URL('../src/generated/website.json.tmp',import.meta.url)
    await writeFile(temporary,text)
    await rename(temporary,file)
  }
  return snapshot
}
if (
  process.argv[1] &&
  new URL(`file://${process.argv[1]}`).href === import.meta.url
) {
  const snapshot = await syncWebsite()
  console.log(
    `Website: ${snapshot.publications.length} pages, ${snapshot.bookVideos.length} book videos, revision ${snapshot.revision}`
  )
}
