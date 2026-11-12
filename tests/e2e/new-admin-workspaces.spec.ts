import { expect, test } from '@playwright/test'

async function setup(page: import('@playwright/test').Page, permissions: string[], isMasterAdmin = false) {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Admin' }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin, permissions, user: { id: 1 } }
    if (path === '/api/admin/class-setup/overview') data = { rows: [] }
    if (path.endsWith('/new-admin/classes')) data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    if (path.endsWith('/timesheets/options')) data = { userId: 1, canViewAll: false, people: [], timezone: 'America/New_York', today: '2026-11-12' }
    if (path.endsWith('/timesheets/week')) data = { week: '2026-11-09', end: '2026-11-15', today: '2026-11-12', userId: 1, people: [], canAssign: false }
    await route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
}

test('new admin exposes migrated workspaces and grouped tabs', async ({ page }) => {
  await setup(page, [], true)
  const navigation = page.getByRole('navigation', { name: 'Admin sections' })
  for (const name of ['Calendar', 'Floor Planner', 'Messages', 'Store', 'Pages & Popups', 'Opportunities', 'Marketing & Visibility', 'Database & Analysis', 'FAQ library', 'Legal', 'Preferences', 'Staff Access', 'Settings']) {
    await expect(navigation.getByRole('button', { name, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: `Open ${name}`, exact: true })).toBeAttached()
  }
  await navigation.getByRole('button', { name: 'Staff Access', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Staff Access', exact: true })).toBeVisible()
  await navigation.getByRole('button', { name: 'Pages & Popups', exact: true }).click()
  const tabs = page.getByRole('navigation', { name: 'Pages & Popups tabs' })
  await expect(tabs.getByRole('button', { name: 'Special Pages', exact: true })).toHaveAttribute('aria-current', 'page')
  await tabs.getByRole('button', { name: 'Events', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Add New Event', exact: true })).toBeVisible()
  await navigation.getByRole('button', { name: 'Legal', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Legal tabs' }).getByRole('button')).toHaveCount(3)
})

test('migrated groups and tabs retain permission boundaries on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page, ['schools.view'])
  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  const navigation = page.getByRole('navigation', { name: 'Admin sections' })
  await expect(navigation.getByRole('button', { name: 'Settings', exact: true })).toHaveCount(0)
  await expect(navigation.getByRole('button', { name: 'Staff Access', exact: true })).toHaveCount(0)
  await expect(navigation.getByRole('button', { name: 'Calendar', exact: true })).toHaveCount(0)
  await navigation.getByRole('button', { name: 'Database & Analysis', exact: true }).click()
  await expect(navigation).toBeHidden()
  await expect(page.getByRole('heading', { name: /Schools/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Database Queries', exact: true })).toHaveCount(0)
})


test('Class Master and Coach Assignments open in their Admin sections', async ({ page }) => {
  await setup(page, ['classes.view', 'classes.manage'])
  await page.getByRole('button', { name: 'Open Classes & schedules', exact: true }).click()
  await page.getByRole('navigation', { name: 'Classes & schedules tabs' }).getByRole('button', { name: 'Class Master', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Class Master', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Timesheets', exact: true }).click()
  await page.getByRole('navigation', { name: 'Timesheets tabs' }).getByRole('button', { name: 'Coach Assignments', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Coach Management', exact: true })).toBeVisible()
})

test('staff without class management permission cannot open Coach Assignments', async ({ page }) => {
  await setup(page, [])
  await page.getByRole('button', { name: 'Open Timesheets', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Timesheets', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Coach Assignments', exact: true })).toHaveCount(0)
})
