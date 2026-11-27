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

for (const timezoneId of ['America/New_York', 'Asia/Tokyo', 'UTC']) {
  test.describe(`public class dates in ${timezoneId}`, () => {
    test.use({ timezoneId })

    test('keeps Bowie’s current class date through calendar, enrollment and drop-ins', async ({ page }) => {
      // The date has rolled into December in Tokyo and UTC, but the class has yet to start in Bowie.
      const classDate = '2026-11-30'
      await page.clock.setFixedTime(new Date('2026-12-01T01:00:00Z'))
      const event = { ...eventFor(31, classDate), startTime: '20:30', endTime: '21:30', enrollVisible: true }
      const slot = {
        ...event, id: event.timeSlotId, scheduleMode: 'day', dayOfWeek: 1, dayName: 'Monday', isActive: true,
      }
      await page.route('**/api/**', route => {
        const request = route.request()
        const url = new URL(request.url())
        expect(request.method()).toBe('GET')
        const json = (data: unknown) => route.fulfill({ json: { success: true, data } })
        if (url.pathname === '/api/scheduling/calendar') {
          const startDate = url.searchParams.get('startDate')!
          const endDate = url.searchParams.get('endDate')!
          return json({ year: 2026, month: 11, startDate, endDate, events: classDate >= startDate && classDate <= endDate ? [event] : [], tbdPatterns: [] })
        }
        if (url.pathname === `/api/scheduling/forms/${event.formId}`) {
          return json({
            id: event.formId, title: event.className, isActive: true, timeSlots: [slot],
            slotGroups: [{
              id: event.slotGroupId, formId: event.formId, scheduleMode: 'day',
              isActive: true, spotsRemaining: event.spotsRemaining, occurrences: [slot],
            }],
          })
        }
        if (url.pathname === '/api/public/classes-offered') return json({ programs: [] })
        if (url.pathname === '/api/public/drop-ins') return json({ sessions: [] })
        return json([])
      })

      await page.goto('/read-board#schedule')
      const calendar = page.locator('#schedule [data-prerender-dynamic]')
      await expect(calendar.getByRole('heading', { name: 'November 2026', exact: true })).toBeVisible()
      await calendar.getByRole('button', { name: 'day', exact: true }).press('Enter')
      await expect(calendar.getByRole('heading', { name: 'Monday, November 30, 2026', exact: true })).toBeVisible()
      const signup = calendar.getByRole('link', { name: 'Sign Up', exact: true })
      await expect(signup).toHaveAttribute('href', `/enroll?form=41&slotGroupId=51&timeSlotId=31&enrollmentStartDate=${classDate}`)
      await signup.press('Enter')

      const start = page.getByLabel('Enrollment start date')
      await expect(start).toHaveValue(classDate)
      await expect(start).toHaveAttribute('min', classDate)
      expect(await start.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(true)
      await page.reload()
      await expect(start).toHaveValue(classDate)
      await expect(start).toHaveAttribute('min', classDate)

      await page.goto('/drop-in')
      const dropIn = page.getByLabel('Drop-in date')
      await expect(dropIn).toHaveAttribute('min', classDate)
      await dropIn.fill(classDate)
      expect(await dropIn.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(true)
    })
  })
}

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
  const updates: { date: string; slotId: number; cancelled: boolean; emailBody?: string }[] = []
  const dayUpdates: { date: string; cancelled: boolean; emailBody?: string }[] = []
  let calendarReads = 0
  let failNextUpdate = false
  let failNextPreview = false

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
    if (url.pathname === '/api/admin/scheduling/calendar/cancellation-preview') {
      expect(request.method()).toBe('POST')
      if (failNextPreview) {
        return route.fulfill({ status: 400, json: { success: false, message: 'Could not load parent notification. Try again.' } })
      }
      const selection = request.postDataJSON() as { date: string; slotId?: number }
      const sessions = events.filter(event => event.date === selection.date && (!selection.slotId || event.timeSlotId === selection.slotId) && !event.isCancelled)
      const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${selection.date}T12:00:00Z`))
      data = {
        subject: `Class cancellation for ${dateLabel}`,
        body: `Dear Vortex families,\n\nWe are sorry that the following sessions on ${dateLabel} have been canceled:\n${sessions.map(session => `${session.className}: 4:00 PM – 5:00 PM`).join('\n')}\n\nWe will work with you to facilitate a make-up date. Thank you for your understanding.\n\nVortex Athletics`,
        recipientCount: sessions.length ? 2 : 0,
        missingContactCount: 0,
        affectedSessions: sessions.map(session => ({ className: session.className, date: session.date, startTime: session.startTime, endTime: session.endTime })),
      }
    }
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
      data = { ...update, ...(update.cancelled ? { notifications: { sent: 1, pending: 1, failed: 0, recipientCount: 2, missingContactCount: 0 } } : {}) }
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
      data = { ...update, ...(update.cancelled ? { notifications: { sent: 2, pending: 0, failed: 0, recipientCount: 2, missingContactCount: 0 } } : {}) }
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
    setPreviewFailure: (fail: boolean) => { failNextPreview = fail },
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
  const email = regular.getByLabel('Email message to parents')
  await expect(email).toHaveValue(/Monday, November 16, 2026/)
  await expect(email).toHaveValue(/Tumbling: 4:00 PM – 5:00 PM/)
  const signature = regular.getByRole('complementary', { name: 'Vortex email signature' })
  await expect(signature.getByRole('img', { name: 'Vortex Athletics & Gymnastics' })).toHaveAttribute('src', 'https://vortexathletics.com/vortex-athletics-gymnastics-logo.png')
  await expect(signature).toContainText('4961 Tesla Dr, Ste E, Bowie, MD 20715')
  await expect(signature.getByRole('link', { name: '443-422-4794 (gym)' })).toHaveAttribute('href', 'tel:4434224794')
  const editedMessage = `${await email.inputValue()}\nPlease contact our front desk to arrange your make-up.`
  await email.fill(' ')
  await expect(regular.getByRole('button', { name: 'Confirm cancellation' })).toBeDisabled()
  await email.fill(editedMessage)
  failNextUpdate()
  await regular.getByRole('button', { name: 'Confirm cancellation' }).click()
  await expect(regular.getByRole('alert')).toHaveText('Could not update the session. Try again.')
  await regular.getByRole('button', { name: 'Confirm cancellation' }).click()
  await expect(regular.getByRole('status').filter({ hasText: /^Cancelled$/ })).toBeVisible()
  await expect(regular.getByText(/1 pending; delivery will retry automatically/)).toBeVisible()
  expect(updates.at(-1)).toEqual({ date, slotId: 31, cancelled: true, emailBody: editedMessage })
  await regular.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(firstClass).toHaveAccessibleName(/Cancelled/)
  await expect(laterClass).not.toHaveAccessibleName(/Cancelled/)

  await page.getByRole('button', { name: 'week', exact: true }).click()
  await firstClass.click()
  await regular.getByRole('button', { name: 'Restore class' }).click()
  await expect(regular.getByRole('status').filter({ hasText: /^Scheduled$/ })).toBeVisible()
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
  await expect(trial.getByRole('status').filter({ hasText: /^Cancelled$/ })).toBeVisible()
  expect(updates.at(-1)).toMatchObject({ date, slotId: 32, cancelled: true, emailBody: expect.stringContaining('Trial skills assessment: 4:00 PM – 5:00 PM') })
  await trial.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(trialDate).toHaveAccessibleName(/Cancelled/)
  await trialDate.click()
  await trial.getByRole('button', { name: 'Restore class' }).click()
  await expect(trial.getByRole('status').filter({ hasText: /^Scheduled$/ })).toBeVisible()
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

test('email preview failure blocks cancellation and can be retried on mobile', async ({ page }) => {
  const { updates, setPreviewFailure } = await openCalendar(page, true)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /Tumbling, November 16, 2026/ }).click()
  const dialog = page.getByRole('dialog', { name: activeClassName })
  setPreviewFailure(true)
  await dialog.getByRole('button', { name: 'Cancel class', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Could not load parent notification. Try again.')
  await expect(dialog.getByRole('button', { name: 'Confirm cancellation' })).toBeDisabled()
  expect(updates).toHaveLength(0)
  setPreviewFailure(false)
  await dialog.getByRole('button', { name: 'Retry email preview' }).click()
  await expect(dialog.getByLabel('Email message to parents')).toHaveValue(/make-up date/)
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await dialog.getByRole('button', { name: 'Keep scheduled' }).click()
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
  await expect(dialog.getByLabel('Email message to parents')).toHaveValue(/Trial skills assessment: 4:00 PM – 5:00 PM/)
  await dialog.getByRole('button', { name: 'Go back', exact: true }).click()
  expect(dayUpdates).toEqual([])
  await expect(trialSession).not.toHaveAccessibleName(/Cancelled/)
  cancelSeparately(32, date)

  const readsBeforeCancellation = calendarReads()
  await closeDate.click()
  const fullDayMessage = 'Dear families,\n\nTumbling on Monday, November 16, 2026, 4:00 PM – 5:00 PM is canceled. We will work with you to arrange a make-up date.\n\nThank you for your understanding,\nVortex Athletics'
  await dialog.getByLabel('Email message to parents').fill(fullDayMessage)
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
  expect(dayUpdates).toEqual([{ date, cancelled: true, emailBody: fullDayMessage }, { date, cancelled: true, emailBody: fullDayMessage }, { date, cancelled: false }])
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
  expect(dayUpdates[0]).toMatchObject({ date: '2026-11-17', cancelled: true, emailBody: expect.stringContaining('Tuesday, November 17, 2026') })
  expect(dayUpdates[1]).toEqual({ date: '2026-11-17', cancelled: false })
})
