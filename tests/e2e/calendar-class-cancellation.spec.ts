import { expect, test, type Page } from '@playwright/test'
import type { SchedulingCalendarEvent } from '../../src/utils/schedulingApi'
import { ANALYTICS_POLICY_VERSION, CONSENT_STORAGE_KEY } from '../../src/config/analyticsPolicy'

const date = '2026-11-16'
const followingWeek = '2026-11-23'
const activeClassName = 'Tumbling'
const trialClassName = 'Trial skills assessment'

function eventFor(slotId: number, sessionDate: string, isTrialAssessment = false): SchedulingCalendarEvent {
  return {
    id: `${slotId}-${sessionDate}`,
    date: sessionDate,
    startTime: '16:00',
    endTime: '17:00',
    formId: slotId + 10,
    classEventId: slotId,
    programsId: 1,
    programName: 'Gymnastics',
    className: isTrialAssessment ? trialClassName : activeClassName,
    classDescription: null,
    skillLevel: null,
    ageMin: null,
    ageMax: null,
    skillRequirements: null,
    offeringId: null,
    offeringLabel: null,
    offeringStartDate: null,
    offeringEndDate: null,
    slotGroupId: slotId + 20,
    timeSlotId: slotId,
    maxParticipants: 8,
    signupCount: 2,
    waitlistCount: 0,
    spotsRemaining: 6,
    isFull: false,
    formActive: !isTrialAssessment,
    classActive: true,
    slotGroupActive: true,
    slotActive: true,
    isCancelled: false,
    isTrialAssessment,
  }
}

