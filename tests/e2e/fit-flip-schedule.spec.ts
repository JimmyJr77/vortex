import { expect, test, type Page } from '@playwright/test'

const fitAndFlip = 'Fit & Flip'
const bookingPath = `/enroll?program=${encodeURIComponent(fitAndFlip)}`
const younger = 'Cyclones ages 8–11'
const older = 'Cyclones ages 12–15'
const currentDay = '2026-11-17'
const staleDescription = 'Legacy catalog wording about ninja course dynamics.'
const staleDevelopmentDescription = 'Our developmental classes teach the full spectrum of gymnastics disciplines, including rhythmic and aerobic gymnastics.'
const developmentalDescription = /^Coached preschool and recreational gymnastics\./
const teamName = 'Vortex Gymnastics Team'
const staleTeamProgramDescription = 'VGT is the official artistic gymnastics team of Vortex Gymnastics'
const staleTeamClassDescription = 'Team athletes will participate in any of the following types of gymnastics competitions: Artistic, Acrobatics, Rhythmic, Aerobics, and Trampoline.'
const teamSignupPath = '/enroll?form=29'

function recurringGroup(formId: number, groupId: number, offeringId: number, dayOfWeek: number, startTime: string, endTime: string) {
  return {
    id: groupId, formId, offeringId, scheduleMode: 'day', isActive: true,
    occurrences: [{ id: groupId + 100, formId, slotGroupId: groupId, scheduleMode: 'day', dayOfWeek,
      startTime, endTime, isActive: true }],
  }
}

async function mockSchedule(page: Page, unavailableForms: number[] = []) {
  // It is already November 18 UTC, but November 17 at the gym.
  await page.clock.setFixedTime(new Date('2026-11-18T02:00:00Z'))
  const formRequests: number[] = []
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const json = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (path === '/api/public/classes-offered') {
      return json({ programs: [
        { id: 9, displayName: fitAndFlip, primarySportName: 'Gymnastics', description: staleDescription, classes: [
          { id: 61, displayName: older, ageMin: 12, ageMax: 15, formId: 31, enrollVisible: true },
          { id: 60, displayName: younger, ageMin: 8, ageMax: 11, formId: 30, enrollVisible: true },
          { id: 62, displayName: 'Unpublished Cyclones', formId: 32, enrollVisible: false, excludeFromDropIns: true },
        ] },
        { id: 5, displayName: 'Adult Fitness & Acrobatics', classes: [
          { id: 63, displayName: 'Typhoons', ageMin: 18, formId: 3, enrollVisible: true },
        ] },
        { id: 2, displayName: 'Development Gymnastics', description: staleDevelopmentDescription, classes: [
          { id: 64, displayName: 'Tornadoes', ageMin: 6, skillLevel: 'BEGINNER', formId: 5, enrollVisible: true },
          { id: 65, displayName: 'Dirt Devils (Mommy & Me)', ageMin: 2, ageMax: 3, skillLevel: 'EARLY_STAGE', formId: 11, enrollVisible: true },
          { id: 66, displayName: 'Gymnastics Cyclones', ageMin: 6, skillLevel: 'INTERMEDIATE', formId: 22, enrollVisible: true, description: 'Progress from beginner gymnastics skills.' },
        ] },
        { id: 13, displayName: teamName, description: staleTeamProgramDescription, classes: [{
          id: 40, displayName: teamName, description: staleTeamClassDescription, ageMin: 6, ageMax: null,
          formId: 29, enrollVisible: true, excludeFromDropIns: true, skillRequirements: 'Evaluation is required.',
          signupUrl: teamSignupPath,
        }] },
      ] })
    }
    if (path === '/api/public/drop-ins') {
      return json({ classes: [{
        classId: 60, formId: 30, className: younger, programId: 9, programName: fitAndFlip,
        programDescription: staleDescription, ageMin: 8, ageMax: 11,
      }, {
        classId: 64, formId: 5, className: 'Tornadoes', programId: 2, programName: 'Development Gymnastics',
        programDescription: staleDevelopmentDescription, ageMin: 6, skillLevel: 'BEGINNER',
      }], sessions: [] })
    }

    const formMatch = path.match(/^\/api\/scheduling\/forms\/(\d+)(\/offerings)?$/)
    if (!formMatch) return json({})
    const formId = Number(formMatch[1])
    if (formMatch[2]) {
      return json([
        { id: 1, formId, startDate: currentDay, endDate: currentDay },
        { id: 2, formId, startDate: '2026-11-18' },
      ])
    }

    formRequests.push(formId)
    if (formId !== 30 && formId !== 31) return json({})
    if (unavailableForms.includes(formId)) return route.fulfill({ status: 503, json: { success: false } })
    const [startTime, endTime] = formId === 30 ? ['18:00', '19:30'] : ['19:00', '20:30']
    return json({
      id: formId, programsId: 9, isActive: true, startDate: currentDay, endDate: currentDay,
      slotGroups: [
        { ...recurringGroup(formId, 1, 1, 2, startTime, endTime), activeStart: currentDay, activeEnd: currentDay },
        recurringGroup(formId, 2, 2, 4, '17:00', '18:30'),
        { ...recurringGroup(formId, 3, 1, 5, '17:00', '18:30'), activeEnd: '2026-11-16' },
      ],
    })
  })
  return formRequests
}

