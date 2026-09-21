import { defineConfig, mergeConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import base from './vite.config'

// Build the real app and payroll test entry without development reloads.
const port = Number(process.env.PAYROLL_BROWSER_PORT || 4173)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PAYROLL_BROWSER_PORT')
export default mergeConfig(base, defineConfig({
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify(`http://127.0.0.1:${port}`) },
  build: {
    outDir: 'dist-payroll-test',
    rollupOptions: { input: {
      app: fileURLToPath(new URL('./index.html', import.meta.url)),
      retirementPlan: fileURLToPath(new URL('./tests/support/retirement-plan.html', import.meta.url)),
      payroll: fileURLToPath(new URL('./tests/support/payroll.html', import.meta.url)),
      onboardingInputs: fileURLToPath(new URL('./tests/support/onboarding-inputs.html', import.meta.url)),
    } },
  },
  preview: { host: '127.0.0.1', port, strictPort: true },
}))
