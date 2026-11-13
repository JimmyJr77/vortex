import { expect, test, type Page, type Route } from '@playwright/test'

const fixture = '/tests/e2e/fixtures/family-enrollment.html'
const schedule = { slotGroupId: 4, timeSlotId: 5, offeringId: null, offeringLabel: null,
  offeringDates: null, scheduleLabel: 'Monday · 16:00–17:00', startTime: '16:00', daySort: 1,
  priceCents: 15000, priceLabel: '$150/mo' }
const catalog = { formId: 3, offerings: [], scheduleOptions: [schedule] }
const preview = { hasPricing: true, memberId: 101, existingClasses: [], newSignups: [],
  formSummaries: [], existingMonthlyTotal: 0, newSignupMonthlyTotal: 150,
  estimatedMonthlyTotal: 150, totalDiscountMonthly: 0, disclaimer: '' }
const json = (route: Route, data: unknown) => route.fulfill({ json: { success: true, data } })

type SignupRequest = { signupAuthToken: string; promoCodes: string[]; signups: Array<Record<string, unknown>> }
type Capture = { batches: SignupRequest[]; previews: SignupRequest[] }
async function setup(page: Page, options: { stripe?: boolean; delayFirst?: boolean; failPreview?: boolean; paid?: boolean; checkoutFails?: boolean } = {}): Promise<Capture> {
  const captured: Capture = { batches: [], previews: [] }
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : {}
    if (path.endsWith('/offerings')) return json(route, catalog)
    if (path.endsWith('/annual-membership')) return json(route, { available: false, active: false })
    if (path.endsWith('/auth/member-session')) return json(route, { signupAuthToken: `athlete-${body.targetMemberId}` })
    if (path.endsWith('/order-preview')) {
      captured.previews.push(body)
      if (options.delayFirst && body.signupAuthToken === 'athlete-101') {
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
      if (options.failPreview) return route.fulfill({ status: 503, json: { success: false, message: 'Pricing unavailable for test' } })
      return json(route, { ...preview, estimatedMonthlyTotal: body.signupAuthToken === 'athlete-102' ? 200 : 150,
        additionalFeesOneTime: options.stripe || options.paid ? 1 : 0 })
    }
    if (path.endsWith('/signups/batch')) {
      captured.batches.push(body)
      return json(route, { signups: [{ id: 123 }] })
    }
    if (path.endsWith('/enrollment-checkout-session')) {
      if (options.checkoutFails) return route.fulfill({ status: 503, json: { success: false, message: 'Payment service unavailable' } })
      captured.batches.push(body)
      return json(route, { url: fixture + '?returned=1', pendingEnrollmentId: 1 })
    }
    if (path === '/api/signup/catalog/programs') return json(route, [{ id: 1, name: 'Test Gymnastics' }])
    if (path === '/api/signup/catalog/programs/1/classes') return json(route, [{ id: 2, name: 'Test Class', schedulingFormId: 3 }])
    if (path === '/api/signup/waivers') return json(route, [])
    if (path === '/api/signup/suggest-username') return json(route, { username: 'fixture-parent' })
    // Never let this fixture call an unmocked production API.
    return json(route, {})
  })
  return captured
}

async function chooseClass(page: Page, date = '2027-01-04') {
  await page.getByLabel('Enrollment start date').fill(date)
  await page.getByRole('checkbox', { name: /Monday/ }).check()
}

