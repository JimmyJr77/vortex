import { expect, test, type Page } from '@playwright/test'
import type { ClassSetupOverviewRow, ClassSetupSlotGroup } from '../../src/utils/classSetupOverviewApi'

type Scope = 'class' | 'matching' | 'program'
type DropInChange = { allowDropIns: boolean; scope: Scope; timeSlotId?: number }
type ScheduleLine = { timeSlotId: number; isActive: boolean; scheduleLabel: string; excludeFromDropIns: boolean }
type FixtureRow = ClassSetupOverviewRow & { slotGroups: Array<ClassSetupSlotGroup & { scheduleLines: ScheduleLine[] }> }
type Write = { path: string; method: string; body: DropInChange }

function classRow(classId: number, className: string, programsId: number, slots: Array<[number, string]>): FixtureRow {
  const scheduleLines = slots.map(([timeSlotId, day]) => ({
    timeSlotId, isActive: true, scheduleLabel: `${day} · 16:00–17:00`, excludeFromDropIns: false,
  }))
  return {
    classId, className, programsId, programName: programsId === 20 ? 'Gymnastics' : 'Other program',
    classDescription: null, classNotes: null, skillLevel: null, classIsActive: true, classArchived: false,
    programDescription: null, programArchived: false, programIsActive: true, excludeFromDropIns: false,
    primarySportId: null, primarySportName: null, sportTags: '', sportTagIds: [],
    formId: classId + 100, formActive: true, pricingOverridesProgram: true, offerings: [],
    slotGroups: [{
      slotGroupId: classId + 200, formId: classId + 100, offeringId: null, maxParticipants: 10,
      signupCount: 0, datesTbd: true, scheduleLabel: scheduleLines.map(line => line.scheduleLabel).join('; '), scheduleLines,
    }],
    enrolleeCount: 0, status: 'Active', costPerClass: null, fee1x: null,
    costPerMonthSummary: '$120.00/mo', pricingCostOptions: [], effectiveCostAmountCents: 12000, effectiveCostUnit: 'per_month',
  }
}

async function setup(page: Page, { rejectSave = false } = {}) {
  const rows: FixtureRow[] = [
    classRow(10, 'Foundations', 20, [[101, 'Monday'], [102, 'Wednesday']]),
    classRow(11, 'Foundations', 20, [[103, 'Saturday']]),
    classRow(12, 'Advanced', 20, [[104, 'Friday']]),
    classRow(13, 'Foundations', 21, [[105, 'Sunday']]),
  ]
  const writes: Write[] = []
  const nativeDialogs: string[] = []
  page.on('dialog', async dialog => {
    nativeDialogs.push(dialog.message())
    await dialog.dismiss()
  })
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'class-master-drop-ins-fixture')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Class manager', isMaster: true }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin: true, permissions: [], roles: ['ADMIN'], user: { id: 1 } }
    if (path === '/api/admin/new-admin/classes') data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    if (path === '/api/admin/class-setup/overview') data = { rows }
    if (path.startsWith('/api/admin/') && request.method() !== 'GET') {
      writes.push({ path, method: request.method(), body: request.postDataJSON() })
      if (path === '/api/admin/new-admin/classes/10/drop-ins' && request.method() === 'PATCH') {
        if (rejectSave) {
          await route.fulfill({ status: 409, json: { success: false, message: 'The schedule changed. Refresh and try again.' } })
          return
        }
        const change = request.postDataJSON() as DropInChange
        const source = rows[0]
        for (const row of rows) {
          const isTarget = change.scope === 'class' ? row.classId === source.classId
            : row.programsId === source.programsId && (change.scope === 'program' || row.className === source.className)
          if (!isTarget) continue
          for (const group of row.slotGroups) {
            for (const line of group.scheduleLines) {
              if (change.scope !== 'class' || line.timeSlotId === change.timeSlotId) line.excludeFromDropIns = !change.allowDropIns
            }
          }
        }
        data = { updated: true }
      }
    }
    await route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Classes & schedules', exact: true }).click()
  await page.getByRole('navigation', { name: 'Classes & schedules tabs' }).getByRole('button', { name: 'Class Master', exact: true }).click()
  await page.getByRole('button', { name: 'Locked', exact: true }).click()
  return { writes, nativeDialogs }
}

