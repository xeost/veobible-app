import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import app from '../worker/api/index.ts'

function database() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(new URL('../worker/migrations/0001_initial_schema.sql', import.meta.url), 'utf8'))
  const prepare = sql => {
    let args = []
    const statement = {
      bind(...values) { args = values; return statement },
      async first() { return sqlite.prepare(sql).get(...args) ?? null },
      async all() { return { results: sqlite.prepare(sql).all(...args) } },
      async run() { const result = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } } },
    }
    return statement
  }
  return { prepare, async batch(statements) { return Promise.all(statements.map(s => s.run())) } }
}
const secret = 'local-test-secret'
function token(user) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const body = `${encode({ alg: 'HS256' })}.${encode({ sub: user, exp: Math.floor(Date.now()/1000) + 600 })}`
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}
test('API preserves concurrent notes, isolates ownership, syncs deletion and rejects unauthenticated requests', async () => {
  const env = { DB: database(), SUPABASE_JWT_SECRET: secret, SUPABASE_URL: 'https://test.supabase.co' }
  const request = (user, path, method = 'GET', body) => app.fetch(new Request(`https://test/v1${path}`, { method, headers: { Authorization: `Bearer ${token(user)}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), env)
  const b = { id: crypto.randomUUID(), versionSlug: 'kjv', bookSlug: 'genesis', chapter: 1, verseStart: 1, verseEnd: 1, selectedText: 'text', note: 'original', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  const first = await request('alice', '/bookmarks', 'POST', b)
  assert.equal(first.status, 201)
  const saved = (await first.json()).data
  const changed = await request('alice', '/bookmarks', 'POST', { ...b, note: 'device A', baseUpdatedAt: saved.updatedAt, conflictId: crypto.randomUUID() })
  assert.equal(changed.status, 201)
  const conflict = await request('alice', '/bookmarks', 'POST', { ...b, note: 'device B', baseUpdatedAt: saved.updatedAt, conflictId: crypto.randomUUID() })
  assert.equal(conflict.status, 201)
  const notes = (await (await request('alice', '/bookmarks')).json()).data.map(b => b.note)
  assert.deepEqual(notes.sort(), ['device A', 'device B'])
  await request('bob', '/bookmarks', 'POST', { ...b, note: 'intruder' })
  assert.deepEqual((await (await request('alice', '/bookmarks')).json()).data.map(b => b.note).sort(), notes.sort())
  assert.equal((await (await request('bob', '/bookmarks')).json()).data.length, 0)
  await request('alice', `/bookmarks/${b.id}`, 'DELETE')
  const pull = await (await request('alice', '/sync?since=1970-01-01T00:00:00.000Z')).json()
  assert.ok(pull.bookmarks.find(item => item.id === b.id).deletedAt)
  const unauthenticated = await app.fetch(new Request('https://test/v1/bookmarks'), env)
  assert.equal(unauthenticated.status, 401)
})
