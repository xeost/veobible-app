import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { stage, devBuild, finish, readSnapshot, deployedSnapshot } from '../worker/site/store.ts'
import { exportContent } from '../worker/site/export.ts'
import {
  validateContent,
  youtubeId
} from '../../../packages/website/content.ts'
function database() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(
    readFileSync(
      new URL('../worker/migrations/0002_website.sql', import.meta.url),
      'utf8'
    )
  )
  const prepare = (sql) => {
    let args = []
    const stmt = {
      bind(...v) {
        args = v
        return stmt
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...args) }
      },
      async first() {
        return sqlite.prepare(sql).get(...args) ?? null
      },
      async run() {
        return { meta: sqlite.prepare(sql).run(...args) }
      }
    }
    return stmt
  }
  return { prepare }
}
const content = {
  schema: 1,
  publications: [
    {
      projectId: 1,
      kind: 'short',
      locale: 'es',
      version: 'rv1909',
      slug: 'genesis-1',
      title: 'Génesis',
      description: '',
      youtubeId: 'abcdefghijk',
      passage: {
        book: 'genesis',
        start: { chapter: 1, verse: 1 },
        end: { chapter: 1, verse: 3 }
      }
    }
  ],
  bookVideos: []
}
test('publication snapshots isolate development builds, prevent overlapping deployments and retain their immutable content', async () => {
  const db = database()
  const revision = await stage(db, content, 'admin')
  await assert.rejects(() => stage(db, content, 'other'), /already in progress/)
  const newer = structuredClone(content)
  newer.publications[0].description = 'Changed after deployment started'
  await devBuild(db, newer, 'editor')
  assert.equal((await readSnapshot(db)).publications[0].description, '')
  assert.equal(
    (await readSnapshot(db, true)).publications[0].description,
    newer.publications[0].description
  )
  await finish(db, 'unrelated', true)
  await assert.rejects(() => stage(db, newer, 'admin'))
  await finish(db, revision, false)
  assert.equal(await readSnapshot(db), null)
  const retry = await stage(db, content, 'admin')
  assert.notEqual(revision, retry)
  await finish(db, retry, true)
  assert.equal((await deployedSnapshot(db)).revision,retry)
  await stage(db, newer, 'admin')
})
test('build exports require a separate secret while local development exports stay local', async () => {
  const db = database()
  await stage(db, content, 'admin')
  const request = () => new Request('https://site/api/site-export')
  assert.equal((await exportContent(request(), { DB: db })).status, 401)
  assert.equal(
    (await exportContent(request(), { DB: db, SITE_EXPORT_TOKEN: 'secret' }))
      .status,
    401
  )
  const response = await exportContent(
    new Request('https://site/api/site-export', {
      headers: { Authorization: 'Bearer secret' }
    }),
    { DB: db, SITE_EXPORT_TOKEN: 'secret' }
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal((await response.json()).publications.length, 1)
  assert.equal(
    (
      await exportContent(
        new Request('http://localhost/site-export?development=1'),
        { DB: db, SITE_LOCAL: 'true' }
      )
    ).status,
    404
  )
})
test('development content is explicitly selected, deduplicated and isolated from production exports', async () => {
  const db = database()
  const first = await devBuild(db, content, 'editor')
  assert.equal(await devBuild(db, content, 'editor'), first)
  const changed = structuredClone(content)
  changed.publications[0].description = 'Saved later in dashboard'
  // Editing the source does not mutate the last explicitly selected development build.
  assert.equal((await readSnapshot(db, true)).publications[0].description, '')
  const production = await stage(db, content, 'admin')
  await finish(db, production, true)
  const second = await devBuild(db, changed, 'editor')
  assert.notEqual(second, first)
  const local = await exportContent(new Request('http://localhost/site-export?development=1'), { DB: db, SITE_LOCAL: 'true' })
  assert.equal((await local.json()).revision, second)
  const publicExport = await exportContent(new Request('https://site/api/site-export?development=1', { headers: { Authorization: 'Bearer secret' } }), { DB: db, SITE_EXPORT_TOKEN: 'secret' })
  assert.equal((await publicExport.json()).revision, production)
})
test('publication validation rejects nonexistent passages, unsafe links and duplicate page addresses', () => {
  assert.equal(youtubeId('https://youtu.be/abcdefghijk'), 'abcdefghijk')
  assert.equal(
    youtubeId('https://www.youtube.com/shorts/abcdefghijk'),
    'abcdefghijk'
  )
  assert.equal(youtubeId('https://evil.test/watch?v=abcdefghijk'), null)
  const invalid = structuredClone(content)
  invalid.publications[0].passage.end.verse = 999
  assert.throws(() => validateContent(invalid))
  const backwards = structuredClone(content)
  backwards.publications[0].passage.end.chapter = 1
  backwards.publications[0].passage.start.chapter = 2
  assert.throws(() => validateContent(backwards))
  assert.throws(() =>
    validateContent({
      ...content,
      publications: [
        content.publications[0],
        { ...content.publications[0], projectId: 2 }
      ]
    })
  )
})
