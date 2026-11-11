import { expect, test } from '@playwright/test'

test('class managers can edit classes and create and rename programs from New Admin', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Class Manager', isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  const programs = [{ id: 2, displayName: 'Gymnastics', abridgedName: 'Gym', description: 'Original program', archived: false }]
  const details = { displayName: 'Tumbling', abridgedName: 'Tumble', description: 'Original class', isActive: true }
  await page.route('**/api/**', async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin: false, permissions: ['classes.view', 'classes.manage'], roles: ['ADMIN'], user: { id: 1 } }
    if (path === '/api/admin/new-admin/classes') {
      data = { rows: [{ id: 1, programsId: 2, name: details.displayName, programName: programs[0].displayName, details, isActive: true, capacity: 12, enrolledCount: 0, waitlistCount: 0 }], total: 1, page: 1, pageSize: 25, totalPages: 1 }
    }
    if (path === '/api/admin/programs/1' && req.method() === 'PUT') {
      expect(req.postDataJSON()).toMatchObject({ displayName: 'Advanced Tumbling', description: 'Updated class', abridgedName: 'Tumble', isActive: true })
      Object.assign(details, req.postDataJSON())
    }
    if (path === '/api/admin/programs-top') {
      if (req.method() === 'POST') {
        expect(req.postDataJSON()).toMatchObject({ name: 'Parkour', displayName: 'Parkour', description: 'New program' })
        programs.push({ id: 3, archived: false, ...req.postDataJSON() })
      }
      data = programs
    }
    if (path === '/api/admin/programs-top/2' && req.method() === 'PUT') {
      expect(req.postDataJSON()).toMatchObject({ displayName: 'Gymnastics Academy', description: 'Updated program', abridgedName: 'Gym' })
      Object.assign(programs[0], req.postDataJSON())
    }
    await route.fulfill({ json: { success: true, data } })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Classes & schedules' }).click()
  await page.getByRole('button', { name: 'Edit class: Tumbling' }).click()
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Original class')
  await page.getByLabel('Class or Event Name').fill('Advanced Tumbling')
  await page.getByLabel('Description', { exact: true }).fill('Updated class')
  await page.getByRole('button', { name: 'Update class/event' }).click()
  await expect(page.getByRole('button', { name: 'Edit class: Advanced Tumbling' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit program', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit program' })
  await editor.getByRole('combobox', { name: 'Program' }).selectOption('2')
  await expect(editor.getByLabel('Description')).toHaveValue('Original program')
  await editor.getByLabel('Program name').fill('Gymnastics Academy')
  await editor.getByLabel('Description').fill('Updated program')
  await editor.getByRole('button', { name: 'Save program' }).click()
  await expect(page.getByRole('cell', { name: 'Gymnastics Academy' })).toBeVisible()

  await page.getByRole('button', { name: 'Create program', exact: true }).click()
  const creator = page.getByRole('dialog', { name: 'Create program' })
  await creator.getByLabel('Program name').fill('Parkour')
  await creator.getByLabel('Description').fill('New program')
  await creator.getByRole('button', { name: 'Create program', exact: true }).click()
  await expect(creator).toBeHidden()
  await page.getByRole('button', { name: 'Create class', exact: true }).click()
  await page.getByRole('combobox').filter({ has: page.locator('option[value="3"]') }).selectOption({ label: 'Parkour' })
})
