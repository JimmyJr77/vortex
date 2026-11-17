import { expect, test } from '@playwright/test'

test('class managers can set availability by schedule, edit classes, and manage programs from Admin', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Class Manager', isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  const programs = [{ id: 2, displayName: 'Gymnastics', abridgedName: 'Gym', description: 'Original program', archived: false }]
  const details = { displayName: 'Tumbling', abridgedName: 'Tumble', description: 'Original class', isActive: true }
  const scheduleGroups = [
    {
      id: 10, enrolledCount: 4, capacity: 10, waitlistCount: 2,
      slots: [
        { id: 1, dayOfWeek: 1, startTime: '16:00:00', endTime: '17:00:00', allowDropIns: true, allowFreeTrials: true },
        { id: 2, dayOfWeek: 3, startTime: '18:00:00', endTime: '19:00:00', allowDropIns: true, allowFreeTrials: true },
      ],
    },
    {
      id: 20, enrolledCount: 7, capacity: 8, waitlistCount: 3,
      slots: [{ id: 3, dayOfWeek: 5, startTime: '15:00:00', endTime: '16:00:00', allowDropIns: true, allowFreeTrials: true }],
    },
  ]
  await page.route('**/api/**', async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin: false, permissions: ['classes.view', 'classes.manage'], roles: ['ADMIN'], user: { id: 1 } }
    if (path === '/api/admin/new-admin/classes') {
      data = { rows: [{ id: 1, programsId: 2, name: details.displayName, programName: programs[0].displayName, details, monthlyPriceCents: 12000, costAmountCents: 12000, costUnit: 'per_month', scheduleGroups, schedules: scheduleGroups.flatMap(group => group.slots), isActive: true, capacity: 18, enrolledCount: 11, waitlistCount: 5 }], total: 1, page: 1, pageSize: 25, totalPages: 1 }
    }
    if (path === '/api/admin/new-admin/classes/1' && req.method() === 'PUT') {
      expect(req.postDataJSON()).toMatchObject({ displayName: 'Advanced Tumbling', description: 'Updated class', abridgedName: 'Tumble', isActive: true, monthlyPriceCents: 13500 })
      Object.assign(details, req.postDataJSON())
    }
    if (path === '/api/admin/new-admin/classes/1/drop-ins' && req.method() === 'PATCH') {
      expect(req.postDataJSON()).toEqual({ scope: 'class', timeSlotId: 1, allowFreeTrials: false })
      scheduleGroups[0].slots[0].allowFreeTrials = false
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
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Classes & schedules', exact: true }).click()
  await expect(page.getByRole('columnheader', { name: 'Class Cost' })).toBeVisible()
  await expect(page.getByRole('columnheader')).toHaveText(['Program','Class','Class Cost','Days & times','Enrolled','Capacity','Waitlisted','Status','Actions'])
  for (const [label,key] of [['Program','program'],['Class','class'],['Class Cost','cost'],['Days & times','schedule'],['Enrolled','enrolled'],['Capacity','capacity'],['Waitlisted','waitlisted'],['Status','status']]) {
    const header=page.getByRole('columnheader',{name:label,exact:true})
    const request=page.waitForRequest(req=>new URL(req.url()).pathname==='/api/admin/new-admin/classes' && new URL(req.url()).searchParams.get('sort')===key && new URL(req.url()).searchParams.get('direction')==='asc')
    await header.getByRole('button').click()
    await request
    await expect(header).toHaveAttribute('aria-sort','ascending')
    const reverse=page.waitForRequest(req=>new URL(req.url()).pathname==='/api/admin/new-admin/classes' && new URL(req.url()).searchParams.get('sort')===key && new URL(req.url()).searchParams.get('direction')==='desc')
    await header.getByRole('button').click()
    await reverse
    await expect(header).toHaveAttribute('aria-sort','descending')
  }

  const mondayAndWednesday = page.getByRole('row').filter({ has: page.getByText('Mon · 4:00 PM–5:00 PM', { exact: true }) })
  const friday = page.getByRole('row').filter({ has: page.getByText('Fri · 3:00 PM–4:00 PM', { exact: true }) })
  await expect(mondayAndWednesday.getByText('Wed · 6:00 PM–7:00 PM', { exact: true })).toBeVisible()
  await expect(mondayAndWednesday.getByRole('cell').filter({ hasText: /^\d+$/ })).toHaveText(['4', '10', '2'])
  await expect(friday.getByRole('cell').filter({ hasText: /^\d+$/ })).toHaveText(['7', '8', '3'])
  const mondayAvailability = page.getByRole('button', { name: 'Edit drop-ins and free trials for Tumbling · Mon · 4:00 PM–5:00 PM', exact: true })
  await mondayAvailability.click()
  const availability = page.getByRole('dialog', { name: 'Booking availability' })
  await expect(availability.getByRole('checkbox', { name: 'Allow drop-ins' })).toBeChecked()
  await availability.getByRole('checkbox', { name: 'Allow free trials' }).uncheck()
  await availability.getByRole('button', { name: 'Save availability' }).click()
  await expect(mondayAvailability).toHaveText('Drop-ins: Allowed · Free trials: Blocked')
  await expect(page.getByRole('button', { name: 'Edit drop-ins and free trials for Tumbling · Wed · 6:00 PM–7:00 PM', exact: true })).toHaveText('Drop-ins: Allowed · Free trials: Allowed')
  await page.getByRole('button', { name: 'Edit class: Tumbling' }).click()
  await expect(page.getByLabel('Monthly price ($)', { exact: true })).toHaveValue('120.00')
  await expect(page.getByText('$40.00', { exact: true })).toBeVisible()
  await page.getByLabel('Monthly price ($)', { exact: true }).fill('135')
  await expect(page.getByText('$45.00', { exact: true })).toBeVisible()
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
