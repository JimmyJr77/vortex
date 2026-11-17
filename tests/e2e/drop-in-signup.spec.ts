import { expect, test, type Page } from '@playwright/test'
import { ANALYTICS_POLICY_VERSION, CONSENT_COOKIE_NAME, CONSENT_ID_COOKIE_NAME, CONSENT_STORAGE_KEY } from '../../src/config/analyticsPolicy'

const classDate = '2027-01-12'
const signupUrl = `/drop-in?signupSlot=200&signupDate=${classDate}`
const resumeUrl = `${signupUrl}&athlete=102`
const adultProgram = 'Adult Fitness & Acrobatics'
const adultDropInUrl = `/drop-in?program=${encodeURIComponent(adultProgram)}`
const fitFlipProgram = 'Fit & Flip'
const fitFlipDropInUrl = `/drop-in?program=${encodeURIComponent(fitFlipProgram)}`
const account = { id: 101, memberId: 101, firstName: 'Test', lastName: 'Parent', email: 'dropin@example.test', availablePortals: ['member'] }
const waivers = [
  { id: 11, name: 'Participation waiver', version: '1', body: 'Fixture waiver text.', is_required: true, waiver_type: 'LIABILITY' },
  { id: 12, name: 'Gym policies', version: '1', body: 'Fixture policies.', is_required: true, waiver_type: 'PAYMENT_POLICY' },
]
const dropInClass = {
  formId: 3, classId: 4, className: 'Beginner Gymnastics', classDescription: 'Learn gymnastics basics.',
  programId: 5, programName: 'Developmental Gymnastics', programDescription: null, sportName: 'Gymnastics',
  skillLevel: 'beginner', ageMin: 6, ageMax: 12, monthlyCents: 12000, baseCents: 3000,
  discountPercent: 0, discountCents: 0, totalCents: 3000,
}
const session = {
  ...dropInClass, slotGroupId: 200, date: classDate, startTime: '16:00', endTime: '17:00',
  maxParticipants: 10, monthlyEnrolled: 3, dropInEnrolled: 1, totalAttending: 4, enrolled: 4,
  spotsRemaining: 6, isFull: false,
}
const adultDropInClass = {
  ...dropInClass, formId: 6, classId: 13, className: 'Typhoons (Adult)',
  classDescription: 'Strength, conditioning, mobility, and introductory acrobatics.',
  programId: 8, programName: adultProgram, skillLevel: null, ageMin: 18, ageMax: null,
}
const adultSession = {
  ...session, ...adultDropInClass, slotGroupId: 201, startTime: '19:00', endTime: '20:30', allowsFreeTrial: true,
}
const fitFlipDropInClass = {
  ...dropInClass, formId: 7, classId: 14, className: 'Cyclones (8-11)',
  classDescription: null, programId: 9, programName: fitFlipProgram, ageMin: 8, ageMax: 11,
}
const fitFlipSession = {
  ...session, ...fitFlipDropInClass, slotGroupId: 202, startTime: '18:00', endTime: '19:30',
}
const olderFitFlipSession = {
  ...fitFlipSession, formId: 8, classId: 15, className: 'Cyclones (12-15)', ageMin: 12, ageMax: 15,
  slotGroupId: 203, startTime: '19:00', endTime: '20:30',
}

async function acceptAnalytics(page: Page) {
  await page.addInitScript(({ consentKey, policyVersion }) => {
    localStorage.setItem(consentKey, JSON.stringify({
      necessary: true, analytics: true, marketing: false, policyVersion, updatedAt: new Date().toISOString(),
    }))
  }, { consentKey: CONSENT_STORAGE_KEY, policyVersion: ANALYTICS_POLICY_VERSION })
}

