import { expect, test, type Page } from '@playwright/test'
import type { ClassSetupOverviewRow } from '../../src/utils/classSetupOverviewApi'

async function setupClasses(page: Page, archivedProgram = false) {
  const writes: Array<{ path: string; body: unknown }> = []
  const program = { id: 1, displayName: 'Gymnastics', archived: archivedProgram }
  const klass = { id: 2, formId: 3, programsId: 1, name: 'Foundations', programName: 'Gymnastics', isActive: true, enrolledCount: 0, capacity: 10, waitlistCount: 0, details: {} }
  const inactive = { ...klass, id: 3, formId: 4, name: 'Inactive class', programsId: 2, programName: 'General Gymnastics', isActive: false, archived: false }
  const archivedProgramClass = { ...klass, id: 4, formId: 5, name: 'Class in archived program', programsId: 5, programName: 'Seasonal program', archived: true }
  const active = { ...inactive, id: 5, formId: 6, name: 'Active class', isActive: true }
  const overviewClass: ClassSetupOverviewRow = {
    classId: klass.id, className: klass.name, classDescription: null, classNotes: null, skillLevel: null,
    classIsActive: true, classArchived: false, programsId: program.id, programName: program.displayName,
    programDescription: null, programArchived: false, programIsActive: true,
    excludeFromDropIns: false, primarySportId: null, primarySportName: null, sportTags: '', sportTagIds: [],
    formId: klass.formId, formActive: true, pricingOverridesProgram: false, offerings: [], slotGroups: [],
    enrolleeCount: 0, status: 'Active', costPerClass: null, fee1x: null, costPerMonthSummary: null, pricingCostOptions: [],
  }
  let archivedClass = false
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'fixture')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, isMaster: true }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', async route => {
    const request = route.request()
    const { pathname: path, searchParams } = new URL(request.url())
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin: true, permissions: [], roles: ['ADMIN'], user: { id: 1 } }
    if (path.startsWith('/api/admin/accounting/')) data = { rows: [], members: [], classes: [], total: 0, page: 1, pageSize: 25, totalPages: 1, summary: {}, timezone: 'America/New_York' }
    if (path === '/api/admin/new-admin/classes') {
      const rows = [{ ...klass, archived: archivedClass || program.archived, isActive: !archivedClass }, active, inactive, archivedProgramClass]
        .filter(row => searchParams.get('includeArchived') === 'true' || !row.archived)
      data = { rows, total: rows.length, page: 1, pageSize: 25, totalPages: 1 }
    }
    if (path === '/api/admin/new-admin/classes/2/roster') data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    if (path === '/api/admin/new-admin/classes/2') data = { class: klass, groups: [], roster: { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 1 } }
    if (path === '/api/admin/class-setup/overview') {
      const rows: ClassSetupOverviewRow[] = [
        {
          ...overviewClass, classArchived: archivedClass, programArchived: program.archived,
          classIsActive: !archivedClass, programIsActive: !program.archived, status: archivedClass || program.archived ? 'Legacy' : 'Active',
        },
        {
          ...overviewClass, classId: active.id, className: active.name, formId: active.formId,
          programsId: active.programsId, programName: active.programName,
        },
        {
          ...overviewClass, classId: inactive.id, className: inactive.name, formId: inactive.formId,
          programsId: inactive.programsId, programName: inactive.programName, classIsActive: false, status: 'Inactive',
        },
        {
          ...overviewClass, classId: archivedProgramClass.id, className: archivedProgramClass.name, formId: archivedProgramClass.formId,
          programsId: archivedProgramClass.programsId, programName: archivedProgramClass.programName, programArchived: true, programIsActive: false, status: 'Legacy',
        },
      ]
      data = { rows }
    }
    if (path === '/api/admin/programs-top') data = [program]
    if (path.endsWith('/archive') && request.method() === 'PATCH') {
      writes.push({ path, body: request.postDataJSON() })
      if (path === '/api/admin/programs/2/archive') archivedClass = true
      if (path === '/api/admin/programs-top/1/archive') program.archived = request.postDataJSON().archived
    }
    await route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Classes & schedules', exact: true }).click()
  return writes
}

