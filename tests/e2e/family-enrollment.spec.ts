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
async function setup(page: Page, options: { stripe?: boolean; delayFirst?: boolean; failPreview?: boolean } = {}): Promise<Capture> {
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
        additionalFeesOneTime: options.stripe ? 1 : 0 })
    }
    if (path.endsWith('/signups/batch')) {
      captured.batches.push(body)
      return json(route, { signups: [{ id: 123 }] })
    }
    if (path.endsWith('/enrollment-checkout-session')) {
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
  await page.getByPlaceholder('Enter discount code').fill('FIRST')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
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

test('payment navigation retains the other sibling draft, and logout clears drafts', async ({ page }) => {
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
  await expect(page.getByRole('checkbox', { name: /Monday/ })).not.toBeChecked()
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
  await page.getByPlaceholder('First name *', { exact: true }).fill('Parent')
  await page.getByPlaceholder('Last name *', { exact: true }).fill('Example')
  await page.getByPlaceholder('Email *', { exact: true }).fill('parent@example.invalid')
  await page.getByPlaceholder('###-###-####').fill('2025550100')
  await page.getByPlaceholder('Street address *').fill('123 Example Street')
  await page.getByPlaceholder('City *', { exact: true }).fill('Bowie')
  await page.locator('select').filter({ has: page.locator('option[value="MD"]') }).selectOption('MD')
  await page.getByPlaceholder('ZIP *').fill('20715')
  await page.getByLabel('Date of Birth', { exact: false }).fill('1980-01-01')
  await page.getByPlaceholder('Username *').fill('fixture-parent')
  await page.getByPlaceholder('Password *', { exact: true }).fill('FixtureOnly123!')
  await page.getByPlaceholder('Confirm password *').fill('FixtureOnly123!')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
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
