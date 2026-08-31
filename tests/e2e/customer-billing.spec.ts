import { expect, test, type Page } from '@playwright/test'

interface CapturedRequests {
  searchQueries: string[]
  priceChanges: Array<Record<string, unknown>>
  customCharges: Array<Record<string, unknown>>
  customChargeKeys: string[]
  refunds: Array<Record<string, unknown>>
  refundKeys: string[]
  retryCount: number
}

const failedAdjustment = {
  id: 902,
  signupId: 502,
  kind: 'fixed_final_price',
  finalPriceCents: 9500,
  promoCode: null,
  effectiveFromMonth: '2026-09-01',
  effectiveThroughMonth: '2026-11-01',
  reason: 'Approved temporary rate',
  status: 'sync_failed',
  stripeSyncError: 'Test schedule synchronization failure',
  createdAt: '2026-08-20T14:00:00.000Z',
}

const overview = {
  account: {
    id: 7,
    familyId: 42,
    familyName: 'Rivera Household',
    payerMemberId: 10,
    billingEmail: 'alex.rivera@example.com',
    billingPhone: '(555) 010-2040',
    billingStreet: '12 Main Street',
    billingCity: 'New York',
    billingState: 'NY',
    billingZip: '10001',
    stripeCustomerId: 'cus_test_rivera',
    isActive: true,
  },
  selectedMemberId: 11,
  members: [
    { id: 10, firstName: 'Alex', lastName: 'Rivera', name: 'Alex Rivera', email: 'alex.rivera@example.com', phone: '(555) 010-2040', isActive: true },
    { id: 11, firstName: 'Jordan', lastName: 'Rivera', name: 'Jordan Rivera', email: 'jordan@example.com', phone: '5550102040', isActive: true },
  ],
  summary: {
    chargesCents: 44500,
    paymentsCents: 35000,
    refundsCents: 5000,
    balanceCents: 14500,
    outstandingBalanceCents: 14500,
    futureCreditsCents: 0,
    paidThisMonthCents: 20500,
    monthlyTotals: { grossCents: 24000, discountCents: 3500, netCents: 20500 },
    nextBillDate: '2026-09-01',
    latestPayment: { id: 200, amountCents: 16500, paidAt: '2026-08-01T13:00:00.000Z', method: 'Visa •••• 4242' },
    stripeSync: { status: 'attention', message: 'One enrollment price schedule needs review.' },
  },
  paymentMethod: {
    available: true,
    stripeEnabled: true,
    paymentMethod: { id: 'pm_card_visa', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2029 },
  },
  alerts: [{
    id: 301,
    type: 'price_schedule_drift',
    severity: 'warning',
    message: 'Wednesday Tumbling price schedule needs synchronization.',
    stripeObjectId: 'sub_test_502',
    createdAt: '2026-08-20T14:01:00.000Z',
  }],
  enrollments: [
    {
      id: 501,
      source: 'scheduling',
      memberId: 11,
      memberName: 'Jordan Rivera',
      sport_name: 'Gymnastics',
      program_name: 'Artistic Foundations',
      class_name: 'Monday Foundations',
      offering_dates: 'Aug 3, 2026 – Dec 18, 2026',
      enrollment_start_date: '2026-08-03',
      created_at: '2026-08-03T12:00:00.000Z',
      schedule: 'Mondays · 4:00 PM–5:00 PM',
      status: 'active',
      billing_status: 'active',
      billingType: 'recurring',
      classCostCents: 12000,
      automaticDiscountCents: 1500,
      automaticDiscountComponents: [{ name: 'Sibling discount', amountCents: 1500, source: 'automatic' }],
      automaticAdjustedCostCents: 10500,
      manualAdjustmentCents: 0,
      adjustedCostCents: 10500,
      activePriceAdjustment: null,
      priceAdjustments: [],
      nextBillDate: '2026-09-01',
      priceSyncStatus: 'not_required',
      priceSyncError: null,
      stripeSubscriptionScheduleId: null,
    },
    {
      id: 502,
      source: 'scheduling',
      memberId: 11,
      memberName: 'Jordan Rivera',
      sport_name: 'Tumbling',
      program_name: 'Tumbling Development',
      class_name: 'Wednesday Tumbling',
      offering_dates: 'Aug 5, 2026 – May 28, 2027',
      enrollment_start_date: '2026-08-05',
      created_at: '2026-08-05T12:00:00.000Z',
      schedule: 'Wednesdays · 5:15 PM–6:15 PM',
      status: 'active',
      billing_status: 'active',
      billingType: 'recurring',
      classCostCents: 12000,
      automaticDiscountCents: 2000,
      automaticDiscountComponents: [{ name: 'Multi-class discount', amountCents: 2000, source: 'automatic' }],
      automaticAdjustedCostCents: 10000,
      manualAdjustmentCents: 0,
      adjustedCostCents: 10000,
      activePriceAdjustment: null,
      priceAdjustments: [failedAdjustment],
      nextBillDate: '2026-09-01',
      priceSyncStatus: 'failed',
      priceSyncError: 'Test schedule synchronization failure',
      stripeSubscriptionScheduleId: null,
    },
    {
      id: 503,
      source: 'drop_in',
      memberId: 11,
      memberName: 'Jordan Rivera',
      sport_name: 'Gymnastics',
      program_name: 'Open Gym',
      class_name: 'Saturday Open Gym',
      offering_dates: 'Aug 29, 2026',
      enrollment_start_date: '2026-08-29',
      created_at: '2026-08-29T12:00:00.000Z',
      schedule: 'Saturday · 11:00 AM–12:00 PM',
      status: 'drop_in',
      billing_status: 'one_time',
      billingType: 'one_time',
      classCostCents: 2500,
      automaticDiscountCents: 0,
      automaticDiscountComponents: [],
      automaticAdjustedCostCents: 2500,
      manualAdjustmentCents: 0,
      adjustedCostCents: 2500,
      activePriceAdjustment: null,
      priceAdjustments: [],
      nextBillDate: null,
      priceSyncStatus: 'not_required',
      priceSyncError: null,
      stripeSubscriptionScheduleId: null,
    },
  ],
  waitlists: [{
    id: 601,
    source: 'waitlist',
    memberId: 11,
    memberName: 'Jordan Rivera',
    sport_name: 'Gymnastics',
    program_name: 'Artistic Foundations',
    class_name: 'Saturday Advanced',
    offering_dates: 'Sep 5, 2026 – Dec 19, 2026',
    enrollment_start_date: '2026-08-15',
    created_at: '2026-08-15T12:00:00.000Z',
    schedule: 'Saturdays · 10:00 AM–11:30 AM',
    status: 'waitlist',
    billing_status: null,
    classCostCents: 0,
    automaticDiscountCents: 0,
    automaticDiscountComponents: [],
    automaticAdjustedCostCents: 0,
    manualAdjustmentCents: 0,
    adjustedCostCents: 0,
    activePriceAdjustment: null,
    priceAdjustments: [],
    nextBillDate: null,
    priceSyncStatus: 'not_required',
    priceSyncError: null,
    stripeSubscriptionScheduleId: null,
  }],
  annualMemberships: [],
  monthlyInvoices: [],
  subscriptions: [
    {
      id: 71,
      memberId: 11,
      memberName: 'Jordan Rivera',
      signupId: 501,
      description: 'Monday Foundations',
      status: 'active',
      monthlyAmountCents: 12000,
      automaticDiscountCents: 1500,
      automaticDiscountComponents: [{ name: 'Sibling discount', amountCents: 1500, source: 'automatic' }],
      manualAdjustmentCents: 0,
      discountAmountCents: 1500,
      netMonthlyCents: 10500,
      nextBillDate: '2026-09-01',
      startDate: '2026-08-03',
      endDate: null,
      stripeSubscriptionId: 'sub_test_501',
      stripeSubscriptionScheduleId: null,
      priceSyncStatus: 'synced',
      priceSyncError: null,
      activePriceAdjustment: null,
      scheduledPriceAdjustments: [],
    },
    {
      id: 72,
      memberId: 11,
      memberName: 'Jordan Rivera',
      signupId: 502,
      description: 'Wednesday Tumbling',
      status: 'active',
      monthlyAmountCents: 12000,
      automaticDiscountCents: 2000,
      automaticDiscountComponents: [{ name: 'Multi-class discount', amountCents: 2000, source: 'automatic' }],
      manualAdjustmentCents: 0,
      discountAmountCents: 2000,
      netMonthlyCents: 10000,
      nextBillDate: '2026-09-01',
      startDate: '2026-08-05',
      endDate: null,
      stripeSubscriptionId: 'sub_test_502',
      stripeSubscriptionScheduleId: null,
      priceSyncStatus: 'failed',
      priceSyncError: 'Test schedule synchronization failure',
      activePriceAdjustment: null,
      scheduledPriceAdjustments: [failedAdjustment],
    },
  ],
  adjustments: [failedAdjustment],
}

