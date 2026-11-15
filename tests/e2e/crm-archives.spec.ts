import { expect, test } from '@playwright/test'

test('lead and member directories share archived CRM with restore and guarded deletion', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  let restored = false
  let deleted = false
  let blocked = true
  let deletes = 0
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'fixture')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    let data: unknown = []
    const paged = (rows: unknown[]) => ({ rows, total: rows.length, page: 1, pageSize: 25, totalPages: rows.length ? 1 : 0 })
    if (path === '/api/admin/access/me') data = { isMasterAdmin: false, permissions: ['members.view', 'accounts.lifecycle'], user: { id: 1 } }
    if (path === '/api/admin/notifications') data = { notifications: [], unreadCount: 0 }
    if (path === '/api/admin/new-admin/leads') {
      expect(url.searchParams.get('archived')).toBe('false')
      data = paged(restored ? [{ id: 7, firstName: 'Archived', lastName: 'Lead', email: 'lead@example.test', status: 'new', archived: false, contacted: false, followUp: false }] : [])
    }
    if (path === '/api/admin/new-admin/families') data = paged([])
    if (path === '/api/admin/new-admin/crm') {
      expect(url.searchParams.get('record')).toBe('archived')
      expect(url.searchParams.get('source')).toBe('member,lead')
      const rows = [
        ...(!restored ? [{ id: 7, kind: 'lead', name: 'Archived Lead', email: 'lead@example.test' }] : []),
        ...(!deleted ? [{ id: 8, kind: 'member', name: 'Archived Member', email: 'member@example.test', familyName: 'Example Family' }] : []),
      ].filter(row => row.name.toLowerCase().includes((url.searchParams.get('search') || '').toLowerCase()))
      data = paged(rows)
    }
    if (path === '/api/admin/new-admin/leads/7/archive') {
      expect(route.request().postDataJSON()).toEqual({ archived: false })
      restored = true
    }
    if (path === '/api/admin/members/8' && route.request().method() === 'DELETE') {
      deletes++
      if (blocked) return route.fulfill({ status: 409, json: { success: false, blockers: [{ message: 'Billing history prevents deletion.' }] } })
      deleted = true
    }
    return route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Leads', exact: true }).click()
  await expect(page.getByLabel('Show archived leads')).toHaveCount(0)
  await page.getByRole('button', { name: 'View Archives', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Archived CRM' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Archived CRM records' })).toContainText('Archived Lead')
  await expect(page.getByRole('table')).toContainText('Archived Member')
  await page.getByRole('searchbox', { name: 'Search archives' }).fill('Lead')
  await expect(page.getByText('Archived Member', { exact: true })).toHaveCount(0)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Restore Archived Lead', exact: true }).click()
  await expect(page.getByText('No archived people or leads match your search.')).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Archived Lead', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Members & accounts', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Archived logins', exact: true })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Records', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'View Archives', exact: true }).click()
  const remove = page.getByRole('button', { name: 'Permanently delete Archived Member', exact: true })
  await remove.click()
  const dialog = page.getByRole('dialog', { name: 'Delete permanently', exact: true })
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  expect(deletes).toBe(0)
  for (const succeeds of [false, true]) {
    blocked = !succeeds
    await remove.click()
    await dialog.getByLabel('Type DELETE to confirm').fill('DELETE')
    await dialog.getByRole('button', { name: 'Delete permanently', exact: true }).click()
    if (!succeeds) await expect(page.getByRole('alert')).toContainText('Billing history prevents deletion.')
  }
  await expect(page.getByText('No archived people or leads match your search.')).toBeVisible()
  expect(deletes).toBe(2)
  expect(errors).toEqual([])
})