async function mockDropInApi(page: Page, options: {
  membershipConfirmationFails?: boolean
  checkoutFails?: boolean
  autoLoginFails?: boolean
  fullOnRefresh?: boolean
  trialUsedOnRefresh?: boolean
  allowsFreeTrial?: boolean
  membershipRequiresReview?: boolean
  includeAdultClass?: boolean
  includeFitFlipClass?: boolean
  includeBothFitFlipCohorts?: boolean
  mixedAdultTrialFlags?: boolean
} = {}) {
  const submitted: { path: string; body: Record<string, unknown> }[] = []
  const catalogMemberIds: string[] = []
  let membershipActive = false
  let loginAttempts = 0
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() as Record<string, unknown> : null
    if (body) submitted.push({ path, body })
    const json = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (path === '/api/public/classes-offered') {
      const gymnasticsProgram = {
        id: 5, displayName: 'Developmental Gymnastics', description: null,
        classes: [{ id: 4, displayName: 'Beginner Gymnastics', formId: 3, ageMin: 6, ageMax: 12, skillLevel: 'beginner' }],
      }
      const adultProgramOption = {
        id: adultDropInClass.programId, displayName: adultProgram, description: null,
        classes: [{
          id: adultDropInClass.classId, displayName: adultDropInClass.className, formId: adultDropInClass.formId,
          ageMin: adultDropInClass.ageMin, ageMax: null, skillLevel: null,
          enrollVisible: false, excludeFromDropIns: false,
        }],
      }
      const fitFlipProgramOption = {
        id: fitFlipDropInClass.programId, displayName: fitFlipProgram, description: null,
        classes: [{
          id: fitFlipDropInClass.classId, displayName: fitFlipDropInClass.className, formId: fitFlipDropInClass.formId,
          ageMin: fitFlipDropInClass.ageMin, ageMax: fitFlipDropInClass.ageMax, skillLevel: 'beginner',
        }],
      }
      return json({ programs: [gymnasticsProgram,
        ...(options.includeAdultClass ? [adultProgramOption] : []),
        ...(options.includeFitFlipClass ? [fitFlipProgramOption] : []),
      ] })
    }
    if (path === '/api/public/drop-ins') {
      if (url.searchParams.has('memberId')) {
        expect(route.request().headers().authorization).toBe('Bearer drop-in-test-token')
        catalogMemberIds.push(url.searchParams.get('memberId')!)
      } else {
        expect(route.request().headers().authorization).toBeUndefined()
      }
      const selectedAthlete = url.searchParams.has('memberId')
      const youthSession = { ...session, allowsFreeTrial: options.allowsFreeTrial, isFull: Boolean(options.fullOnRefresh && selectedAthlete) }
      return json({
        classes: [dropInClass,
          ...(options.includeAdultClass ? [adultDropInClass] : []),
          ...(options.includeFitFlipClass ? [fitFlipDropInClass] : []),
        ],
        sessions: [youthSession,
          ...(options.includeAdultClass ? [adultSession,
            { ...adultSession, date: '2027-01-19', isFull: true, spotsRemaining: 0 },
            { ...adultSession, date: '2027-01-26', excludedFromDropIns: true },
            ...(options.mixedAdultTrialFlags ? [
              { ...adultSession, date: '2027-02-02', allowsFreeTrial: false },
              { ...adultSession, date: '2027-02-09', allowsFreeTrial: undefined },
            ] : []),
          ] : []),
          ...(options.includeFitFlipClass ? [fitFlipSession] : []),
          ...(options.includeBothFitFlipCohorts ? [
            { ...olderFitFlipSession, date: '2027-01-15' },
            olderFitFlipSession,
            { ...olderFitFlipSession, date: '2027-01-13', isFull: true, spotsRemaining: 0 },
          ] : []),
        ],
        benefits: {
          annualMember: membershipActive, annualCreditsRemaining: membershipActive ? 4 : 0,
          adminCreditsRemaining: 0, freePassesRemaining: 0, trialAvailable: !(options.trialUsedOnRefresh && selectedAthlete), discountPercent: membershipActive ? 10 : 0,
        },
      })
    }
    if (path === '/api/signup/waivers') return json(waivers)
    if (path === '/api/signup/family') return json({ payerMemberId: 101, memberIds: [101, 102], pendingEnrollments: [] })
    if (path === '/api/members/login') {
      if (options.autoLoginFails && loginAttempts++ === 0) return route.fulfill({ status: 503, json: { success: false, message: 'Sign in again to continue.' } })
      return route.fulfill({ json: { success: true, token: 'drop-in-test-token', member: account } })
    }
    if (path === '/api/members/billing/annual-membership') {
      expect(url.searchParams.get('memberId')).toBe('102')
      return json({ available: true, active: membershipActive, fee: { feeId: 10, name: 'Annual Membership', amountCents: 7500 },
        amountCents: 7500, renewsOn: '2027-11-16', cycleStart: '2026-11-16', sportName: 'Membership', programName: 'Annual Membership' })
    }
    if (path === '/api/members/billing/annual-membership-checkout') {
      expect(route.request().headers().authorization).toBe('Bearer drop-in-test-token')
      expect(body?.memberId).toBe(102)
      if (options.membershipRequiresReview) return json({ requiresReview: true, status: 'quarantined' })
      return json({ url: '/mock-membership-card-payment' })
    }
    if (path === '/api/members/billing/confirm-annual-membership-checkout') {
      expect(route.request().headers().authorization).toBe('Bearer drop-in-test-token')
      expect(body).toEqual({ checkoutSessionId: 'cs_membership_fixture' })
      if (options.membershipConfirmationFails) return route.fulfill({ status: 409, json: { success: false, message: 'Membership payment is still being verified.' } })
      membershipActive = true
      return json({ status: 'completed', renewsOn: '2027-11-16' })
    }
    if (path === '/api/public/drop-ins/register') {
      expect(route.request().headers().authorization).toBe('Bearer drop-in-test-token')
      const benefitType = body?.useFreeTrial ? 'free_trial' : membershipActive ? 'annual_credit' : 'paid'
      return json({ id: 400, status: benefitType === 'paid' ? 'payment_pending' : 'confirmed', benefitType,
        totalCents: benefitType === 'paid' ? 3000 : 0, enrollmentStartDate: classDate, accountRequired: false, signupUrl: null })
    }
    if (path === '/api/members/billing/drop-in-checkout') {
      expect(body).toEqual({ dropInId: 400 })
      if (options.checkoutFails) return route.fulfill({ status: 503, json: { success: false, message: 'Card checkout is temporarily unavailable.' } })
      return json({ status: 'payment_pending', url: '/mock-drop-in-card-payment' })
    }
    return json([])
  })
  await page.route('**/mock-membership-card-payment', route => route.fulfill({ body: 'Membership card payment fixture' }))
  await page.route('**/mock-drop-in-card-payment', route => route.fulfill({ body: 'Drop-in card payment fixture' }))
  const conversions = () => submitted.filter(({ path }) => path === '/api/analytics/event')
    .flatMap(({ body }) => (body.events as { eventName: string }[]).map(({ eventName }) => eventName))
    .filter(name => name === 'trial_confirmed' || name === 'drop_in_confirmed')
  return { submitted, catalogMemberIds, conversions }
}

