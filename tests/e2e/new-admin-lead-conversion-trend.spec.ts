import { expect, test, type Page } from '@playwright/test'

async function prepare(page: Page, { failure = false, permission = true, empty = false } = {}) {
  const requests: URL[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'test-admin')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Dashboard Admin', isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url())
    let data: unknown = null
    if (url.pathname === '/api/admin/access/me') data = { isMasterAdmin: false, permissions: [permission ? 'members.view' : 'classes.view'], roles: ['ADMIN'], user: { id: 1 } }
    if (url.pathname.endsWith('/families') || url.pathname.endsWith('/classes')) data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    if (url.pathname.endsWith('/lead-conversion-trend')) {
      requests.push(url)
      if (failure) { failure = false; return route.fulfill({ status: 503, json: { success: false, message: 'Lead history is temporarily unavailable.' } }) }
      const totals = empty ? { inquiries: 0, freeTrials: 0, dropIns: 0, directSignups: 0, conversions: 0 } : { inquiries: 12, freeTrials: 5, dropIns: 3, directSignups: 2, conversions: 6 }
      const start = url.searchParams.get('start') ?? '2025-11-28', end = url.searchParams.get('end') ?? '2026-11-27'
      data = { start, end, today: '2026-11-27', timezone: 'America/New_York', interval: url.searchParams.get('interval'), totals,
        buckets: [{ key: start, start, end, ...totals }] }
    }
    return route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  if (permission) await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Dashboard', exact: true }).click()
  return { requests, errors }
}

test('dashboard opens with lead timeline, selectable breakdowns, bar graph and exact table totals', async ({ page }) => {
  const { errors } = await prepare(page)
  const panel = page.getByRole('region', { name: 'Leads & conversions', exact: true })
  await expect(panel.getByRole('heading', { name: 'Leads & conversions', exact: true })).toBeVisible()
  expect(await panel.evaluate(element => element.nextElementSibling?.getAttribute('aria-label'))).toBe('Enrollment & Loss Data')
  await expect(panel.getByRole('img', { name: /Timeline of lead activity/ })).toBeVisible()
  await panel.getByRole('button', { name: 'Bar graph', exact: true }).click()
  await expect(panel.getByRole('img', { name: /Bar graph of lead activity/ })).toBeVisible()
  await panel.getByRole('button', { name: 'Table', exact: true }).click()
  const table = panel.getByRole('table')
  await expect(table.getByRole('row', { name: /^Total/ }).getByRole('cell')).toHaveText(['12', '5', '3', '2', '6'])
  await panel.getByRole('checkbox', { name: 'Non-member drop-ins', exact: true }).uncheck()
  await expect(table.getByRole('columnheader', { name: 'Non-member drop-ins', exact: true })).toHaveCount(0)
  for (const label of ['Inquiries', 'Free trials', 'Direct sign-ups', 'Conversions']) await panel.getByRole('checkbox', { name: label, exact: true }).uncheck()
  await expect(panel.getByText('Select at least one series to display.')).toBeVisible()
  await panel.getByRole('checkbox', { name: 'Conversions', exact: true }).check()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(table).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '/private/tmp/vortex-lead-conversions-mobile.png' })
  expect(errors).toEqual([])
})

test('date controls request daily and weekly data and can reset the range', async ({ page }) => {
  const { requests, errors } = await prepare(page)
  const panel = page.getByRole('region', { name: 'Leads & conversions', exact: true })
  await panel.getByLabel('From', { exact: true }).fill('2026-11-01')
  await panel.getByLabel('Through', { exact: true }).fill('2026-11-20')
  await panel.getByLabel('Group by', { exact: true }).selectOption('day')
  await panel.getByRole('button', { name: 'Apply dates' }).click()
  await expect.poll(() => requests.at(-1)?.searchParams.get('interval')).toBe('day')
  expect(requests.at(-1)?.searchParams.get('start')).toBe('2026-11-01')
  expect(requests.at(-1)?.searchParams.get('end')).toBe('2026-11-20')
  await panel.getByLabel('Group by', { exact: true }).selectOption('week')
  await panel.getByRole('button', { name: 'Apply dates' }).click()
  await expect.poll(() => requests.at(-1)?.searchParams.get('interval')).toBe('week')
  await panel.getByRole('button', { name: 'Last 12 months' }).click()
  await expect(panel.getByLabel('From', { exact: true })).toHaveValue('2025-11-28')
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.screenshot({ path: '/private/tmp/vortex-lead-conversions-desktop.png' })
  expect(errors).toEqual([])
})

test('failed history can retry and an empty date range is explicit', async ({ page }) => {
  const { errors } = await prepare(page, { failure: true, empty: true })
  const panel = page.getByRole('region', { name: 'Leads & conversions', exact: true })
  await expect(panel.getByText('Lead history is temporarily unavailable.')).toBeVisible()
  await panel.getByRole('button', { name: /retry/i }).click()
  await expect(panel.getByText('No recorded lead or conversion activity in this date range.')).toBeVisible()
  expect(errors).toEqual([])
})

test('staff without dashboard permission cannot load lead history', async ({ page }) => {
  const { requests } = await prepare(page, { permission: false })
  await expect(page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Dashboard', exact: true })).toHaveCount(0)
  expect(requests).toHaveLength(0)
})
