import { readFile, writeFile, unlink } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const configPath = resolve(root, '.wrangler.api-dev.json')
const config = JSON.parse(await readFile(resolve(root, 'wrangler.jsonc'), 'utf8'))
// Derive API-only development from the production bindings, without static assets
// or public domain routes. Keeping the config beside .dev.vars preserves loading.
const { assets, routes, ...apiConfig } = config
apiConfig.main = 'worker/api/index.ts'
await writeFile(configPath, JSON.stringify(apiConfig, null, 2) + '\n', { mode: 0o600 })

const require = createRequire(import.meta.url)
const wrangler = resolve(dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js')
const args = process.argv.slice(2)
const port = args.some(arg => arg === '--port' || arg.startsWith('--port=')) ? [] : ['--port', '8787']
const child = spawn(process.execPath, [wrangler, 'dev', '--config', configPath, ...port, '--persist-to', 'worker/.wrangler/state', ...args], { cwd: root, stdio: 'inherit' })
const stop = signal => child.kill(signal)
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
child.on('error', async error => {
  console.error(error)
  await unlink(configPath).catch(() => {})
  process.exitCode = 1
})
child.on('exit', async code => {
  await unlink(configPath).catch(() => {})
  process.exitCode = code ?? 0
})