async function signedIn(page: Page) {
  await page.addInitScript(account => {
    localStorage.setItem('vortex_member_token', 'drop-in-test-token')
    localStorage.setItem('vortex_member', JSON.stringify(account))
  }, account)
}

test('signed-in Fit & Flip families choose the eligible athlete before reviewing price or trial benefits', async ({ page }) => {
  await signedIn(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const { catalogMemberIds } = await mockDropInApi(page, { includeFitFlipClass: true, trialUsedOnRefresh: true })
  await page.route('**/api/members/family', route => {
    expect(route.request().headers().authorization).toBe('Bearer drop-in-test-token')
    return route.fulfill({ json: { success: true, familyMembers: [
      { id: 101, first_name: 'Test', last_name: 'Parent', date_of_birth: '1985-01-01' },
      { id: 102, first_name: 'Test', last_name: 'Child', date_of_birth: '2019-01-12' },
      { id: 103, first_name: 'Test', last_name: 'Sibling', date_of_birth: '2019-01-13' },
    ] } })
  })
  const registrations: unknown[] = []
  await page.route('**/api/public/drop-ins/register', route => {
    registrations.push(route.request().postDataJSON())
    return route.fulfill({ status: 400, json: {
      success: false, message: 'All current required waivers must be signed for this athlete before the drop-in is confirmed.',
    } })
  })

  await page.goto(fitFlipDropInUrl)
  await page.getByRole('button', { name: /Cyclones \(8-11\).*Nonmember/i }).click()
  await expect(page).toHaveURL(`/drop-in?signupSlot=202&signupDate=${classDate}&program=Fit+%26+Flip`)
  await expect(page.getByRole('heading', { name: 'Who’s attending this drop-in?' })).toBeVisible()
  await expect(page.getByRole('radio')).toHaveCount(1)
  const child = page.getByRole('radio', { name: /Test Child.*Age 8 on class day/ })
  await expect(child).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Review drop-in' })).toBeDisabled()
  expect(catalogMemberIds).toEqual([])

  await child.check()
  await page.getByRole('button', { name: 'Review drop-in' }).click()
  await expect(page).toHaveURL(`/drop-in?signupSlot=202&signupDate=${classDate}&program=Fit+%26+Flip&athlete=102`)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Pay $30.00' })).toBeEnabled()
  await expect(page.getByText('Use my one-time free trial')).toHaveCount(0)
  await expect(page.getByText('Add yearly membership')).toHaveCount(0)
  await page.getByLabel('Free-day code (optional)').fill('UNVERIFIED')
  await expect(page.getByRole('button', { name: 'Pay $30.00' })).toBeEnabled()
  await page.getByRole('button', { name: 'Pay $30.00' }).click()
  await expect(page.getByRole('alert')).toContainText('required waivers must be signed for this athlete')
  await expect(page.getByRole('link', { name: 'Review and sign waivers' })).toHaveAttribute('href', '/waivers-memberships')
  expect(registrations).toEqual([{ memberId: 102, slotGroupId: 202, classDate, useFreeTrial: false, promoCode: 'UNVERIFIED' }])
  expect(catalogMemberIds.length).toBeGreaterThanOrEqual(2)
  expect(new Set(catalogMemberIds)).toEqual(new Set(['102']))

  await page.getByRole('button', { name: 'Change athlete' }).click()
  await expect(page.getByRole('radio', { name: /Test Child/ })).not.toBeChecked()
  await page.getByRole('button', { name: 'Back to classes' }).click()
  await expect(page).toHaveURL('/drop-in?program=Fit+%26+Flip')
})

test('an expired family session offers sign-in while retaining the class date and program', async ({ page }) => {
  await signedIn(page)
  await mockDropInApi(page, { includeFitFlipClass: true })
  await page.route('**/api/members/family', route => route.fulfill({ status: 401, json: { success: false } }))
  const selection = `/drop-in?signupSlot=202&signupDate=${classDate}&program=Fit+%26+Flip`
  await page.goto(selection)
  await expect(page.getByRole('alert')).toHaveText('Your sign-in expired.')
  await page.getByRole('link', { name: 'Sign in again' }).click()
  await expect(page).toHaveURL(`${selection}&login=1`)
  await expect(page.getByRole('heading', { name: 'Continue your drop-in signup' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('vortex_member_token'))).toBeNull()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Who’s attending this drop-in?' })).toBeVisible()
})

async function completeAccountDetails(page: Page) {
  await page.getByPlaceholder('First name *', { exact: true }).fill('Test')
  await page.getByPlaceholder('Last name *', { exact: true }).fill('Parent')
  await page.getByPlaceholder('Email *', { exact: true }).fill('dropin@example.test')
  await page.getByRole('textbox', { name: 'Phone number' }).fill('4105550101')
  await page.getByPlaceholder('Street address *', { exact: true }).fill('123 Test Lane')
  await page.getByPlaceholder('City *', { exact: true }).fill('Test City')
  await page.getByRole('combobox', { name: 'State', exact: true }).selectOption('MD')
  await page.getByPlaceholder('ZIP *', { exact: true }).fill('21001')
  await page.getByLabel('Date of Birth', { exact: false }).fill('01/01/1985')
  await page.getByRole('combobox', { name: 'Gender' }).selectOption('prefer-not-to-say')
  await page.getByPlaceholder('Username *', { exact: true }).fill('dropintestparent')
  await page.getByPlaceholder('Password *', { exact: true }).fill('FixturePassword123')
  await page.getByPlaceholder('Confirm password *', { exact: true }).fill('FixturePassword123')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Add member', exact: true }).click()
  await page.getByPlaceholder('First name *', { exact: true }).fill('Test')
  await page.getByPlaceholder('Last name *', { exact: true }).fill('Child')
  await page.getByLabel('Date of Birth', { exact: false }).fill('01/01/2016')
  await page.getByRole('combobox', { name: 'Gender' }).selectOption('prefer-not-to-say')
  await page.getByRole('combobox', { name: 'Who is attending this drop-in?' }).selectOption({ label: 'Test Child' })
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
}

async function finishAccount(page: Page, expectReview = true) {
  await page.getByRole('checkbox', { name: "I've read the above and agree to Participation waiver" }).check()
  await page.getByRole('checkbox', { name: "I've read the above and agree to Gym policies" }).check()
  await page.getByRole('checkbox', { name: 'I AGREE TO THE SELECTED WAIVERS ABOVE', exact: true }).check()
  await page.getByLabel('Full Name (signature)', { exact: true }).fill('Test Parent')
  await page.getByRole('button', { name: 'Create account & review payment' }).click()
  if (expectReview) await expect(page.getByRole('heading', { name: 'Review your drop-in' })).toBeVisible()
}

test('adult drop-in dates stay scoped through guest signup and cancellation', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-10T17:00:00Z'))
  await acceptAnalytics(page)
  const { submitted, conversions } = await mockDropInApi(page, { includeAdultClass: true, mixedAdultTrialFlags: true })
  await page.goto('/adult-gymnastics')
  await page.getByText('Can I try adult gymnastics for free?', { exact: true }).click()
  await expect(page.getByText(/Look for “Accepts free trials” on Typhoons dates/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Register yourself and sign your waiver' })).toBeVisible()
  const findDates = page.getByRole('link', { name: 'Check Typhoons dates and prices', exact: true })
  await expect(findDates).toHaveAttribute('href', adultDropInUrl)
  await findDates.click()
  await expect(page).toHaveURL(adultDropInUrl)

  const availableDates = page.getByRole('heading', { name: 'Available Typhoons drop-in dates' })
  const dateOption = page.getByRole('button', { name: /Typhoons \(Adult\).*Jan 12, 2027.*7:00 PM.*8:30 PM/ })
  const youthClass = page.getByRole('button', { name: /Beginner Gymnastics/ })
  await expect(page.getByRole('heading', { name: 'Adult gymnastics drop-ins.' })).toBeVisible()
  await expect(page.getByText(/Registration checks whether the selected athlete has an unused one-time trial/)).toBeVisible()
  await expect(availableDates).toBeVisible()
  await expect(youthClass).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Typhoons \(Adult\).*Jan (19|26), 2027/ })).toHaveCount(0)
  await expect(dateOption.getByText('Accepts free trials', { exact: true })).toBeVisible()
  await expect(dateOption.getByText('$30.00', { exact: true })).toBeVisible()
  for (const day of ['Feb 2', 'Feb 9']) {
    const paidOption = page.getByRole('button', { name: new RegExp(`Typhoons.*${day}, 2027`) })
    await expect(paidOption).toBeEnabled()
    await expect(paidOption.getByText('Accepts free trials', { exact: true })).toHaveCount(0)
  }
  await dateOption.click()
  await expect(page).toHaveURL(url => url.pathname === '/drop-in' &&
    url.searchParams.get('program') === adultProgram &&
    url.searchParams.get('signupSlot') === '201' &&
    url.searchParams.get('signupDate') === classDate)
  await expect(page.getByRole('heading', { name: 'Register for your drop-in' })).toBeVisible()
  await expect(page.getByText(adultDropInClass.className, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Accepts free trials', { exact: true })).toBeVisible()
  await expect.poll(() => submitted.filter(({ path }) => path === '/api/analytics/event')
    .flatMap(({ body }) => body.events as { eventName: string; pagePath: string }[])
    .find(({ eventName }) => eventName === 'drop_in_start')?.pagePath).toBe('/drop-in')
  expect(conversions()).toEqual([])

  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page).toHaveURL(url => url.pathname === '/drop-in' &&
    url.searchParams.get('program') === adultProgram && !url.searchParams.has('signupSlot') &&
    !url.searchParams.has('signupDate'))
  await expect(availableDates).toBeVisible()
  await expect(dateOption).toBeVisible()
  await expect(youthClass).toHaveCount(0)
  expect(submitted.filter(({ path }) => path === '/api/public/drop-ins/register')).toHaveLength(0)
})

test('adult membership checkout returns to the selected drop-in and keeps Typhoons as the back destination', async ({ page }) => {
  await signedIn(page)
  const { submitted } = await mockDropInApi(page, { includeAdultClass: true })
  await page.goto(`${adultDropInUrl}&signupSlot=201&signupDate=${classDate}&athlete=102`)
  await expect(page.getByRole('checkbox', { name: /Use my one-time free trial/ })).toBeChecked()
  await page.getByRole('radio', { name: /Add yearly membership/ }).check()
  await page.getByRole('button', { name: 'Continue to payment', exact: true }).click()
  await expect(page).toHaveURL('/mock-membership-card-payment')
  const checkout = submitted.find(({ path }) => path === '/api/members/billing/annual-membership-checkout')!
  for (const destination of [checkout.body.successUrl, checkout.body.cancelUrl]) {
    const params = new URL(String(destination)).searchParams
    expect(Object.fromEntries(params)).toMatchObject({ program: adultProgram, signupSlot: '201', signupDate: classDate, athlete: '102' })
  }
  await page.goto(String(checkout.body.cancelUrl))
  await expect(page.getByText('Membership checkout was cancelled.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Back to classes' }).click()
  await expect(page).toHaveURL(url => url.pathname === '/drop-in' && url.searchParams.get('program') === adultProgram && !url.searchParams.has('signupSlot'))
  await expect(page.getByRole('heading', { name: 'Available Typhoons drop-in dates' })).toBeVisible()
})

test('general drop-in catalog retains its curated programs when Typhoons is available', async ({ page }) => {
  await mockDropInApi(page, { includeAdultClass: true })
  await page.goto('/drop-in')
  const calendars = page.getByRole('navigation', { name: 'Drop-in calendars by program' })
  await expect(calendars.getByRole('link', { name: 'Youth gymnastics dates' })).toHaveAttribute('href', '/drop-in?program=Developmental%20Gymnastics')
  await expect(calendars.getByRole('link', { name: 'Fit & Flip dates' })).toHaveAttribute('href', fitFlipDropInUrl)
  await expect(calendars.getByRole('link', { name: 'Typhoons drop-in dates' })).toHaveAttribute('href', adultDropInUrl)
  await expect(page.getByRole('button', { name: /Beginner Gymnastics.*View drop-in times/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Typhoons \(Adult\).*View drop-in times/ })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Program', exact: true }).locator('option')).toHaveText([
    'All programs', 'Developmental Gymnastics',
  ])
})