function dropInCell(page: Page, classId: number, day: string) {
  const row = page.getByRole('row', { name: new RegExp(`^${classId} `) })
    .filter({ has: page.getByRole('cell', { name: day, exact: true }) })
  return row.getByRole('cell').nth(13)
}

async function openEditor(page: Page) {
  await dropInCell(page, 10, 'Monday').click()
  const editor = page.locator('.portal-dialog').filter({ has: page.getByRole('heading', { name: 'Edit Allow Drop-ins', exact: true }) })
  await expect(editor).toBeVisible()
  return editor
}

for (const scenario of [
  { scope: 'class', label: 'Just this class', excluded: ['Monday'] },
  { scope: 'matching', label: 'All matching classes', excluded: ['Monday', 'Wednesday', 'Saturday'] },
  { scope: 'program', label: 'All classes in this program', excluded: ['Monday', 'Wednesday', 'Saturday', 'Friday'] },
] as const) {
  test(`Allow Drop-ins saves ${scenario.label.toLowerCase()} without changing another program`, async ({ page }) => {
    const { writes, nativeDialogs } = await setup(page)
    const editor = await openEditor(page)
    const scope = editor.getByRole('combobox', { name: 'Apply change to', exact: true })
    await expect(scope).toHaveValue('class')
    await expect(scope.locator('option')).toHaveText(['Just this class', 'All matching classes', 'All classes in this program'])
    if (scenario.scope !== 'class') await scope.selectOption({ label: scenario.label })
    await editor.getByRole('checkbox', { name: /^Allow Drop-ins/ }).uncheck()
    await editor.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(editor).toBeHidden()
    expect(writes).toEqual([{
      path: '/api/admin/new-admin/classes/10/drop-ins', method: 'PATCH',
      body: { allowDropIns: false, scope: scenario.scope, timeSlotId: 101 },
    }])
    expect(nativeDialogs).toEqual([])
    for (const [classId, day] of [[10, 'Monday'], [10, 'Wednesday'], [11, 'Saturday'], [12, 'Friday'], [13, 'Sunday']] as const) {
      await expect(dropInCell(page, classId, day)).toHaveText(scenario.excluded.some(excluded => excluded === day) ? 'No' : 'Yes')
    }
  })
}

test('cancelling a broad Drop-ins edit writes nothing and reopening defaults to this class', async ({ page }) => {
  const { writes } = await setup(page)
  let editor = await openEditor(page)
  await editor.getByRole('combobox', { name: 'Apply change to', exact: true }).selectOption('program')
  await editor.getByRole('checkbox', { name: /^Allow Drop-ins/ }).uncheck()
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(editor).toBeHidden()
  expect(writes).toEqual([])
  editor = await openEditor(page)
  await expect(editor.getByRole('combobox', { name: 'Apply change to', exact: true })).toHaveValue('class')
  await expect(editor.getByRole('checkbox', { name: /^Allow Drop-ins/ })).toBeChecked()
  await expect(dropInCell(page, 10, 'Monday')).toHaveText('Yes')
})

test('a failed scoped Drop-ins save keeps the selection and existing schedule values', async ({ page }) => {
  const { writes } = await setup(page, { rejectSave: true })
  const editor = await openEditor(page)
  await editor.getByRole('combobox', { name: 'Apply change to', exact: true }).selectOption('matching')
  await editor.getByRole('checkbox', { name: /^Allow Drop-ins/ }).uncheck()
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor.getByText('The schedule changed. Refresh and try again.', { exact: true })).toBeVisible()
  await expect(editor.getByRole('combobox', { name: 'Apply change to', exact: true })).toHaveValue('matching')
  await expect(editor.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
  await expect(dropInCell(page, 10, 'Monday')).toHaveText('Yes')
  await expect(dropInCell(page, 11, 'Saturday')).toHaveText('Yes')
  expect(writes).toHaveLength(1)
})
