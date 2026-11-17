import { expect, test, type Page } from '@playwright/test'
import { ANALYTICS_POLICY_VERSION, CONSENT_STORAGE_KEY } from '../../src/config/analyticsPolicy'

test('a verified drop-in counts once when its paid return opens in two tabs', async ({ context, page }) => {
  await context.addInitScript(({ consentKey, policyVersion }) => {
    localStorage.setItem('vortex_member_token', 'test-member-token')
    localStorage.setItem('vortex_member', JSON.stringify({ id: 7, email: 'parent@example.test' }))
    localStorage.setItem(consentKey, JSON.stringify({
      necessary: true, analytics: true, marketing: false, policyVersion, updatedAt: new Date().toISOString(),
    }))
  }, { consentKey: CONSENT_STORAGE_KEY, policyVersion: ANALYTICS_POLICY_VERSION })
  const requests: unknown[] = []
  const conversions: string[] = []
  const tabsWithPaidReturnAnalytics = new Set<Page>()
  await context.route('**/api/**', (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/analytics/event') {
      const events = request.postDataJSON().events as { eventName: string }[]
      conversions.push(...events.map(({ eventName }) => eventName).filter(name => name === 'drop_in_confirmed' || name === 'trial_confirmed'))
      if (new URL(request.frame().url()).searchParams.get('checkout') === 'paid') {
        tabsWithPaidReturnAnalytics.add(request.frame().page())
      }
      return route.fulfill({ status: 204 })
    }
    if (path === '/api/public/classes-offered') return route.fulfill({ json: { programs: [] } })
    if (path === '/api/public/drop-ins') return route.fulfill({ json: { success: true, data: { classes: [], sessions: [], benefits: { trialAvailable: true } } } })
    if (path !== '/api/members/billing/drop-in-checkout') return route.fulfill({ json: { success: true, data: [] } })
    const body = route.request().postDataJSON()
    requests.push(body)
    expect(route.request().headers().authorization).toBe('Bearer test-member-token')
    const data = body.checkoutSessionId
      ? { status: 'confirmed' }
      : { status: 'payment_pending', url: '/mock-drop-in-card-payment' }
    return route.fulfill({ json: { success: true, data } })
  })
  await page.route('**/mock-drop-in-card-payment', (route) => route.fulfill({ body: 'Mock card payment' }))
  await page.goto('/drop-in?booking=42')
  await expect(page.getByRole('heading', { name: 'Drop-in confirmed' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Pay by credit card' }).click()
  await expect(page).toHaveURL('/mock-drop-in-card-payment')
  expect(conversions).toEqual([])

  const paidReturn = '/drop-in?booking=42&checkout=paid&session_id=cs_fixture'
  const otherTab = await context.newPage()
  await Promise.all([page, otherTab].map(async tab => {
    await tab.goto(paidReturn)
    await expect(tab.getByRole('heading', { name: 'Drop-in confirmed' })).toBeVisible()
  }))
  await expect.poll(() => tabsWithPaidReturnAnalytics.size).toBe(2)
  expect(conversions).toEqual(['drop_in_confirmed'])
  expect(requests[0]).toEqual({ dropInId: 42 })
  expect(requests.slice(1).length).toBeGreaterThanOrEqual(2)
  for (const confirmation of requests.slice(1)) {
    expect(confirmation).toEqual({ dropInId: 42, checkoutSessionId: 'cs_fixture' })
  }
})
