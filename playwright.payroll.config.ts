import { defineConfig } from '@playwright/test'
import base from './playwright.config'

const port = Number(process.env.PAYROLL_BROWSER_PORT || 4173)
export default defineConfig(base, {
  testMatch: 'payroll-*.spec.ts',
  fullyParallel: false,
  workers: 1,
  // Expose failures on the first attempt; retries must not mask regressions.
  retries: 0,
  use: { ...base.use, baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}` },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'vite build --config vite.payroll-test.config.ts && vite preview --config vite.payroll-test.config.ts',
    url: `http://127.0.0.1:${port}/tests/support/payroll.html`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