const transactions = [
  {
    entryKind: 'charge', entryType: 'recurring', refId: 100, memberId: 11,
    memberName: 'Jordan Rivera', description: 'August tuition · Monday Foundations',
    amountCents: 12000, occurredAt: '2026-08-01T12:00:00.000Z', status: 'paid',
    runningBalanceCents: 12000,
    details: { servicePeriodStart: '2026-08-01', servicePeriodEnd: '2026-08-31', enrollmentId: 501, stripeInvoiceId: 'in_test_100' },
  },
  {
    entryKind: 'payment', entryType: 'payment', refId: 200, memberId: null,
    memberName: null, description: 'Visa •••• 4242', amountCents: -16500,
    occurredAt: '2026-08-01T13:00:00.000Z', status: 'settled', runningBalanceCents: -4500,
    details: { stripePaymentIntentId: 'pi_test_200', stripeCheckoutSessionId: 'cs_test_200', receiptSentAt: '2026-08-01T13:02:00.000Z' },
  },
]

const activities = [{
  id: 800,
  eventType: 'enrollment_price_sync_failed',
  summary: 'Wednesday Tumbling price change could not be synchronized to Stripe.',
  memberId: 11,
  signupId: 502,
  relatedChargeId: null,
  relatedPaymentId: null,
  relatedRefundId: null,
  beforeValue: null,
  afterValue: failedAdjustment,
  details: { reason: 'Test schedule synchronization failure' },
  stripeObjectId: 'sub_test_502',
  actorUserId: 1,
  actorName: 'Billing Admin',
  actorType: 'admin',
  occurredAt: '2026-08-20T14:01:00.000Z',
}]

