// Isolated browser -> API -> PostgreSQL verification. Never reads application secrets.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
import { legalHarness } from '../backend/legal/testing/harness.js'

const h = await legalHarness()
let vite, browser
try {
  vite = await createServer({ configFile: false, plugins: [react()], define: { 'import.meta.env.VITE_API_URL': JSON.stringify(h.url) }, server: { host: '127.0.0.1', port: 55440, strictPort: true }, appType: 'custom' })
  vite.middlewares.use('/legal-test', async (req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml('/legal-test', '<html><head><title>Staff legal verification</title></head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/staff-legal.tsx"></script></body></html>')) })
  await vite.listen()
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  // An older or unavailable API must show a retry notice without crashing the portal.
  await page.route('**/api/staff/legal', route => route.fulfill({json:{success:true,data:[]}}))
  await page.goto('http://127.0.0.1:55440/legal-test')
  await page.getByRole('button', {name:'Retry policy check'}).waitFor()
  await page.getByRole('heading', {name:'Staff legal policies and signatures',exact:true}).waitFor()
  await page.unroute('**/api/staff/legal')
  await page.getByRole('button', {name:'Retry policy check'}).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  assert.match(await dialog.innerText(), /Required staff legal policies/)
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Review policies', exact: true }).click()
  await dialog.waitFor({ state: 'visible' })
  for (const title of ['Child Abuse Identification and Reporting Policy', 'Abuse Prevention and Staff Boundaries Policy', 'Abuse and Harassment Crisis Management Plan']) {
    const article = dialog.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    await article.getByText('Read the complete document', { exact: true }).click()
    await article.getByLabel('Your full name').fill('Linked Coach')
    await article.getByRole('checkbox').check()
    await article.getByRole('button', { name: 'Sign this document', exact: true }).click()
    await article.getByText(/Signed by Linked Coach/).waitFor()
  }
  await dialog.getByText('All three documents are signed. Thank you.').waitFor()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh tracking' }).click()
  await page.getByText('1 of 4 staff have signed all three documents.', { exact: true }).waitFor()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export tracking CSV' }).click()
  assert.equal((await downloadPromise).suggestedFilename(), 'vortex-staff-legal-signatures.csv')
  await page.goto('http://127.0.0.1:55440/legal-test?portal=payroll')
  await page.getByText('Staff legal policies and your signatures', { exact: true }).waitFor()
  assert.equal(await page.getByRole('dialog').isVisible(), false)
  await page.getByRole('button', { name: 'Review policies', exact: true }).click()
  await dialog.getByText('All three documents are signed. Thank you.').waitFor()
  const count = (await h.pool.query('SELECT count(*) FROM staff_legal_signature')).rows[0].count
  assert.equal(count, '3'); assert.deepEqual(errors, [])
  console.log('PASS: login notice, individual electronic signatures, durable database records, linked payroll status, admin tracking and CSV export; no browser errors.')
} finally { await browser?.close(); await vite?.close(); await h.close() }
