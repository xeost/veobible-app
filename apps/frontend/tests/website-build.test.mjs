import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { downloadRelease, normalizeSnapshot } from '../scripts/sync-website.mjs'
const content = { schema: 1, publications: [], bookVideos: [] }
const revision = createHash('sha256').update(JSON.stringify(content)).digest('hex')
test('build download pins every retry to the same CI execution and never falls back to latest', async () => {
  let calls = 0
  const response = await downloadRelease('https://dashboard.test/api/site-export', {
    buildId: 'build-42', token: 'secret', wait: async () => {},
    fetcher: async (url, options) => {
      assert.equal(url.searchParams.get('build'), 'build-42')
      assert.equal(options.headers.Authorization, 'Bearer secret')
      return ++calls === 1 ? new Response('', { status: 409 }) : Response.json({ ...content, revision, deploymentId: 42 })
    }
  })
  assert.equal(calls, 2)
  assert.equal(normalizeSnapshot(await response.json(), true).deploymentId, 42)
  await assert.rejects(() => downloadRelease('https://dashboard.test/api/site-export'), /WORKERS_CI_BUILD_UUID/)
})
test('unknown builds have bounded retries and authentication failures are not retried', async () => {
  let calls = 0
  const response = await downloadRelease('https://dashboard.test/api/site-export', {
    buildId: 'unknown', wait: async () => {}, fetcher: async () => { calls++; return new Response('', { status: 409 }) }
  })
  assert.equal(calls, 30)
  assert.equal(response.status, 409)
  calls = 0
  await downloadRelease('https://dashboard.test/api/site-export', {
    buildId: 'unknown', fetcher: async () => { calls++; return new Response('', { status: 401 }) }
  })
  assert.equal(calls, 1)
})
test('build validation rejects corrupted data and missing deployment identity', () => {
  assert.throws(() => normalizeSnapshot({ ...content, revision: 'wrong', deploymentId: 1 }, true), /hash/)
  assert.throws(() => normalizeSnapshot({ ...content, revision }, true), /identity is missing/)
  assert.throws(() => normalizeSnapshot({ ...content, revision, deploymentId: -1 }), /identity/)
  assert.throws(() => normalizeSnapshot({ ...content, revision: 'empty', deploymentId: 1 }, true), /hash/)
  assert.deepEqual(normalizeSnapshot({ ...content, revision, deploymentId: 1, privateField: 'strip' }, true), { ...content, revision, deploymentId: 1 })
})

test('production downloads follow the signed URL without forwarding dashboard credentials', async () => {
  const signed = `https://${'a'.repeat(32)}.r2.cloudflarestorage.com/site-releases/42.json?X-Amz-Signature=signature`
  const calls = []
  const response = await downloadRelease('https://dashboard.test/api/site-export', {
    buildId: 'build-42', token: 'secret',
    fetcher: async (url, options) => {
      calls.push({ url, options })
      if (calls.length === 1) return new Response(null, { status: 302, headers: { Location: signed } })
      assert.equal(url.href, signed)
      assert.equal(options.headers, undefined)
      assert.equal(options.redirect, 'error')
      return Response.json({ ...content, revision, deploymentId: 42 })
    }
  })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].options.redirect, 'manual')
  assert.equal(normalizeSnapshot(await response.json(), true).deploymentId, 42)
})
test('download redirects reject unexpected destinations before sending another request', async () => {
  for (const location of [
    'https://attacker.test/42.json?X-Amz-Signature=x',
    `http://${'a'.repeat(32)}.r2.cloudflarestorage.com/site-releases/42.json?X-Amz-Signature=x`,
    `https://${'a'.repeat(32)}.r2.cloudflarestorage.com/another-bucket/42.json?X-Amz-Signature=x`,
  ]) {
    let calls = 0
    await assert.rejects(() => downloadRelease('https://dashboard.test/api/site-export', {
      buildId: 'build-42', token: 'secret', fetcher: async () => {
        calls++
        return new Response(null, { status: 302, headers: { Location: location } })
      }
    }), /Invalid website content download URL/)
    assert.equal(calls, 1)
  }
})
