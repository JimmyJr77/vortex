import { expect, test, type Page } from '@playwright/test'

const adultName = 'Typhoons (Adult)'
const adultFormId = 405
const adultProgram = 'Adult Fitness & Acrobatics'
const adultBookingPath = `/enroll?program=${encodeURIComponent(adultProgram)}`
const adultDropInPath = `/drop-in?program=${encodeURIComponent(adultProgram)}`
const scheduleHeading = 'Recurring adult gymnastics class times'
const slot = {
  id: 501,
  formId: adultFormId,
  slotGroupId: 601,
  scheduleMode: 'day',
  dayOfWeek: 1,
  dayName: 'Monday',
  startTime: '19:00',
  endTime: '20:30',
  maxParticipants: 10,
  spotsRemaining: 8,
  isActive: true,
}

async function mockClasses(page: Page, {
  enrollVisible = true,
  multipleAdultClasses = false,
  adultFormProgramId = 2,
  adultFormActive = true,
  catalogError = false,
  catalogGate,
}: {
  enrollVisible?: boolean; multipleAdultClasses?: boolean; adultFormProgramId?: number
  adultFormActive?: boolean; catalogError?: boolean; catalogGate?: Promise<void>
} = {}) {
  const adultClasses = [{
    id: 20, displayName: adultName, ageMin: 18, formId: adultFormId, enrollVisible,
    signupUrl: enrollVisible ? `/enroll?form=${adultFormId}` : null,
  }]
  if (multipleAdultClasses) {
    adultClasses.push({
      id: 21, displayName: 'Second adult class', ageMin: 18, formId: 406,
      enrollVisible: true, signupUrl: '/enroll?form=406',
    })
  }
  const formRequests: string[] = []
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const json = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (/^\/api\/scheduling\/forms\/\d+$/.test(path)) formRequests.push(path)
    switch (path) {
      case '/api/public/classes-offered':
        await catalogGate
        if (catalogError) return route.fulfill({ status: 503, json: { success: false } })
        return json({ programs: [
          { id: 1, displayName: 'Fit & Flip', classes: [{ id: 10, displayName: 'Cyclones', formId: 100 }] },
          { id: 2, displayName: adultProgram, classes: adultClasses },
        ] })
      case `/api/scheduling/forms/${adultFormId}`:
        return json({ id: adultFormId, title: adultName, programsId: adultFormProgramId, isActive: adultFormActive, mandateWaiver: false,
          slotGroups: [{ id: slot.slotGroupId, formId: adultFormId, offeringId: 701, scheduleMode: 'day',
            maxParticipants: 10, spotsRemaining: 8, isActive: true, occurrences: [slot] }], timeSlots: [slot] })
      case `/api/scheduling/forms/${adultFormId}/offerings`:
        return json([{ id: 701, formId: adultFormId, startDate: '2026-01-01', evergreen: true, isSelected: true }])
      case `/api/scheduling/forms/${adultFormId}/program-options`:
        return json({ options: [] })
      case '/api/scheduling/forms/406':
        return route.fulfill({ status: 503, json: { success: false } })
      case '/api/signup/catalog/classes/10/offerings':
        return json({ formId: 100, offerings: [], scheduleOptions: [] })
      default:
        return json({})
    }
  })
  return formRequests
}

