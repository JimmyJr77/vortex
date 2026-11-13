import { expect, test } from '@playwright/test'

test('a drop-in stays pending at card checkout and confirms after payment verification', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_member_token', 'test-member-token')
    localStorage.setItem('vortex_member', JSON.stringify({ id: 7, email: 'parent@example.test' }))
  })
  const requests: unknown[] = []
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
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
  await page.goto('/drop-in?booking=42&checkout=paid&session_id=cs_fixture')
  await expect(page.getByRole('heading', { name: 'Drop-in confirmed' })).toBeVisible()
  expect(requests[0]).toEqual({ dropInId: 42 })
  expect(requests.slice(1).length).toBeGreaterThan(0)
  for (const confirmation of requests.slice(1)) {
    expect(confirmation).toEqual({ dropInId: 42, checkoutSessionId: 'cs_fixture' })
  }
})
