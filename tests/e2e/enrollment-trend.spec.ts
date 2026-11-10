import { expect, test } from '@playwright/test'

test('dashboard switches family trend between timeline, bars and a table on desktop and mobile', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Dashboard Admin', isMaster: true }))
  })
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin: true, permissions: [], roles: ['ADMIN'], user: { id: 1 } }
    if (path === '/api/admin/notifications') data = { notifications: [], unreadCount: 0 }
    if (path === '/api/admin/dashboard') data = {
      permissions: { canViewEnrollment: true, canViewBilling: true, canViewWaivers: true },
      generatedAt: '2026-11-08T17:00:00Z', enrollment: null, billing: null, mediaReleaseOptOuts: [],
      enrollmentTrend: { year: 2026, asOf: '2026-11-08', notes: ['First recorded month has no verified opening population.'], months: [
        { key: '2026-01', label: 'Jan', openingFamilies: null, newFamilies: 7, lostFamilies: null, lossRate: null, partial: false, provisional: false },
        { key: '2026-02', label: 'Feb', openingFamilies: 7, newFamilies: 6, lostFamilies: 1, lossRate: 14.29, partial: false, provisional: false },
        { key: '2026-11', label: 'Nov', openingFamilies: 35, newFamilies: 1, lostFamilies: 0, lossRate: 0, partial: true, provisional: true },
      ] },
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
  })
  await page.goto('/')
  await page.getByRole('navigation').getByRole('button', { name: 'Dashboard', exact: true }).click()
  const trend = page.getByRole('region', { name: 'Family enrollment trend' })
  await expect(trend.getByRole('button', { name: 'Timeline', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(trend.locator('.recharts-line')).toHaveCount(2)
  await trend.getByRole('button', { name: 'Bars', exact: true }).click()
  await expect(trend.locator('.recharts-bar')).toHaveCount(2)
  await trend.getByRole('button', { name: 'Table', exact: true }).click()
  await expect(trend.getByRole('table')).toBeVisible()
  await expect(trend.getByRole('row').filter({ hasText: 'Feb' })).toContainText('14.3%')
  await expect(trend.getByRole('row').filter({ hasText: 'Jan' })).toContainText('Unavailable')
  await expect(trend.getByRole('row').filter({ hasText: 'Nov' })).toContainText('(partial)')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(trend.getByRole('button', { name: 'Timeline', exact: true })).toBeVisible()
  await trend.getByRole('button', { name: 'Timeline', exact: true }).click()
  await expect(trend.locator('.recharts-surface').first()).toBeVisible()
  await trend.getByText('How these figures are calculated and data coverage').click()
  await expect(trend.getByText('First recorded month has no verified opening population.')).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: '/tmp/vortex-enrollment-trend.png', fullPage: true })
  expect(errors).toEqual([])
})
