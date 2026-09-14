import { expect, test, type Page } from '@playwright/test'

const runtimeErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => { const errors: string[] = []; runtimeErrors.set(page, errors); page.on('pageerror', (error) => errors.push(error.message)) })
test.afterEach(async ({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); await expect(page.locator('vite-error-overlay')).toHaveCount(0) })

const basePlan = () => ({ version: 1, increment: 15, start: 480, end: 780, locations: [{ id: 'floor', name: 'Main floor' }, { id: 'bars', name: 'Bars' }], classes: [], blocks: [] })
async function openPlanner(page: Page, manage = true) {
  const writes: Record<string, unknown>[] = []
  let saved: unknown = null
  let revision = 0
  const namedViews = new Map<string, { id: string; name: string; revision: number; selectedDay: number; plan: unknown; facilityId: number; updatedAt: string }>()
  let nextView = 1
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true'); localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Planner Admin', email: 'planner@example.com', isMaster: true }))
  })
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const json = (data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
    if (path === '/api/admin/access/me') return json({ isMasterAdmin: false, permissions: ['scheduling.view', 'classes.view', ...(manage ? ['scheduling.manage'] : [])], roles: ['ADMIN'], user: { id: 1 } })
    if (path === '/api/admin/notifications') return json({ notifications: [], unreadCount: 0 })
    if (path === '/api/admin/floor-planner') {
      if (route.request().method() === 'PUT') { const body = route.request().postDataJSON(); writes.push(body); saved = body.plan; revision++ }
      return json({ plan: saved || basePlan(), revision, facilityId: 1 })
    }
    if (path === '/api/admin/floor-planner/views') {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        if ([...namedViews.values()].some((view) => view.name.toLowerCase() === body.name.toLowerCase())) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'A view with that name already exists. Choose a different name.' }) })
        const id = `00000000-0000-4000-8000-${String(nextView++).padStart(12, '0')}`
        const view = { id, name: body.name, plan: body.plan, selectedDay: body.selectedDay, revision: 1, facilityId: 1, updatedAt: new Date().toISOString() }
        namedViews.set(id, view); return json(view)
      }
      return json([...namedViews.values()])
    }
    if (path.startsWith('/api/admin/floor-planner/views/')) {
      const id = path.split('/').at(-1)!
      const view = namedViews.get(id)!
      if (route.request().method() === 'DELETE') { namedViews.delete(id); return json({ id }) }
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON()
        expect(body.revision).toBe(view.revision)
        const updated = { ...view, name: body.name, plan: body.plan, selectedDay: body.selectedDay, revision: view.revision + 1 }
        namedViews.set(id, updated); return json(updated)
      }
      return json(view)
    }
    if (path === '/api/admin/floor-planner/coaches') return json([{ id: 1, name: 'Avery', assignments: [{ classId: 10 }] }, { id: 2, name: 'Jordan', assignments: [] }])
    if (path === '/api/admin/class-setup/overview') return json({ rows: [{ classId: 10, className: 'Junior Gymnastics', programName: 'Gymnastics', classIsActive: true, classArchived: false, programArchived: false, formId: 20, programsId: 30, offerings: [], slotGroups: [{ slotGroupId: 40, formId: 20, offeringId: null, maxParticipants: 12, signupCount: 4, scheduleLabel: 'Monday · 09:00–10:00', scheduleLines: [{ timeSlotId: 50, isActive: true, scheduleLabel: 'Monday · 09:00–10:00' }] }] }] })
    return json([])
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /VORTEX ADMIN/i })).toBeVisible({ timeout: 30000 })
  await page.getByRole('navigation').getByRole('button', { name: 'Floor Planner', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Floor Planner', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: /^Mon/ }).click()
  await expect(page.getByTestId('library-class')).toHaveCount(1)
  return writes
}
async function addClass(page: Page, start = '09:00', end = '10:00') {
  await page.getByTestId('library-class').getByRole('button', { name: /Add to/ }).click()
  const editor = page.getByRole('region', { name: 'Class details' })
  await editor.getByLabel('Start time', { exact: true }).fill(start)
  await editor.getByLabel('End time', { exact: true }).fill(end)
  await editor.getByRole('button', { name: 'Apply placement' }).click()
}

test('scheduled duration, coaches, independent colors, weekdays, copying and saved reload', async ({ page }) => {
  const writes = await openPlanner(page)
  await addClass(page)
  await expect(page.getByTestId('floor-block')).toContainText('Avery')
  await addClass(page, '10:00', '11:00')
  const colors = await page.getByTestId('floor-block').evaluateAll((els) => els.map((el) => el.getAttribute('data-color')))
  expect(new Set(colors).size).toBe(2)
  await page.getByRole('button', { name: 'Copy day', exact: true }).click()
  await page.getByLabel('Destination day', { exact: true }).selectOption('1')
  await page.getByRole('button', { name: 'Copy to Tuesday' }).click()
  await expect(page.getByRole('tab', { name: /^Tue/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('floor-block')).toHaveCount(2)
  await page.getByTestId('floor-block').first().click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await page.getByRole('tab', { name: /^Mon/ }).click()
  await expect(page.getByTestId('floor-block')).toHaveCount(2)
  await page.getByRole('button', { name: 'Save week', exact: true }).click()
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible()
  expect(writes).toHaveLength(1)
  const plan = writes[0].plan as { blocks: { day: number; end: number; start: number }[] }
  expect(plan.blocks).toHaveLength(3)
  expect(plan.blocks[0].end - plan.blocks[0].start).toBe(60)
  await page.reload()
  await expect(page.getByRole('heading', { name: /VORTEX ADMIN/i })).toBeVisible()
  await page.getByRole('navigation').getByRole('button', { name: 'Floor Planner', exact: true }).click()
  await page.getByRole('tab', { name: /^Tue/ }).click()
  await expect(page.getByTestId('floor-block')).toHaveCount(1)
})

test('drag from library, right-click split, move pieces between locations and merge adjacent siblings', async ({ page }) => {
  await openPlanner(page)
  const row = page.getByTestId('floor-row-Main floor')
  await page.getByTestId('library-class').dragTo(row, { targetPosition: { x: 256, y: 40 } })
  await expect(page.getByTestId('floor-block')).toHaveCount(1)
  await page.getByTestId('floor-block').click({ button: 'right', position: { x: 128, y: 25 } })
  await page.getByRole('menuitem', { name: /Split at/ }).click()
  await expect(page.getByTestId('floor-block')).toHaveCount(2)
  const pieces = await page.getByTestId('floor-block').evaluateAll((els) => els.map((el) => el.getAttribute('data-instance')))
  expect(new Set(pieces).size).toBe(1)
  // Moving a split piece preserves its original grab offset.
  await page.getByTestId('floor-block').last().dragTo(page.getByTestId('floor-row-Bars'), { sourcePosition: { x: 20, y: 20 }, targetPosition: { x: 404, y: 30 } })
  await expect(page.getByTestId('floor-row-Bars').getByTestId('floor-block')).toHaveCount(1)
  await page.getByTestId('floor-row-Bars').getByTestId('floor-block').dragTo(row, { sourcePosition: { x: 20, y: 20 }, targetPosition: { x: 404, y: 30 } })
  await expect(page.getByTestId('floor-block')).toHaveCount(1)
  await expect(page.getByTestId('floor-block')).toContainText('9:00 AM–10:00 AM')
})

test('resizing snaps to grid and search, idea creation, locations and replacement copying work', async ({ page }) => {
  await openPlanner(page)
  await addClass(page)
  const handle = page.getByTestId('resize-end')
  const box = await handle.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + 4, box!.y + 30)
  await page.mouse.down(); await page.mouse.move(box!.x + 68, box!.y + 30, { steps: 5 }); await page.mouse.up()
  await expect(page.getByTestId('floor-block')).toContainText('10:15 AM')
  for (const increment of ['5', '10', '15', '30']) { await page.getByLabel('Time increments').selectOption(increment); await expect(page.getByLabel('Time increments')).toHaveValue(increment) }
  await page.getByLabel('Find classes').fill('no match')
  await expect(page.getByText('No classes match your search.')).toBeVisible()
  await page.getByRole('button', { name: 'Notional Class' }).click()
  const modal = page.getByRole('dialog')
  await modal.getByLabel('Class name').fill('Open Skills Lab')
  await modal.getByLabel('Duration (minutes)').fill('45')
  await modal.getByRole('button', { name: 'Create class', exact: true }).click()
  await expect(page.getByTestId('library-class')).toHaveCount(2)
  await page.getByRole('button', { name: 'Add location', exact: true }).click()
  await modal.getByLabel('Location name').fill('Skills corner')
  await modal.getByRole('button', { name: 'Add location', exact: true }).click()
  await expect(page.getByTestId('floor-row-Skills corner')).toBeVisible()
  await page.getByRole('tab', { name: /^Wed/ }).click()
  await expect(page.getByTestId('floor-row-Skills corner')).toBeVisible()
  await expect(page.getByTestId('floor-block')).toHaveCount(0)
  await page.getByRole('tab', { name: /^Mon/ }).click()
  await page.getByRole('button', { name: 'Copy day', exact: true }).click()
  await page.getByLabel('Destination day', { exact: true }).selectOption('2')
  await page.getByRole('button', { name: 'Copy to Wednesday' }).click()
  await page.getByRole('tab', { name: /^Mon/ }).click()
  await page.getByRole('button', { name: 'Copy day', exact: true }).click()
  await page.getByLabel('Destination day', { exact: true }).selectOption('2')
  await page.getByLabel(/Replace destination day/).check()
  await page.getByRole('button', { name: 'Copy to Wednesday' }).click()
  await expect(page.getByTestId('floor-block')).toHaveCount(1)
  await page.getByRole('button', { name: 'Delete location Skills corner' }).click()
  await modal.getByRole('button', { name: 'Delete location', exact: true }).click()
  await expect(page.getByTestId('floor-row-Skills corner')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByTestId('floor-row-Skills corner')).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.screenshot({ path: 'artifacts/floor-planner.png', fullPage: true })
})

test('read-only admins cannot change the plan', async ({ page }) => {
  await openPlanner(page, false)
  await expect(page.getByText('View only', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save week', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Notional Class' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Add location', exact: true })).toBeDisabled()
})

test('unsaved drafts survive navigation, coach overlaps are visible and stale saves preserve edits', async ({ page }) => {
  await openPlanner(page)
  await addClass(page)
  await addClass(page)
  await expect(page.getByText('2 segments with location or coach overlaps')).toBeVisible()
  await page.getByTestId('floor-block').last().click()
  await page.getByRole('region', { name: 'Class details' }).getByRole('combobox', { name: 'Location', exact: true }).selectOption('bars')
  await page.getByRole('button', { name: 'Apply placement' }).click()
  await page.getByTestId('floor-row-Bars').getByTestId('floor-block').click()
  await expect(page.getByRole('region', { name: 'Class details' }).getByText('Coach overlap: Avery', { exact: true })).toBeVisible()
  await page.getByRole('navigation').getByRole('button', { name: 'Home', exact: true }).click()
  await page.getByRole('navigation').getByRole('button', { name: 'Floor Planner', exact: true }).click()
  await page.getByRole('tab', { name: /^Mon/ }).click()
  await expect(page.getByTestId('floor-block')).toHaveCount(2)
  await expect(page.getByText('Restored your unsaved plan from this tab.', { exact: true }).last()).toBeVisible()
  await page.route('**/api/admin/floor-planner', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Another admin saved this plan. Reload the saved plan before making further changes.' }) })
  })
  await page.getByRole('button', { name: 'Save week', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Another admin saved this plan.')
  await expect(page.getByTestId('floor-block')).toHaveCount(2)
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()
})

test('reset snapshots every active day with program names and coaches, leaving live scheduling untouched', async ({ page }) => {
  const writes = await openPlanner(page)
  const sourceMutations: string[] = []
  page.on('request', (request) => {
    if (/\/api\/admin\/(scheduling|coaches)/.test(request.url()) && request.method() !== 'GET') sourceMutations.push(request.url())
  })
  await page.route('**/api/admin/scheduling/calendar?**', async (route) => {
    const params = new URL(route.request().url()).searchParams
    expect(params.get('formActive')).toBe('active')
    const start = params.get('startDate')!
    const event = (day: number, extra = {}) => {
      const date = new Date(`${start}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + day)
      return { id: `event-${day}`, date: date.toISOString().slice(0, 10), startTime: day === 6 ? '23:00' : '09:00', endTime: day === 6 ? '00:00' : '10:00', formId: 20, classEventId: 10, programsId: 30, programName: 'Gymnastics', className: 'Junior Gymnastics', offeringId: 60, slotGroupId: 40, timeSlotId: 50, formActive: true, classActive: true, slotGroupActive: true, slotActive: true, ...extra }
    }
    const events = [
      ...Array.from({ length: 7 }, (_, i) => event(i)),
      event(0, { id: 'second', timeSlotId: 51, classEventId: 11, programName: 'Ninja', className: 'Obstacle Skills', startTime: '09:30', endTime: '10:15' }),
      event(0), // Duplicate occurrence must not create a duplicate placement.
      event(0, { id: 'inactive-class', timeSlotId: 52, classActive: false }),
      event(0, { id: 'hidden-enrollment', timeSlotId: 53, formActive: false, classEventId: 11, programName: 'Ninja', className: 'Private Skills', startTime: '11:00', endTime: '12:00' }),
      event(0, { id: 'inactive-slot', timeSlotId: 54, slotActive: false }),
      event(0, { id: 'inactive-group', timeSlotId: 55, slotGroupActive: false }),
      event(7),
    ]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { events, tbdPatterns: [] } }) })
  })
  await addClass(page, '11:00', '12:00')
  await page.getByRole('button', { name: 'Reset to current schedule', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('9 scheduled classes')
  await expect(page.getByTestId('floor-block')).toHaveCount(1)
  await page.getByRole('button', { name: 'Reset planning week' }).click()
  await expect(page.getByTestId('floor-row-Unassigned').getByTestId('floor-block')).toHaveCount(3)
  await expect(page.getByText('3 awaiting location')).toBeVisible()
  await expect(page.getByText('No location or coach overlaps')).toBeVisible()
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  for (const [index, day] of days.entries()) {
    await page.getByRole('tab', { name: new RegExp(`^${day}`) }).click()
    await expect(page.getByTestId('floor-block')).toHaveCount(index === 0 ? 3 : 1)
    await expect(page.getByTestId('floor-block').first()).toContainText('Gymnastics')
    await expect(page.getByTestId('floor-block').first()).toContainText('Junior Gymnastics')
    await expect(page.getByTestId('floor-block').first()).toContainText('Avery')
  }
  await expect(page.getByTestId('floor-block')).toContainText('11:00 PM–12:00 AM')
  await page.getByRole('tab', { name: /^Mon/ }).click()
  await page.getByTestId('floor-block').first().click()
  const editor = page.getByRole('region', { name: 'Class details' })
  await editor.getByRole('combobox', { name: 'Location', exact: true }).selectOption('floor')
  await editor.getByRole('combobox', { name: /^Coaches/ }).fill('Jordan')
  await editor.getByRole('button', { name: 'Apply placement' }).click()
  await expect(page.getByTestId('floor-row-Main floor').getByTestId('floor-block')).toContainText('Jordan')
  await page.getByRole('button', { name: 'Save week', exact: true }).click()
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible()
  const saved = writes.at(-1)!.plan as { blocks: { day: number; locationId: string; coaches: string[]; program: string }[] }
  expect(saved.blocks).toHaveLength(9)
  expect(saved.blocks.filter((b) => b.locationId === 'floor-planner-unassigned')).toHaveLength(8)
  expect(sourceMutations).toEqual([])
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.screenshot({ path: 'artifacts/floor-planner.png', fullPage: true })
})

test('failed schedule reset keeps existing planning data intact', async ({ page }) => {
  await openPlanner(page)
  await addClass(page)
  await page.route('**/api/admin/scheduling/calendar?**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Schedule unavailable' }) }))
  await page.getByRole('button', { name: 'Reset to current schedule', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Schedule unavailable')
  await expect(page.getByRole('button', { name: 'Reset planning week' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.getByTestId('floor-block')).toHaveCount(1)
})

async function saveAsView(page: Page, name: string) {
  await page.getByRole('button', { name: 'Save as new view' }).click()
  await page.getByRole('dialog').getByLabel('View name').fill(name)
  await page.getByRole('button', { name: 'Save new view', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test('named views save independent weeks and display settings, reopen, update, and delete', async ({ page }) => {
  const writes = await openPlanner(page)
  await addClass(page)
  await page.getByRole('button', { name: 'Save week', exact: true }).click()
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible()
  await saveAsView(page, 'Evening rotation')
  await expect(page.getByLabel('Saved view', { exact: true })).toHaveValue('00000000-0000-4000-8000-000000000001')
  await page.getByRole('tab', { name: /^Tue/ }).click()
  await addClass(page, '10:00', '11:00')
  await page.getByLabel('Time increments').selectOption('30')
  await page.getByRole('button', { name: 'Save view', exact: true }).click()
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible()
  await saveAsView(page, 'Weekend rotation')
  await page.getByTestId('floor-block').click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await page.getByRole('button', { name: 'Save view', exact: true }).click()
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible()
  await page.getByLabel('Saved view', { exact: true }).selectOption({ label: 'Evening rotation' })
  await expect(page.getByRole('tab', { name: /^Tue/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('Time increments')).toHaveValue('30')
  await expect(page.getByTestId('floor-block')).toHaveCount(1)
  await page.getByLabel('Saved view', { exact: true }).selectOption('')
  await page.getByRole('tab', { name: /^Mon/ }).click()
  await expect(page.getByLabel('Time increments')).toHaveValue('15')
  await expect(page.getByTestId('floor-block')).toHaveCount(1)
  expect(writes).toHaveLength(1) // Named views never overwrite the base week.
  await page.reload()
  await page.getByRole('navigation').getByRole('button', { name: 'Floor Planner', exact: true }).click()
  await page.getByLabel('Saved view', { exact: true }).selectOption({ label: 'Evening rotation' })
  await expect(page.getByTestId('floor-block')).toHaveCount(1)
  await expect(page.getByRole('tab', { name: /^Tue/ })).toHaveAttribute('aria-selected', 'true')
  await page.getByLabel('Saved view', { exact: true }).selectOption({ label: 'Weekend rotation' })
  await expect(page.getByTestId('floor-block')).toHaveCount(0)
  await page.getByRole('button', { name: 'Delete view', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete saved view', exact: true }).click()
  await expect(page.getByLabel('Saved view', { exact: true })).toHaveValue('')
  await expect(page.getByRole('option', { name: 'Weekend rotation', exact: true })).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'Evening rotation', exact: true })).toHaveCount(1)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.screenshot({ path: 'artifacts/floor-planner-views.png', fullPage: true })
})

test('named view drafts are isolated and duplicate names keep the save dialog open', async ({ page }) => {
  await openPlanner(page)
  await addClass(page)
  await page.getByRole('button', { name: 'Save week', exact: true }).click()
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible()
  await saveAsView(page, 'Fall plan')
  await page.getByRole('button', { name: 'Save as new view' }).click()
  await page.getByRole('dialog').getByLabel('View name').fill('Fall plan')
  await page.getByRole('button', { name: 'Save new view', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('already exists')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByTestId('floor-block').click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await page.getByLabel('Saved view', { exact: true }).selectOption('')
  await expect(page.getByTestId('floor-block')).toHaveCount(1)
  await page.getByLabel('Saved view', { exact: true }).selectOption({ label: 'Fall plan' })
  await expect(page.getByTestId('floor-block')).toHaveCount(0)
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reload saved', exact: true }).click()
  await page.getByRole('button', { name: 'Reload saved view', exact: true }).click()
  await expect(page.getByTestId('floor-block')).toHaveCount(1)
})

test('right-click move preserves exact times, coaches, color and day, and supports undo', async ({ page }) => {
  const writes = await openPlanner(page)
  await addClass(page, '09:07', '10:02')
  const original = page.getByTestId('floor-block')
  const color = await original.getAttribute('data-color')
  const instance = await original.getAttribute('data-instance')
  await original.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Move to location', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Move to location' })
  await expect(modal).toContainText('Monday · 9:07 AM–10:02 AM')
  await expect(modal.getByRole('option', { name: 'Main floor', exact: true })).toHaveCount(0)
  await modal.getByLabel('Destination location', { exact: true }).selectOption('bars')
  await modal.getByRole('button', { name: 'Move class', exact: true }).click()
  const moved = page.getByTestId('floor-row-Bars').getByTestId('floor-block')
  await expect(moved).toContainText('9:07 AM–10:02 AM')
  await expect(moved).toContainText('Avery')
  await expect(moved).toHaveAttribute('data-color', color!)
  await expect(moved).toHaveAttribute('data-instance', instance!)
  await expect(page.getByTestId('floor-row-Main floor').getByTestId('floor-block')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save week', exact: true }).click()
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible()
  const saved = writes.at(-1)!.plan as { blocks: { start: number; end: number; day: number; locationId: string; coaches: string[] }[] }
  expect(saved.blocks).toHaveLength(1)
  expect(saved.blocks[0]).toMatchObject({ start: 547, end: 602, day: 0, locationId: 'bars', coaches: ['Avery'] })
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByTestId('floor-row-Main floor').getByTestId('floor-block')).toContainText('9:07 AM–10:02 AM')
})