async function openProgram(page: Page) {
  await page.getByRole('button', { name: 'Edit program', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Edit program', exact: true })
  await editor.getByRole('combobox', { name: 'Program', exact: true }).selectOption('1')
  return editor
}

const confirmation = (page: Page) => page.getByRole('dialog', { name: 'Archive item', exact: true })

test('archive requires exact uppercase confirmation and cancellation makes no request', async ({ page }) => {
  const writes = await setupClasses(page)
  const editor = await openProgram(page)
  await editor.getByRole('button', { name: 'Archive program', exact: true }).click()
  const popup = confirmation(page)
  const input = popup.getByLabel('Type ARCHIVE to confirm')
  const archive = popup.getByRole('button', { name: 'Archive', exact: true })
  await expect(popup).toContainText('Gymnastics')
  await expect(popup).toContainText('will be archived and will no longer be accessible for use')
  await expect(input).toBeFocused()
  await expect(archive).toBeDisabled()
  for (const value of ['archive', 'ARCHIV', ' ARCHIVE ', 'ARCHIVE!']) {
    await input.fill(value)
    await expect(archive).toBeDisabled()
    await input.press('Enter')
    await expect(popup).toBeVisible()
    expect(writes).toEqual([])
  }
  await input.fill('ARCHIVE')
  await expect(archive).toBeEnabled()
  await popup.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(popup).toBeHidden()
  await expect(editor).toBeVisible()
  expect(writes).toEqual([])

  await editor.getByRole('button', { name: 'Archive program', exact: true }).click()
  await expect(input).toHaveValue('')
  await input.fill('ARCHIVE')
  await input.press('Enter')
  await expect(editor).toBeHidden()
  expect(writes).toEqual([{ path: '/api/admin/programs-top/1/archive', body: { archived: true } }])
})

test('Escape and close cancel only the archive popup and restore focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const writes = await setupClasses(page)
  const editor = await openProgram(page)
  const trigger = editor.getByRole('button', { name: 'Archive program', exact: true })
  await trigger.click()
  const popup = confirmation(page)
  await popup.getByLabel('Type ARCHIVE to confirm').fill('ARCHIVE')
  await page.keyboard.press('Tab')
  await expect(popup.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(popup.getByRole('button', { name: 'Archive', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(popup.getByRole('button', { name: 'Close archive confirmation' })).toBeFocused()
  await popup.screenshot({ path: test.info().outputPath('archive-confirmation-mobile.png') })
  await page.keyboard.press('Escape')
  await expect(popup).toBeHidden()
  await expect(editor).toBeVisible()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(popup.getByLabel('Type ARCHIVE to confirm')).toHaveValue('')
  await popup.getByRole('button', { name: 'Close archive confirmation' }).click()
  await expect(popup).toBeHidden()
  await expect(editor).toBeVisible()
  expect(writes).toEqual([])
})

test('class archiving waits for confirmation and both tabs share archive visibility', async ({ page }) => {
  const writes = await setupClasses(page)
  await page.getByRole('button', { name: 'Foundations', exact: true }).click()
  await page.getByRole('button', { name: 'Archive class', exact: true }).click()
  const popup = confirmation(page)
  await expect(popup).toContainText('Foundations')
  expect(writes).toEqual([])
  await popup.getByLabel('Type ARCHIVE to confirm').fill('ARCHIVE')
  await popup.getByRole('button', { name: 'Archive', exact: true }).click()
  const listClass = page.getByRole('button', { name: 'Foundations', exact: true })
  const listActive = page.getByRole('button', { name: 'Active class', exact: true })
  const listInactive = page.getByRole('button', { name: 'Inactive class', exact: true })
  const listArchivedProgramClass = page.getByRole('button', { name: 'Class in archived program', exact: true })
  await expect(listActive).toBeVisible()
  await expect(listInactive).toBeVisible()
  await expect(listClass).toHaveCount(0)
  await expect(listArchivedProgramClass).toHaveCount(0)

  const tabs = page.getByRole('navigation', { name: 'Classes & schedules tabs' })
  const classMasterTab = tabs.getByRole('button', { name: 'Class Master', exact: true })
  const schedulesTab = tabs.getByRole('button', { name: 'Classes & schedules', exact: true })
  await classMasterTab.click()
  const archived = page.getByRole('cell', { name: 'Foundations', exact: true })
  const archivedProgramClass = page.getByRole('cell', { name: 'Class in archived program', exact: true })
  const active = page.getByRole('cell', { name: 'Active class', exact: true })
  const inactive = page.getByRole('cell', { name: 'Inactive class', exact: true })
  const showArchived = page.getByRole('button', { name: 'Show archived', exact: true })
  const hideArchived = page.getByRole('button', { name: 'Hide archived', exact: true })
  await expect(active).toBeVisible()
  await expect(inactive).toBeVisible()
  await expect(archived).toHaveCount(0)
  await expect(archivedProgramClass).toHaveCount(0)
  await showArchived.click()
  await expect(archived).toBeVisible()
  await expect(archivedProgramClass).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Archived', exact: true })).toHaveCount(2)
  await expect(active).toBeVisible()
  await expect(inactive).toBeVisible()

  await schedulesTab.click()
  await expect(hideArchived).toBeVisible()
  await expect(listClass).toBeVisible()
  await expect(listArchivedProgramClass).toBeVisible()
  await expect(page.getByRole('cell', { name: 'archived', exact: true })).toHaveCount(2)
  await expect(listActive).toBeVisible()
  await expect(listInactive).toBeVisible()
  await hideArchived.click()
  await expect(listClass).toHaveCount(0)
  await expect(listArchivedProgramClass).toHaveCount(0)
  await expect(listInactive).toBeVisible()

  await classMasterTab.click()
  await expect(showArchived).toBeVisible()
  await expect(inactive).toBeVisible()
  await expect(archived).toHaveCount(0)
  await expect(archivedProgramClass).toHaveCount(0)
  expect(writes).toEqual([{ path: '/api/admin/programs/2/archive', body: { archived: true } }])
})

test('restoring a program does not ask for archive confirmation', async ({ page }) => {
  const writes = await setupClasses(page, true)
  const editor = await openProgram(page)
  await editor.getByRole('button', { name: 'Restore program', exact: true }).click()
  await expect(editor).toBeHidden()
  await expect(confirmation(page)).toBeHidden()
  expect(writes).toEqual([{ path: '/api/admin/programs-top/1/archive', body: { archived: false } }])
})

for (const role of ['admin', 'coach'] as const) {
  test(`${role} accounts require confirmation to archive, but not to restore`, async ({ page }) => {
    const changes: boolean[] = []
    let active = true
    await page.route('**/api/**', async route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      let data: unknown = []
      if (path === '/api/admin/admins') data = [{ id: 2, firstName: 'Test', lastName: 'Admin', email: 'admin@example.test', username: 'testadmin', isMaster: false, isActive: active }]
      if (path === '/api/admin/coaches') data = [{ id: 2, full_name: 'Test Coach', coach_active: true, account_active: active, assignments: [] }]
      if (path === '/api/admin/coaches/options') data = { users: [] }
      if (path === '/api/admin/access/users/2/active' && request.method() === 'PATCH') {
        active = request.postDataJSON().isActive
        changes.push(active)
      }
      await route.fulfill({ json: { success: true, data } })
    })
    await page.goto(`/tests/fixtures/archive-actions.html?scenario=${role === 'coach' ? 'coaches' : 'admins'}`)
    await page.getByTitle(`Archive ${role}`, { exact: true }).click()
    const popup = confirmation(page)
    await expect(popup).toContainText('They will lose login access.')
    expect(changes).toEqual([])
    await popup.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(changes).toEqual([])
    await page.getByTitle(`Archive ${role}`, { exact: true }).click()
    await popup.getByLabel('Type ARCHIVE to confirm').fill('ARCHIVE')
    await popup.getByRole('button', { name: 'Archive', exact: true }).click()
    const restore = page.getByTitle(`Unarchive ${role}`, { exact: true })
    await expect(restore).toBeVisible()
    expect(changes).toEqual([false])
    await restore.click()
    await expect(page.getByTitle(`Archive ${role}`, { exact: true })).toBeVisible()
    await expect(popup).toBeHidden()
    expect(changes).toEqual([false, true])
  })
}

test('inbox archiving explains its scope and waits for confirmation', async ({ page }) => {
  let writes = 0
  await page.route('**/api/**', async route => {
    if (route.request().method() === 'POST') writes++
    await route.fulfill({ json: { success: true, data: [] } })
  })
  await page.goto('/tests/fixtures/archive-actions.html?scenario=messages')
  await page.getByRole('button', { name: 'Thread options' }).click()
  await page.getByRole('button', { name: 'Archive from inbox' }).click()
  const popup = confirmation(page)
  await expect(popup).toContainText('Other participants will retain access.')
  expect(writes).toBe(0)
  await popup.getByLabel('Type ARCHIVE to confirm').fill('ARCHIVE')
  await popup.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect.poll(() => writes).toBe(1)
})

test('saved evaluation forms cannot be archived in local storage without confirmation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vortex_eval_templates', JSON.stringify([{ id: 'test-form', name: 'Test evaluation', cards: [] }])))
  await page.route('**/api/**', route => route.fulfill({ json: { success: true, data: [] } }))
  await page.goto('/tests/fixtures/archive-actions.html?scenario=evaluation')
  await page.getByRole('button', { name: 'Saved evaluation forms', exact: true }).click()
  await page.getByRole('button', { name: 'Archive Test evaluation', exact: true }).click()
  const popup = confirmation(page)
  const readTemplate = () => page.evaluate(() => JSON.parse(localStorage.getItem('vortex_eval_templates')!)[0])
  await popup.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await readTemplate()).archived).toBeUndefined()
  await page.getByRole('button', { name: 'Archive Test evaluation', exact: true }).click()
  await popup.getByLabel('Type ARCHIVE to confirm').fill('ARCHIVE')
  await popup.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Archive Test evaluation', exact: true })).toBeHidden()
  expect((await readTemplate()).archived).toBe(true)
})
