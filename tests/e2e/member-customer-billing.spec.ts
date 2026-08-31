import { expect, test, type Page } from '@playwright/test'

const memberTabs = ['home', 'profile', 'classes', 'events', 'billing', 'waivers', 'training', 'progress', 'messages', 'faqs', 'preferences']

const customerBilling = {
  canSeeFamily: true,
  overview: {
    account: {
      id: 7,
      familyId: 42,
      familyName: 'Rivera Household',
      payerMemberId: 11,
      billingEmail: 'jordan@example.com',
      billingPhone: null,
      billingStreet: null,
      billingCity: null,
      billingState: null,
      billingZip: null,
      stripeCustomerId: 'cus_123',
      householdMonthlyBillingEnabled: true,
      isActive: true,
    },
    selectedMemberId: null,
    members: [{ id: 11, firstName: 'Jordan', lastName: 'Rivera', name: 'Jordan Rivera', email: 'jordan@example.com', phone: null, isActive: true }],
    summary: {
      chargesCents: 12000,
      paymentsCents: 0,
      refundsCents: 0,
      balanceCents: 12000,
      outstandingBalanceCents: 12000,
      monthlyRecurringCents: 12000,
      monthlyRecurringDiscountCents: 3000,
      futureCreditsCents: 0,
      paidThisMonthCents: 0,
      monthlyTotals: { grossCents: 15000, discountCents: 3000, netCents: 12000 },
      nextBillDate: '2026-09-01',
      latestPayment: null,
      stripeSync: { status: 'healthy', message: 'Active classes are collected together through one household monthly Stripe invoice.' },
    },
    paymentMethod: {
      available: true,
      stripeEnabled: true,
      paymentMethod: { id: 'pm_123', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2029 },
    },
    alerts: [{ id: 1, type: 'warning', severity: 'warning', message: 'Admin-only account alert', stripeObjectId: null, createdAt: '2026-08-30' }],
    enrollments: [{
      id: 501,
      source: 'scheduling',
      memberId: 11,
      memberName: 'Jordan Rivera',
      sport_name: 'Gymnastics',
      program_name: 'Development',
      class_name: 'Monday Foundations',
      offering_dates: 'Sep 1, 2026 – Dec 31, 2026',
      enrollment_start_date: '2026-09-01',
      created_at: '2026-08-28',
      schedule: 'Monday · 4:00 PM–5:00 PM',
      status: 'active',
      billing_status: 'active',
      billingType: 'recurring',
      classCostCents: 15000,
      automaticDiscountCents: 3000,
      automaticDiscountComponents: [{ name: 'Family multi-class discount', amountCents: 3000, source: 'automatic' }],
      automaticAdjustedCostCents: 12000,
      manualAdjustmentCents: 0,
      adjustedCostCents: 12000,
      activePriceAdjustment: null,
      activePriceAdjustments: [],
      priceAdjustments: [],
      nextBillDate: '2026-09-01',
      priceSyncStatus: 'healthy',
      priceSyncError: null,
      collectionMode: 'household_monthly',
      stripeSubscriptionScheduleId: null,
      pricingMonth: '2026-09',
    }],
    waitlists: [],
    annualMemberships: [{
      memberId: 11,
      memberName: 'Jordan Rivera',
      billingSubscriptionId: null,
      active: false,
      membershipDate: null,
      renewalDate: null,
      autoRenewal: false,
      canManageAutoRenewal: false,
      outstandingChargeId: null,
      outstandingAmountCents: 8500,
    }],
    monthlyInvoices: [],
    subscriptions: [],
    adjustments: [],
  },
  transactions: [{
    entryKind: 'charge',
    entryType: 'recurring',
    refId: 100,
    memberId: 11,
    memberName: 'Jordan Rivera',
    description: 'September tuition · Monday Foundations',
    billingMonths: ['2026-09'],
    amountCents: 12000,
    occurredAt: '2026-08-28',
    status: 'unpaid',
    runningBalanceCents: 12000,
  }],
}

async function openMemberPortal(page: Page, captured = { customerBillingRequests: 0 }) {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_member_token', 'member-billing-e2e-token')
    localStorage.setItem('vortex_member', JSON.stringify({
      id: 11,
      fullName: 'Jordan Rivera',
      email: 'jordan@example.com',
      availablePortals: ['member'],
    }))
  })

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const json = (data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
    if (url.pathname === '/api/members/me') {
      await json({
        id: 11,
        firstName: 'Jordan',
        lastName: 'Rivera',
        email: 'jordan@example.com',
        familyId: 42,
        familyName: 'Rivera Household',
        roles: [],
        isActive: true,
        enrollments: [],
      })
      return
    }
    if (url.pathname === '/api/members/portal-config') {
      await json({ hiddenTabs: [], tabOrder: memberTabs, navLayout: memberTabs.map((key) => ({ type: 'tab', key })) })
      return
    }
    if (url.pathname === '/api/members/billing/customer-account') {
      captured.customerBillingRequests += 1
      await json(customerBilling)
      return
    }
    if (url.pathname === '/api/members/billing/account') {
      await json({ canSeeFamily: true, charges: [], payments: [], chargesCents: 0, paymentsCents: 0, balanceCents: 0, stripeEnabled: true })
      return
    }
    if (url.pathname === '/api/public/classes-offered') {
      await json({ programs: [] })
      return
    }
    await json([])
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Member Portal', exact: true }).click()
  await expect(page.getByRole('heading', { name: /VORTEX MEMBER PORTAL/ })).toBeVisible()
  return captured
}

test.describe('Member family billing', () => {
  test('uses the customer billing layout without admin-only controls', async ({ page }) => {
    const captured = await openMemberPortal(page)

    await page.getByRole('button', { name: 'Billing', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Rivera Household', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Process monthly balance', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Update payment method', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Refresh billing account', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New Enrollment', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enroll now', exact: true })).toBeVisible()
    await expect(page.getByText('Complete account audit', { exact: true })).toBeVisible()
    await expect(page.getByText('Admin-only account alert')).toHaveCount(0)
    await expect(page.getByText('Stripe pricing', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Actions', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Activity', exact: true })).toHaveCount(0)

    const initialCustomerBillingRequests = captured.customerBillingRequests
    await page.getByRole('button', { name: 'Refresh billing account', exact: true }).click()
    await expect.poll(() => captured.customerBillingRequests).toBeGreaterThan(initialCustomerBillingRequests)

    await page.getByRole('button', { name: 'New Enrollment', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Enrollments', exact: true })).toBeVisible()
  })
})
