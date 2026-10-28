import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests/e2e', timeout: 120000, use: { baseURL: 'http://localhost:8790' }, workers: 1 })