test('Fit & Flip drop-in link shows Cyclones dates and keeps the program through signup', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-10T17:00:00Z'))
  await mockDropInApi(page, { includeFitFlipClass: true, includeBothFitFlipCohorts: true })
  await page.goto('/fit-and-flip')
  await page.getByRole('button', { name: 'Necessary only', exact: true }).click()
  const findDates = page.getByRole('link', { name: 'See Fit & Flip drop-in dates', exact: true })
  await expect(findDates).toHaveAttribute('href', fitFlipDropInUrl)
  await findDates.click()
  await expect(page).toHaveURL(fitFlipDropInUrl)

  const availableDates = page.getByRole('heading', { name: 'Available Cyclones drop-in dates', exact: true })
  const dateOption = page.getByRole('button', { name: /Cyclones.*Jan 12, 2027.*6:00 PM.*7:30 PM/ })
  const cyclones = page.getByRole('button', { name: /Cyclones.*View drop-in times/ })
  const gymnastics = page.getByRole('button', { name: /Beginner Gymnastics.*View drop-in times/ })
  await expect(page.getByRole('heading', { name: 'Fit & Flip drop-ins.', exact: true })).toBeVisible()
  await expect(availableDates).toBeVisible()
  await expect(dateOption).toBeVisible()
  const ageGroup = page.getByRole('combobox', { name: 'Age group', exact: true })
  await expect(ageGroup.locator('option')).toHaveText(['All age groups', 'Ages 8–11', 'Ages 12–15'])
  await ageGroup.selectOption({ label: 'Ages 12–15' })
  await expect(page).toHaveURL(url => url.searchParams.get('cohort') === '15')
  await expect(dateOption).toHaveCount(0)
  const olderDates = page.getByRole('button', { name: /Cyclones \(12-15\)/ })
  await expect(olderDates).toHaveCount(2)
  await expect(olderDates.first()).toContainText('Jan 12, 2027')
  await page.reload()
  await expect(ageGroup).toHaveValue('15')
  await expect(olderDates).toHaveCount(2)
  await ageGroup.selectOption({ label: 'Ages 8–11' })
  await expect(olderDates).toHaveCount(0)
  await expect(dateOption.getByText('Accepts free trials', { exact: true })).toHaveCount(0)
  await expect(cyclones).toHaveCount(0)
  await expect(gymnastics).toHaveCount(0)

  await dateOption.click()
  await expect(page.getByRole('heading', { name: 'Register for your drop-in' })).toBeVisible()
  await expect(page).toHaveURL(url => url.pathname === '/drop-in' &&
    url.searchParams.get('program') === fitFlipProgram &&
    url.searchParams.get('cohort') === '14' &&
    url.searchParams.get('signupSlot') === '202' && url.searchParams.get('signupDate') === classDate)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page).toHaveURL(url => url.pathname === '/drop-in' && url.searchParams.get('program') === fitFlipProgram && !url.searchParams.has('signupSlot'))
  await expect(availableDates).toBeVisible()
  await expect(ageGroup).toHaveValue('14')
  await expect(dateOption).toBeVisible()
  await expect(gymnastics).toHaveCount(0)

  await page.getByRole('link', { name: 'Browse all drop-in classes', exact: true }).click()
  await expect(page).toHaveURL('/drop-in')
  await expect(cyclones).toBeVisible()
  await expect(gymnastics).toBeVisible()
})

