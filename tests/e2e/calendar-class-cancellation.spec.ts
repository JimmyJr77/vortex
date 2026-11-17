import { expect, test, type Page } from '@playwright/test'
import type { SchedulingCalendarEvent } from '../../src/utils/schedulingApi'

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

async function openCalendar(page: Page, canManage: boolean) {
  await page.clock.setFixedTime(new Date('2026-11-16T15:00:00Z'))
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Schedule Manager', isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })

  const events = [eventFor(31, date), eventFor(32, date, true), eventFor(31, followingWeek)]
  const updates: { date: string; slotId: number; cancelled: boolean }[] = []
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
      const start = url.searchParams.get('startDate')!
      const end = url.searchParams.get('endDate')!
      const id = url.searchParams.get('programId')
      data = {
        year: 2026,
        month: 11,
        startDate: start,
        endDate: end,
        events: events.filter((event) => event.date >= start && event.date <= end && (!id || String(event.classEventId) === id)),
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
    await route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Calendar', exact: true }).click()
  return { updates, failNextUpdate: () => { failNextUpdate = true } }
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
  const { updates } = await openCalendar(page, false)
  await page.getByRole('button', { name: /Tumbling, November 16, 2026/ }).click()
  const dialog = page.getByRole('dialog', { name: activeClassName })
  await expect(dialog.getByRole('status')).toHaveText('Scheduled')
  await expect(dialog.getByRole('button')).toHaveCount(1)
  expect(updates).toHaveLength(0)
})