test('siblings keep separate selections, dates and discounts; each submit targets its own athlete', async ({ page }) => {
  const requests = await setup(page)
  await page.goto(fixture)
  await chooseClass(page)
  await page.getByRole('button', { name: 'Enroll (1)', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Confirm enrollment', exact: true })).toBeEnabled()
  await page.getByPlaceholder('Enter discount code').fill('FIRST')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('vortex_member_enrollment_draft_v1:101:101') || '{}').promoCodes)).toEqual(['FIRST'])
  await page.getByRole('button', { name: 'Back to class selection' }).click()
  await page.getByLabel('Enroll athlete', { exact: true }).selectOption('102')
  await expect(page.getByRole('checkbox', { name: /Monday/ })).not.toBeChecked()
  await expect(page.getByLabel('Enrollment start date')).toHaveValue('')
  await chooseClass(page, '2027-01-11')
  await expect(page.getByRole('button', { name: /Athlete One — review/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Athlete Two — review/ })).toBeVisible()
  await page.getByRole('button', { name: /Athlete One — review/ }).click()
  await expect(page.getByLabel('Enrollment start date')).toHaveValue('2027-01-04')
  await expect(page.getByRole('checkbox', { name: /Monday/ })).toBeChecked()
  await page.getByRole('button', { name: 'Enroll (1)', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm enrollment', exact: true }).click()
  await expect(page.getByText('Enrollment complete', { exact: true })).toBeVisible()
  expect(requests.batches[0]).toMatchObject({ signupAuthToken: 'athlete-101', promoCodes: ['FIRST'], signups: [{ enrollmentStartDate: '2027-01-04', timeSlotId: 5 }] })
  await page.getByRole('button', { name: 'Enroll another athlete' }).click()
  await expect(page.getByLabel('Enroll athlete', { exact: true })).toHaveValue('102')
  await expect(page.getByLabel('Enrollment start date')).toHaveValue('2027-01-11')
  await expect(page.getByRole('checkbox', { name: /Monday/ })).toBeChecked()
  await page.getByRole('button', { name: 'Enroll (1)', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm enrollment', exact: true }).click()
  await expect(page.getByText('Enrollment complete', { exact: true })).toBeVisible()
  expect(requests.batches[1]).toMatchObject({ signupAuthToken: 'athlete-102', promoCodes: [], signups: [{ enrollmentStartDate: '2027-01-11', timeSlotId: 5 }] })
})

test('an existing enrollment for one sibling does not remove the other sibling draft', async ({ page }) => {
  await setup(page)
  await page.goto(fixture + '?existing=1')
  await chooseClass(page)
  await page.getByLabel('Enroll athlete', { exact: true }).selectOption('102')
  await expect(page.getByRole('checkbox', { name: /Monday/ })).toBeDisabled()
  await page.getByLabel('Enroll athlete', { exact: true }).selectOption('101')
  await expect(page.getByRole('checkbox', { name: /Monday/ })).toBeChecked()
})

test('cancelled payment navigation retains both sibling drafts, and logout clears drafts', async ({ page }) => {
  const requests = await setup(page, { stripe: true })
  await page.goto(fixture + '?stripe=1')
  await chooseClass(page)
  await page.getByLabel('Enroll athlete', { exact: true }).selectOption('102')
  await chooseClass(page, '2027-01-11')
  await page.getByLabel('Enroll athlete', { exact: true }).selectOption('101')
  await page.getByRole('button', { name: 'Enroll (1)', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm & pay' }).click()
  await page.waitForURL('**?returned=1')
  expect(requests.batches[0].signupAuthToken).toBe('athlete-101')
  await expect(page.getByRole('checkbox', { name: /Monday/ })).toBeChecked()
  await page.getByLabel('Enroll athlete', { exact: true }).selectOption('102')
  await expect(page.getByRole('checkbox', { name: /Monday/ })).toBeChecked()
  await expect(page.getByLabel('Enrollment start date')).toHaveValue('2027-01-11')
  await page.getByRole('button', { name: 'Test logout' }).click()
  const keys = await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('vortex_member_enrollment_draft_v1:')))
  expect(keys).toEqual([])
})

test('late pricing from another athlete cannot overwrite the current quote', async ({ page }) => {
  const requests = await setup(page, { delayFirst: true })
  await page.goto(fixture)
  await chooseClass(page)
  await expect.poll(() => requests.previews.length).toBeGreaterThan(0)
  await page.getByLabel('Enroll athlete', { exact: true }).selectOption('102')
  await chooseClass(page)
  await expect(page.getByText('$200.00/mo', { exact: true })).toBeVisible()
  await page.waitForTimeout(1800) // Let the intentionally delayed previous-athlete response arrive.
  await expect(page.getByText('$200.00/mo', { exact: true })).toBeVisible()
  await expect(page.getByText('$150.00/mo', { exact: true })).toHaveCount(0)
})

test('failed pricing cannot submit an unpriced enrollment', async ({ page }) => {
  const requests = await setup(page, { failPreview: true })
  await page.goto(fixture)
  await chooseClass(page)
  await page.getByRole('button', { name: 'Enroll (1)', exact: true }).click()
  await expect(page.getByText('Pricing unavailable for test', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm enrollment', exact: true })).toBeDisabled()
  expect(requests.batches).toEqual([])
})

test('family signup copies a class into a separate enrollment without replacing the first child', async ({ page }) => {
  await setup(page)
  await page.goto(fixture + '?family=1')
  await fillPrimaryAdult(page)
  for (const [index, name] of ['First', 'Second'].entries()) {
    await page.getByRole('button', { name: 'Add member', exact: true }).click()
    await page.getByPlaceholder('First name *', { exact: true }).nth(index).fill(name)
    await page.getByPlaceholder('Last name *', { exact: true }).nth(index).fill('Example')
    await page.getByLabel('Date of Birth', { exact: false }).nth(index).fill('2018-01-01')
  }
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Add enrollment', exact: true }).click()
  await page.getByLabel('Family member', { exact: true }).selectOption({ label: 'First Example' })
  await page.locator('select').filter({ has: page.locator('option[value="1"]') }).selectOption('1')
  await page.locator('select').filter({ has: page.locator('option[value="2"]') }).selectOption('2')
  await page.getByLabel('Enrollment start date').fill('2027-01-04')
  await page.getByRole('checkbox', { name: /Monday/ }).check()
  await page.getByRole('button', { name: 'Enroll another family member in this class', exact: true }).click()
  await expect(page.getByLabel('Family member', { exact: true })).toHaveCount(2)
  await page.getByLabel('Family member', { exact: true }).nth(1).selectOption({ label: 'Second Example' })
  const firstId = await page.getByLabel('Family member', { exact: true }).nth(0).inputValue()
  const secondId = await page.getByLabel('Family member', { exact: true }).nth(1).inputValue()
  expect(firstId).not.toBe(secondId)
  await expect(page.getByLabel('Family member', { exact: true }).nth(0).locator('option:checked')).toHaveText('First Example')
  await expect(page.getByRole('checkbox', { name: /Monday/ }).nth(0)).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /Monday/ }).nth(1)).toBeChecked()
  await page.getByRole('checkbox', { name: /Monday/ }).nth(1).uncheck()
  await expect(page.getByRole('checkbox', { name: /Monday/ }).nth(0)).toBeChecked()
  await expect(page.getByLabel('Enrollment start date').nth(1)).toHaveValue('2027-01-04')
  await page.getByRole('checkbox', { name: /Monday/ }).nth(1).check()
  await page.getByLabel('Family member', { exact: true }).nth(1).selectOption({ label: 'First Example' })
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByText('This class time is selected more than once for the same family member. Choose a different family member or remove the duplicate enrollment.')).toBeVisible()
})

async function fillPrimaryAdult(page: Page, username = 'fixture-parent', onUsernameEntered?: () => Promise<void>) {
  await page.getByPlaceholder('First name *', { exact: true }).fill('Parent')
  await page.getByPlaceholder('Last name *', { exact: true }).fill('Example')
  await page.getByPlaceholder('Email *', { exact: true }).fill('parent@example.invalid')
  await page.getByPlaceholder('###-###-####').fill('2025550100')
  await page.getByPlaceholder('Street address *').fill('123 Example Street')
  await page.getByPlaceholder('City *', { exact: true }).fill('Bowie')
  await page.locator('select').filter({ has: page.locator('option[value="MD"]') }).selectOption('MD')
  await page.getByPlaceholder('ZIP *').fill('20715')
  await page.getByLabel('Date of Birth', { exact: false }).fill('1980-01-01')
  await page.getByPlaceholder('Username *').fill(username)
  await onUsernameEntered?.()
  await page.getByPlaceholder('Password *', { exact: true }).fill('FixtureOnly123!')
  await page.getByPlaceholder('Confirm password *').fill('FixtureOnly123!')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
}

test('paid classes cannot fall back to direct signup when Stripe is disabled', async ({ page }) => {
  const requests = await setup(page, { paid: true })
  await page.goto(fixture)
  await chooseClass(page)
  await page.getByRole('button', { name: 'Enroll (1)', exact: true }).click()
  await page.getByRole('button', { name: 'Payment unavailable', exact: true }).click()
  await expect(page.getByText(/Online payments are unavailable/)).toBeVisible()
  expect(requests.batches).toEqual([])
})

test('checkout failure cannot confirm enrollment or discard the selected class', async ({ page }) => {
  const requests = await setup(page, { stripe: true, checkoutFails: true })
  await page.goto(fixture + '?stripe=1')
  await chooseClass(page)
  await page.getByRole('button', { name: 'Enroll (1)', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm & pay' }).click()
  await expect(page.getByText('Payment service unavailable', { exact: true })).toBeVisible()
  expect(requests.batches).toEqual([])
  await expect(page.getByText('Enrollment complete', { exact: true })).toHaveCount(0)
})

for (const loginFails of [false, true]) test(`family account creation hands classes to checkout (login failure: ${loginFails})`, async ({ page }) => {
  const requests = await setup(page, { stripe: true })
  const credentials = { emailOrUsername: 'Parent', password: 'FixtureOnly123!' }
  let releaseSuggestion!: () => void
  const chosenUsername = new Promise<void>((resolve) => { releaseSuggestion = resolve })
  await page.route('**/api/signup/waivers', (route) => json(route, [{ id: 1, name: 'Test waiver', body: 'Test terms', version: '1', is_required: true }]))
  await page.route('**/api/signup/suggest-username?*', async (route) => {
    await chosenUsername
    await json(route, { username: 'fixture-parent' })
  })
  await page.route('**/api/signup/family', async (route) => {
    const body = route.request().postDataJSON()
    expect(body.enrollments).toHaveLength(1)
    expect(body.primaryAdult).toMatchObject({ username: credentials.emailOrUsername, password: credentials.password })
    await json(route, { payerMemberId: 101, enrollmentReceipts: [], pendingEnrollments: [{
      memberId: 101, classEventId: 2, formId: 3, slotGroupId: 4, timeSlotId: 5,
      classLabel: 'Test Class', scheduleLabel: 'Monday', programsId: 1, enrollmentStartDate: '2027-01-04',
    }] })
  })
  await page.route('**/api/members/login', (route) => {
    expect(route.request().postDataJSON()).toEqual(credentials)
    return loginFails
      ? route.fulfill({ status: 503, json: { success: false } })
      : route.fulfill({ json: { success: true, token: 'fixture-token', member: { id: 101 } } })
  })
  // Render the member checkout fixture at the real handoff destination.
  await page.route('**/?enrollment=review', async (route) => {
    const response = await route.fetch({ url: new URL(fixture, route.request().url()).href })
    await route.fulfill({ response, body: (await response.text()).replace('./family-enrollment.tsx', '/tests/e2e/fixtures/family-enrollment.tsx') })
  })
  const suggestionResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/signup/suggest-username')
  await page.goto(fixture + '?family=1')
  await fillPrimaryAdult(page, credentials.emailOrUsername, async () => {
    releaseSuggestion()
    await suggestionResponse
  })
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Add enrollment', exact: true }).click()
  await page.getByLabel('Family member', { exact: true }).selectOption({ label: 'Parent Example' })
  await page.locator('select').filter({ has: page.locator('option[value="1"]') }).selectOption('1')
  await page.locator('select').filter({ has: page.locator('option[value="2"]') }).selectOption('2')
  await chooseClass(page)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('checkbox', { name: /agree to Test waiver/ }).check()
  await page.getByRole('checkbox', { name: 'I AGREE TO THE SELECTED WAIVERS ABOVE' }).check()
  await page.getByPlaceholder('Legal name').fill('Parent Example')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  if (loginFails) {
    await expect(page.getByText(/Account created. Your class selections are awaiting checkout/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Continue to member portal' })).toHaveAttribute('href', '/?enrollment=review')
    await expect(page.getByRole('button', { name: 'Create account', exact: true })).toHaveCount(0)
  } else {
    await page.waitForURL('**/?enrollment=review')
    await expect(page.getByRole('checkbox', { name: /Monday/ })).toBeChecked()
    await expect(page.getByLabel('Enrollment start date')).toHaveValue('2027-01-04')
  }
  expect(requests.batches).toEqual([])
  const draft = await page.evaluate(() => JSON.parse(sessionStorage.getItem('vortex_member_enrollment_draft_v1:101:101') || '{}'))
  expect(draft.cart).toMatchObject([{ formId: 3, slotGroupId: 4, timeSlotId: 5, enrollmentStartDate: '2027-01-04' }])
  if (!loginFails) {
    let directSignups = 0
    await page.route('**/api/scheduling/signups/batch', (route) => {
      directSignups += 1
      return json(route, { signups: [] })
    })
    await page.getByRole('button', { name: 'Enroll (1)', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm & pay' }).click()
    await page.waitForURL('**?returned=1')
    expect(directSignups).toBe(0)
    expect(requests.batches).toHaveLength(1)
    expect(requests.batches[0]).toMatchObject({ signupAuthToken: 'athlete-101',
      signups: [{ formId: 3, slotGroupId: 4, timeSlotId: 5, enrollmentStartDate: '2027-01-04' }] })
  }
})
