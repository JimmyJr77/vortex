import { expect, test, type Page } from '@playwright/test'

async function mockNavigationApi(page: Page) {
  const billingWrites: string[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', route => {
    const { pathname: path } = new URL(route.request().url())
    if (/billing|stripe|enrollment|scheduling/.test(path) && !['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) billingWrites.push(path)
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin: true, permissions: [], roles: ['ADMIN'], user: { id: 1 } }
    if (path === '/api/admin/notifications') data = { notifications: [], unreadCount: 0 }
    if (path === '/api/admin/accounting/options') data = { members: [], classes: [] }
    if (path === '/api/admin/accounting/lines') data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0, timezone: 'America/New_York', summary: { billedCents: 0, paidCents: 0, creditAppliedCents: 0, openCents: 0, creditCents: 0, openCount: 0 } }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
  })
  return { billingWrites, errors }
}

test('staff return through Member Portal on desktop/mobile and switch admin inside the portal', async ({ page }) => {
  const { billingWrites, errors } = await mockNavigationApi(page)
  // Covers older admin sessions that have no stored member profile.
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'navigation-test-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Admin', isMaster: true }))
  })
  await page.goto('/')
  const legacyNav = page.getByRole('navigation', { name: 'Legacy Admin sections' })
  await expect(legacyNav.getByRole('button')).toHaveText(['Home', 'Dashboard', 'Payroll', 'Leads', 'Accounts', 'Enrollments', 'Class Setup'])
  await page.getByRole('button', { name: 'Return to website home' }).click()
  await page.getByRole('button', { name: 'Necessary only', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Open a portal' })).toHaveCount(0)
  const returnToPortal = page.getByRole('button', { name: 'Member Portal', exact: true })
  await returnToPortal.click()
  await page.getByRole('button', { name: 'Switch portal account' }).click()
  await page.getByRole('option', { name: 'Admin', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('vortex_admin_portal'))).toBe('new-admin')
  await page.getByRole('button', { name: 'Switch portal account' }).click()
  await page.getByRole('option', { name: 'Legacy Admin', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Admin sections', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Return to website home' }).click()
  for (const width of [1100, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(page.getByRole('combobox', { name: 'Open a portal' })).toHaveCount(0)
    await expect(returnToPortal).toBeVisible()
    await expect(page.getByRole('button', { name: 'Account login', exact: true })).toHaveCount(0)
    const header = page.getByRole('banner')
    await expect.poll(async () => Math.round((await header.boundingBox())?.y ?? -1)).toBe(0)
    expect(await header.evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await returnToPortal.click()
  await page.getByRole('button', { name: 'Switch portal account' }).click()
  await page.getByRole('option', { name: 'Admin', exact: true }).click()
  await page.getByRole('button', { name: 'Return to website home' }).click()
  await returnToPortal.click()
  await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible()
  expect(billingWrites).toEqual([])
  expect(errors).toEqual([])
})

test('public visitors and member-only accounts are not offered admin portals', async ({ page }) => {
  await mockNavigationApi(page)
  await page.goto('/')
  await expect(page.getByRole('combobox', { name: 'Open a portal' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Account login', exact: true })).toBeVisible()
  await page.evaluate(() => {
    localStorage.setItem('vortex_member_token', 'member-test-token')
    localStorage.setItem('vortex_member', JSON.stringify({ id: 2, fullName: 'Member', roles: ['MEMBER_ATHLETE'], availablePortals: ['member'] }))
  })
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Open a portal' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Member Portal', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Account login', exact: true })).toHaveCount(0)
})