async function openCustomerBilling(page: Page, captured: CapturedRequests) {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Billing Admin', email: 'billing@example.com', isMaster: true }))
  })

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const json = (data: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    })

    if (url.pathname === '/api/admin/access/me') {
      await json({
        isMasterAdmin: true,
        permissions: ['billing.view', 'billing.manage', 'family_billing.manage', 'billing.statements.manage'],
        roles: ['MASTER_ADMIN'],
        user: { id: 1 },
      })
      return
    }
    if (url.pathname === '/api/admin/notifications') {
      await json({ notifications: [], unreadCount: 0 })
      return
    }
    if (url.pathname === '/api/admin/members') {
      await json([{
        id: 11,
        firstName: 'Jordan',
        lastName: 'Rivera',
        status: 'active',
        isActive: true,
        familyId: 42,
        familyName: 'Rivera Household',
        roles: [{ id: 'member-athlete', role: 'MEMBER_ATHLETE' }],
        enrollments: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }])
      return
    }
    if (url.pathname === '/api/admin/billing/cancellation-requests') {
      await json([])
      return
    }
    if (url.pathname === '/api/admin/customer-billing/search') {
      captured.searchQueries.push(url.searchParams.get('q') ?? '')
      await json([{ familyId: 42, familyName: 'Rivera Household', billingAccountId: 7, memberId: 11, name: 'Jordan Rivera', email: 'jordan@example.com', phone: '(555) 010-2040', isActive: true }])
      return
    }
    if (url.pathname === '/api/admin/customer-billing/families/42/overview') {
      await json(overview)
      return
    }
    if (url.pathname === '/api/admin/customer-billing/families/42/transactions') {
      await json({ rows: transactions, nextCursor: null })
      return
    }
    if (url.pathname === '/api/admin/customer-billing/families/42/activity') {
      await json({ rows: activities, nextCursor: null })
      return
    }
    if (url.pathname === '/api/admin/families/42/statements' && request.method() === 'GET') {
      await json([{ id: 300, statementDate: '2026-08-01', dueDate: '2026-08-10', totalCents: 20500, status: 'issued', lines: [{ id: 1, description: 'August tuition', amount_cents: 20500 }] }])
      return
    }
    if (url.pathname.endsWith('/price-adjustments/preview')) {
      const body = request.postDataJSON() as Record<string, unknown>
      await json({
        signupId: 501,
        billingSubscriptionId: 71,
        memberName: 'Jordan Rivera',
        className: 'Monday Foundations',
        kind: body.kind,
        finalPriceCents: body.finalPriceCents,
        promoCode: null,
        effectiveFromMonth: body.effectiveFromMonth,
        effectiveThroughMonth: null,
        reason: body.reason,
        standardPriceCents: 12000,
        aboveList: false,
        months: [{ periodKey: '2026-08', standardPriceCents: 12000, automaticDiscountCents: 1500, automaticNetCents: 10500, manualAdjustmentCents: 1500, adjustedCostCents: 9000, householdNetCents: 19000, postedAmountCents: 10500, retroactive: true, retroactiveDifferenceCents: -1500 }],
        retroactiveDifferenceCents: -1500,
        currentBalanceCents: 14500,
        resultingBalanceCents: 13000,
        stripePlan: { mode: 'subscription_schedule', prorationBehavior: 'none', revertsAfter: null },
      })
      return
    }
    if (/\/price-adjustments$/.test(url.pathname)) {
      captured.priceChanges.push(request.postDataJSON() as Record<string, unknown>)
      await json({ adjustment: { id: 903, status: 'active' }, retroactiveEntries: [{ id: 401 }] }, 201)
      return
    }
    if (url.pathname.endsWith('/retry-sync')) {
      captured.retryCount += 1
      await json({ adjustment: { ...failedAdjustment, status: 'active', stripeSyncError: null } })
      return
    }
    if (url.pathname === '/api/admin/customer-billing/families/42/custom-charges') {
      captured.customCharges.push(request.postDataJSON() as Record<string, unknown>)
      captured.customChargeKeys.push(request.headers()['idempotency-key'] ?? '')
      await json({ charge: { id: 400 }, collection: { payment: { id: 401 } }, replayed: false }, 201)
      return
    }
    if (url.pathname.endsWith('/refunds/preview')) {
      await json({ remainingRefundableCents: 16500, amountCents: 5000, currentBalanceCents: 14500, resultingBalanceCents: 14500, ledgerTreatment: 'reverse_charge', relatedCharge: { id: 100, description: 'August tuition · Monday Foundations', amountCents: 12000 } })
      return
    }
    if (url.pathname.endsWith('/refunds')) {
      captured.refunds.push(request.postDataJSON() as Record<string, unknown>)
      captured.refundKeys.push(request.headers()['idempotency-key'] ?? '')
      await json({ refund: { id: 500, external_status: 'succeeded' }, replayed: false }, 201)
      return
    }
    await json([])
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /VORTEX ADMIN/i })).toBeVisible()
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('vortex:navigate-notification', {
      detail: { portal: 'admin', group: 'accounts', section: 'customerBilling' },
    }))
  })
  await expect(page.getByRole('heading', { name: 'Account Billing & Enrollments', exact: true })).toBeVisible()
}

