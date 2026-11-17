import { expect, test } from '@playwright/test'
import type { SchedulingCalendarEvent } from '../../src/utils/schedulingApi'

const classDate = '2027-01-12'
const earlierDate = '2027-01-11'
const cyclones: SchedulingCalendarEvent = {
  id: '30:98:107:2027-01-12', date: classDate, startTime: '18:00', endTime: '19:30',
  formId: 30, classEventId: 14, programsId: 9, programName: 'Fit & Flip', className: 'Cyclones',
  classDescription: null, skillLevel: null, skillRequirements: null, ageMin: 8, ageMax: 11,
  offeringId: 18, offeringLabel: null, offeringStartDate: null, offeringEndDate: null,
  slotGroupId: 98, timeSlotId: 107, maxParticipants: 6, signupCount: 2, waitlistCount: 0,
  spotsRemaining: 4, isFull: false, formActive: true, enrollVisible: true, classActive: true,
  slotGroupActive: true, slotActive: true, isCancelled: false, isTrialAssessment: false,
}

test.describe('Client-critical smoke flows', () => {
  test('public homepage renders core CTAs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1, name: 'Gymnastics & youth athletic training in Bowie, MD' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Directions to the Bowie gym' })).toHaveAttribute('href', '/contact')
    await expect(page.getByRole('button', { name: 'Book a free trial', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Schedule', exact: true })).toHaveAttribute('href', '/read-board#schedule')
  })

  test('class schedule links preserve the selected view across history and reload', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const scheduleUrl = '/read-board?utm_source=schedule-qa#schedule'
    const eventsUrl = '/read-board?utm_source=schedule-qa#events'
    await page.goto(scheduleUrl, { waitUntil: 'domcontentloaded' })

    const tabs = page.getByRole('navigation', { name: 'Browse classes and updates' })
    const scheduleTab = tabs.getByRole('link', { name: 'Schedule', exact: true })
    const eventsTab = tabs.getByRole('link', { name: 'Events', exact: true })
    const calendar = page.locator('section#schedule').getByRole('button', { name: 'By class', exact: true })
    await expect(scheduleTab).toHaveAttribute('aria-current', 'location')
    await expect(calendar).toBeVisible()

    await eventsTab.click()
    await expect(page).toHaveURL(eventsUrl)
    await expect(eventsTab).toHaveAttribute('aria-current', 'location')
    await expect(page.getByRole('heading', { name: 'Upcoming Events', exact: true })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(scheduleUrl)
    await expect(scheduleTab).toHaveAttribute('aria-current', 'location')
    await expect(calendar).toBeVisible()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(scheduleUrl)
    await expect(scheduleTab).toHaveAttribute('aria-current', 'location')
    await expect(calendar).toBeVisible()
  })

  test('Day view keeps an eligible class time and date in the enrollment link', async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${classDate}T12:00:00`))
    const events = [
      cyclones,
      { ...cyclones, id: 'full', className: 'Full Cyclones', slotGroupId: 99, timeSlotId: 108,
        startTime: '19:00', signupCount: 6, spotsRemaining: 0, isFull: true },
      { ...cyclones, id: 'cancelled', className: 'Cancelled Cyclones', isCancelled: true },
      { ...cyclones, id: 'assessment', className: 'Trial Assessment', isTrialAssessment: true },
      { ...cyclones, id: 'past', className: 'Earlier Cyclones', date: earlierDate },
    ]
    await page.route('**/api/scheduling/calendar?*', route => route.fulfill({
      json: { success: true, data: { year: 2027, month: 1, events, tbdPatterns: [] } },
    }))
    await page.route('**/api/public/scheduling/classes', route => route.fulfill({
      json: { success: true, data: [] },
    }))

    await page.goto('/read-board#schedule')
    const calendar = page.locator('section#schedule')
    await calendar.getByRole('button', { name: /^day$/i }).click()
    await expect(calendar.getByRole('button', { name: /Cancelled Cyclones/ })).toBeVisible()
    await expect(calendar.getByRole('button', { name: /Trial Assessment/ })).toBeVisible()

    const signup = calendar.getByRole('link', { name: 'Sign Up', exact: true })
    await expect(signup).toHaveCount(2)
    await expect(signup.nth(0)).toHaveAttribute('href',
      `/enroll?form=30&offeringId=18&slotGroupId=98&timeSlotId=107&enrollmentStartDate=${classDate}`)
    await expect(signup.nth(1)).toHaveAttribute('href',
      `/enroll?form=30&offeringId=18&slotGroupId=99&timeSlotId=108&enrollmentStartDate=${classDate}`)

    await calendar.getByRole('button', { name: 'Previous period', exact: true }).click()
    await expect(calendar.getByRole('button', { name: /Earlier Cyclones/ })).toBeVisible()
    await expect(signup).toHaveCount(0)
  })

  test('Day view keeps the selected date when an older calendar request finishes last', async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${classDate}T12:00:00`))
    let releaseToday = () => {}
    let finishToday = () => {}
    const holdToday = new Promise<void>(resolve => { releaseToday = resolve })
    const todayFinished = new Promise<void>(resolve => { finishToday = resolve })
    await page.route('**/api/scheduling/calendar?*', async route => {
      const params = new URL(route.request().url()).searchParams
      const start = params.get('startDate')
      const isToday = start === classDate && params.get('endDate') === classDate
      if (isToday) await holdToday
      const events = start === earlierDate
        ? [{ ...cyclones, id: 'earlier', date: earlierDate, className: 'Earlier Cyclones' }]
        : isToday ? [cyclones] : []
      const response = { json: { success: true, data: { year: 2027, month: 1, events, tbdPatterns: [] } } }
      if (isToday) {
        try {
          await route.fulfill(response)
        } catch (error) {
          if (!route.request().failure()?.errorText.includes('ABORTED')) throw error
        } finally {
          finishToday()
        }
      } else {
        await route.fulfill(response)
      }
    })
    await page.route('**/api/public/scheduling/classes', route => route.fulfill({
      json: { success: true, data: [] },
    }))

    try {
      await page.goto('/read-board#schedule')
      const calendar = page.locator('section#schedule')
      const todayRequest = page.waitForRequest(request => {
        const url = new URL(request.url())
        return url.pathname === '/api/scheduling/calendar' && url.searchParams.get('startDate') === classDate
      })
      await calendar.getByRole('button', { name: /^day$/i }).click()
      await todayRequest
      await calendar.getByRole('button', { name: 'Previous period', exact: true }).click()
      const earlierClass = calendar.getByRole('button', { name: /Earlier Cyclones/ })
      await expect(earlierClass).toBeVisible()
      releaseToday()
      await todayFinished
      // Let the stale fetch and a subsequent React render finish if the request was not aborted.
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
      await expect(earlierClass).toBeVisible()
    } finally {
      releaseToday()
    }
  })

  test('account login modal opens from public flow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const memberLogin = page.getByRole('button', { name: 'Member login', exact: true })
    await memberLogin.click()
    await expect(page.getByRole('heading', { name: 'Account Login' })).toBeVisible()
    await expect(page.getByText('Forgot password?')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(memberLogin).toBeFocused()
  })
})
