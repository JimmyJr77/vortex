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

  test('mobile visitors can open the guide beside each starting class', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const guides = [
      { link: 'What children learn in preschool gymnastics', path: 'preschool-gymnastics-what-toddlers-learn', heading: 'What children learn in preschool gymnastics' },
      { link: 'Compare gymnastics and tumbling for kids', path: 'gymnastics-vs-tumbling', heading: 'Gymnastics vs. tumbling for kids' },
      { link: 'Compare youth sports and fitness in Bowie', path: 'youth-sports-bowie', heading: 'A parent’s guide to youth sports in Bowie, MD' },
      { link: 'Returning to gymnastics as an adult', path: 'returning-to-gymnastics-as-an-adult', heading: 'Returning to gymnastics as an adult' },
    ]
    for (const { link, path, heading } of guides) {
      await page.goto('/')
      const startingClasses = page.getByRole('region', { name: 'Find a class by age and experience' })
      await startingClasses.getByRole('link', { name: link, exact: true }).click()
      await expect(page).toHaveURL(`/blog/${path}`)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    }

    await page.goto('/fit-and-flip')
    await page.getByRole('link', { name: 'Compare local youth sports and fitness options' }).click()
    await expect(page).toHaveURL('/blog/youth-sports-bowie#choose-an-activity')
    await expect(page.getByRole('heading', { name: 'Choose an activity your child wants to come back to' })).toBeInViewport()
  })

  test('mobile visitors can go from a program page to facility photos and back to a starting class', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/gymnastics')
    const visit = page.getByRole('region', { name: 'Visit Vortex in Bowie' })
    await visit.getByRole('link', { name: 'See inside the Bowie gym' }).click()
    await expect(page).toHaveURL('/contact#inside-the-gym')
    const gym = page.getByRole('region', { name: 'Inside the Bowie gym' })
    await expect(gym.getByRole('heading', { level: 2 })).toBeInViewport()
    await expect(gym.getByRole('img')).toHaveCount(3)
    await expect(gym.getByRole('img', { name: /Padded trampoline/ })).toHaveAttribute('src', '/gym-DSC02700-1600.webp')
    const directions = new URL(await page.getByRole('link', { name: 'Get directions to Vortex', exact: true }).getAttribute('href') ?? '')
    expect(directions.origin + directions.pathname).toBe('https://www.google.com/maps/dir/')
    expect(directions.searchParams.get('destination')).toBe('4961 Tesla Dr Suite E, Bowie, MD 20715')
    const mobileFits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
    expect(mobileFits).toBe(true)
    await gym.getByRole('link', { name: 'Find a youth gymnastics starting class' }).click()
    await expect(page).toHaveURL('/gymnastics#choose-a-class')
    await expect(page.getByRole('heading', { name: 'Find the right starting class' })).toBeInViewport()
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
      enrollmentClass(9, 'Tornadoes', 'BEGINNER'),
      { ...enrollmentClass(22, 'Cyclones', 'INTERMEDIATE'), excludeFromDropIns: true },
      enrollmentClass(14, 'Hidden class', 'ADVANCED', false), enrollmentClass(15, 'Expired class', 'ADVANCED'),
      enrollmentClass(16, 'Different program form', 'ADVANCED'),
    ]
    await page.route('**/api/public/classes-offered', (route) => route.fulfill({ json: {
      success: true, data: { programs: [
        { id: developmentalProgram, displayName: 'Development Gymnastics', classes,
          pricingCostOptions: [{ key: 'monthly_flat', enabled: true, amountCents: 99999 }] },
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
    await expect(schedule.locator('.np-recurring-schedule summary')).toHaveText(['Tornadoes Beginner', 'Cyclones Intermediate'])
    const times = schedule.getByText('Tuesday · 4:00 PM – 5:30 PM', { exact: true })
    await expect(times.first()).toBeHidden()
    await schedule.getByText('Tornadoes Beginner', { exact: true }).click()
    await expect(times.first()).toBeVisible()
    await expect(schedule.getByRole('link', { name: 'Check dates and availability' }))
      .toHaveAttribute('href', '/enroll?program=Developmental%20Gymnastics')
    expect([...requestedForms].sort((a, b) => a - b)).toEqual([9, 15, 16, 22])

    await page.route(/\/api\/signup\/catalog\/classes\/(9|22)\/offerings$/, (route) => {
      expect(route.request().headers().authorization).toBeUndefined()
      const formId = Number(new URL(route.request().url()).pathname.split('/').at(-2))
      const option = { scheduleMode: 'day', slotGroupId: formId, offeringId: formId + 100 }
      return route.fulfill({ json: { success: true, data: {
        formId, costUnit: formId === 9 ? 'per_month' : 'per_class',
        scheduleOptions: [
          { ...option, priceCents: 15000 },
          { ...option, priceCents: 16000 },
          { ...option, offeringId: 999, priceCents: 1000 },
          { ...option, scheduleMode: 'date', priceCents: 2000 },
        ],
      } } })
    })
    await page.route('**/api/public/drop-ins', (route) => {
      expect(route.request().headers().authorization).toBeUndefined()
      const youth = { programName: 'Development Gymnastics', classId: 9, date: classDate, totalCents: 5000, isFull: false }
      return route.fulfill({ json: { success: true, data: { sessions: [
        youth,
        { ...youth, totalCents: 1000, isFull: true },
        { ...youth, totalCents: 2000, excludedFromDropIns: true },
        { ...youth, programName: 'Fit & Flip', totalCents: 3000 },
      ] } } })
    })
    await page.getByRole('link', { name: 'Compare youth gymnastics prices' }).click()
    await expect(page).toHaveURL('/gymnastics#youth-gymnastics-pricing')
    const pricing = page.locator('#youth-gymnastics-pricing')
    await expect(pricing.getByRole('table')).toBeVisible()
    const tornadoesPricing = pricing.getByRole('row', { name: /Tornadoes/ })
    await expect(tornadoesPricing.getByRole('cell')).toHaveText(['$150.00–$160.00', '$50.00'])
    await expect(tornadoesPricing.getByRole('link', { name: 'Tornadoes' }))
      .toHaveAttribute('href', '/enroll?program=Developmental%20Gymnastics&form=9')
    await expect(pricing.getByRole('row', { name: /Cyclones/ }).getByRole('cell')).toHaveText(['See enrollment', 'Unavailable'])
    await expect(pricing.getByRole('link', { name: 'Find a free gymnastics trial' })).toHaveAttribute('href', '/gymnastics#first-visit')
    await pricing.getByRole('link', { name: 'Review available drop-in dates' }).click()
    await expect(page).toHaveURL('/drop-in?program=Developmental%20Gymnastics')
    await expect(page.getByRole('heading', { name: 'Youth gymnastics drop-ins.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tornadoes' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Fit & Flip|Cyclones/ })).toHaveCount(0)
  })

  test('Fit & Flip compares current prices by program without using member benefits', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const program = 'Fit & Flip'
    const groups = [
      { id: 41, formId: 30, displayName: 'Cyclones (8–11)', ageMin: 8, priceCents: 15000 },
      { id: 42, formId: 31, displayName: 'Cyclones (12–15)', ageMin: 12, priceCents: 16000 },
    ]
    await page.route('**/api/public/classes-offered', route => route.fulfill({ json: { success: true, data: {
      programs: [{ id: 9, displayName: program, classes: groups.map(group => ({ ...group, enrollVisible: true })) }],
    } } }))
    const priceRequests: { path: string; authorization?: string }[] = []
    for (const { id, formId, priceCents } of groups) {
      const offeringId = formId + 100
      const groupId = formId + 200
      const slot = { formId, isActive: true, scheduleMode: 'day', dayOfWeek: 2,
        dayName: 'Tuesday', startTime: '18:00', endTime: '19:30' }
      await page.route(`**/api/scheduling/forms/${formId}`, route => route.fulfill({ json: { success: true, data: {
        id: formId, isActive: true, programsId: 9,
        slotGroups: [{ id: groupId, formId, offeringId, isActive: true, scheduleMode: 'day', occurrences: [slot] }],
      } } }))
      await page.route(`**/api/scheduling/forms/${formId}/offerings`, route => route.fulfill({ json: { success: true, data: [{ id: offeringId, formId }] } }))
      await page.route(`**/api/signup/catalog/classes/${id}/offerings`, route => {
        const request = route.request()
        priceRequests.push({ path: new URL(request.url()).pathname, authorization: request.headers().authorization })
        return route.fulfill({ json: { success: true, data: {
          formId, costUnit: 'per_month', scheduleOptions: [
            { scheduleMode: 'day', slotGroupId: groupId, offeringId, priceCents },
            { scheduleMode: 'day', slotGroupId: groupId, offeringId: 999, priceCents: 1000 },
          ],
        } } })
      })
    }
    await page.route('**/api/public/drop-ins', route => {
      const request = route.request()
      priceRequests.push({ path: new URL(request.url()).pathname, authorization: request.headers().authorization })
      return route.fulfill({ json: { success: true, data: { sessions: [
        { programName: program, totalCents: 5000, isFull: false },
        { programName: program, totalCents: 6000, isFull: false },
        { programName: program, totalCents: 2000, isFull: true },
        { programName: program, totalCents: 1000, excludedFromDropIns: true },
        { programName: 'Adult Fitness & Acrobatics', totalCents: 2500, isFull: false },
      ] } } })
    })

    await page.goto('/blog/youth-sports-bowie')
    await page.getByRole('link', { name: 'Compare Fit & Flip prices', exact: true }).click()
    await expect(page).toHaveURL('/fit-and-flip#fit-flip-class-pricing')
    const schedule = page.getByRole('region', { name: 'Recurring Fit & Flip class times' })
    await expect(schedule.locator('.np-recurring-schedule > ul > li')).toContainText(['Cyclones (8–11)', 'Cyclones (12–15)'])
    expect(priceRequests).toEqual([])
    await page.evaluate(() => localStorage.setItem('vortex_member_token', 'test-member-token'))
    const pricing = page.locator('#fit-flip-class-pricing')
    await pricing.locator('summary').click()
    await expect(pricing.getByText('$150.00–$160.00 per month', { exact: true })).toBeVisible()
    await expect(pricing.getByText('$50.00–$60.00 per class', { exact: true })).toBeVisible()
    await expect(pricing.getByText('$0 on qualifying dates', { exact: true })).toBeVisible()
    await expect(pricing.getByText(/Paid monthly enrollment requires an active annual membership/)).toBeVisible()
    await expect(pricing.getByRole('link', { name: 'Review monthly enrollment' })).toHaveAttribute('href', '/enroll?program=Fit%20%26%20Flip')
    await expect(pricing.getByRole('link', { name: 'Review available drop-in dates' })).toHaveAttribute('href', '/drop-in?program=Fit%20%26%20Flip')
    await expect(pricing.getByRole('link', { name: 'Find a free Fit & Flip trial' })).toHaveAttribute('href', '/fit-and-flip#training-fit')
    expect(priceRequests.map(({ path }) => path).sort()).toEqual([
      '/api/public/drop-ins', '/api/signup/catalog/classes/41/offerings', '/api/signup/catalog/classes/42/offerings',
    ])
    expect(priceRequests.every(({ authorization }) => authorization === undefined)).toBe(true)
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