async function findRiveraAccount(page: Page) {
  await page.getByLabel('Find a customer or family').fill('555-010-2040')
  await page.getByRole('button', { name: /Jordan Rivera.*Rivera Household/i }).click()
  await expect(page.getByRole('heading', { name: 'Rivera Household' })).toBeVisible()
}

test.describe('Account Billing & Enrollments administration', () => {
  test('opens the selected Vortex Account directly in Account Billing & Enrollments', async ({ page }) => {
    const captured: CapturedRequests = { searchQueries: [], priceChanges: [], customCharges: [], customChargeKeys: [], refunds: [], refundKeys: [], retryCount: 0 }
    await openCustomerBilling(page, captured)

    await page.getByRole('button', { name: 'Vortex Accounts', exact: true }).click()
    await expect(page.getByRole('heading', { name: /Vortex Accounts/ })).toBeVisible()
    await page.getByRole('button', { name: "Open Jordan Rivera's Account Billing & Enrollments" }).click()

    await expect(page.getByRole('heading', { name: 'Account Billing & Enrollments', exact: true })).toBeVisible()
    await expect(page.getByText('Family #42 · Billing account #7')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Jordan Rivera', exact: true })).toHaveClass(/border-vortex-red/)
  })

  test('opens an exact family ID directly at the household level', async ({ page }) => {
    const captured: CapturedRequests = { searchQueries: [], priceChanges: [], customCharges: [], customChargeKeys: [], refunds: [], refundKeys: [], retryCount: 0 }
    await openCustomerBilling(page, captured)

    await page.getByLabel('Find a customer or family').fill('42')
    await expect(page.getByRole('heading', { name: 'Rivera Household' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'All family' })).toHaveClass(/bg-gray-950/)
    expect(captured.searchQueries).toContain('42')
  })

  test('opens after Vortex Accounts and renders a complete member-filtered household account', async ({ page }) => {
    const captured: CapturedRequests = { searchQueries: [], priceChanges: [], customCharges: [], customChargeKeys: [], refunds: [], refundKeys: [], retryCount: 0 }
    const consoleErrors: string[] = []
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    await openCustomerBilling(page, captured)

    await expect(page.getByRole('button', { name: 'Vortex Accounts', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Account Billing & Enrollments', exact: true })).toBeVisible()
    await findRiveraAccount(page)

    expect(captured.searchQueries).toContain('555-010-2040')
    await expect(page.getByText('Family #42 · Billing account #7')).toBeVisible()
    await expect(page.getByText('Monthly recurring', { exact: true })).toBeVisible()
    await expect(page.getByText('$205.00', { exact: true })).toBeVisible()
    await expect(page.getByText('Visa •••• 4242').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Current & upcoming enrollments' })).toBeVisible()
    await expect(page.getByText('Monday Foundations').first()).toBeVisible()
    await expect(page.getByText('Mondays · 4:00 PM–5:00 PM')).toBeVisible()
    await expect(page.getByRole('row', { name: /Monday Foundations/ }).getByText('Autopay not set')).toBeVisible()
    await expect(page.getByRole('row', { name: /Saturday Open Gym/ }).getByText('No autopay needed')).toBeVisible()
    await expect(page.getByText('Waitlists · non-billable')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Complete account audit' })).toBeVisible()
    await expect(page.getByText('August tuition · Monday Foundations')).toBeVisible()
    expect(consoleErrors).toEqual([])
  })

  test('previews price impact and sends authorized, idempotent collection and refund payloads', async ({ page }) => {
    const captured: CapturedRequests = { searchQueries: [], priceChanges: [], customCharges: [], customChargeKeys: [], refunds: [], refundKeys: [], retryCount: 0 }
    await openCustomerBilling(page, captured)
    await findRiveraAccount(page)

    const mondayEnrollment = page.getByRole('row', { name: /Monday Foundations/ })
    await mondayEnrollment.getByRole('button', { name: 'Change price' }).click()
    await expect(page.getByRole('dialog', { name: 'Change enrollment price' })).toBeVisible()
    await page.getByRole('spinbutton', { name: /^Final monthly price/ }).fill('90.00')
    await page.getByLabel('Administrative reason').fill('Approved family pricing through account review')
    await page.getByRole('button', { name: 'Preview billing impact' }).click()
    await expect(page.getByText('Billing changes occur on month boundaries with no proration.')).toBeVisible()
    await expect(page.getByText('−$15.00').first()).toBeVisible()
    await page.getByRole('button', { name: 'Apply reviewed price change' }).click()
    await expect(page.getByText('Enrollment price change applied successfully.')).toBeVisible()
    expect(captured.priceChanges[0]).toMatchObject({ kind: 'fixed_final_price', finalPriceCents: 9000, reason: 'Approved family pricing through account review' })

    await page.getByRole('button', { name: 'Custom charge' }).click()
    await page.getByLabel('Description').fill('Private lesson')
    await page.getByRole('spinbutton', { name: /^Exact amount/ }).fill('75.00')
    await page.getByText('Charge saved card', { exact: true }).click()
    await page.getByLabel('Authorization note').fill('Alex Rivera approved this exact amount by phone.')
    await page.getByText('I confirm authorization for exactly $75.00 on this attempt.').click()
    await page.getByRole('button', { name: 'Create charge and collect' }).click()
    await expect(page.getByText('Custom charge created and paid successfully with the saved card.')).toBeVisible()
    expect(captured.customCharges[0]).toMatchObject({ description: 'Private lesson', amountCents: 7500, collectionMethod: 'saved_card' })
    expect(captured.customCharges[0].authorization).toMatchObject({ source: 'phone', confirmed: true, confirmedAmountCents: 7500 })
    expect(captured.customChargeKeys[0]).toMatch(/^custom-charge-/)

    await page.getByRole('button', { name: 'Refund', exact: true }).click()
    const refundDialog = page.getByRole('dialog', { name: 'Refund card payment' })
    await refundDialog.getByRole('spinbutton', { name: /^Refund amount/ }).fill('50.00')
    await refundDialog.getByRole('combobox', { name: /^Related charge/ }).selectOption('100')
    await refundDialog.getByRole('combobox', { name: 'Approved exception' }).selectOption('owner_discretion')
    await refundDialog.getByLabel('Reason').fill('Owner-approved service exception')
    await refundDialog.getByLabel('Evidence or approval note').fill('Approval documented in the account correspondence.')
    await refundDialog.getByRole('button', { name: 'Preview', exact: true }).click()
    await expect(page.getByText('Balance after refund')).toBeVisible()
    await refundDialog.getByRole('button', { name: 'Refund original card' }).click()
    await expect(page.getByText('Refund #500 submitted successfully.')).toBeVisible()
    expect(captured.refunds[0]).toMatchObject({ paymentId: 200, amountCents: 5000, ledgerTreatment: 'reverse_charge', relatedChargeId: 100, exceptionCategory: 'owner_discretion' })
    expect(captured.refundKeys[0]).toMatch(/^refund-/)

    await page.getByRole('button', { name: 'Retry sync' }).click()
    await expect(page.getByText('Stripe price schedule synchronized and the price change is now active.')).toBeVisible()
    expect(captured.retryCount).toBe(1)
  })
})