test.describe('public mobile calendar', () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true })

  test('month and week class taps open the scheduled day with its signup link', async ({ page }) => {
    const selectedDate = '2026-11-19'
    const events = [
      { ...eventFor(31, selectedDate), enrollVisible: true },
      { ...eventFor(32, selectedDate, true), formActive: true, enrollVisible: true },
    ]
    await page.clock.setFixedTime(new Date('2026-11-16T15:00:00Z'))
    await page.addInitScript(({ key, policyVersion }) => {
      localStorage.setItem(key, JSON.stringify({
        necessary: true, analytics: false, marketing: false, policyVersion, updatedAt: new Date().toISOString(),
      }))
    }, { key: CONSENT_STORAGE_KEY, policyVersion: ANALYTICS_POLICY_VERSION })
    await page.route('**/api/**', route => {
      const request = route.request()
      const url = new URL(request.url())
      expect(request.method()).toBe('GET')
      const startDate = url.searchParams.get('startDate')
      const endDate = url.searchParams.get('endDate')
      const data = url.pathname === '/api/scheduling/calendar' && startDate && endDate
        ? { year: 2026, month: 11, startDate, endDate, events: events.filter(event => event.date >= startDate && event.date <= endDate), tbdPatterns: [] }
        : []
      return route.fulfill({ json: { success: true, data } })
    })
    await page.goto('/read-board#schedule')
    const calendar = page.locator('#schedule [data-prerender-dynamic]')
    const heading = calendar.getByRole('heading', { name: 'Thursday, November 19, 2026', exact: true })
    const signUp = calendar.getByRole('link', { name: 'Sign Up', exact: true })

    for (const view of ['month', 'week']) {
      await calendar.getByRole('button', { name: view, exact: true }).tap()
      const classChip = calendar.getByRole('button', { name: /Tumbling/ })
      await classChip.tap()
      await expect(heading).toBeFocused()
      await expect(heading).toBeInViewport()
      await expect(calendar.getByRole('button', { name: 'day', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(signUp).toHaveCount(1)
      await expect(signUp).toHaveAttribute('href', '/enroll?form=41&slotGroupId=51&timeSlotId=31&enrollmentStartDate=' + selectedDate)
      await expect(calendar.getByRole('button', { name: /Tumbling/ })).toHaveCount(0)
      await expect(page).toHaveURL('/read-board#schedule')
    }
  })
})

async function openCalendar(page: Page, canManage: boolean, initiallyCancelledDates: string[] = []) {
  await page.clock.setFixedTime(new Date('2026-11-16T15:00:00Z'))
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Schedule Manager', isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })

  const events = [eventFor(31, date), eventFor(32, date, true), eventFor(31, followingWeek)]
  const cancelledDates = new Set(initiallyCancelledDates)
  const updates: { date: string; slotId: number; cancelled: boolean }[] = []
  const dayUpdates: { date: string; cancelled: boolean }[] = []
  let calendarReads = 0
  let failNextUpdate = false

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    let data: unknown = []
    if (url.pathname === '/api/admin/access/me') {
      data = {
        isMasterAdmin: false,
        permissions: canManage ? ['scheduling.view', 'scheduling.manage'] : ['scheduling.view'],
        roles: ['ADMIN'],
        user: { id: 1 },
      }
    }
    if (url.pathname === '/api/admin/programs-top') data = [{ id: 1, displayName: 'Gymnastics' }]
    if (url.pathname === '/api/admin/scheduling/classes') {
      data = [
        { id: 31, displayName: activeClassName, programName: 'Gymnastics', formId: 41 },
        { id: 32, displayName: 'Full trial skills assessment name', programName: 'Gymnastics', formId: 42 },
      ]
    }
    if (url.pathname === '/api/admin/scheduling/calendar') {
      calendarReads += 1
      const start = url.searchParams.get('startDate')!
      const end = url.searchParams.get('endDate')!
      const id = url.searchParams.get('programId')
      data = {
        year: 2026,
        month: 11,
        startDate: start,
        endDate: end,
        events: events.filter((event) => event.date >= start && event.date <= end && (!id || String(event.classEventId) === id))
          .map((event) => ({
            ...event,
            isIndividuallyCancelled: event.isCancelled,
            isCancelledByDay: cancelledDates.has(event.date),
            isCancelled: event.isCancelled || cancelledDates.has(event.date),
          })),
        cancelledDates: [...cancelledDates].filter((day) => day >= start && day <= end),
        tbdPatterns: [],
      }
    }
    if (/^\/api\/admin\/scheduling\/forms\/\d+$/.test(url.pathname)) data = { slotGroups: [] }
    if (url.pathname === '/api/admin/scheduling/calendar/occurrence') {
      expect(request.method()).toBe('PUT')
      const update = request.postDataJSON() as typeof updates[number]
      updates.push(update)
      if (failNextUpdate) {
        failNextUpdate = false
        return route.fulfill({ status: 409, json: { success: false, message: 'Could not update the session. Try again.' } })
      }
      const event = events.find((item) => item.date === update.date && item.timeSlotId === update.slotId)
      expect(event).toBeDefined()
      event!.isCancelled = update.cancelled
      data = update
    }
    if (url.pathname === '/api/admin/scheduling/calendar/day') {
      expect(request.method()).toBe('PUT')
      const update = request.postDataJSON() as typeof dayUpdates[number]
      dayUpdates.push(update)
      if (failNextUpdate) {
        failNextUpdate = false
        return route.fulfill({ status: 409, json: { success: false, message: 'Could not update the day. Try again.' } })
      }
      if (update.cancelled) cancelledDates.add(update.date)
      else cancelledDates.delete(update.date)
      data = update
    }
    await route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Calendar', exact: true }).click()
  return {
    updates,
    dayUpdates,
    calendarReads: () => calendarReads,
    failNextUpdate: () => { failNextUpdate = true },
    cancelSeparately: (slotId: number, sessionDate: string) => {
      const event = events.find((item) => item.date === sessionDate && item.timeSlotId === slotId)
      if (!event) throw new Error('No matching fixture event')
      event.isCancelled = true
    },
  }
}

test('calendar cancels and restores an individual regular or trial session by date', async ({ page }) => {
  const { updates, failNextUpdate } = await openCalendar(page, true)
  const firstClass = page.getByRole('button', { name: /Tumbling, November 16, 2026/ })
  const laterClass = page.getByRole('button', { name: /Tumbling, November 23, 2026/ })
  await firstClass.click()
  const regular = page.getByRole('dialog', { name: activeClassName })
  await regular.getByRole('button', { name: 'Cancel class', exact: true }).click()
  await regular.getByRole('button', { name: 'Keep scheduled' }).click()
  expect(updates).toHaveLength(0)
  await regular.getByRole('button', { name: 'Cancel class', exact: true }).click()
  failNextUpdate()
  await regular.getByRole('button', { name: 'Confirm cancellation' }).click()
  await expect(regular.getByRole('alert')).toHaveText('Could not update the session. Try again.')
  await regular.getByRole('button', { name: 'Confirm cancellation' }).click()
  await expect(regular.getByRole('status')).toHaveText('Cancelled')
  expect(updates.at(-1)).toEqual({ date, slotId: 31, cancelled: true })
  await regular.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(firstClass).toHaveAccessibleName(/Cancelled/)
  await expect(laterClass).not.toHaveAccessibleName(/Cancelled/)

  await page.getByRole('button', { name: 'week', exact: true }).click()
  await firstClass.click()
  await regular.getByRole('button', { name: 'Restore class' }).click()
  await expect(regular.getByRole('status')).toHaveText('Scheduled')
  expect(updates.at(-1)).toEqual({ date, slotId: 31, cancelled: false })
  await page.keyboard.press('Escape')
  await expect(regular).toBeHidden()

  await page.getByRole('button', { name: 'By class', exact: true }).click()
  await page.getByRole('combobox', { name: 'Class', exact: true }).selectOption('32')
  await page.getByRole('button', { name: /Mon.*4:00 PM/ }).click()
  const trialDate = page.getByRole('button', { name: /Nov 16, 2026/ })
  await trialDate.click()
  const trial = page.getByRole('dialog', { name: trialClassName })
  await expect(trial.getByText('Trial assessment', { exact: true })).toBeVisible()
  await trial.getByRole('button', { name: 'Cancel class', exact: true }).click()
  await trial.getByRole('button', { name: 'Confirm cancellation' }).click()
  await expect(trial.getByRole('status')).toHaveText('Cancelled')
  expect(updates.at(-1)).toEqual({ date, slotId: 32, cancelled: true })
  await trial.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(trialDate).toHaveAccessibleName(/Cancelled/)
  await trialDate.click()
  await trial.getByRole('button', { name: 'Restore class' }).click()
  await expect(trial.getByRole('status')).toHaveText('Scheduled')
  expect(updates.at(-1)).toEqual({ date, slotId: 32, cancelled: false })
})

test('staff with calendar view access can inspect session status', async ({ page }) => {
  const { updates } = await openCalendar(page, false, [followingWeek])
  await expect(page.getByText('Day cancelled', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /(?:Cancel|Restore) full day/ })).toHaveCount(0)
  await page.getByRole('button', { name: /Tumbling, November 16, 2026/ }).click()
  const dialog = page.getByRole('dialog', { name: activeClassName })
  await expect(dialog.getByRole('status')).toHaveText('Scheduled')
  await expect(dialog.getByRole('button')).toHaveCount(1)
  expect(updates).toHaveLength(0)
})

