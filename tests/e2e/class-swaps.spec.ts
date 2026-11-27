import { expect, test, type Page } from '@playwright/test'

const recurring = {
  key: 'scheduling:21', source: 'scheduling', signupId: 21, formId: 10,
  slotGroupId: 31, timeSlotId: 41, className: 'Monday Foundations', programName: 'Gymnastics',
  scheduleLabel: 'Monday · 4:00 PM–5:00 PM', startDate: '2026-09-01', classDate: null,
  kind: 'recurring', canPermanent: true,
}
const students = [
  { key: 'member:11', memberId: 11, name: 'Avery Rivera', enrollments: [recurring,
    { ...recurring, key: 'scheduling:22', signupId: 22, formId: 12, slotGroupId: 33, timeSlotId: 43,
      className: 'Wednesday Trampoline', scheduleLabel: 'Wednesday · 5:00 PM–6:00 PM', kind: 'multi_class' }] },
  { key: 'member:12', memberId: 12, name: 'Zoe Bennett', enrollments: [
    { ...recurring, key: 'drop_in:51', source: 'drop_in', signupId: 51,
      className: 'Friday Trial', classDate: '2026-11-27', kind: 'trial', canPermanent: false }] },
  { key: 'member:13', memberId: 13, name: 'Leo Chen', enrollments: [
    { ...recurring, key: 'drop_in:52', source: 'drop_in', signupId: 52,
      className: 'Friday Drop-in', classDate: '2026-11-27', kind: 'drop_in', canPermanent: false }] },
]

type Capture = { previews: Record<string, unknown>[]; swaps: Record<string, unknown>[]; swapKeys: (string | undefined)[]; classes: URL[] }
type StudentFixture = { key: string; memberId: number; name: string; enrollments: Record<string, unknown>[] }
type FixtureOptions = { previewError?: string; executionErrors?: number; students?: StudentFixture[]; availableStrength?: boolean }

async function openEnrollments(page: Page, options: FixtureOptions = {}): Promise<Capture> {
  const capture: Capture = { previews: [], swaps: [], swapKeys: [], classes: [] }
  await page.clock.setFixedTime(new Date('2026-11-27T15:00:00Z'))
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Enrollment Manager' }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin: true, permissions: [], user: { id: 1 } }
    if (path === '/api/admin/scheduling/enrollments/class-summaries') data = { rows: [] }
    if (path === '/api/admin/scheduling/class-swaps/students') {
      const search = (url.searchParams.get('search') || '').toLowerCase()
      data = { students: (options.students || students).filter(student => student.name.toLowerCase().includes(search)) }
    }
    if (path === '/api/admin/scheduling/class-swaps/classes') {
      capture.classes.push(url)
      const date = url.searchParams.get('effectiveDate') || '2026-11-27'
      const permanent = url.searchParams.get('mode') === 'permanent'
      const count = permanent ? 8 : date === '2026-12-01' ? 5 : 3
      const classes = [
        { key: `20:32:42:${date}`, formId: 20, slotGroupId: 32, timeSlotId: 42,
          className: 'Tuesday Foundations', programName: 'Gymnastics',
          scheduleLabel: 'Tuesday · 4:00 PM–5:00 PM', date, capacity: 12,
          enrolledCount: count, availableSpots: 12 - count },
        { key: `30:34:44:${date}`, formId: 30, slotGroupId: 34, timeSlotId: 44,
          className: 'Evening Strength', programName: 'Athleticism',
          scheduleLabel: 'Tuesday · 6:00 PM–7:00 PM', date, capacity: 10,
          enrolledCount: options.availableStrength ? 7 : 10, availableSpots: options.availableStrength ? 3 : 0 },
      ]
      const search = (url.searchParams.get('search') || '').toLowerCase()
      data = { classes: classes.filter(klass => `${klass.className} ${klass.programName}`.toLowerCase().includes(search)) }
    }
    if (path === '/api/admin/scheduling/class-swaps/preview') {
      const body = request.postDataJSON() as Record<string, unknown>
      capture.previews.push(body)
      if (options.previewError) {
        return route.fulfill({ status: 409, json: { success: false, message: options.previewError } })
      }
      data = { billingImpact: body.mode === 'permanent' ? {
        sourceFirstPeriodCents: 5000, replacementFirstMonthCents: 7000, replacementMonthlyCents: 14000,
        resultingBalanceCents: 2000, sourceRemainingClasses: 2, replacementRemainingClasses: 3,
      } : null }
    }
    if (path === '/api/admin/scheduling/class-swaps' && request.method() === 'POST') {
      capture.swaps.push(request.postDataJSON() as Record<string, unknown>)
      capture.swapKeys.push(request.headers()['idempotency-key'])
      if (capture.swaps.length <= (options.executionErrors || 0)) {
        return route.fulfill({ status: 503, json: { success: false, message: 'The swap service is temporarily unavailable. Please retry.' } })
      }
      data = { message: 'Class swap completed.' }
    }
    if (path === '/api/admin/scheduling/daily-roster') data = {
      date: '2026-11-27', dateLabel: 'Friday, November 27, 2026', timeZone: 'America/New_York',
      classCount: 1, athleteCount: 1, classes: [{ eventId: '10:31:41:2026-11-27', formId: 10,
        slotGroupId: 31, timeSlotId: 41, className: 'Foundations', programName: 'Gymnastics',
        timeLabel: '4:00 PM–5:00 PM', athletes: [{ signupId: 21, source: 'scheduling', memberId: 11,
          name: 'Avery Rivera', age: 9, email: 'payer@example.test', phone: '2025550101' }] }],
    }
    await route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Admin sections', exact: true })
    .getByRole('button', { name: 'Enrollments', exact: true }).click()
  return capture
}

