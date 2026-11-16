import { expect, test } from '@playwright/test'

async function adminLeadPage(page: import('@playwright/test').Page) {
  const submitted: Record<string, unknown>[] = []
  const leads: Record<string, unknown>[] = []
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'fixture')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin: false, permissions: ['members.view', 'members.edit'], roles: ['ADMIN'], user: { id: 1, fullName: 'Alex Coach', email: 'coach@example.test' } }
    if (path.endsWith('/families') || path.endsWith('/leads')) data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 1 }
    if (path.endsWith('/leads')) data = { rows: leads, total: leads.length, page: 1, pageSize: 25, totalPages: 1 }
    if (path.endsWith('/leads') && route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      submitted.push(body)
      const lead = { ...body, id: 50, status: 'new', createdAt: '2026-11-15T12:00:00Z', contacted: false, followUp: false, inquiry: { ...body.inquiry, submittedBy: { userId: 1, name: 'Alex Coach' } } }
      leads.push(lead)
      data = lead
    }
    await route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Leads', exact: true }).click()
  await page.getByRole('button', { name: 'Add lead', exact: true }).click()
  return { dialog: page.getByRole('dialog', { name: 'Add lead', exact: true }), submitted }
}

test('admin can save a completely blank lead and submitted-by comes from signed-in staff', async ({ page }) => {
  const { dialog, submitted } = await adminLeadPage(page)
  await expect(dialog.getByLabel('Submitted by', { exact: true })).toHaveValue('Alex Coach')
  await expect(dialog.getByLabel('Submitted by', { exact: true })).toHaveAttribute('readonly', '')
  await dialog.getByRole('button', { name: 'Save lead', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(submitted).toHaveLength(1)
  expect(submitted[0]).toMatchObject({ firstName: '', lastName: '', email: '', phone: '', inquiry: { submitterRole: '', interests: [], classTypes: [], campers: [], newsletter: true } })
  expect(submitted[0]).not.toHaveProperty('submittedBy')
  expect(submitted[0].inquiry).not.toHaveProperty('submittedBy')
  await expect(page.getByRole('button', { name: 'Lead #50', exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Contacted Lead #50', exact: true })).toBeVisible()
})

test('admin lead saves supplied athlete details and inquiry preferences', async ({ page }) => {
  const { dialog, submitted } = await adminLeadPage(page)
  await dialog.getByRole('textbox', { name: 'Email', exact: true }).fill('parent@example.test')
  await dialog.getByRole('textbox', { name: 'First name', exact: true }).fill('Jordan')
  await dialog.getByRole('radio', { name: 'Parent/Guardian', exact: true }).check()
  await dialog.getByRole('checkbox', { name: 'Strength & Explosiveness', exact: true }).check()
  await dialog.getByRole('checkbox', { name: 'Gymnastics', exact: true }).check()
  await dialog.getByRole('checkbox', { name: 'Tumbling & Trampoline', exact: true }).check()
  await expect(dialog.getByRole('checkbox', { name: 'Mutli-Sport Athleticism Training', exact: true })).toBeVisible()
  await expect(dialog.getByRole('group', { name: 'Training Interests', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('group', { name: 'Sport Interests', exact: true })).toHaveCount(0)
  await dialog.getByRole('checkbox', { name: 'Youth Classes', exact: true }).check()
  await dialog.getByRole('checkbox', { name: 'Camps', exact: true }).check()
  await dialog.getByRole('button', { name: 'Add athlete', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Phone', exact: true }).fill('2025550101')
  await dialog.getByLabel('Athlete 1 date of birth', { exact: true }).fill('2018-04-05')
  await dialog.getByLabel('Athlete 1 gender', { exact: true }).selectOption('male')
  await dialog.getByRole('button', { name: 'Add athlete', exact: true }).click()
  await dialog.getByLabel('Athlete 2 gender', { exact: true }).selectOption('female')
  await dialog.getByLabel('Athlete 2 date of birth', { exact: true }).fill('2020-06-07')
  await expect(dialog.getByLabel('Athlete 1 first name', { exact: true })).not.toHaveAttribute('required')
  await expect(dialog.getByLabel('Athlete 2 last name', { exact: true })).not.toHaveAttribute('required')
  await dialog.getByLabel('Leave a comment or ask any questions').fill('Interested in an afternoon class.')
  await expect(dialog.getByRole('checkbox', { name: /The contact would like to receive/ })).toBeChecked()
  await dialog.getByRole('button', { name: 'Save lead', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(submitted[0]).toMatchObject({ firstName: 'Jordan', lastName: '', message: 'Interested in an afternoon class.', inquiry: { submitterRole: 'Parent/Guardian', interests: ['Strength & Explosiveness', 'Gymnastics', 'Tumbling & Trampoline'], classTypes: ['Youth Classes', 'Camps'], campers: [{ dateOfBirth: '2018-04-05', gender: 'male' }, { dateOfBirth: '2020-06-07', gender: 'female' }], newsletter: true } })
})

test('admin can save partial athletes without email, phone, birthdays or genders', async ({ page }) => {
  const { dialog, submitted } = await adminLeadPage(page)
  await dialog.getByRole('button', { name: 'Add athlete', exact: true }).click()
  await dialog.getByLabel('Athlete 1 first name', { exact: true }).fill('Taylor')
  await dialog.getByRole('button', { name: 'Add athlete', exact: true }).click()
  await expect(dialog.locator('[required]')).toHaveCount(0)
  await expect(dialog.getByRole('checkbox', { name: /The contact would like to receive/ })).toBeChecked()
  await dialog.getByRole('button', { name: 'Save lead', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(submitted).toHaveLength(1)
  expect(submitted[0]).toMatchObject({ email: '', phone: '', inquiry: { campers: [{ firstName: 'Taylor' }, {}], newsletter: true } })
  await expect(page.getByRole('button', { name: 'Lead #50', exact: true })).toBeVisible()
})