test('shows the current Eastern schedule by age and keeps the enrollment link on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const formRequests = await mockSchedule(page)
  await page.goto('/fit-and-flip')
  const schedule = page.getByRole('region', { name: 'Recurring Fit & Flip class times' })
  await schedule.scrollIntoViewIfNeeded()
  const cohorts = schedule.locator('.np-recurring-schedule > ul > li')
  await expect(cohorts).toHaveCount(2)
  await expect(cohorts.nth(0)).toContainText(younger)
  await expect(cohorts.nth(0)).toContainText('Tuesday · 6:00 PM – 7:30 PM')
  await expect(cohorts.nth(1)).toContainText(older)
  await expect(cohorts.nth(1)).toContainText('Tuesday · 7:00 PM – 8:30 PM')
  await expect(schedule.getByText(/Thursday|Friday|Unpublished|Typhoons/)).toHaveCount(0)
  await expect(schedule.getByRole('link', { name: 'Check dates and availability' })).toHaveAttribute('href', bookingPath)
  expect([...new Set(formRequests)].sort()).toEqual([30, 31])

  await page.getByRole('navigation', { name: 'Other Vortex programs' }).getByRole('link', { name: 'Youth Gymnastics', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Youth gymnastics classes in Bowie, MD' })).toBeVisible()
  await expect(schedule).toHaveCount(0)
  await expect(page.getByText(younger, { exact: true })).toHaveCount(0)
})

test('marks a recurring time full only when every matching group is confirmed full', async ({ page }) => {
  await mockSchedule(page)
  await page.route('**/api/scheduling/forms/30', route => route.fulfill({
    json: { success: true, data: {
      id: 30, programsId: 9, isActive: true, startDate: currentDay, endDate: currentDay,
      slotGroups: [
        { ...recurringGroup(30, 1, 1, 2, '18:00', '19:30'), isFull: true },
        { ...recurringGroup(30, 2, 1, 2, '18:00', '19:30'), isFull: true },
        { ...recurringGroup(30, 3, 1, 3, '18:00', '19:30'), isFull: true },
        { ...recurringGroup(30, 4, 1, 3, '18:00', '19:30'), isFull: false },
        { ...recurringGroup(30, 5, 1, 4, '18:00', '19:30'), isFull: true },
        recurringGroup(30, 6, 1, 4, '18:00', '19:30'),
      ],
    } },
  }))

  await page.goto('/fit-and-flip#fit-flip-schedule')
  const schedule = page.getByRole('region', { name: 'Recurring Fit & Flip class times' })
  const times = schedule.locator('.np-recurring-schedule > ul > li').filter({ hasText: younger }).getByRole('listitem')
  await expect(times).toHaveText([
    'Tuesday · 6:00 PM – 7:30 PM · Full',
    'Wednesday · 6:00 PM – 7:30 PM',
    'Thursday · 6:00 PM – 7:30 PM',
  ])
  await expect(schedule.getByText(/check enrollment for another time or waitlist options/i)).toBeVisible()
  await expect(schedule.getByRole('link', { name: 'Check dates and availability' })).toHaveAttribute('href', bookingPath)
})

test('keeps the healthy Fit & Flip group visible when the other form fails', async ({ page }) => {
  await mockSchedule(page, [30])
  await page.goto('/fit-and-flip')
  const schedule = page.getByRole('region', { name: 'Recurring Fit & Flip class times' })
  await schedule.scrollIntoViewIfNeeded()
  const cohorts = schedule.locator('.np-recurring-schedule > ul > li')
  await expect(cohorts).toHaveCount(1)
  await expect(cohorts).toContainText(older)
  await expect(schedule.getByRole('link', { name: 'Check dates and availability' })).toHaveAttribute('href', bookingPath)
})

test('keeps filtered enrollment available if weekly times cannot load', async ({ page }) => {
  await mockSchedule(page, [30, 31])
  await page.goto('/fit-and-flip')
  const schedule = page.getByRole('region', { name: 'Recurring Fit & Flip class times' })
  await schedule.scrollIntoViewIfNeeded()
  await expect(schedule.getByText('Check enrollment for current class times or contact Vortex for help.')).toBeVisible()
  await expect(schedule.getByRole('link', { name: 'Check dates and availability' })).toHaveAttribute('href', bookingPath)
})

test('returning from a linked class time keeps the focused catalog on reload and history', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockSchedule(page)
  await page.goto('/fit-and-flip')
  await page.goto(bookingPath + '&form=30&offeringId=1&slotGroupId=1&timeSlotId=101&enrollmentStartDate=' +
    currentDay + '&utm_source=calendar')

  await expect(page.getByRole('heading', { name: 'Enroll', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to classes', exact: true }).press('Enter')
  const catalogUrl = (url: URL) => url.pathname === '/enroll' && url.searchParams.get('form') === '30' &&
    url.searchParams.get('program') === fitAndFlip && url.searchParams.get('utm_source') === 'calendar' &&
    !['offeringId', 'slotGroupId', 'timeSlotId', 'enrollmentStartDate'].some(key => url.searchParams.has(key))
  const cohort = page.getByRole('heading', { name: younger, exact: true })
  await expect(page).toHaveURL(catalogUrl)
  await expect(cohort).toBeFocused()

  await page.reload()
  await expect(page).toHaveURL(catalogUrl)
  await expect(cohort).toBeFocused()
  await expect(page.getByRole('button', { name: 'Back to classes', exact: true })).toHaveCount(0)

  await page.goBack()
  await expect(page).toHaveURL('/fit-and-flip')
  await page.goForward()
  await expect(page).toHaveURL(catalogUrl)
  await expect(cohort).toBeFocused()
})

test('starts a mobile form link at the selected cohort while the other schedule still loads', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockSchedule(page)

  let releaseOlderSchedule = () => {}
  const olderScheduleReady = new Promise<void>(resolve => { releaseOlderSchedule = resolve })
  await page.route('**/api/signup/catalog/classes/{60,61}/offerings', async (route) => {
    const isOlder = new URL(route.request().url()).pathname.includes('/61/')
    if (isOlder) await olderScheduleReady
    await route.fulfill({ json: { success: true, data: {
      formId: isOlder ? 31 : 30,
      scheduleOptions: [{
        slotGroupId: 2, timeSlotId: 3, offeringId: 4, scheduleMode: 'day',
        scheduleLabel: isOlder ? 'Tuesday · 7:00 PM' : 'Tuesday · 6:00 PM', priceCents: 15000,
      }],
    } } })
  })

  try {
    await page.goto(`${bookingPath}&form=30`)
    const cards = page.locator('.np-enrollment-class')
    const selected = cards.first()
    const heading = selected.getByRole('heading', { name: younger })
    const date = page.getByLabel('Enrollment start date')
    const time = selected.getByRole('checkbox', { name: /Tuesday/ })
    await expect(heading).toBeFocused()
    await expect(heading).toBeInViewport({ ratio: 1 })
    await expect(selected.getByLabel('Enrollment start date')).toBeInViewport({ ratio: 1 })
    await expect(time).toBeInViewport({ ratio: 1 })
    await expect(cards.filter({ hasText: older })).toContainText('Loading schedule…')

    releaseOlderSchedule()
    await expect(cards.filter({ hasText: older }).getByRole('checkbox', { name: /Tuesday/ })).toBeVisible()
    await expect(heading).toBeFocused()
    await expect(heading).toBeInViewport({ ratio: 1 })

    await time.check()
    const checkout = page.getByRole('button', { name: 'Continue to account setup' })
    await checkout.click()
    await expect(date).toBeFocused()
    await date.fill('2026-11-19')
    const search = page.getByRole('searchbox', { name: 'Search classes' })
    await search.fill('unmatched class')
    await expect(selected).toHaveCount(0)
    await expect(date).toHaveValue('2026-11-19')
    await search.clear()
    await expect(time).toBeChecked()
    await expect(date).toHaveCount(1)
    await checkout.click()
    await expect(page).toHaveURL('/signup/family?source=enroll')
    const cart = await page.evaluate(() => JSON.parse(sessionStorage.getItem('vortex_public_enrollment_cart_v1') ?? '[]'))
    expect(cart).toMatchObject([{ classEventId: 60, schedulingFormId: 30, slotGroupId: 2, timeSlotId: 3, enrollmentStartDate: '2026-11-19' }])
  } finally {
    releaseOlderSchedule()
  }
})

test('uses verified program descriptions on the public class board and team enrollment', async ({ page }) => {
  await mockSchedule(page)
  await page.goto('/read-board')
  const board = page.locator('.np-browse-class-list')
  await expect(board.getByText(/Fit & Flip is a coached fitness class for ages 8–15/)).toBeVisible()
  await expect(board.getByText(staleDescription)).toHaveCount(0)
  await expect(board.getByText(developmentalDescription)).toBeVisible()
  await expect(board.getByText(staleDevelopmentDescription)).toHaveCount(0)
  const boardTeam = board.locator(':scope > div').filter({ has: page.getByRole('heading', { name: teamName, level: 3 }) })
  const teamPlacement = /^Vortex Gymnastics Team is listed for ages 6 and up\. The team requires an evaluation for placement\./
  await expect(boardTeam.getByText(teamPlacement)).toBeVisible()
  await expect(boardTeam.getByText(staleTeamProgramDescription)).toHaveCount(0)
  await expect(boardTeam.getByText(staleTeamClassDescription)).toHaveCount(0)
  await expect(boardTeam.getByText(/Age:\s*6\+/)).toBeVisible()
  await expect(boardTeam.getByText(/Requirements:.*Evaluation is required\./)).toBeVisible()

  const signup = boardTeam.getByRole('link', { name: 'Sign Up', exact: true })
  await expect(signup).toHaveAttribute('href', teamSignupPath)
  await signup.click()
  await expect(page).toHaveURL(teamSignupPath)
  const enrollmentTeam = page.locator('.np-enrollment-program').filter({ has: page.getByRole('heading', { name: teamName, level: 2 }) })
  await expect(enrollmentTeam.getByText(teamPlacement)).toBeVisible()
  await expect(enrollmentTeam.getByText(staleTeamProgramDescription)).toHaveCount(0)
  await expect(enrollmentTeam.getByText(staleTeamClassDescription)).toHaveCount(0)
  const teamClass = enrollmentTeam.locator('.np-enrollment-class')
  await expect(teamClass.getByRole('heading', { name: teamName })).toBeFocused()
  await expect(teamClass.getByText('Age: 6+', { exact: true })).toBeVisible()
  await expect(teamClass.getByText('Evaluation is required.')).toBeVisible()
})

for (const [path, searchLabel] of [['/enroll', 'Search classes'], ['/drop-in', 'Search drop-in classes']]) {
  test(`finds youth gymnastics and Fit & Flip by program search terms on ${path}`, async ({ page }) => {
    await mockSchedule(page)
    await page.goto(path)
    const search = page.getByRole('searchbox', { name: searchLabel })
    const fitAndFlipHeading = page.getByRole('heading', { name: fitAndFlip, exact: true })
    const gymnasticsHeading = page.getByRole('heading', { name: 'Developmental Gymnastics', exact: true })
    await expect(fitAndFlipHeading).toBeVisible()
    await expect(gymnasticsHeading).toBeVisible()
    await expect(page.getByText(staleDescription)).toHaveCount(0)
    await expect(page.getByText(/Fit & Flip is a coached fitness class for ages 8–15/)).toBeVisible()
    await expect(page.getByText(developmentalDescription)).toBeVisible()
    await expect(page.getByText(staleDevelopmentDescription)).toHaveCount(0)

    for (const term of [
      'youth fitness', 'athletic training', 'strength training', 'sports performance',
      'Youth Athletics', 'Athleticism Development', 'Youth Sports', 'Fit and Flip', 'fit-and-flip',
      'youth training', 'youth athleticism training', 'youth strength training', 'youth conditioning',
      'youth plyometrics', 'youth sports training',
    ]) {
      await search.fill(term)
      await expect(fitAndFlipHeading).toBeVisible()
      await expect(page.getByText(younger, { exact: true })).toBeVisible()
      await expect(page.getByText(older, { exact: true })).toBeVisible()
      await expect(gymnasticsHeading).toHaveCount(0)
      await expect(page.getByText('Typhoons', { exact: true })).toHaveCount(0)
    }

    const tornadoes = page.getByRole('heading', { name: 'Tornadoes', exact: true })
    const preschool = page.getByRole('heading', { name: 'Dirt Devils (Mommy & Me)', exact: true })
    const intermediate = page.getByRole('heading', { name: 'Gymnastics Cyclones', exact: true })
    await search.fill('Youth Gymnastics')
    await expect(gymnasticsHeading).toBeVisible()
    await expect(tornadoes).toBeVisible()
    await expect(preschool).toBeVisible()
    await expect(intermediate).toBeVisible()
    await expect(fitAndFlipHeading).toHaveCount(0)

    await search.fill('Beginner Gymnastics')
    await expect(tornadoes).toBeVisible()
    await expect(preschool).toHaveCount(0)
    await expect(intermediate).toHaveCount(0)
    await expect(fitAndFlipHeading).toHaveCount(0)

    for (const term of ['Tumbling', 'Floor tumbling', 'Tumbling classes']) {
      await search.fill(term)
      await expect(tornadoes).toBeVisible()
      await expect(intermediate).toBeVisible()
      await expect(preschool).toHaveCount(0)
    }

    for (const term of ['8-11', '8–11']) {
      await search.fill(term)
      await expect(page.getByText(younger, { exact: true })).toBeVisible()
      await expect(page.getByText(older, { exact: true })).toHaveCount(0)
    }

    await search.fill('Mommy and Me')
    await expect(page.getByRole('heading', { name: 'Dirt Devils (Mommy & Me)', exact: true })).toBeVisible()
    await expect(fitAndFlipHeading).toHaveCount(0)

    const adultLink = page.getByRole('link', { name: /^See Typhoons adult gymnastics/ })
    await expect(adultLink).toHaveCount(0)
    for (const term of ['adult gymnastics', 'gymnastics for adults', 'Typhoons']) {
      await search.fill(term)
      await expect(adultLink).toHaveAttribute('href', path + '?program=Adult%20Fitness%20%26%20Acrobatics')
    }

    await search.fill('adulthood')
    await expect(adultLink).toHaveCount(0)

    await search.fill('Cyclones')
    await expect(page.getByText(younger, { exact: true })).toBeVisible()
    await expect(page.getByText(older, { exact: true })).toBeVisible()
    await expect(intermediate).toBeVisible()
    const age = page.getByRole('spinbutton', { name: 'Age on class date' })
    await age.fill('11')
    await expect(page.getByText(younger, { exact: true })).toBeVisible()
    await expect(page.getByText(older, { exact: true })).toHaveCount(0)
    await age.fill('12')
    await expect(page.getByText(younger, { exact: true })).toHaveCount(0)
    await expect(page.getByText(older, { exact: true })).toBeVisible()

    await search.clear()
    await age.fill('2')
    await expect(page.getByRole('heading', { name: 'Dirt Devils (Mommy & Me)', exact: true })).toBeVisible()
    await expect(page.getByText(younger, { exact: true })).toHaveCount(0)
    await expect(page.getByText(older, { exact: true })).toHaveCount(0)
    const openEnded = page.getByRole('heading', { name: 'Tornadoes', exact: true })
    await expect(openEnded).toHaveCount(0)
    await age.fill('18')
    await expect(adultLink).toHaveAttribute('href', path + '?program=Adult%20Fitness%20%26%20Acrobatics')
    await expect(openEnded).toBeVisible()
    await expect(page.getByText(younger, { exact: true })).toHaveCount(0)
    await expect(page.getByText(older, { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Clear', exact: true }).click()
    await expect(age).toHaveValue('')
    await expect(page.getByText(younger, { exact: true })).toBeVisible()
    await expect(page.getByText(older, { exact: true })).toBeVisible()
  })
}
