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
  test('the Contact menu supports keyboard navigation and restores focus on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/contact')
    const openMenu = page.getByRole('button', { name: 'Open navigation menu', exact: true })
    const navigation = page.getByRole('navigation', { name: 'Main navigation' })
    const adultGymnastics = navigation.getByRole('link', { name: 'Adult Gymnastics', exact: true })

    await openMenu.press('Enter')
    await expect(adultGymnastics).toBeVisible()
    await adultGymnastics.press('Escape')
    await expect(navigation).toBeHidden()
    await expect(openMenu).toBeFocused()

    await openMenu.press('Enter')
    await adultGymnastics.press('Enter')
    await expect(page).toHaveURL('/adult-gymnastics')
    await expect(page.getByRole('heading', { name: 'Adult gymnastics and acrobatics in Bowie, MD', exact: true })).toBeVisible()
  })

  test('families can compare boys’ apparatus classes and find a first gymnastics visit', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/gymnastics#artistic')
    await page.getByRole('link', { name: 'Compare boys’ gymnastics and apparatus classes' }).click()
    await expect(page).toHaveURL('/blog/gymnastics-vs-tumbling#boys-gymnastics')

    const comparison = page.locator('#boys-gymnastics')
    await expect(comparison.getByRole('heading')).toBeInViewport()
    await expect(comparison.getByRole('link', { name: 'See MGA’s boys’ gymnastics class' }))
      .toHaveAttribute('href', 'https://www.mga-gymnastics.com/boys.html')
    await comparison.getByRole('link', { name: 'See how a Vortex trial works' }).click()
    await expect(page).toHaveURL('/gymnastics#first-visit')
    await expect(page.locator('#first-visit').getByRole('heading', { level: 2 })).toBeInViewport()
  })

  test('Fit & Flip links families to fitness alternatives by age', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/fit-and-flip#fit-flip-trial-age')
    await page.getByRole('link', { name: 'Compare Bowie fitness options by age' }).click()

    await expect(page).toHaveURL('/blog/youth-sports-bowie#fitness-without-a-team')
    const fitness = page.locator('#fitness-without-a-team')
    await expect(fitness.getByRole('heading')).toBeInViewport()
    await expect(fitness.getByRole('link', { name: 'See South Bowie’s open gym hours' }))
      .toHaveAttribute('href', 'https://www.pgparks.com/facilities/south-bowie-community-center')
    await fitness.getByRole('link', { name: 'See gymnastics options for teens' }).click()
    await expect(page).toHaveURL('/gymnastics#teen')
    await expect(page.locator('#teen').getByRole('heading')).toBeInViewport()
  })

  test('Fit & Flip strength guidance leads to the kettlebell film moment', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/fit-and-flip#strength')
    await page.getByRole('link', { name: 'See how kids progress from bodyweight to light resistance' }).click()

    await expect(page).toHaveURL('/blog/athletic-development-young-athletes#strength-training-readiness')
    const readiness = page.locator('#strength-training-readiness')
    await expect(readiness.getByRole('heading', { level: 2 })).toBeInViewport()
    await readiness.getByRole('link', { name: 'See a kettlebell swing in the Vortex training film' }).click()
    await expect(page).toHaveURL('/watch/training-at-vortex#strength-and-handstand')
    await expect(page.getByRole('link', { name: 'Play from 0:12', exact: true })).toBeInViewport()
  })

  test('homeschool families can compare local options and return to gymnastics class times', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/gymnastics#homeschool')
    const homeschool = page.locator('#homeschool')
    await expect(homeschool.getByRole('heading')).toBeInViewport()
    await homeschool.getByRole('link', { name: 'Compare homeschool gymnastics and PE near Bowie' }).click()

    await expect(page).toHaveURL('/blog/youth-sports-bowie#homeschool-pe')
    const comparison = page.locator('#homeschool-pe')
    await expect(comparison.getByRole('heading')).toBeInViewport()
    await expect(comparison.getByRole('link', { name: 'Look up seasonal homeschool classes' }))
      .toHaveAttribute('href', 'https://www.pgparks.com/your-guide')
    await comparison.getByRole('link', { name: 'Check Vortex’s weekly gymnastics times' }).click()
    await expect(page).toHaveURL('/gymnastics#youth-gymnastics-schedule')
    await expect(page.locator('#youth-gymnastics-schedule').getByRole('heading').first()).toBeInViewport()
  })

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

    await page.goto('/gymnastics#trampoline-tumbling')
    await page.getByRole('link', { name: 'Compare tumbling classes near Bowie', exact: true }).click()
    await expect(page).toHaveURL('/blog/gymnastics-vs-tumbling#nearby-tumbling-classes')
    const nearbyTumbling = page.locator('#nearby-tumbling-classes')
    await expect(nearbyTumbling.getByRole('heading')).toBeInViewport()
    await expect(nearbyTumbling.getByRole('link', { name: /county’s current guide/ }))
      .toHaveAttribute('href', 'https://www.pgparks.com/your-guide')

    await page.goto('/fit-and-flip')
    await page.getByRole('link', { name: 'Compare youth athletic training in Bowie' }).click()
    await expect(page).toHaveURL('/blog/youth-sports-bowie#compare-athletic-training')
    const youthTraining = page.locator('#compare-athletic-training')
    await expect(youthTraining.getByRole('heading')).toBeInViewport()
    await expect(youthTraining.getByRole('link', { name: 'See Redline’s first-session format and ages' })).toBeVisible()
    await expect(youthTraining.getByRole('link', { name: 'Check how teens start' })).toBeVisible()
    await youthTraining.getByRole('link', { name: 'Check Cyclones trial and drop-in dates' }).click()
    await expect(page).toHaveURL('/drop-in?program=Fit%20%26%20Flip')

    await page.goto('/fit-and-flip#speed-agility')
    await page.getByRole('link', { name: 'Compare sprint starts, planned turns, and reacting' }).click()
    await expect(page).toHaveURL('/blog/athletic-development-young-athletes#speed-vs-agility')
    const agility = page.locator('#speed-vs-agility')
    await expect(agility.getByRole('heading')).toBeInViewport()
    await agility.getByRole('link', { name: 'See a change of direction in the Vortex training film' }).click()
    await expect(page).toHaveURL('/watch/training-at-vortex#change-of-direction')
    await expect(page.getByRole('link', { name: 'Play from 0:16', exact: true })).toBeInViewport()
    await expect(page.getByRole('main').locator('video')).toHaveJSProperty('paused', true)
  })

  test('adult gymnasts can compare nearby formats and reach Typhoons dates', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/adult-gymnastics')
    await page.getByRole('link', { name: 'Compare adult classes and open gym near Bowie' }).click()
    await expect(page).toHaveURL('/blog/returning-to-gymnastics-as-an-adult#nearby-adult-gymnastics')
    const comparison = page.locator('#nearby-adult-gymnastics')
    await expect(comparison.getByRole('heading')).toBeInViewport()
    await expect(comparison.getByRole('listitem')).toHaveCount(5)
    await expect(comparison.getByText(/MGA Gymnastics in Upper Marlboro/)).toBeVisible()
    await expect(comparison.getByText(/Fairland/)).toBeVisible()
    await comparison.getByRole('link', { name: 'See Typhoons drop-in dates' }).click()
    await expect(page).toHaveURL('/drop-in?program=Adult%20Fitness%20%26%20Acrobatics')
    await expect(page.getByRole('heading', { name: 'Adult gymnastics drop-ins.' })).toBeVisible()
  })

  test('competitive gymnastics leads to team evaluation guidance and the scoped enrollment catalog', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.route('**/api/public/classes-offered', route => route.fulfill({ json: { success: true, data: { programs: [
      { id: 2, displayName: 'Development Gymnastics', classes: [
        { id: 26, formId: 11, displayName: 'Dirt Devils', enrollVisible: true },
      ] },
      { id: 13, displayName: 'Vortex Gymnastics Team', classes: [
        { id: 40, formId: 29, displayName: 'Vortex Gymnastics Team', ageMin: 6, skillRequirements: 'Evaluation is required.', enrollVisible: true },
      ] },
    ] } } }))
    await page.route('**/api/signup/catalog/classes/40/offerings', route => route.fulfill({ json: {
      success: true, data: { formId: 29, offerings: [], costUnit: 'per_month', scheduleOptions: [
        { slotGroupId: 20, timeSlotId: 21, offeringId: null, scheduleMode: 'day', scheduleLabel: 'Monday · 17:30–19:00', priceCents: 15000 },
      ] },
    } }))

    await page.goto('/read-board')
    await page.getByRole('link', { name: 'how gymnastics team placement works' }).click()
    await expect(page).toHaveURL('/gymnastics#competitive-gymnastics-team')
    const team = page.locator('#competitive-gymnastics-team')
    await expect(team.getByRole('heading', { level: 2 })).toBeInViewport()
    await expect(team.getByRole('link', { name: 'Find a developmental Trial Assessment' })).toHaveAttribute('href', '/gymnastics#class-placement')
    await team.getByRole('link', { name: 'Contact Vortex about a team evaluation' }).click()
    await expect(page).toHaveURL('/contact#inquiry')
    const inquiry = page.locator('#inquiry')
    await expect(inquiry.getByRole('heading', { name: 'What to include in your inquiry' })).toBeInViewport()
    await inquiry.getByRole('button', { name: 'Ask Our Team' }).click()
    await expect(page.getByRole('heading', { name: 'Athlete Inquiry' })).toBeVisible()

    await page.goto('/gymnastics#competitive-gymnastics-team')
    await team.getByRole('link', { name: 'View team practice times' }).click()
    await expect(page).toHaveURL('/enroll?program=Vortex%20Gymnastics%20Team')
    await expect(page.getByRole('combobox', { name: 'Program', exact: true })).toHaveValue('13')
    await expect(page.getByRole('heading', { name: 'Dirt Devils', level: 3 })).toHaveCount(0)
    const teamCard = page.locator('.np-enrollment-class').filter({ has: page.getByRole('heading', { name: 'Vortex Gymnastics Team', level: 3 }) })
    await expect(teamCard.getByText(/Evaluation is required\./)).toBeVisible()
    await expect(teamCard.getByRole('checkbox', { name: /Monday.*17:30/ })).toBeVisible()
  })

  test('mobile visitors can find accessibility details and gym photos from a program page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/gymnastics')
    const visit = page.getByRole('region', { name: 'Visit Vortex in Bowie' })
    await visit.getByRole('link', { name: 'Parking and accessibility' }).click()
    await expect(page).toHaveURL('/contact#parking-and-accessibility')
    const accessibility = page.getByRole('region', { name: 'Parking and accessibility' })
    await expect(accessibility.getByRole('heading')).toBeInViewport()
    await expect(accessibility.getByText(/wheelchair-accessible parking and a wheelchair-accessible entrance/)).toBeVisible()
    await expect(accessibility.getByRole('link', { name: 'View the Google Maps listing' }))
      .toHaveAttribute('href', 'https://www.google.com/maps?cid=15262285316302188709')

    await page.goBack()
    await expect(page).toHaveURL('/gymnastics')
    await visit.getByRole('link', { name: 'See inside the Bowie gym' }).click()
    await expect(page).toHaveURL('/contact#inside-the-gym')
    const gym = page.getByRole('region', { name: 'Inside the Bowie gym' })
    await expect(gym.getByRole('heading', { level: 2 })).toBeInViewport()
    await expect(gym.getByRole('img')).toHaveCount(5)
    await expect(gym.getByRole('img', { name: /Padded trampoline/ })).toHaveAttribute('src', '/gym-DSC02700-1600.webp')
    const directions = new URL(await page.getByRole('link', { name: 'Get directions to Vortex', exact: true }).getAttribute('href') ?? '')
    expect(directions.origin + directions.pathname).toBe('https://www.google.com/maps/dir/')
    expect(directions.searchParams.get('destination')).toBe('4961 Tesla Dr Suite E, Bowie, MD 20715')
    const mobileFits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
    expect(mobileFits).toBe(true)
    await gym.getByRole('link', { name: 'Find a youth gymnastics starting class' }).click()
    await expect(page).toHaveURL('/gymnastics#choose-a-class')
    await expect(page.getByRole('heading', { name: 'Find the right starting class' })).toBeInViewport()

    await page.getByRole('link', { name: 'See Vortex’s practice beams and training rings' }).click()
    await expect(page).toHaveURL('/contact#gymnastics-equipment')
    const equipment = page.getByRole('region', { name: 'Balance beams and training rings' })
    await expect(equipment.getByRole('heading')).toBeInViewport()
    for (const [name, src] of [
      ['Two low balance beams beside the tumbling track at Vortex Athletics', '/gym-DSC02690-1600.webp'],
      ['Wooden training rings hanging above red and blue mats at Vortex Athletics', '/gym-DSC02672-1600.webp'],
    ]) {
      const photo = equipment.getByRole('img', { name })
      await expect(photo).toHaveAttribute('src', src)
      await photo.scrollIntoViewIfNeeded()
      await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
    }
    await equipment.getByRole('link', { name: 'Ask which equipment your class uses' }).click()
    await expect(page).toHaveURL('/contact#inquiry')
    await expect(page.getByRole('heading', { name: 'What to include in your inquiry' })).toBeInViewport()
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
    await page.route('**/api/public/classes-offered', route => route.fulfill({ json: { success: true, data: { programs: [
      { id: 10, displayName: 'Adult Fitness & Acrobatics', classes: [
        { id: 20, displayName: 'Typhoons (Adult)', enrollVisible: true, formId: 3, signupUrl: '/enroll?form=3', ageMin: 18 },
        { id: 21, displayName: 'Unpublished adult class', enrollVisible: false, formId: 23 },
      ] },
    ] } } }))
    await page.goto(scheduleUrl, { waitUntil: 'domcontentloaded' })

    const tabs = page.getByRole('navigation', { name: 'Browse classes and updates' })
    const scheduleTab = tabs.getByRole('link', { name: 'Schedule', exact: true })
    const eventsTab = tabs.getByRole('link', { name: 'Events', exact: true })
    const classesTab = tabs.getByRole('link', { name: 'Classes Offered', exact: true })
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

    await classesTab.click()
    await expect(page).toHaveURL('/read-board?utm_source=schedule-qa#classes')
    const classes = page.getByRole('region', { name: 'Gymnastics and fitness classes in Bowie' })
    await expect(classes.getByRole('link', { name: 'Typhoons adult gymnastics' })).toHaveAttribute('href', '/adult-gymnastics')
    await expect(classes.getByRole('heading', { name: 'Typhoons (Adult)', exact: true })).toBeVisible()
    await expect(classes.getByRole('link', { name: 'Sign Up', exact: true })).toHaveAttribute('href', '/enroll?form=3')
    await expect(classes.getByText('Unpublished adult class')).toHaveCount(0)
  })

  test('the youth gymnastics page lists published weekly times and keeps class levels distinct', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.clock.setFixedTime(new Date('2027-01-12T18:00:00Z'))
    const developmentalProgram = 2
    const enrollmentClass = (formId: number, displayName: string, skillLevel: string, enrollVisible = true) =>
      ({ id: formId, formId, displayName, skillLevel, enrollVisible })
    const classes = [
      enrollmentClass(9, 'Tornadoes', 'BEGINNER'),
      { ...enrollmentClass(22, 'Cyclones', 'INTERMEDIATE'), skillRequirements: 'Forward roll, handstand and round-off.', excludeFromDropIns: true },
      { ...enrollmentClass(14, 'Hidden class', 'ADVANCED', false), skillRequirements: 'Hidden placement requirement.' },
      enrollmentClass(15, 'Expired class', 'ADVANCED'),
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
    await expect(schedule.getByText('Forward roll, handstand and round-off.')).toBeHidden()
    await schedule.getByText('Cyclones Intermediate', { exact: true }).click()
    await expect(schedule.getByText('Forward roll, handstand and round-off.')).toBeVisible()
    await expect(schedule.getByText('Hidden placement requirement.')).toHaveCount(0)
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
    let scheduleRequests = 0
    await page.route('**/api/public/classes-offered', route => {
      scheduleRequests += 1
      return route.fulfill({ json: { success: true, data: {
        programs: [{ id: 9, displayName: program, classes: groups.map(group => ({ ...group, enrollVisible: true })) }],
      } } })
    })
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

    await page.goto('/fit-and-flip', { waitUntil: 'networkidle' })
    expect(scheduleRequests).toBe(0)
    const schedule = page.getByRole('region', { name: 'Recurring Fit & Flip class times' })
    await schedule.locator('.np-class-pricing').scrollIntoViewIfNeeded()
    await expect(schedule.locator('.np-recurring-schedule > ul > li')).toContainText(['Cyclones (8–11)', 'Cyclones (12–15)'])
    expect(scheduleRequests).toBe(1)
    expect(priceRequests).toEqual([])
    await page.evaluate(() => localStorage.setItem('vortex_member_token', 'test-member-token'))
    await page.goto('/blog/youth-sports-bowie')
    await page.getByRole('link', { name: 'Compare Fit & Flip prices', exact: true }).click()
    await expect(page).toHaveURL('/fit-and-flip#fit-flip-class-pricing')
    const pricing = page.locator('#fit-flip-class-pricing')
    await expect(pricing).toHaveAttribute('open', '')
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
    await pricing.locator('summary').click()
    await expect(pricing).not.toHaveAttribute('open', '')
    await page.getByRole('link', { name: 'Compare monthly and drop-in prices', exact: true }).click()
    await expect(pricing).toHaveAttribute('open', '')
    await expect(pricing.getByText('$150.00–$160.00 per month', { exact: true })).toBeVisible()
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
