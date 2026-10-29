import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { validateContent } from '../../../packages/website/content.ts'
try {
  process.loadEnvFile('.env.local')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const file = new URL('../src/generated/website.json', import.meta.url)
export async function downloadRelease(endpoint, { development = false, buildId, token, fetcher = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const url = new URL(endpoint)
  if (!development) {
    if (!buildId) throw new Error('WORKERS_CI_BUILD_UUID is required; use SITE_CONTENT_FILE for an explicit offline snapshot')
    url.searchParams.set('build', buildId)
  }
  let response
  for (let attempt = 0; attempt < 30; attempt++) {
    response = await fetcher(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(15000), cache: 'no-store'
    })
    if (response.status !== 409 || development || attempt === 29) break
    await response.body?.cancel()
    await wait(2000)
  }
  return response
}
export function normalizeSnapshot(snapshot, requireDeployment = false) {
  if (
    typeof snapshot.revision !== 'string' ||
    !snapshot.revision ||
    snapshot.revision.length > 100
  )
    throw new Error('Invalid website revision')
  const content = validateContent(snapshot)
  if ((snapshot.revision !== 'empty' || content.publications.length || content.bookVideos.length || requireDeployment) && createHash('sha256').update(JSON.stringify(content)).digest('hex') !== snapshot.revision)
    throw new Error('Website content hash does not match its revision')
  if (snapshot.deploymentId !== undefined && (!Number.isSafeInteger(snapshot.deploymentId) || snapshot.deploymentId <= 0))
    throw new Error('Invalid website deployment identity')
  if (requireDeployment && !snapshot.deploymentId)
    throw new Error('Website deployment identity is missing')
  return { ...content, revision: snapshot.revision, ...(snapshot.deploymentId ? { deploymentId: snapshot.deploymentId } : {}) }
}
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
        ? 'http://127.0.0.1:3003/api/site-export?development=1'
        : 'https://dash.veobible.com/api/site-export')
    const response = await downloadRelease(endpoint, {
      development, buildId: process.env.WORKERS_CI_BUILD_UUID, token: process.env.SITE_EXPORT_TOKEN
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
  snapshot = normalizeSnapshot(snapshot, !development && !source && process.env.SITE_ALLOW_EMPTY !== '1')
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
