import { expect, test } from '@playwright/test'
import type { StoreOrder, StoreProduct } from '../../src/utils/storeApi'

test('Store Desk resumes a pending reader payment and releases the paid order for pickup', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Store Admin' }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  const timestamp = '2026-11-16T18:00:00.000Z'
  const product: StoreProduct = {
    id: 10, sku: 'DESK-10', name: 'Water bottle', description: null, category: 'equipment', tags: ['equipment'],
    priceCents: 1500, inventoryQuantity: 4, isPublic: true, isActive: true, sortOrder: 0, createdAt: timestamp, updatedAt: timestamp,
  }
  const order: StoreOrder = {
    id: 20, orderNumber: 'STORE-20', memberId: null, purchaserName: null, purchaserEmail: null, source: 'admin',
    status: 'awaiting_payment', paymentStatus: 'pending', paymentMethod: 'terminal', externalReference: null,
    subtotalCents: 1500, discountCents: 0, totalCents: 1500, discountCode: null, fulfillmentNote: '',
    pickedUpAt: null, receiptSentAt: null, createdAt: timestamp, updatedAt: timestamp, stripeCheckoutUrl: null,
    items: [{ id: 30, productId: 10, productName: product.name, sku: product.sku, unitPriceCents: 1500, quantity: 1, lineTotalCents: 1500 }],
  }
  const reader = { id: 'tmr_store', label: 'Store reader', status: 'online', simulated: true }
  const starts: unknown[] = []
  let submittedOrder = false
  let attemptStatus: 'awaiting_card' | 'succeeded' | null = null
  const snapshot = () => attemptStatus === null ? null : { id: 'attempt-store', readerId: reader.id, amountCents: order.totalCents, status: attemptStatus, simulated: true }
  await page.route('**/api/**', (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin: false, permissions: ['billing.view', 'billing.manage'], user: { id: 1 } }
    if (path === '/api/admin/store/products') data = [product]
    if (path === '/api/admin/store/dashboard') {
      const paid = attemptStatus === 'succeeded'
      data = {
        orders: submittedOrder ? [{ ...order, status: paid ? 'placed' : order.status, paymentStatus: paid ? 'paid' : order.paymentStatus }] : [],
        lowStock: [],
        summary: { orderCount: paid ? 1 : 0, salesCents: paid ? order.totalCents : 0, awaitingPaymentCount: submittedOrder && !paid ? 1 : 0, pickupCount: paid ? 1 : 0 },
      }
    }
    if (path === '/api/admin/store/orders' && request.method() === 'POST') {
      expect(request.postDataJSON()).toMatchObject({ paymentMethod: 'terminal', items: [{ productId: product.id, quantity: 1 }] })
      expect(request.headers()['idempotency-key']).toMatch(/^admin-store-terminal-/)
      submittedOrder = true
      data = order
    }
    if (path === '/api/admin/stripe-terminal/readers') data = { enabled: true, readers: [reader], testMode: true }
    if (path === `/api/admin/stripe-terminal/store/${order.id}`) {
      if (request.method() === 'POST') {
        starts.push(request.postDataJSON())
        attemptStatus = 'awaiting_card'
      }
      data = snapshot()
    }
    if (path === `/api/admin/stripe-terminal/store/${order.id}/simulate`) {
      expect(request.postDataJSON()).toEqual({ attemptId: 'attempt-store', outcome: 'approved' })
      attemptStatus = 'succeeded'
      data = snapshot()
    }
    return route.fulfill({ json: { success: true, data } })
  })

  await page.goto('/')
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Store', exact: true }).click()
  const paymentMethod = page.getByRole('combobox', { name: 'Payment method', exact: true })
  await expect(paymentMethod.getByRole('option', { name: 'Stripe card reader', exact: true })).toBeEnabled()
  await paymentMethod.selectOption('terminal')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: 'Pay with card reader', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Pay with Stripe card reader' })
  await dialog.getByRole('button', { name: 'Send $15.00 to reader' }).click()
  await expect(dialog.getByText(/Ask the customer to tap/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Close Pay with Stripe card reader' }).click()
  await page.getByRole('button', { name: 'Open reader payment' }).click()
  await expect(dialog.getByText(/Ask the customer to tap/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Simulate payment', exact: true }).click()
  await expect(dialog.getByText('Payment confirmed.', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close Pay with Stripe card reader' }).click()
  await expect(page.getByRole('button', { name: 'Picked up', exact: true })).toBeVisible()
  expect(starts).toEqual([{ readerId: reader.id, expectedAmountCents: order.totalCents }])
})
