import { expect, test } from '@playwright/test'

const crmPath = '/api/admin/new-admin/crm'
const person = {
  id: 10, kind: 'member', name: 'Alex Rivera', email: 'alex@example.test', phone: '555-010-2020',
  age: 39, dateOfBirth: '1987-02-10', familyId: 42, familyName: 'Rivera Family', status: 'inactive',
  enrolled: true, familyActive: true, familyEnrolled: false, leadStatus: null, archived: false, childCount: 1, memberCount: 2, updatedAt: '2026-11-09T12:00:00Z',
}
const family = { ...person, id: 42, kind: 'family', name: 'Rivera Family', age: null, dateOfBirth: null, status: 'active', enrolled: false }
const children = [{ id: 11, name: 'Jordan Rivera', age: 10, dateOfBirth: '2016-06-10', gender: null, isActive: true, isEnrolled: false, archived: false }]

function paged<T>(rows: T[], page = 1, total = rows.length, pageSize = 25) {
  return { rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

test('CRM filters and sorts active status separately from enrollment and opens paginated history on demand', async ({ page }) => {
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
        people: [{ ...person, isActive: false, isEnrolled: true }],
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
  const personRow = workspace.getByRole('table', { name: 'CRM records' }).getByRole('row', { name: /Alex Rivera/ })
  await expect(personRow).toContainText('Inactive')
  await expect(personRow.getByRole('cell').nth(7)).toHaveText('Enrolled')
  await expect(personRow).toContainText('Family active')
  await expect(personRow).toContainText('Family not enrolled')
  await workspace.getByRole('combobox', { name: 'Active status', exact: true }).selectOption('inactive')
  await workspace.getByRole('combobox', { name: 'Enrollment', exact: true }).selectOption('true')
  await workspace.getByRole('combobox', { name: 'Family active status', exact: true }).selectOption('true')
  await workspace.getByRole('combobox', { name: 'Family enrollment', exact: true }).selectOption('false')
  await workspace.getByRole('searchbox', { name: 'Search class history' }).fill('Tumbling')
  await workspace.getByRole('columnheader', { name: 'Enrollment', exact: true }).getByRole('button').click()
  await expect.poll(() => listRequests.at(-1)?.get('sortBy')).toBe('enrolled')
  await workspace.getByRole('columnheader', { name: 'Family enrollment', exact: true }).getByRole('button').click()
  await expect.poll(() => Object.fromEntries(listRequests.at(-1) ?? [])).toMatchObject({
    status: 'inactive', enrolled: 'true', familyActive: 'true', familyEnrolled: 'false', classSearch: 'Tumbling', sortBy: 'familyEnrolled', sortDir: 'asc', page: '1',
  })
  expect(detailRequests).toEqual([])

  await workspace.getByRole('button', { name: 'Next', exact: true }).click()
  await expect.poll(() => listRequests.at(-1)?.get('page')).toBe('2')
  await workspace.getByRole('checkbox', { name: 'Families only' }).check()
  await expect.poll(() => Object.fromEntries(listRequests.at(-1) ?? [])).toMatchObject({ familiesOnly: 'true', page: '1' })
  await workspace.getByRole('button', { name: 'Rivera Family', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Rivera Family' })
  await expect(dialog.getByRole('region', { name: 'Children', exact: true })).toContainText('Age 10')
  await expect(dialog.getByRole('region', { name: 'Children', exact: true })).toContainText('Active')
  await expect(dialog.getByRole('region', { name: 'Children', exact: true })).toContainText('Not enrolled')
  await expect(dialog.getByRole('region', { name: 'Household members', exact: true })).toContainText('Inactive')
  await expect(dialog.getByRole('region', { name: 'Household members', exact: true })).toContainText('Enrolled')
  await expect(dialog.getByRole('region', { name: 'Class history', exact: true })).toContainText('Foundations')
  await expect(dialog.getByRole('region', { name: 'Inquiry history', exact: true })).toContainText('Interested in gymnastics.')
  await dialog.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(dialog.getByRole('region', { name: 'Class history', exact: true })).toContainText('Youth Tumbling')
  expect(detailRequests).toEqual([`${crmPath}/family/42?page=1&pageSize=15`, `${crmPath}/family/42?page=2&pageSize=15`])

  await dialog.getByRole('button', { name: 'Close Rivera Family' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(workspace.getByRole('list', { name: 'CRM records' }).getByRole('button', { name: 'Rivera Family' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('CRM shows each active status and enrollment combination independently', async ({ page }) => {
  const records = [
    { ...person, id: 1, name: 'Member Enrolled', status: 'active', enrolled: true },
    { ...person, id: 2, name: 'Member Waiting', status: 'active', enrolled: false },
    { ...person, id: 3, name: 'Student Without Membership', status: 'inactive', enrolled: true },
    { ...person, id: 4, name: 'Former Student', status: 'inactive', enrolled: false },
  ]
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'crm-test-admin')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', route => {
    const { pathname } = new URL(route.request().url())
    let data: unknown = []
    if (pathname === '/api/admin/access/me') data = { isMasterAdmin: false, permissions: ['members.view'], roles: ['ADMIN'] }
    if (pathname === crmPath) data = paged(records)
    return route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'CRM', exact: true }).click()
  const table = page.getByRole('table', { name: 'CRM records', exact: true })
  for (const record of records) {
    const row = table.getByRole('row').filter({ has: page.getByRole('button', { name: record.name, exact: true }) })
    await expect(row.getByRole('cell').nth(6)).toHaveText(record.status === 'active' ? 'Active' : 'Inactive')
    await expect(row.getByRole('cell').nth(7)).toHaveText(record.enrolled ? 'Enrolled' : 'Not enrolled')
  }
  await expect(page.getByText('Active means a current annual membership or a confirmed or attended paid drop-in in the past two months.', { exact: false })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Active status', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  const cards = page.getByRole('list', { name: 'CRM records', exact: true })
  await expect(cards.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Member Waiting', exact: true }) })).toContainText('Not enrolled')
  await expect(cards.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Student Without Membership', exact: true }) })).toContainText('Inactive')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
