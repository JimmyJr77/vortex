import { expect, test, type Page } from '@playwright/test'
import { ANALYTICS_POLICY_VERSION, CONSENT_STORAGE_KEY } from '../../src/config/analyticsPolicy'

const stripeSession = 'cs_test_storeConfirmation123'
const checkout = 'https://checkout-fixture.invalid/payment'
const orderId = 501
const token = 'fixture-member-token'
const product = {
  id: 4, name: 'Vortex training shirt', category: 'clothing', tags: ['clothing'],
  priceCents: 2500, inventoryQuantity: 10,
}

type AnalyticsEvent = { eventName: string; pagePath: string; properties?: Record<string, unknown> }

async function mockHostedCheckout(page: Page, baseURL: string, orderIsPaid: () => boolean) {
  const origin = new URL(baseURL).origin
  const completed = new URL('/store', origin)
  completed.searchParams.set('store', 'success')
  completed.searchParams.set('session_id', stripeSession)
  const cancelled = new URL('/store?store=cancelled', origin)
  const confirmations: Array<{ authorization: string | undefined; session: string | null }> = []
  const events: AnalyticsEvent[] = []

  await page.addInitScript(({ origin, token, consentKey, version }) => {
    if (window.location.origin !== origin) return
    localStorage.setItem('vortex_member_token', token)
    localStorage.setItem('vortex_member', JSON.stringify({ id: 74, availablePortals: ['member'] }))
    localStorage.setItem(consentKey, JSON.stringify({
      necessary: true, analytics: true, marketing: false, policyVersion: version, updatedAt: new Date().toISOString(),
    }))
  }, { origin, token, consentKey: CONSENT_STORAGE_KEY, version: ANALYTICS_POLICY_VERSION })

  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.href === checkout) {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><h1>Test hosted checkout</h1><a href="${completed.href.replaceAll('&', '&amp;')}">Complete payment</a><a href="${cancelled.href}">Cancel payment</a>`,
      })
    }
    if (url.pathname === '/api/store/products' || url.pathname === '/api/members/store/products') {
      return route.fulfill({ json: { success: true, data: [product] } })
    }
    if (url.pathname === '/api/members/store/checkout') {
      return route.fulfill({ json: { success: true, data: { id: orderId, status: 'awaiting_payment', stripeCheckoutUrl: checkout } } })
    }
    if (url.pathname === `/api/members/store/orders/${orderId}/confirmation`) {
      confirmations.push({ authorization: request.headers().authorization, session: url.searchParams.get('session_id') })
      return route.fulfill({ json: { success: true, data: { confirmed: orderIsPaid() } } })
    }
    if (url.pathname === '/api/analytics/event') {
      const { events: batch } = request.postDataJSON() as { events: AnalyticsEvent[] }
      events.push(...batch)
      return route.fulfill({ status: 204 })
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { success: true, data: [] } })
    if (url.origin === origin) return route.continue()
    return route.fulfill({ status: 204 })
  })

  return {
    confirmations,
    events,
    purchases: () => events.filter(event => event.eventName === 'store_purchase'),
    views: () => events.filter(event => event.eventName === 'page_view').length,
  }
}

async function enterHostedCheckout(page: Page) {
  await page.goto('/store')
  await page.getByRole('button', { name: 'Add to cart' }).click()
  await page.getByRole('button', { name: 'Continue to card payment' }).click()
  await expect(page.getByRole('heading', { name: 'Test hosted checkout' })).toBeVisible()
}

test('a hosted checkout return records one purchase after the payment is confirmed', async ({ page, baseURL }) => {
  let paid = false
  const capture = await mockHostedCheckout(page, baseURL!, () => paid)
  await enterHostedCheckout(page)
  await expect.poll(() => capture.events.some(event => event.eventName === 'store_checkout_start')).toBe(true)

  await page.getByRole('link', { name: 'Complete payment' }).click()
  await expect.poll(() => capture.confirmations.length).toBe(1)
  expect(capture.purchases()).toHaveLength(0)
  paid = true
  await expect.poll(() => capture.purchases().length, { timeout: 10_000 }).toBe(1)
  expect(capture.purchases()[0]).toMatchObject({ eventName: 'store_purchase', pagePath: '/store' })
  expect(capture.confirmations).toEqual([
    { authorization: `Bearer ${token}`, session: stripeSession },
    { authorization: `Bearer ${token}`, session: stripeSession },
  ])
  expect(JSON.stringify(capture.events)).not.toContain(stripeSession)

  const views = capture.views()
  await page.reload()
  await expect.poll(capture.views).toBeGreaterThan(views)
  expect(capture.purchases()).toHaveLength(1)
  expect(capture.confirmations).toHaveLength(2)
})

test('returning from a cancelled hosted checkout does not record a purchase', async ({ page, baseURL }) => {
  const capture = await mockHostedCheckout(page, baseURL!, () => true)
  await enterHostedCheckout(page)
  const views = capture.views()

  await page.getByRole('link', { name: 'Cancel payment' }).click()
  await expect(page).toHaveURL(/\/store\?store=cancelled$/)
  await expect.poll(capture.views).toBeGreaterThan(views)
  expect(capture.purchases()).toHaveLength(0)
  expect(capture.confirmations).toHaveLength(0)
})
