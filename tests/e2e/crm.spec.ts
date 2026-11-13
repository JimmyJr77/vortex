import { expect, test } from '@playwright/test'

const crmPath = '/api/admin/new-admin/crm'
const person = {
  id: 10, kind: 'member', name: 'Alex Rivera', email: 'alex@example.test', phone: '555-010-2020',
  age: 39, dateOfBirth: '1987-02-10', familyId: 42, familyName: 'Rivera Family', status: 'inactive',
  familyActive: true, leadStatus: null, archived: false, childCount: 1, memberCount: 2, updatedAt: '2026-11-09T12:00:00Z',
}
const family = { ...person, id: 42, kind: 'family', name: 'Rivera Family', age: null, dateOfBirth: null, status: 'active' }
const children = [{ id: 11, name: 'Jordan Rivera', age: 10, dateOfBirth: '2016-06-10', gender: null }]

function paged<T>(rows: T[], page = 1, total = rows.length, pageSize = 25) {
  return { rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

test('CRM filters and sorts activity on the server and opens paginated history on demand', async ({ page }) => {
  const listRequests: URLSearchParams[] = []
  const detailRequests: string[] = []
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'crm-test-admin')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', route => {
    const { pathname, searchParams } = new URL(route.request().url())
    let data: unknown = []
    if (pathname === '/api/admin/access/me') data = { isMasterAdmin: false, permissions: ['members.view'], roles: ['ADMIN'] }
    if (pathname === crmPath) {
      listRequests.push(searchParams)
      const pageNumber = Number(searchParams.get('page'))
      data = paged([searchParams.get('familiesOnly') === 'true' ? family : person], pageNumber, 51)
    }
    if (pathname.startsWith(`${crmPath}/`)) {
      const pageNumber = Number(searchParams.get('page'))
      detailRequests.push(`${pathname}?${searchParams}`)
      data = {
        person: family,
        children,
        people: [{ ...person, isActive: true }],
        classes: paged([{ key: `class-${pageNumber}`, memberName: 'Jordan Rivera', className: pageNumber === 1 ? 'Foundations' : 'Youth Tumbling',
          programName: 'Gymnastics', status: 'completed', startDate: '2026-01-05', endDate: '2026-08-31', source: 'Vortex' }], pageNumber, 16, 15),
        inquiries: [{ id: 5, firstName: 'Alex', lastName: 'Rivera', status: 'converted', message: 'Interested in gymnastics.', notes: null, createdAt: '2025-12-08' }],
      }
    }
    return route.fulfill({ json: { success: true, data } })
  })

  await page.goto('/')
  const navigation = page.getByRole('navigation', { name: 'Admin sections' })
  const crm = navigation.getByRole('button', { name: 'CRM', exact: true })
  await expect(crm).toBeVisible()
  const names = await navigation.getByRole('button').allTextContents()
  expect(names[names.indexOf('Leads') + 1]).toBe('CRM')
  await crm.click()
  const workspace = page.getByRole('region', { name: 'CRM', exact: true })
  await expect(workspace.getByRole('table', { name: 'CRM records' }).getByRole('row', { name: /Alex Rivera/ })).toContainText(/inactive.*family active/i)
  await workspace.getByRole('combobox', { name: 'Activity', exact: true }).selectOption('inactive')
  await workspace.getByRole('combobox', { name: 'Family activity', exact: true }).selectOption('true')
  await workspace.getByRole('searchbox', { name: 'Search class history' }).fill('Tumbling')
  await workspace.getByRole('columnheader', { name: 'Family activity' }).getByRole('button').click()
  await expect.poll(() => Object.fromEntries(listRequests.at(-1) ?? [])).toMatchObject({
    status: 'inactive', familyActive: 'true', classSearch: 'Tumbling', sortBy: 'familyActive', sortDir: 'asc', page: '1',
  })
  expect(detailRequests).toEqual([])

  await workspace.getByRole('button', { name: 'Next', exact: true }).click()
  await expect.poll(() => listRequests.at(-1)?.get('page')).toBe('2')
  await workspace.getByRole('checkbox', { name: 'Families only' }).check()
  await expect.poll(() => Object.fromEntries(listRequests.at(-1) ?? [])).toMatchObject({ familiesOnly: 'true', page: '1' })
  await workspace.getByRole('button', { name: 'Rivera Family', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Rivera Family' })
  await expect(dialog.getByRole('region', { name: 'Children', exact: true })).toContainText('Age 10')
  await expect(dialog.getByRole('region', { name: 'Class history', exact: true })).toContainText('Foundations')
  await expect(dialog.getByRole('region', { name: 'Lead history', exact: true })).toContainText('Interested in gymnastics.')
  await dialog.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(dialog.getByRole('region', { name: 'Class history', exact: true })).toContainText('Youth Tumbling')
  expect(detailRequests).toEqual([`${crmPath}/family/42?page=1&pageSize=15`, `${crmPath}/family/42?page=2&pageSize=15`])

  await dialog.getByRole('button', { name: 'Close Rivera Family' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(workspace.getByRole('list', { name: 'CRM records' }).getByRole('button', { name: 'Rivera Family' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