test('adult gymnastics, general enrollment, and published form links open the current Typhoons schedule', async ({ page }) => {
  await mockClasses(page)
  await page.goto('/blog/returning-to-gymnastics-as-an-adult#track-your-progress')
  await page.getByRole('link', { name: 'see how to start with one adult gymnastics class a week' }).click()
  await expect(page).toHaveURL('/adult-gymnastics#adult-weekly-training')
  const weekly = page.locator('#adult-weekly-training')
  await expect(weekly.getByRole('heading', { name: 'Can I start adult gymnastics with one class a week?' })).toBeInViewport()
  await weekly.getByRole('link', { name: 'Check the weekly Typhoons schedule' }).click()
  await expect(page).toHaveURL('/adult-gymnastics#adult-class-schedule')
  await expect(page.getByRole('heading', { name: scheduleHeading, exact: true })).toBeVisible()
  await expect(page.getByText('Monday · 7:00 PM – 8:30 PM', { exact: true })).toBeVisible()
  await expect(page.getByText('All times Eastern. Check enrollment for dates and availability.')).toBeVisible()
  const booking = page.getByRole('link', { name: 'See recurring class times', exact: true })
  await expect(booking).toHaveAttribute('href', adultBookingPath)
  await booking.click()
  await expect(page.getByRole('heading', { name: 'Adult gymnastics classes' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ask about adult gymnastics classes' })).toHaveAttribute('href', '/contact')
  await expect(page.getByRole('link', { name: 'Try a free class', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Back to adult gymnastics' })).toHaveAttribute('href', '/adult-gymnastics')
  await expect(page.getByRole('heading', { name: adultName })).toBeVisible()
  await expect(page.getByRole('button', { name: /Monday.*7:00 PM/ })).toBeVisible()

  await page.goto(`/enroll?form=${adultFormId}`)
  await expect(page.getByRole('heading', { name: adultName })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ask about adult gymnastics classes' })).toHaveAttribute('href', '/contact')

  await page.goto(`/enroll?form=${adultFormId}&offeringId=701&slotGroupId=${slot.slotGroupId}&timeSlotId=${slot.id}`)
  await expect(page.getByRole('heading', { name: 'Adult gymnastics classes' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ask about adult gymnastics classes' })).toHaveAttribute('href', '/contact')
  await expect(page.getByRole('link', { name: 'Try a free class', exact: true })).toHaveCount(0)

  const legacyClassSelection = `?form=${adultFormId}&offeringId=701&slotGroupId=${slot.slotGroupId}&timeSlotId=${slot.id}&utm_source=legacy#classes`
  await page.goto(`/schedule${legacyClassSelection}`)
  await expect(page).toHaveURL(`/enroll${legacyClassSelection}`)
  await expect(page.getByRole('heading', { name: adultName })).toBeVisible()

  await page.goto('/enroll')
  await expect(page.getByRole('link', { name: 'Try a free class', exact: true })).toHaveAttribute('href', '/#free-trial')
  await expect(page.getByRole('heading', { name: 'Cyclones' })).toBeVisible()
  await expect(page.getByRole('heading', { name: adultName })).toHaveCount(0)
  await page.getByRole('link', { name: 'see adult gymnastics class times' }).click()
  await expect(page).toHaveURL(adultBookingPath)
  await expect(page.getByRole('heading', { name: adultName })).toBeVisible()
  await expect(page.getByRole('button', { name: /Monday.*7:00 PM/ })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL('/enroll')
  await expect(page.getByRole('link', { name: 'Try a free class', exact: true })).toHaveAttribute('href', '/#free-trial')
})

test('only the adult program page loads recurring adult class times', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const formRequests = await mockClasses(page, { multipleAdultClasses: true })
  await page.goto('/adult-gymnastics', { waitUntil: 'networkidle' })
  expect(formRequests).toEqual([])
  await page.locator('#adult-class-pricing').scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { name: scheduleHeading, exact: true })).toBeVisible()
  await expect(page.getByText('Monday · 7:00 PM – 8:30 PM', { exact: true })).toBeVisible()
  await expect(page.getByText('Second adult class', { exact: true })).toHaveCount(0)
  const otherPrograms = page.getByRole('navigation', { name: 'Other Vortex programs' })
  await otherPrograms.getByRole('link', { name: 'Fit & Flip Youth Athletic Training' }).click()
  await expect(page.getByRole('heading', { name: 'Youth athletic training in Bowie, MD' })).toBeVisible()
  await expect(page.getByRole('heading', { name: scheduleHeading, exact: true })).toHaveCount(0)
  await otherPrograms.getByRole('link', { name: 'Youth Gymnastics', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Youth gymnastics classes in Bowie, MD' })).toBeVisible()
  await expect(page.getByRole('heading', { name: scheduleHeading, exact: true })).toHaveCount(0)
  expect([...new Set(formRequests)].sort()).toEqual([`/api/scheduling/forms/${adultFormId}`, '/api/scheduling/forms/406'])
})

test('the adult hero stays in place while recurring times load on mobile', async ({ page }) => {
  let releaseCatalog!: () => void
  const catalogGate = new Promise<void>((resolve) => { releaseCatalog = resolve })
  await page.setViewportSize({ width: 390, height: 844 })
  await mockClasses(page, { catalogGate })
  await page.goto('/adult-gymnastics')
  const heroImage = page.locator('.np-program-hero-image')
  const schedule = page.getByRole('region', { name: scheduleHeading, exact: true })
  let before: number
  try {
    await expect(schedule.getByText('Checking recurring class times…')).toHaveCount(0)
    await schedule.locator('#adult-class-pricing').scrollIntoViewIfNeeded()
    await expect(schedule.getByText('Checking recurring class times…')).toBeVisible()
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    before = await heroImage.evaluate(image => image.getBoundingClientRect().top + window.scrollY)
  } finally {
    releaseCatalog()
  }
  await expect(schedule.getByText('Monday · 7:00 PM – 8:30 PM', { exact: true })).toBeVisible()
  const after = await heroImage.evaluate(image => image.getBoundingClientRect().top + window.scrollY)
  expect(Math.abs(before - after)).toBeLessThanOrEqual(1)
  await expect(schedule.getByRole('link', { name: 'Check dates and availability' })).toHaveAttribute('href', adultBookingPath)
})

test('adults can compare live monthly and nonmember drop-in rates on demand', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockClasses(page)
  const pricingRequests: { type: string; authorization?: string }[] = []
  await page.route('**/api/signup/catalog/classes/20/offerings', route => {
    pricingRequests.push({ type: 'monthly' })
    return route.fulfill({ json: { success: true, data: {
      formId: adultFormId, costUnit: 'per_month', scheduleOptions: [
        { scheduleMode: 'day', slotGroupId: slot.slotGroupId, offeringId: 700, priceCents: 12000 },
        { scheduleMode: 'day', slotGroupId: slot.slotGroupId, offeringId: 701, priceCents: 15000 },
      ],
    } } })
  })
  await page.route('**/api/public/drop-ins', route => {
    const authorization = route.request().headers().authorization
    pricingRequests.push({ type: 'drop-in', authorization })
    return route.fulfill({ json: { success: true, data: { sessions: [
      { programName: adultProgram, totalCents: authorization ? 3750 : 5000, isFull: false },
      { programName: adultProgram, totalCents: 2500, isFull: true },
      { programName: adultProgram, totalCents: 1000, excludedFromDropIns: true },
      { programName: 'Fit & Flip', totalCents: 2000, isFull: false },
    ] } } })
  })
  await page.goto('/adult-gymnastics')
  const pricing = page.locator('#adult-class-pricing')
  await pricing.scrollIntoViewIfNeeded()
  await expect(page.getByText('Monday · 7:00 PM – 8:30 PM', { exact: true })).toBeVisible()
  await expect(pricing).not.toHaveAttribute('open', '')
  expect(pricingRequests).toEqual([])
  await page.evaluate(() => localStorage.setItem('vortex_member_token', 'test-member-token'))
  await page.getByRole('link', { name: 'Read the guide to returning as an adult' }).click()
  await page.getByRole('link', { name: 'Compare monthly enrollment and drop-in prices' }).click()
  await expect(page).toHaveURL('/adult-gymnastics#adult-class-pricing')
  await expect(pricing).toHaveAttribute('open', '')
  await expect(pricing.getByText('Compare adult gymnastics prices', { exact: true })).toBeInViewport()
  await expect(pricing.getByText('$150.00 per month', { exact: true })).toBeVisible()
  await expect(pricing.getByText('$50.00 per class', { exact: true })).toBeVisible()
  await expect(pricing.getByText(/Paid monthly enrollment requires an active annual membership/)).toBeVisible()
  await expect(pricing.getByRole('link', { name: 'Review monthly enrollment' })).toHaveAttribute('href', adultBookingPath)
  await expect(pricing.getByRole('link', { name: 'Review available drop-in dates' })).toHaveAttribute('href', adultDropInPath)
  expect(pricingRequests).toEqual(expect.arrayContaining([{ type: 'monthly' }, { type: 'drop-in', authorization: undefined }]))
  await pricing.getByText('Compare adult gymnastics prices', { exact: true }).click()
  await expect(pricing).not.toHaveAttribute('open', '')
  await expect(pricing.getByText('$150.00 per month', { exact: true })).toBeHidden()
})

test('pricing keeps current drop-in rates and booking links when monthly tuition cannot be verified', async ({ page }) => {
  let releaseCatalog!: () => void
  const catalogGate = new Promise<void>(resolve => { releaseCatalog = resolve })
  await mockClasses(page, { catalogGate })
  await page.route('**/api/signup/catalog/classes/20/offerings', route => route.fulfill({ json: {
    success: true, data: { formId: adultFormId, costUnit: 'per_class', scheduleOptions: [
      { scheduleMode: 'day', slotGroupId: slot.slotGroupId, offeringId: 701, priceCents: 12000 },
    ] },
  } }))
  await page.route('**/api/public/drop-ins', route => route.fulfill({ json: { success: true, data: { sessions: [
    { programName: adultProgram, totalCents: 5250, isFull: false },
  ] } } }))
  await page.goto('/adult-gymnastics')
  const pricing = page.locator('#adult-class-pricing')
  try {
    await pricing.getByText('Compare adult gymnastics prices', { exact: true }).click()
    await expect(pricing.getByText('$52.50 per class', { exact: true })).toBeVisible()
    await expect(pricing.getByText('Checking current tuition…')).toBeVisible()
  } finally {
    releaseCatalog()
  }
  await expect(pricing.getByText('See current tuition in enrollment.')).toBeVisible()
  await expect(pricing.getByRole('link', { name: 'Review monthly enrollment' })).toHaveAttribute('href', adultBookingPath)
  await expect(pricing.getByRole('link', { name: 'Review available drop-in dates' })).toHaveAttribute('href', adultDropInPath)
})

for (const [scenario, mockOptions, expectsFormRequest] of [
  ['an unpublished adult class', { enrollVisible: false }, false],
  ['an inactive adult form', { adultFormActive: false }, true],
  ['a mismatched youth form', { adultFormProgramId: 1 }, true],
  ['an unavailable class catalog', { catalogError: true }, false],
] as const) {
  test(`the adult landing page keeps the enrollment link for ${scenario}`, async ({ page }) => {
    const formRequests = await mockClasses(page, mockOptions)
    await page.goto('/adult-gymnastics#adult-class-schedule')
    await expect(page.getByText('Check enrollment for current class times or contact Vortex for help.')).toBeVisible()
    const schedule = page.getByRole('region', { name: scheduleHeading, exact: true })
    await expect(schedule.getByRole('list')).toHaveCount(0)
    await expect(schedule.getByRole('link', { name: 'Check dates and availability' })).toHaveAttribute('href', adultBookingPath)
    await expect(page.getByRole('link', { name: 'See recurring class times', exact: true })).toHaveAttribute('href', adultBookingPath)
    expect(formRequests.length > 0).toBe(expectsFormRequest)
    expect(formRequests.every((path) => path === `/api/scheduling/forms/${adultFormId}`)).toBe(true)
  })
}

test('choosing from multiple adult classes retains the adult contact and return links', async ({ page }) => {
  await mockClasses(page, { multipleAdultClasses: true })
  await page.goto(adultBookingPath)
  const list = page.getByRole('list', { name: 'Available adult classes' })
  const booking = list.getByRole('link', { name: adultName })
  await expect(booking).toHaveAttribute('href', `${adultBookingPath}&form=${adultFormId}`)
  await booking.click()
  await expect(page.getByRole('heading', { name: adultName })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ask about adult gymnastics classes' })).toHaveAttribute('href', '/contact')
  await expect(page.getByRole('link', { name: 'Back to classes' })).toHaveAttribute('href', adultBookingPath)
})

test('unpublished adult classes lead to contact without opening their signup forms', async ({ page }) => {
  const formRequests = await mockClasses(page, { enrollVisible: false })
  await page.goto('/enroll')
  await page.getByRole('link', { name: 'see adult gymnastics class times' }).click()
  await expect(page.getByText('There are no adult classes open for online enrollment right now.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Contact us about adult classes' })).toHaveAttribute('href', '/contact')
  await page.goto(`/enroll?form=${adultFormId}`)
  await expect(page.getByRole('heading', { name: 'Cyclones' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Try a free class', exact: true })).toHaveAttribute('href', '/#free-trial')
  expect(formRequests).toEqual([])
})