test('full-day cancellation stops regular classes and trials and reloads separate cancellations when restored', async ({ page }) => {
  const { dayUpdates, calendarReads, cancelSeparately, failNextUpdate } = await openCalendar(page, true)
  const firstClass = page.getByRole('button', { name: /Tumbling, November 16, 2026/ })
  const trialSession = page.getByRole('button', { name: /Trial skills assessment, November 16, 2026/ })
  const laterClass = page.getByRole('button', { name: /Tumbling, November 23, 2026/ })
  const closeDate = page.getByRole('button', { name: 'Cancel full day for November 16, 2026', exact: true })
  const restoreDate = page.getByRole('button', { name: 'Restore full day for November 16, 2026', exact: true })

  await closeDate.click()
  let dialog = page.getByRole('dialog', { name: 'Cancel full day' })
  await expect(dialog.getByText('Monday, November 16, 2026', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Go back', exact: true }).click()
  expect(dayUpdates).toEqual([])
  await expect(trialSession).not.toHaveAccessibleName(/Cancelled/)
  cancelSeparately(32, date)

  const readsBeforeCancellation = calendarReads()
  await closeDate.click()
  failNextUpdate()
  await dialog.getByRole('button', { name: 'Cancel full day', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Could not update the day. Try again.')
  await dialog.getByRole('button', { name: 'Cancel full day', exact: true }).click()
  await expect(restoreDate).toBeVisible()
  expect(calendarReads()).toBeGreaterThan(readsBeforeCancellation)
  await expect(firstClass).toHaveAccessibleName(/Cancelled/)
  await expect(trialSession).toHaveAccessibleName(/Cancelled/)
  await expect(laterClass).not.toHaveAccessibleName(/Cancelled/)

  await firstClass.click()
  const session = page.getByRole('dialog', { name: activeClassName })
  await expect(session.getByText('Full day cancelled', { exact: true })).toBeVisible()
  await expect(session.getByRole('button', { name: 'Restore class' })).toHaveCount(0)
  await session.getByRole('button', { name: 'Close', exact: true }).click()

  const readsBeforeRestore = calendarReads()
  await restoreDate.click()
  dialog = page.getByRole('dialog', { name: 'Restore full day' })
  await dialog.getByRole('button', { name: 'Restore full day', exact: true }).click()
  await expect(closeDate).toBeVisible()
  expect(calendarReads()).toBeGreaterThan(readsBeforeRestore)
  await expect(firstClass).not.toHaveAccessibleName(/Cancelled/)
  await expect(trialSession).toHaveAccessibleName(/Cancelled/)
  expect(dayUpdates).toEqual([{ date, cancelled: true }, { date, cancelled: true }, { date, cancelled: false }])
})

test('an empty date can be cancelled in Week and restored in Day view', async ({ page }) => {
  const { dayUpdates } = await openCalendar(page, true)
  await page.getByRole('button', { name: 'week', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel full day for November 17, 2026', exact: true }).click()
  await page.getByRole('dialog', { name: 'Cancel full day' }).getByRole('button', { name: 'Cancel full day', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Restore full day for November 17, 2026', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'day', exact: true }).click()
  await page.getByRole('button', { name: 'Next period', exact: true }).click()
  await page.getByRole('button', { name: 'Restore full day', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Restore full day' }).getByText('Tuesday, November 17, 2026', { exact: true })).toBeVisible()
  await page.getByRole('dialog', { name: 'Restore full day' }).getByRole('button', { name: 'Restore full day', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cancel full day', exact: true })).toBeVisible()
  expect(dayUpdates).toEqual([{ date: '2026-11-17', cancelled: true }, { date: '2026-11-17', cancelled: false }])
})
