import { expect, test } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import express from '../../backend/node_modules/express/index.js'
import pg from '../../backend/node_modules/pg/lib/index.js'
import { installSharedAccountRecords } from '../../backend/newAdmin/__tests__/sharedAccountFixture.js'
import { registerAccountingRoutes } from '../../backend/billing/accountingRoutes.js'

test('accounting reads current balances, upcoming bills, credits and preserved history through the real API', async ({ page }) => {
  const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
  test.skip(!connectionString, 'Requires an isolated local Admin test database')
  test.setTimeout(60000)
  const url = new URL(connectionString!)
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(url.hostname)
  expect(url.pathname).toMatch(/^\/vortex_(dashboard_test|new_admin_dev|billing_test)$/)
  expect(url.search + url.hash).toBe('')
  const schema = `accounting_browser_${randomBytes(5).toString('hex')}`
  const admin = new pg.Pool({ connectionString })
  await admin.query(`CREATE SCHEMA ${schema}`)
  const setup = new pg.Pool({ connectionString, options: `-c search_path=${schema}` })
  const reads = new pg.Pool({ connectionString, options: `-c search_path=${schema} -c default_transaction_read_only=on` })
  let server: import('node:http').Server | undefined
  try {
    await setup.query((await readFile(new URL('../../backend/billing/__tests__/fixtures/turnover-schema.sql', import.meta.url), 'utf8')).replaceAll('public.', `${schema}.`))
    await installSharedAccountRecords(setup)
    await setup.query(`
      INSERT INTO facility(id,name,timezone) VALUES(1,'Accounting browser fixture','America/New_York');
      INSERT INTO family(id,facility_id,family_name) VALUES(1,1,'Owing family'),(2,1,'Credit family');
      INSERT INTO family_billing_account(id,family_id) VALUES(1,1),(2,2);
      INSERT INTO member(id,facility_id,family_id,first_name,last_name) VALUES(1,1,1,'Current','Athlete');
      INSERT INTO billing_charge(id,family_billing_account_id,member_id,description,amount_cents,source_type,source_id,service_period_start)
        SELECT id,1,1,description,amount,'manual',id::text,(date_trunc('month',now() AT TIME ZONE 'America/New_York')+months*interval '1 month')::date
        FROM (VALUES(1,'Current tuition',10000,0),(2,'Future tuition',15000,1),(3,'Account credit',-2000,0)) v(id,description,amount,months);
      INSERT INTO billing_payment(id,family_billing_account_id,amount_cents,method,external_status) VALUES(1,1,3000,'cash','settled'),(2,2,2500,'cash','settled');
      INSERT INTO billing_payment_application(id,billing_payment_id,billing_charge_id,amount_cents,application_kind) VALUES(1,1,1,1000,'application');
      INSERT INTO jackrabbit_history_record(facility_id,organization_id,record_kind,source_id,family_id,member_id,occurred_on,amount_cents,source_data)
        VALUES(1,'fixture','transaction','historic-bill',1,1,'2025-01-01',50000,'{"Type":"Tuition"}');
    `)
    const fingerprint = async () => (await setup.query(`SELECT md5(string_agg(value::text,'|' ORDER BY value::text)) AS hash FROM (
      SELECT to_jsonb(t) AS value FROM billing_charge t UNION ALL SELECT to_jsonb(t) FROM billing_payment t
      UNION ALL SELECT to_jsonb(t) FROM billing_payment_application t UNION ALL SELECT to_jsonb(t) FROM jackrabbit_history_record t
      UNION ALL SELECT to_jsonb(t) FROM account_charge t UNION ALL SELECT to_jsonb(t) FROM account_payment t) facts`)).rows[0].hash
    const before = await fingerprint()
    const app = express()
    registerAccountingRoutes(app, reads, { jwtSecret: 'fixture', requirePermission: () => [(req, _res, next) => { req.platformAuth = { user: { facility_id: 1 } }; next() }] })
    server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)) })
    const port = (server.address() as { port: number }).port
    const errors: string[] = [], writes: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      localStorage.setItem('vortex_admin', 'true')
      localStorage.setItem('adminToken', 'accounting-browser-token')
      localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Accounting Admin', isMaster: true }))
      localStorage.setItem('vortex_admin_portal', 'new-admin')
    })
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) writes.push(url.pathname)
      if (url.pathname.startsWith('/api/admin/accounting/')) {
        const response = await route.fetch({ url: `http://127.0.0.1:${port}${url.pathname}${url.search}` })
        expect(response.status()).toBe(200)
        return route.fulfill({ response })
      }
      let data: unknown = []
      if (url.pathname === '/api/admin/access/me') data = { isMasterAdmin: true, permissions: [], roles: ['ADMIN'], user: { id: 1 } }
      if (url.pathname === '/api/admin/notifications') data = { notifications: [], unreadCount: 0 }
      return route.fulfill({ json: { success: true, data } })
    })
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.goto('/')
    await page.getByRole('button', { name: 'Open Accounting', exact: true }).click()
    await page.getByRole('combobox', { name: 'Date range', exact: true }).selectOption('all')
    const balances = page.getByRole('region', { name: 'Current family account balances' })
    const comparison = page.getByRole('region', { name: 'Matched bill comparison' })
    await expect(balances.getByText('$50.00', { exact: true })).toBeVisible()
    await expect(balances.getByText('$150.00', { exact: true })).toBeVisible()
    await expect(balances.getByText('$25.00', { exact: true })).toBeVisible()
    for (const amount of ['$250.00', '$50.00', '$200.00']) await expect(comparison.getByText(amount, { exact: true })).toBeVisible()
    await expect(comparison.getByText('Paid or credited', { exact: true })).toBeVisible()
    await expect(comparison).not.toContainText('allocated')
    await expect(comparison).toContainText('1 imported historical line items totaling $500.00')
    await expect(page.getByRole('table').getByText('Not linked', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'View bill line 1', exact: true }).click()
    const detail = page.getByRole('dialog', { name: 'Bill line #1' })
    await expect(detail.getByText('Paid or credited', { exact: true })).toBeVisible()
    await expect(detail.getByText('$50.00', { exact: true })).toHaveCount(2)
    await expect(detail.getByText('Payment #1 · Cash', { exact: true })).toBeHidden()
    await detail.getByText('Recorded bill history', { exact: true }).click()
    await expect(detail).toContainText('Payment #1')
    await page.getByRole('button', { name: 'Close accounting details' }).click()
    const period = page.getByRole('combobox', { name: 'Unpaid billing period' })
    await period.selectOption('current')
    await expect(page.getByRole('table')).toContainText('Current tuition')
    await expect(page.getByRole('table')).not.toContainText('Future tuition')
    await expect(comparison.getByText('$100.00', { exact: true })).toBeVisible()
    await period.selectOption('upcoming')
    await expect(page.getByRole('table')).toContainText('Future tuition')
    await expect(page.getByRole('table')).not.toContainText('Current tuition')
    await expect(page.getByRole('table')).toContainText('Upcoming')
    await expect(balances.getByText('$50.00', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Payments & refunds' }).click()
    await expect(page.getByText('Payments received', { exact: true })).toBeVisible()
    await expect(page.getByText('$55.00', { exact: true })).toHaveCount(2)
    await expect(page.getByRole('columnheader', { name: 'Unapplied', exact: true })).toHaveCount(0)
    await expect(page.getByText('Applied to bills', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'View payment 1', exact: true }).click()
    const payment = page.getByRole('dialog', { name: 'Payment #1', exact: true })
    await expect(payment.getByText('$30.00', { exact: true })).toBeVisible()
    await expect(payment.getByText('Unapplied receipt', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Close accounting details' }).click()
    await page.getByRole('tab', { name: 'Bills & line items' }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export filtered CSV' }).click()
    const csv = await readFile((await (await download).path())!, 'utf8')
    expect(csv).toContain('Remaining (USD)'); expect(csv).toContain('Future tuition'); expect(csv).not.toContain('Current tuition')
    await page.getByRole('button', { name: 'Reset filters' }).click()
    await expect(page.getByRole('table')).toContainText('Current tuition')
    await balances.screenshot({ path: '/tmp/vortex-accounting-balances-desktop.png' })
    await comparison.screenshot({ path: '/tmp/vortex-accounting-comparison-desktop.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    await balances.screenshot({ path: '/tmp/vortex-accounting-balances-mobile.png' })
    expect(await balances.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.getByRole('textbox', { name: 'Search line items' }).fill('no matching tuition')
    await expect(page.getByText('No bills match these filters.')).toBeVisible()
    await expect(balances.getByText('$50.00', { exact: true })).toBeVisible()
    expect(writes).toEqual([]); expect(errors).toEqual([])
    expect(await fingerprint()).toBe(before)
    expect((await reads.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('on')
  } finally {
    await page.unrouteAll({ behavior: 'wait' })
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()))
    await reads.end(); await setup.end()
    await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end()
  }
})