test('drop-in-only schedule hides the free trial and sends the displayed paid booking', async ({ page }) => {
  await signedIn(page)
  const { submitted } = await mockDropInApi(page, { allowsFreeTrial: false })
  await page.goto(resumeUrl)
  const pay = page.getByRole('button', { name: 'Pay $30.00', exact: true })
  await expect(pay).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /Use my one-time free trial/ })).toHaveCount(0)
  await pay.click()
  await expect(page).toHaveURL('/mock-drop-in-card-payment')
  expect(submitted.find(entry => entry.path === '/api/public/drop-ins/register')?.body)
    .toMatchObject({ memberId: 102, slotGroupId: 200, classDate, useFreeTrial: false })
})

test.describe('short mobile drop-in calendar', () => {
  test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true })

  test('browses by class or date while cookie consent remains unchosen', async ({ page, context }) => {
    await page.clock.setFixedTime(new Date('2027-01-10T17:00:00Z'))
    const { submitted } = await mockDropInApi(page)
    await page.goto('/drop-in')
    const banner = page.getByRole('dialog', { name: 'Cookie consent' })
    await expect(banner).toBeVisible()
    const date = page.locator('#drop-in-date')
    const age = page.getByRole('spinbutton', { name: 'Age on class date' })
    const classOption = page.getByRole('button', { name: /Beginner Gymnastics.*View drop-in times/ })
    const sheet = page.locator('.np-drop-in-sessions')

    await expect(date).not.toHaveAttribute('required')
    await classOption.tap()
    const classHeading = sheet.getByRole('heading', { name: 'Beginner Gymnastics', exact: true })
    await expect(classHeading).toBeFocused()
    await expect(sheet.getByRole('region', { name: 'Upcoming dates & times' }).getByRole('button')).toHaveCount(1)
    await classHeading.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(classOption).toBeFocused()

    await age.fill('7')
    await date.fill('2027-01-10')
    await page.getByRole('button', { name: 'Show classes on any date' }).tap()
    await expect(date).toHaveValue('')
    await expect(age).toHaveValue('7')

    await date.fill(classDate)
    await classOption.tap()
    await expect(sheet.getByRole('region', { name: 'Your selected date' }).getByRole('button')).toHaveCount(1)
    await sheet.getByRole('button', { name: 'Close upcoming classes', exact: true }).tap()
    await expect(sheet).toBeHidden()
    for (const name of ['Settings', 'Necessary only', 'Accept all']) {
      const choice = banner.getByRole('button', { name, exact: true })
      await expect(choice).toBeVisible()
      expect(await choice.evaluate(element => {
        const { x, y, width, height } = element.getBoundingClientRect()
        return element.contains(document.elementFromPoint(x + width / 2, y + height / 2))
      })).toBe(true)
    }

    await date.fill('')
    await classOption.tap()
    const slot = sheet.getByRole('region', { name: 'Upcoming dates & times' }).getByRole('button')
    await expect(slot).toHaveCount(1)
    await expect(slot).toBeEnabled()
    const target = await slot.evaluate(element => {
      const box = element.getBoundingClientRect()
      const x = box.x + box.width / 2
      const y = box.y + box.height / 2
      return { x, y, receivesTap: element.contains(document.elementFromPoint(x, y)) }
    })
    expect(target.receivesTap).toBe(true)
    await page.touchscreen.tap(target.x, target.y)
    await expect(page).toHaveURL(signupUrl)
    await expect(page.getByRole('heading', { name: 'Register for your drop-in' })).toBeVisible()
    expect(await page.evaluate(key => localStorage.getItem(key), CONSENT_STORAGE_KEY)).toBeNull()
    expect((await context.cookies()).filter(cookie => [CONSENT_COOKIE_NAME, CONSENT_ID_COOKIE_NAME].includes(cookie.name))).toEqual([])
    expect(submitted).toEqual([])
  })
})

