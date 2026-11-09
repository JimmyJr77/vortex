import { expect, test, type Page } from '@playwright/test'

const trend = { year: 2026, asOf: '2026-11-09', coverageStart: '2026-01-19', notes: ['Siblings and transfers count once per family.', 'Incomplete records make later months provisional.'], months: Array.from({ length: 11 }, (_, i) => ({
  key: `2026-${String(i + 1).padStart(2, '0')}`, label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov'][i],
  openingFamilies: i ? 20 : null, newFamilies: i ? 4 : 20, canceledFamilies: i ? 3 : 0,
  lostFamilies: i ? 2 : null, lossRate: i ? 10 : null, partial: i === 10, provisional: i >= 7,
})) }
async function prepare(page: Page, { permission = true, failure = false, empty = false } = {}) {
  const requests: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Dashboard Admin', isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    requests.push(path)
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin: false, permissions: permission ? ['members.view'] : ['classes.view'], roles: ['ADMIN'], user: { id: 1 } }
    if (path === '/api/admin/new-admin/families') data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    if (path === '/api/admin/new-admin/classes') data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    if (path === '/api/admin/new-admin/enrollment-trend') {
      if (failure) { failure = false; return route.fulfill({ status: 503, json: { success: false, message: 'Enrollment history is temporarily unavailable.' } }) }
      data = empty ? { ...trend, coverageStart: null, months: trend.months.map(row => ({ ...row, openingFamilies: null, newFamilies: null, canceledFamilies: null, lostFamilies: null, lossRate: null })) } : trend
    }
    return route.fulfill({ status: 200, json: { success: true, data } })
  })
  await page.goto('/')
  if (permission) await page.getByRole('navigation', { name: 'New Admin sections' }).getByRole('button', { name: 'Dashboard', exact: true }).click()
  return { requests, errors }
}

test('New Admin overlays all family measures; view changes are local and mobile/table remain accessible', async ({ page }) => {
  const { requests, errors } = await prepare(page)
  const dashboard = page.getByRole('region', { name: 'Monthly family loss dashboard' })
  await expect(dashboard.getByRole('heading', { name: 'Monthly loss rate', exact: true })).toBeVisible()
  await expect(dashboard.locator('.recharts-line')).toHaveCount(3)
  await dashboard.getByRole('button', { name: 'Bar graph', exact: true }).click()
  await expect(dashboard.locator('.recharts-bar')).toHaveCount(2)
  await expect(dashboard.locator('.recharts-line')).toHaveCount(1)
  await dashboard.getByRole('button', { name: 'Table', exact: true }).click()
  await expect(dashboard.getByRole('table')).toBeVisible()
  await expect(dashboard.getByRole('row')).toHaveCount(12)
  await expect(dashboard.getByRole('row').filter({ hasText: 'Feb' })).toContainText('10.0%')
  await expect(dashboard.getByRole('row').filter({ hasText: 'Jan' })).toContainText('Unavailable')
  await expect(dashboard.getByRole('row').filter({ hasText: 'Nov' })).toContainText('Nov* (partial)')
  expect(requests.filter(path => path.endsWith('/enrollment-trend'))).toHaveLength(1)
  expect(requests.some(path => path.includes('customer-billing'))).toBe(false)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await dashboard.getByRole('button', { name: 'Timeline', exact: true }).click()
  await expect(dashboard.locator('.recharts-surface').first()).toBeVisible()
  await dashboard.getByText('Calculation details & data coverage').click()
  await expect(dashboard.getByText('Siblings and transfers count once per family.')).toBeVisible()
  await page.getByRole('button', { name: 'Refresh New Admin', exact: true }).click()
  await expect(dashboard.locator('.recharts-line')).toHaveCount(3)
  expect(requests.filter(path => path.endsWith('/enrollment-trend'))).toHaveLength(2)
  expect(errors).toEqual([])
})
test('dashboard read errors can be retried and empty data does not become a fabricated zero', async ({ page }) => {
  await prepare(page, { failure: true, empty: true })
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByText('No enrollment history is available for this year.')).toBeVisible()
  await expect(page.getByText('Unavailable', { exact: true })).toHaveCount(3)
})
test('staff without family access cannot open or fetch the family dashboard', async ({ page }) => {
  const { requests } = await prepare(page, { permission: false })
  const nav = page.getByRole('navigation', { name: 'New Admin sections' })
  await expect(nav.getByRole('button', { name: 'Classes & schedules' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Dashboard', exact: true })).toHaveCount(0)
  expect(requests.some(path => path.endsWith('/enrollment-trend'))).toBe(false)
})
