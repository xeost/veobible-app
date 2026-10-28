import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
const root = new URL('../src/', import.meta.url)
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/lib/supabase/client') return { url: 'data:text/javascript,export const getSupabaseClient=()=>globalThis.__auth', shortCircuit: true }
    let url
    if (specifier.startsWith('@/')) url = new URL(specifier.slice(2), root)
    else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) url = new URL(specifier, context.parentURL)
    if (url) for (const suffix of ['', '.ts', '/index.ts']) {
      const candidate = url.href + suffix
      if (candidate.endsWith('.ts') && existsSync(fileURLToPath(candidate))) return { url: candidate, shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, shortCircuit: true }
    return next(url, context)
  },
})
