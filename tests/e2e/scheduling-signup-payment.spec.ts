import { expect, test, type Page, type Route } from '@playwright/test'

const email = 'parent@example.test'
const signupPath = '/tests/e2e/fixtures/scheduling-signup.html?form=3&slotGroupId=4&timeSlotId=5&enrollmentStartDate=2027-01-04'
const schedule = {
  id: 5, formId: 3, slotGroupId: 4, scheduleMode: 'day', dayOfWeek: 1, dayName: 'Monday',
  startTime: '16:00', endTime: '17:00', maxParticipants: 10, spotsRemaining: 5, isActive: true,
}
const form = {
  id: 3, title: 'Test Gymnastics', isActive: true, mandateWaiver: false,
  slotGroups: [{ id: 4, formId: 3, scheduleMode: 'day', maxParticipants: 10, spotsRemaining: 5, isActive: true, occurrences: [schedule] }],
  timeSlots: [schedule],
}
const priced = {
  hasPricing: true, memberId: 42, existingClasses: [], newSignups: [], formSummaries: [],
  existingMonthlyTotal: 0, newSignupMonthlyTotal: 0, estimatedMonthlyTotal: 0, totalDiscountMonthly: 0,
  disclaimer: '',
}

function json(route: Route, data: unknown) {
  return route.fulfill({ json: { success: true, data } })
}

async function openReview(page: Page, {
  preview = priced,
  checkout = {},
  checkoutError = false,
}: {
  preview?: typeof priced & { additionalFeesOneTime?: number }
  checkout?: Record<string, unknown>
  checkoutError?: boolean
} = {}) {
  const requests = { memberLogins: 0, memberSessions: 0, checkouts: 0, directSignups: 0 }
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    switch (pathname) {
      case '/api/scheduling/forms/3': return json(route, form)
      case '/api/public/classes-offered': return route.fulfill({ json: { programs: [] } })
      case '/api/scheduling/forms/3/offerings': return json(route, [])
      case '/api/scheduling/forms/3/program-options': return json(route, { options: [] })
      case '/api/scheduling/my-signups': return json(route, { signups: [] })
      case '/api/scheduling/auth/check-email': return json(route, { exists: true, hasPassword: true })
      case '/api/scheduling/signups/order-preview': return json(route, preview)
      case '/api/members/login': {
        requests.memberLogins++
        expect(route.request().postDataJSON()).toEqual({ emailOrUsername: email, password: 'LocalTestPassword123' })
        return route.fulfill({ json: { success: true, token: 'member-token', member: { id: 7, memberId: 42, email, availablePortals: ['member'] } } })
      }
      case '/api/scheduling/auth/member-session': {
        requests.memberSessions++
        expect(route.request().headers().authorization).toBe('Bearer member-token')
        return json(route, { signupAuthToken: 'signup-token', memberId: 42, email })
      }
      case '/api/members/billing/enrollment-checkout-session': {
        requests.checkouts++
        expect(route.request().headers().authorization).toBe('Bearer member-token')
        expect(route.request().postDataJSON()).toMatchObject({ signupAuthToken: 'signup-token',
          signups: [{ formId: 3, slotGroupId: 4, timeSlotId: 5, enrollmentStartDate: '2027-01-04' }],
        })
        if (checkoutError) return route.fulfill({ status: 503, json: { success: false, message: 'Card payment is temporarily unavailable.' } })
        return json(route, checkout)
      }
      case '/api/scheduling/signups/batch': {
        requests.directSignups++
        return json(route, { signups: [{ id: 8, formId: 3, status: 'confirmed' }] })
      }
      default: return json(route, {})
    }
  })
  await page.goto(signupPath)
  await page.getByPlaceholder('you@email.com').fill(email)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel('Password', { exact: true }).fill('LocalTestPassword123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Review signup', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Review your signups' })).toBeVisible()
  return requests
}

test('direct class link signs in and pays by card without direct registration', async ({ page }) => {
  await page.route('**/mock-card-checkout', (route) => route.fulfill({ body: 'Mock card checkout' }))
  const requests = await openReview(page, { preview: { ...priced, additionalFeesOneTime: 85 },
    checkout: { url: '/mock-card-checkout', pendingEnrollmentId: 11 } })
  await page.getByRole('button', { name: 'Continue to card payment' }).click()
  await expect(page).toHaveURL('/mock-card-checkout')
  expect(requests).toEqual({ memberLogins: 1, memberSessions: 1, checkouts: 1, directSignups: 0 })
})

for (const [name, checkout, message] of [
  ['completed replay', { skipCheckout: true, alreadyCompleted: true }, 'Checkout complete'],
  ['quarantined payment', { skipCheckout: true, requiresReview: true }, 'Enrollment needs staff review'],
] as const) {
  test(`direct class link handles ${name} without another signup`, async ({ page }) => {
    const requests = await openReview(page, { preview: { ...priced, additionalFeesOneTime: 85 }, checkout })
    await page.getByRole('button', { name: 'Continue to card payment' }).click()
    await expect(page.getByRole('heading', { name: message })).toBeVisible()
    expect(requests.checkouts).toBe(1)
    expect(requests.directSignups).toBe(0)
  })
}

test('unavailable card payment leaves the registration unconfirmed', async ({ page }) => {
  const requests = await openReview(page, { preview: { ...priced, additionalFeesOneTime: 85 }, checkoutError: true })
  await page.getByRole('button', { name: 'Continue to card payment' }).click()
  await expect(page.getByRole('alert')).toHaveText('Card payment is temporarily unavailable.')
  await expect(page.getByRole('heading', { name: 'Review your signups' })).toBeVisible()
  expect(requests.checkouts).toBe(1)
  expect(requests.directSignups).toBe(0)
})

test('changed zero-dollar pricing requires confirmation before direct signup', async ({ page }) => {
  const requests = await openReview(page, { preview: { ...priced, additionalFeesOneTime: 85 },
    checkout: { skipCheckout: true, preview: priced } })
  await page.getByRole('button', { name: 'Continue to card payment' }).click()
  await expect(page.getByRole('alert')).toContainText('Review the updated total')
  expect(requests.directSignups).toBe(0)
  await page.getByRole('button', { name: 'Confirm signup' }).click()
  await expect(page.getByRole('heading', { name: "You're signed up!" })).toBeVisible()
  expect(requests.directSignups).toBe(1)
})
