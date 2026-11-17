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
    const visit = page.getByRole('region', { name: 'Visit Vortex in Bowie, MD' })
    await expect(visit.getByText('4961 Tesla Dr Suite E', { exact: false })).toBeVisible()
    await expect(visit.getByRole('link', { name: 'See the class schedule' })).toHaveAttribute('href', '/read-board#schedule')
    await expect(page.getByRole('button', { name: 'Book a free trial', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Schedule', exact: true })).toHaveAttribute('href', '/read-board#schedule')
    const startingClasses = page.getByRole('region', { name: 'Find a class by age and experience' })
    await expect(startingClasses.getByRole('link', { name: /Ages 2–5.*preschool/i })).toHaveAttribute('href', '/gymnastics#preschool')
    await expect(startingClasses.getByRole('link', { name: /Ages 6–17.*kids and teens/i })).toHaveAttribute('href', '/gymnastics#choose-a-class')
    await expect(startingClasses.getByRole('link', { name: /Ages 8–15.*Fit & Flip/i })).toHaveAttribute('href', '/fit-and-flip#fit-flip-schedule')
    await expect(startingClasses.getByRole('link', { name: /Ages 18 and up.*adult gymnastics/i })).toHaveAttribute('href', '/adult-gymnastics')
  })

  test('homepage previews and recommendations preserve the chosen enrollment program', async ({ page }) => {
    await page.route('**/api/public/classes-offered', (route) => route.fulfill({ json: { success: true, data: { programs: [
      { id: 4, displayName: 'Developmental Gymnastics', classes: [] },
      { id: 9, displayName: 'Fit & Flip', classes: [] },
    ] } } }))
    await page.goto('/')
    await page.getByRole('button', { name: 'Explore Gymnastics', exact: true }).click()
    await page.getByRole('dialog', { name: 'Gymnastics' }).getByRole('link', { name: 'Browse classes & enroll' }).click()
    await expect(page).toHaveURL('/enroll?program=Developmental%20Gymnastics')
    await expect(page.getByRole('combobox', { name: 'Program', exact: true })).toHaveValue('4')

    await page.goto('/')
    await page.getByRole('button', { name: 'Find your fit', exact: true }).click()
    await page.getByRole('button', { name: /Become a better all-around athlete/ }).click()
    await page.getByRole('button', { name: 'Explore the program', exact: true }).click()
    await page.getByRole('dialog', { name: 'Fit & Flip' }).getByRole('link', { name: 'Browse classes & enroll' }).click()
    await expect(page).toHaveURL('/enroll?program=Fit%20%26%20Flip')
    await expect(page.getByRole('combobox', { name: 'Program', exact: true })).toHaveValue('9')
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

  test('the youth gymnastics page lists published weekly times and keeps class levels distinct', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.clock.setFixedTime(new Date('2027-01-12T18:00:00Z'))
    const developmentalProgram = 2
    const enrollmentClass = (formId: number, displayName: string, skillLevel: string, enrollVisible = true) =>
      ({ id: formId, formId, displayName, skillLevel, enrollVisible })
    const classes = [
      enrollmentClass(9, 'Tornadoes', 'BEGINNER'), enrollmentClass(22, 'Cyclones', 'INTERMEDIATE'),
      enrollmentClass(14, 'Hidden class', 'ADVANCED', false), enrollmentClass(15, 'Expired class', 'ADVANCED'),
      enrollmentClass(16, 'Different program form', 'ADVANCED'),
    ]
    await page.route('**/api/public/classes-offered', (route) => route.fulfill({ json: {
      success: true, data: { programs: [
        { id: developmentalProgram, displayName: 'Development Gymnastics', classes },
        { id: 9, displayName: 'Fit & Flip', classes: [enrollmentClass(30, 'Cyclones (8–11)', 'BEGINNER')] },
        { id: 13, displayName: 'Vortex Gymnastics Team', classes: [enrollmentClass(31, 'Team', 'ADVANCED')] },
      ] },
    } }))
    const requestedForms = new Set<number>()
    await page.route(/\/api\/scheduling\/forms\/\d+(?:\/offerings)?$/, (route) => {
      const [, id, offerings] = new URL(route.request().url()).pathname.match(/\/(\d+)(\/offerings)?$/)!
      const formId = Number(id)
      requestedForms.add(formId)
      const offeringId = formId + 100
      const slot = { formId, isActive: true, scheduleMode: 'day', dayOfWeek: 2,
        dayName: 'Tuesday', startTime: '16:00', endTime: '17:30' }
      const data = offerings ? [{ id: offeringId, formId, endDate: formId === 15 ? '2026-12-31' : null }] : {
        id: formId, isActive: true, programsId: formId === 16 ? 9 : developmentalProgram,
        slotGroups: [{ id: formId, formId, offeringId, isActive: true, scheduleMode: 'day', occurrences: [slot] }],
      }
      return route.fulfill({ json: { success: true, data } })
    })

    await page.goto('/gymnastics#youth-gymnastics-schedule')
    const schedule = page.getByRole('region', { name: 'Weekly youth gymnastics class schedule' })
    await expect(schedule.getByRole('heading')).toBeInViewport()
    await expect(schedule.locator('summary')).toHaveText(['Tornadoes Beginner', 'Cyclones Intermediate'])
    const times = schedule.getByText('Tuesday · 4:00 PM – 5:30 PM', { exact: true })
    await expect(times.first()).toBeHidden()
    await schedule.getByText('Tornadoes Beginner', { exact: true }).click()
    await expect(times.first()).toBeVisible()
    await expect(schedule.getByRole('link', { name: 'Check dates and availability' }))
      .toHaveAttribute('href', '/enroll?program=Developmental%20Gymnastics')
    expect([...requestedForms].sort((a, b) => a - b)).toEqual([9, 15, 16, 22])
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
