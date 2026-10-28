import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(join(dir, e.name)) : join(dir, e.name)))).flat()
}
const json = (await files('public/bible-data')).filter(p => p.endsWith('.json'))
const entries = {}
const catalog = {}
for (const path of json) {
  const content = await readFile(path)
  entries['/' + path.slice(7)] = { sha256: createHash('sha256').update(content).digest('hex'), bytes: content.length }
  if (path.endsWith('/index.json')) {
    const index = JSON.parse(content)
    catalog[path.split('/').slice(-3, -1).join('/')] = Object.fromEntries(index.books.map(b => [b.slug, b.chapters]))
  }
}
const revision = createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0, 16)
await writeFile('out/bible-data/manifest.json', JSON.stringify({ revision, entries }))
await writeFile('worker/catalog.json', JSON.stringify(catalog))
const assets = (await files('out/_next')).filter(p => /\.(js|css|woff2?)$/.test(p)).map(p => '/' + p.slice(4))
const shells = ['/', '/en', '/es', '/pt', '/en/read', '/es/leer', '/pt/ler', '/en/kjv', '/en/web', '/es/rv1909', '/es/spabll', '/pt/arc', '/offline', '/manifest.json', '/icon.svg', '/icon.png', '/favicon.ico', '/apple-icon.png', '/web-app-manifest-192x192.png', '/web-app-manifest-512x512.png']
const build = createHash('sha256')
for (const p of (await files('out')).filter(p => /\.(html|js|css)$/.test(p))) build.update(await readFile(p))
const template = await readFile('scripts/service-worker.js', 'utf8')
build.update(template)
await writeFile('out/sw.js', `const BUILD=${JSON.stringify(build.digest('hex').slice(0,16))};\nconst PRECACHE=${JSON.stringify([...shells, ...assets])};\n` + template)
await writeFile('out/_headers', '/sw.js\n  Cache-Control: no-cache\n/bible-data/*\n  X-Robots-Tag: noindex\n')
console.log(`Offline shell: ${assets.length} assets; Bible content revision: ${revision}`)
