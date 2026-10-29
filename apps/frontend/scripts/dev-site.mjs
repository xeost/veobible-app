import { access, mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { syncWebsite } from './sync-website.mjs'
const require = createRequire(import.meta.url)
const generated = new URL('../src/generated/website.json', import.meta.url)
await mkdir(new URL('../src/generated/', import.meta.url), { recursive: true })
try {
  await access(generated)
} catch {
  await writeFile(
    generated,
    JSON.stringify({
      schema: 1,
      revision: 'empty',
      publications: [],
      bookVideos: []
    })
  )
}
let stopped = false,
  lastError = ''
async function refresh() {
  try {
    await syncWebsite({ development: true })
    lastError = ''
  } catch (error) {
    if (error.message !== lastError) {
      console.warn(`Website dev build: ${error.message}`)
      lastError = error.message
    }
  }
  if (!stopped) timer = setTimeout(refresh, 3000)
}
let timer
await refresh()
const child = spawn(
  process.execPath,
  [require.resolve('next/dist/bin/next'), 'dev', ...process.argv.slice(2)],
  { stdio: 'inherit' }
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stopped = true
    clearTimeout(timer)
    child.kill(signal)
  })
child.on('exit', (code) => {
  stopped = true
  clearTimeout(timer)
  process.exitCode = code ?? 0
})
