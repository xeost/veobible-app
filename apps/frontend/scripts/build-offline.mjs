import { readdir, readFile, writeFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(join(dir, e.name)) : join(dir, e.name)))).flat()
}
await rm('out/en/daily-dose/_empty', {recursive:true,force:true})
const snapshot = JSON.parse(await readFile('src/generated/website.json','utf8'))
for (const b of snapshot.bookVideos) {
  const path=`out/bible-data/${b.locale}/${b.version}/index.json`
  const index=JSON.parse(await readFile(path,'utf8'))
  const book=index.books.find(book=>book.id===b.book)
  if (!book) throw new Error('Invalid website book video')
  book.video=`https://www.youtube.com/watch?v=${b.youtubeId}`
  await writeFile(path,JSON.stringify(index,null,2)+'\n')
}
await writeFile('out/website-release.json',JSON.stringify({revision:snapshot.revision,deploymentId:snapshot.deploymentId}))
const json = (await files('out/bible-data')).filter(p => p.endsWith('.json') && !p.endsWith('/manifest.json'))
const entries = {}
const catalog = {}
for (const path of json) {
  const content = await readFile(path)
  entries['/' + path.slice(4)] = { sha256: createHash('sha256').update(content).digest('hex'), bytes: content.length }
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
await writeFile('out/_headers', '/website-release.json\n  Cache-Control: no-store\n/sw.js\n  Cache-Control: no-cache\n/bible-data/*\n  X-Robots-Tag: noindex\n')
console.log(`Offline shell: ${assets.length} assets; Bible content revision: ${revision}`)