test('guest drop-in requires full account details and waivers before offering membership and final card payment', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { submitted, catalogMemberIds } = await mockDropInApi(page)
  await page.goto('/drop-in')
  await page.getByRole('button', { name: 'Necessary only', exact: true }).click()
  await page.locator('#drop-in-date').fill(classDate)
  await page.getByRole('button', { name: /Beginner Gymnastics.*View drop-in times/ }).click()
  await page.locator('.np-drop-in-session-option').first().click()
  await expect(page.getByRole('heading', { name: 'Register for your drop-in' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reserve class' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('First and last name are required.')
  expect(submitted.filter(item => /signup\/family|drop-ins\/register|billing/.test(item.path))).toEqual([])
  await completeAccountDetails(page)
  await page.getByRole('button', { name: 'Create account & review payment' }).click()
  await expect(page.getByRole('alert')).toContainText('Please agree to Participation waiver.')
  expect(submitted.filter(item => item.path === '/api/signup/family')).toHaveLength(0)
  await finishAccount(page)
  const signup = submitted.find(item => item.path === '/api/signup/family')!
  expect(signup.body.primaryAdult).toMatchObject({ addressStreet: '123 Test Lane', addressState: 'MD', dateOfBirth: '1985-01-01', username: 'dropintestparent' })
  expect(signup.body.additionalMembers).toHaveLength(1)
  expect(signup.body.enrollments).toEqual([])
  expect(signup.body.waivers).toMatchObject({ acceptedTemplateIds: [11, 12], signatureName: 'Test Parent', paymentPolicyAcknowledged: true })
  await expect(page.getByRole('group', { name: 'Yearly membership (optional)' })).toBeVisible()
  await expect(page.getByText(/4 free drop-ins/).last()).toBeVisible()
  await expect(page.getByRole('radio', { name: /Drop-in only/ })).toBeChecked()
  expect(await page.locator('body').evaluate(body => body.scrollWidth <= window.innerWidth)).toBe(true)
  expect(submitted.filter(item => /drop-ins\/register|billing/.test(item.path))).toEqual([])
  await page.getByRole('checkbox', { name: /one-time free trial/ }).uncheck()
  await page.getByRole('button', { name: 'Pay $30.00', exact: true }).click()
  await expect(page).toHaveURL('/mock-drop-in-card-payment')
  expect(submitted.find(item => item.path === '/api/public/drop-ins/register')?.body).toMatchObject({ memberId: 102, slotGroupId: 200, classDate, useFreeTrial: false })
  expect(catalogMemberIds).toContain('102')
  expect(submitted.filter(item => item.path === '/api/members/billing/annual-membership-checkout')).toHaveLength(0)
})

test('membership is paid and verified before an annual credit can confirm the selected drop-in', async ({ page }) => {
  const { submitted, catalogMemberIds, conversions } = await mockDropInApi(page)
  await acceptAnalytics(page)
  await page.goto(signupUrl)
  await completeAccountDetails(page)
  await finishAccount(page)
  await page.getByRole('radio', { name: /Add yearly membership/ }).check()
  await page.getByRole('button', { name: 'Continue to payment', exact: true }).click()
  await expect(page).toHaveURL('/mock-membership-card-payment')
  expect(submitted.filter(item => item.path === '/api/public/drop-ins/register')).toHaveLength(0)
  const membershipCheckout = submitted.find(item => item.path === '/api/members/billing/annual-membership-checkout')!
  expect(membershipCheckout.body.successUrl).toContain('signupSlot=200')
  expect(membershipCheckout.body.successUrl).toContain('athlete=102')
  const paidUrl = new URL(String(membershipCheckout.body.successUrl).replace('{CHECKOUT_SESSION_ID}', 'cs_membership_fixture'))
  await page.goto(`${paidUrl.pathname}${paidUrl.search}`)
  await expect(page.getByRole('heading', { name: 'Review your drop-in' })).toBeVisible()
  const trialCheckbox = page.getByRole('checkbox', { name: /one-time free trial/ })
  if (await trialCheckbox.isVisible()) await trialCheckbox.uncheck()
  await page.getByRole('button', { name: 'Confirm drop-in · $0', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Drop-in confirmed' })).toBeVisible()
  const confirmationIndex = submitted.findIndex(item => item.path === '/api/members/billing/confirm-annual-membership-checkout')
  const registrationIndex = submitted.findIndex(item => item.path === '/api/public/drop-ins/register')
  expect(confirmationIndex).toBeGreaterThan(-1)
  expect(registrationIndex).toBeGreaterThan(confirmationIndex)
  expect(submitted[registrationIndex].body).toMatchObject({ memberId: 102, useFreeTrial: false })
  expect(submitted.filter(item => item.path === '/api/signup/family')).toHaveLength(1)
  expect(submitted.filter(item => item.path === '/api/members/billing/drop-in-checkout')).toHaveLength(0)
  expect(catalogMemberIds.length).toBeGreaterThanOrEqual(2)
  await expect.poll(conversions).toEqual(['drop_in_confirmed'])
})

test('cancelled optional membership returns to review without confirming a drop-in', async ({ page }) => {
  const { submitted } = await mockDropInApi(page)
  await signedIn(page)
  await page.goto(`${resumeUrl}&membership=cancelled`)
  await expect(page.getByRole('heading', { name: 'Review your drop-in' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Drop-in only/ })).toBeChecked()
  await expect(page.getByRole('heading', { name: 'Drop-in confirmed' })).toHaveCount(0)
  expect(submitted.filter(item => /signup\/family|drop-ins\/register|billing/.test(item.path))).toEqual([])
  await page.getByRole('checkbox', { name: /one-time free trial/ }).uncheck()
  await page.getByRole('button', { name: 'Pay $30.00', exact: true }).click()
  await expect(page).toHaveURL('/mock-drop-in-card-payment')
})

test('unverified membership payment never grants credits or confirms the class', async ({ page }) => {
  const { submitted } = await mockDropInApi(page, { membershipConfirmationFails: true })
  await signedIn(page)
  await page.goto(`${resumeUrl}&membership=paid&session_id=cs_membership_fixture`)
  await expect(page.getByRole('alert')).toContainText('Membership payment is still being verified.')
  await expect(page.getByRole('heading', { name: 'Drop-in confirmed' })).toHaveCount(0)
  expect(submitted.filter(item => item.path === '/api/public/drop-ins/register')).toHaveLength(0)
})

test('card checkout failure retains the account and pending booking for retry', async ({ page }) => {
  const { submitted } = await mockDropInApi(page, { checkoutFails: true })
  await signedIn(page)
  await page.goto(resumeUrl)
  await expect(page.getByRole('heading', { name: 'Review your drop-in' })).toBeVisible()
  await page.getByRole('checkbox', { name: /one-time free trial/ }).uncheck()
  await page.getByRole('button', { name: 'Pay $30.00', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Card checkout is temporarily unavailable.')
  await expect(page.getByRole('heading', { name: 'Drop-in confirmed' })).toHaveCount(0)
  expect(submitted.filter(item => item.path === '/api/signup/family')).toHaveLength(0)
  expect(submitted.filter(item => item.path === '/api/public/drop-ins/register')).toHaveLength(1)
  await page.getByRole('button', { name: 'Pay $30.00', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Card checkout is temporarily unavailable.')
  expect(submitted.filter(item => item.path === '/api/public/drop-ins/register')).toHaveLength(1)
  expect(submitted.filter(item => item.path === '/api/members/billing/drop-in-checkout')).toHaveLength(2)
})

test('an eligible one-time trial confirms at zero dollars without buying membership or opening card checkout', async ({ page }) => {
  const { submitted, conversions } = await mockDropInApi(page)
  await acceptAnalytics(page)
  await page.goto(signupUrl)
  await completeAccountDetails(page)
  await finishAccount(page)
  await expect(page.getByRole('checkbox', { name: /one-time free trial/ })).toBeChecked()
  await page.getByRole('button', { name: 'Confirm drop-in · $0', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Drop-in confirmed' })).toBeVisible()
  await expect(page.getByText('Your one-time free trial is confirmed. No payment is due.')).toBeVisible()
  expect(submitted.find(item => item.path === '/api/public/drop-ins/register')?.body).toMatchObject({ memberId: 102, useFreeTrial: true })
  expect(submitted.filter(item => /billing/.test(item.path))).toHaveLength(0)
  await expect.poll(conversions).toEqual(['trial_confirmed'])
})

test('failed automatic login resumes the saved signup after sign-in without creating another account', async ({ page }) => {
  const { submitted } = await mockDropInApi(page, { autoLoginFails: true })
  await page.goto(signupUrl)
  await completeAccountDetails(page)
  await finishAccount(page, false)
  await expect(page.getByRole('heading', { name: 'Continue your drop-in signup' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Register for your drop-in' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Sign in to continue' }).click()
  await page.getByLabel('Email, username, or phone number', { exact: true }).fill('dropintestparent')
  await page.getByLabel('Password', { exact: true }).fill('FixturePassword123')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Review your drop-in' })).toBeVisible()
  expect(submitted.filter(item => item.path === '/api/signup/family')).toHaveLength(1)
  expect(submitted.filter(item => item.path === '/api/members/login')).toHaveLength(2)
  expect(submitted.filter(item => item.path === '/api/public/drop-ins/register')).toHaveLength(0)
})

test('a newly full class can still recover an existing pending drop-in through the registration API', async ({ page }) => {
  const state = { fullOnRefresh: false }
  const { submitted } = await mockDropInApi(page, state)
  await signedIn(page)
  await page.goto(resumeUrl)
  await page.getByRole('checkbox', { name: /one-time free trial/ }).uncheck()
  state.fullOnRefresh = true
  await page.getByRole('button', { name: 'Pay $30.00', exact: true }).click()
  await expect(page).toHaveURL('/mock-drop-in-card-payment')
  expect(submitted.filter(item => item.path === '/api/public/drop-ins/register')).toHaveLength(1)
})

test('a class that fills during review blocks the optional membership purchase', async ({ page }) => {
  const state = { fullOnRefresh: false }
  const { submitted } = await mockDropInApi(page, state)
  await signedIn(page)
  await page.goto(resumeUrl)
  await page.getByRole('radio', { name: /Add yearly membership/ }).check()
  state.fullOnRefresh = true
  await page.getByRole('button', { name: 'Continue to payment', exact: true }).click()
  await expect(page.getByRole('alert').first()).toContainText('This class is no longer available.')
  expect(submitted.filter(item => /drop-ins\/register|billing/.test(item.path))).toHaveLength(0)
})

test('a trial used elsewhere refreshes the total and requires confirmation before any paid registration', async ({ page }) => {
  const state = { trialUsedOnRefresh: false }
  const { submitted } = await mockDropInApi(page, state)
  await signedIn(page)
  await page.goto(resumeUrl)
  await expect(page.getByRole('button', { name: 'Confirm drop-in · $0', exact: true })).toBeVisible()
  state.trialUsedOnRefresh = true
  await page.getByRole('button', { name: 'Confirm drop-in · $0', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Review the updated total before continuing.')
  expect(submitted.filter(item => item.path === '/api/public/drop-ins/register')).toHaveLength(0)
  await page.getByRole('button', { name: 'Pay $30.00', exact: true }).click()
  await expect(page).toHaveURL('/mock-drop-in-card-payment')
  expect(submitted.find(item => item.path === '/api/public/drop-ins/register')?.body.useFreeTrial).toBe(false)
})

test('membership requiring staff review stays blocked after reloading checkout', async ({ page }) => {
  const { submitted } = await mockDropInApi(page, { membershipRequiresReview: true })
  await signedIn(page)
  await page.goto(resumeUrl)
  await page.getByRole('radio', { name: /Add yearly membership/ }).check()
  await page.getByRole('button', { name: 'Continue to payment', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Your membership payment needs staff review')
  await expect(page).toHaveURL(/membership=review/)
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Your membership payment needs staff review')
  await expect(page.getByRole('button', { name: /Confirm drop-in|^Pay / })).toHaveCount(0)
  expect(submitted.filter(item => item.path === '/api/public/drop-ins/register')).toHaveLength(0)
})