test('daily enrollment columns and CSV identify payer contacts', async ({ page }) => {
  await openEnrollments(page)
  await page.getByRole('tab', { name: 'Daily Enrollments', exact: true }).click()
  await expect(page.getByRole('columnheader')).toHaveText(['Athlete', 'Age', 'Payer Email', 'Payer Phone'])
  await expect(page.getByRole('cell', { name: 'payer@example.test', exact: true })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click()
  const file = await download
  const stream = await file.createReadStream()
  if (!stream) throw new Error('CSV download is unavailable')
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const csv = Buffer.concat(chunks).toString('utf8')
  expect(csv).toContain('"Payer Email","Payer Phone"')
  expect(csv).toContain('payer@example.test')
})

test('students and destination classes filter independently and date-specific counts refresh', async ({ page }, testInfo) => {
  const capture = await openEnrollments(page)
  await page.getByRole('tab', { name: 'Class Swaps', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Select student Avery Rivera', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select student Zoe Bennett', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select student Leo Chen', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Student type', exact: true }).selectOption('trial')
  await expect(page.getByRole('button', { name: 'Select student Avery Rivera', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Select student Zoe Bennett', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Student type', exact: true }).selectOption('all')
  await page.getByLabel('Find a student', { exact: true }).fill('Avery')
  await expect(page.getByRole('button', { name: 'Select student Zoe Bennett', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Select student Avery Rivera', exact: true }).click()
  await expect(page.getByRole('button', { name: 'From class Monday Foundations', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'From class Wednesday Trampoline', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'From class Monday Foundations', exact: true }).click()
  await expect(page.getByRole('button', { name: 'To class Evening Strength', exact: true })).toBeDisabled()
  await page.getByLabel('Swap date', { exact: true }).fill('2026-12-01')
  await expect.poll(() => capture.classes.at(-1)?.searchParams.get('effectiveDate')).toBe('2026-12-01')
  await page.screenshot({ path: testInfo.outputPath('class-swaps-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'From class Wednesday Trampoline', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('class-swaps-cards-desktop.png'), fullPage: true })
  await page.getByLabel('Filter classes', { exact: true }).fill('Tuesday Foundations')
  await expect(page.getByRole('button', { name: 'To class Evening Strength', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'To class Tuesday Foundations', exact: true })).toContainText('5')
  await page.getByLabel('Filter classes', { exact: true }).fill('')
  await page.getByRole('combobox', { name: 'Program', exact: true }).selectOption('Athleticism')
  await expect(page.getByRole('button', { name: 'To class Tuesday Foundations', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'To class Evening Strength', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'To class Evening Strength', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('class-swaps-mobile.png'), fullPage: true })
})

test('one-time click swap requires the exact confirmation and retains both occurrence dates', async ({ page }) => {
  const capture = await openEnrollments(page)
  await page.getByRole('tab', { name: 'Class Swaps', exact: true }).click()
  await page.getByRole('button', { name: 'Select student Avery Rivera', exact: true }).click()
  await page.getByLabel('Original session date', { exact: true }).fill('2026-11-30')
  await page.getByLabel('Swap date', { exact: true }).fill('2026-12-01')
  await page.getByRole('button', { name: 'From class Monday Foundations', exact: true }).click()
  await page.getByRole('button', { name: 'To class Tuesday Foundations', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm class swap', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Finalize swap', exact: true })).toBeDisabled()
  await dialog.getByLabel('Type TEMPORARY to confirm', { exact: true }).fill('temporary')
  await expect(dialog.getByRole('button', { name: 'Finalize swap', exact: true })).toBeDisabled()
  await dialog.getByLabel('Type TEMPORARY to confirm', { exact: true }).fill('TEMPORARY')
  await dialog.getByRole('button', { name: 'Finalize swap', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(capture.swaps).toHaveLength(1)
  expect(capture.swaps[0]).toMatchObject({ source: 'scheduling', signupId: 21, mode: 'temporary',
    sourceDate: '2026-11-30', effectiveDate: '2026-12-01', targetFormId: 20,
    targetSlotGroupId: 32, targetTimeSlotId: 42, confirmation: 'TEMPORARY' })
  expect(capture.swaps[0].requestKey).toEqual(expect.any(String))
})

test('dragging a permanent source class opens billing review before PERMANENT confirmation', async ({ page }) => {
  const capture = await openEnrollments(page)
  await page.getByRole('tab', { name: 'Class Swaps', exact: true }).click()
  await page.getByRole('button', { name: 'Permanent change', exact: true }).click()
  await page.getByLabel('Swap begins', { exact: true }).fill('2026-12-01')
  await page.getByRole('button', { name: 'Select student Avery Rivera', exact: true }).click()
  const from = page.getByRole('button', { name: 'From class Monday Foundations', exact: true })
  const to = page.getByRole('button', { name: 'To class Tuesday Foundations', exact: true })
  await expect(to).toContainText('8')
  await from.dragTo(to)
  const dialog = page.getByRole('dialog', { name: 'Confirm class swap', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Billing impact', { exact: true })).toBeVisible()
  await expect(dialog.getByText('$140.00', { exact: true })).toBeVisible()
  await dialog.getByLabel('Type PERMANENT to confirm', { exact: true }).fill('PERMANENT')
  await dialog.getByRole('button', { name: 'Finalize swap', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(capture.previews.at(-1)).toMatchObject({ mode: 'permanent', signupId: 21, effectiveDate: '2026-12-01' })
  expect(capture.swaps.at(-1)).toMatchObject({ mode: 'permanent', confirmation: 'PERMANENT' })
})

for (const previewError of ['The destination class is now full.', 'The original enrollment changed. Refresh and choose it again.']) {
  test(`preview validation blocks finalization: ${previewError}`, async ({ page }) => {
    const capture = await openEnrollments(page, { previewError })
    await page.getByRole('tab', { name: 'Class Swaps', exact: true }).click()
    await page.getByRole('button', { name: 'Select student Avery Rivera', exact: true }).click()
    await page.getByRole('button', { name: 'From class Monday Foundations', exact: true }).click()
    await page.getByRole('button', { name: 'To class Tuesday Foundations', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Confirm class swap', exact: true })
    await expect(dialog.getByRole('alert')).toHaveText(previewError)
    await expect(dialog.getByLabel('Type TEMPORARY to confirm', { exact: true })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Finalize swap', exact: true })).toBeDisabled()
    expect(capture.previews.length).toBeGreaterThan(0)
    expect(capture.swaps).toHaveLength(0)
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toBeHidden()
  })
}

test('retry after a failed finalization retains the same request body and idempotency key', async ({ page }) => {
  const capture = await openEnrollments(page, { executionErrors: 1 })
  await page.getByRole('tab', { name: 'Class Swaps', exact: true }).click()
  await page.getByRole('button', { name: 'Select student Avery Rivera', exact: true }).click()
  await page.getByRole('button', { name: 'From class Monday Foundations', exact: true }).click()
  await page.getByRole('button', { name: 'To class Tuesday Foundations', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm class swap', exact: true })
  await dialog.getByLabel('Type TEMPORARY to confirm', { exact: true }).fill('TEMPORARY')
  await dialog.getByRole('button', { name: 'Finalize swap', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('The swap service is temporarily unavailable. Please retry.')
  await expect(dialog.getByRole('button', { name: 'Finalize swap', exact: true })).toBeEnabled()
  expect(capture.swaps).toHaveLength(1)
  await dialog.getByRole('button', { name: 'Finalize swap', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(capture.swaps).toHaveLength(2)
  expect(capture.swaps[1]).toEqual(capture.swaps[0])
  expect(capture.swapKeys).toEqual([capture.swaps[0].requestKey, capture.swaps[0].requestKey])
})

test('a combined permanent enrollment requires one replacement for each original day and supports mixed class types', async ({ page }) => {
  const groupScheduleLabel = 'Monday · 4:00 PM–5:00 PM; Wednesday · 5:00 PM–6:00 PM'
  const wholeGroup = { ...recurring, signupId: 61, className: 'Tumbling Combo',
    kind: 'multi_class', wholeGroup: true, groupScheduleLabel, requiredReplacementCount: 2 }
  const capture = await openEnrollments(page, { availableStrength: true, students: [
    { key: 'member:14', memberId: 14, name: 'Morgan Ellis', enrollments: [
      { ...wholeGroup, key: 'scheduling:61:41', timeSlotId: 41, scheduleLabel: 'Monday · 4:00 PM–5:00 PM' },
      { ...wholeGroup, key: 'scheduling:61:45', timeSlotId: 45, scheduleLabel: 'Wednesday · 5:00 PM–6:00 PM' },
    ] },
  ] })
  await page.getByRole('tab', { name: 'Class Swaps', exact: true }).click()
  await page.getByRole('button', { name: 'Permanent change', exact: true }).click()
  await page.getByRole('button', { name: 'Select student Morgan Ellis', exact: true }).click()
  const from = page.getByRole('button', { name: 'From class Tumbling Combo', exact: true })
  await expect(from).toHaveCount(1)
  await expect(from).toContainText(groupScheduleLabel)
  await from.click()
  const review = page.getByRole('button', { name: 'Review swap', exact: true })
  await expect(review).toBeDisabled()
  const foundations = page.getByRole('button', { name: 'To class Tuesday Foundations', exact: true })
  const strength = page.getByRole('button', { name: 'To class Evening Strength', exact: true })
  await foundations.click()
  await expect(review).toBeDisabled()
  await expect(page.getByText('1 of 2 replacement days/times selected', { exact: true })).toBeVisible()
  expect(capture.previews).toHaveLength(0)
  await strength.click()
  await expect(review).toBeEnabled()
  await expect(page.getByText('2 of 2 replacement days/times selected', { exact: true })).toBeVisible()
  await foundations.click()
  await expect(review).toBeDisabled()
  await foundations.click()
  await review.click()
  const dialog = page.getByRole('dialog', { name: 'Confirm class swap', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Tumbling Combo', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Tuesday Foundations', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Evening Strength', { exact: true })).toBeVisible()
  await expect(dialog.getByText(/2 original days\/times → 2 replacement days\/times/)).toBeVisible()
  await dialog.getByLabel('Type PERMANENT to confirm', { exact: true }).fill('PERMANENT')
  await dialog.getByRole('button', { name: 'Finalize swap', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(capture.swaps).toHaveLength(1)
  expect(capture.swaps[0]).toMatchObject({ source: 'scheduling', signupId: 61, mode: 'permanent', confirmation: 'PERMANENT' })
  expect(capture.swaps[0].targetSelections).toEqual(expect.arrayContaining([
    { formId: 20, slotGroupId: 32, timeSlotId: 42 },
    { formId: 30, slotGroupId: 34, timeSlotId: 44 },
  ]))
  expect(capture.swaps[0].targetSelections).toHaveLength(2)
})
