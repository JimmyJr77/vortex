import { expect, test, type Page } from '@playwright/test'

const memberTabs = ['home', 'profile', 'classes', 'events', 'billing', 'waivers', 'training', 'progress', 'messages', 'faqs', 'preferences']

const customerBilling = {
  access: {
    viewerMemberId: 11,
    canViewHousehold: true,
    canManagePayments: true,
    canManagePaymentMethod: true,
  },
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
    members: [
      { id: 11, firstName: 'Jordan', lastName: 'Rivera', name: 'Jordan Rivera', email: 'jordan@example.com', phone: null, isActive: true },
      { id: 12, firstName: 'Casey', lastName: 'Rivera', name: 'Casey Rivera', email: 'casey@example.com', phone: null, isActive: true },
    ],
    summary: {
      chargesCents: 12000,
      paymentsCents: 0,
      refundsCents: 0,
      balanceCents: 12000,
      outstandingBalanceCents: 12000,
      collectibleBalanceCents: 12000,
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
    bundlePasses: [{
      id: 701,
      memberId: 12,
      memberName: 'Casey Rivera',
      programsId: 9,
      packageId: 'ten-class-pass',
      packageLabel: '10-Class Pass',
      classCountPurchased: 10,
      classesRemaining: 7,
      priceCents: 18000,
      status: 'active',
      expiresAt: '2027-01-31',
      purchasedAt: '2026-08-15',
    }],
    bundleUsage: [{
      id: 801,
      memberPassId: 701,
      signupId: 901,
      memberId: 12,
      memberName: 'Casey Rivera',
      programsId: 9,
      entryType: 'use',
      classesUsed: 1,
      creditDelta: -1,
      classesRemainingAfter: 7,
      reason: 'Open gym visit',
      packageLabel: '10-Class Pass',
      createdAt: '2026-08-29',
    }],
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
  nextTransactionCursor: null,
}

interface BillingRequestCapture {
  customerBillingRequests: number
  transactionRequests: number
  legacyAccountRequests: number
  profilePaymentRequests: number
  transactionCursors: Array<string | null>
  checkoutRequests: number
  checkoutIdempotencyKeys: string[]
}

async function openMemberPortal(
  page: Page,
  {
    isPayer = true,
    portalConfigFailure = false,
    hasMoreTransactions = false,
  }: {
    isPayer?: boolean
    portalConfigFailure?: boolean
    hasMoreTransactions?: boolean
  } = {},
  captured: BillingRequestCapture = {
    customerBillingRequests: 0,
    transactionRequests: 0,
    legacyAccountRequests: 0,
    profilePaymentRequests: 0,
    transactionCursors: [],
    checkoutRequests: 0,
    checkoutIdempotencyKeys: [],
  },
) {
  const viewer = isPayer
    ? { id: 11, firstName: 'Jordan', email: 'jordan@example.com' }
    : { id: 12, firstName: 'Casey', email: 'casey@example.com' }
  await page.addInitScript((member) => {
    localStorage.setItem('vortex_member_token', 'member-billing-e2e-token')
    localStorage.setItem('vortex_member', JSON.stringify({
      id: member.id,
      fullName: `${member.firstName} Rivera`,
      email: member.email,
      availablePortals: ['member'],
    }))
  }, viewer)

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const json = (data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
    if (url.pathname === '/api/members/me') {
      await json({
        id: viewer.id,
        firstName: viewer.firstName,
        lastName: 'Rivera',
        email: viewer.email,
        familyId: 42,
        familyName: 'Rivera Household',
        roles: [],
        isActive: true,
        isFamilyPayer: isPayer,
        enrollments: [],
      })
      return
    }
    if (url.pathname === '/api/members/portal-config') {
      if (portalConfigFailure) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Configuration unavailable' }),
        })
        return
      }
      await json({
        hiddenTabs: [],
        tabOrder: memberTabs,
        navLayout: memberTabs.map((key) => ({ type: 'tab', key })),
        // A stale deployment response cannot switch the portal back to the
        // deprecated member billing screen.
        memberBillingReadV2: false,
      })
      return
    }
    if (url.pathname === '/api/members/billing/payments/checkout') {
      captured.checkoutRequests += 1
      captured.checkoutIdempotencyKeys.push(route.request().headers()['idempotency-key'] ?? '')
      await json({})
      return
    }
    if (url.pathname === '/api/members/billing/payments') {
      captured.profilePaymentRequests += 1
      await json([{
        id: 901,
        amountCents: 12000,
        paidAt: '2026-08-28T16:00:00.000Z',
        method: 'visa •••• 4242',
        note: 'September tuition',
        externalReference: 'pi_profile_1',
        externalStatus: 'settled',
      }])
      return
    }
    if (url.pathname === '/api/members/billing/customer-account') {
      captured.customerBillingRequests += 1
      await json({
        ...customerBilling,
        access: {
          viewerMemberId: viewer.id,
          canViewHousehold: true,
          canManagePayments: isPayer,
          canManagePaymentMethod: isPayer,
        },
        transactions: [],
      })
      return
    }
    if (url.pathname === '/api/members/billing/customer-account/transactions') {
      captured.transactionRequests += 1
      const cursor = url.searchParams.get('cursor')
      captured.transactionCursors.push(cursor)
      await json({
        access: {
          viewerMemberId: viewer.id,
          canViewHousehold: true,
          canManagePayments: isPayer,
          canManagePaymentMethod: isPayer,
        },
        rows: cursor ? [{
          ...customerBilling.transactions[0],
          refId: 101,
          description: 'August tuition · Wednesday Foundations',
          billingMonths: ['2026-08'],
          occurredAt: '2026-07-28',
          runningBalanceCents: 0,
        }] : customerBilling.transactions,
        nextCursor: hasMoreTransactions && !cursor ? 'member-audit-page-2' : null,
      })
      return
    }
    if (url.pathname === '/api/members/billing/account') {
      captured.legacyAccountRequests += 1
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
  test('loads the household audit progressively through the opaque cursor', async ({ page }) => {
    const captured = await openMemberPortal(page, { hasMoreTransactions: true })

    await page.getByRole('button', { name: 'Billing', exact: true }).click()
    await expect(page.getByText('September tuition · Monday Foundations', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Load more', exact: true }).click()
    await expect(page.getByText('August tuition · Wednesday Foundations', { exact: true })).toBeVisible()
    expect(captured.transactionCursors).toEqual([null, 'member-audit-page-2'])
    await expect(page.getByRole('button', { name: 'Load more', exact: true })).toHaveCount(0)
  })

  test('loads Profile payment history only when Profile is opened and caches it for the session', async ({ page }) => {
    const captured = await openMemberPortal(page)

    expect(captured.profilePaymentRequests).toBe(0)
    await page.getByRole('button', { name: 'Billing', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Rivera Household', exact: true })).toBeVisible()
    expect(captured.profilePaymentRequests).toBe(0)

    await page.getByRole('button', { name: 'Profile', exact: true }).click()
    await expect.poll(() => captured.profilePaymentRequests).toBe(1)
    await expect(page.getByText(/September tuition/)).toBeVisible()

    await page.getByRole('button', { name: 'Home', exact: true }).click()
    await page.getByRole('button', { name: 'Profile', exact: true }).click()
    await expect.poll(() => captured.profilePaymentRequests).toBe(1)
  })

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
    await expect.poll(() => captured.transactionRequests).toBe(1)
    expect(captured.legacyAccountRequests).toBe(0)

    const checkoutDialog = page.waitForEvent('dialog').then(async (dialog) => {
      await dialog.dismiss()
    })
    await page.getByRole('button', { name: 'Process monthly balance', exact: true }).click()
    await checkoutDialog
    expect(captured.checkoutRequests).toBe(1)
    expect(captured.checkoutIdempotencyKeys[0]).toMatch(/^[A-Za-z0-9_.:-]{8,120}$/)

    const payButton = page.getByRole('button', { name: 'Process monthly balance', exact: true })
    await expect(payButton).toBeEnabled()
    const replayDialog = page.waitForEvent('dialog').then(async (dialog) => {
      await dialog.dismiss()
    })
    await payButton.click()
    await replayDialog
    await expect.poll(() => captured.checkoutRequests).toBe(2)
    expect(captured.checkoutIdempotencyKeys[1]).toBe(captured.checkoutIdempotencyKeys[0])

    const initialCustomerBillingRequests = captured.customerBillingRequests
    const initialTransactionRequests = captured.transactionRequests
    await page.getByRole('button', { name: 'Refresh billing account', exact: true }).click()
    await expect.poll(() => captured.customerBillingRequests).toBeGreaterThan(initialCustomerBillingRequests)
    await expect.poll(() => captured.transactionRequests).toBeGreaterThan(initialTransactionRequests)

    await page.getByRole('button', { name: 'New Enrollment', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Enrollments', exact: true })).toBeVisible()
  })

  test('gives a non-payer the complete modern household view without payment controls', async ({ page }) => {
    const captured = await openMemberPortal(page, { isPayer: false })

    await page.getByRole('button', { name: 'Billing', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Rivera Household', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Jordan Rivera', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Casey Rivera', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Process monthly balance', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Update payment method', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Refresh billing account', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New Enrollment', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Enroll now', exact: true })).toHaveCount(0)
    await expect(page.getByText('Complete account audit', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Class bundles', exact: true })).toBeVisible()
    await expect(page.getByText('10-Class Pass', { exact: true })).toBeVisible()
    await expect(page.getByText('September tuition · Monday Foundations', { exact: true })).toBeVisible()
    await expect.poll(() => captured.transactionRequests).toBe(1)
    expect(captured.customerBillingRequests).toBe(1)
    expect(captured.legacyAccountRequests).toBe(0)
  })

  test('portal configuration failure keeps canonical billing and never requests legacy data', async ({ page }) => {
    const captured = await openMemberPortal(page, { portalConfigFailure: true })

    await page.getByRole('button', { name: 'Billing', exact: true }).click()
    await expect.poll(() => captured.customerBillingRequests).toBe(1)
    await expect.poll(() => captured.transactionRequests).toBe(1)
    await expect(page.getByRole('heading', { name: 'Rivera Household', exact: true })).toBeVisible()
    expect(captured.legacyAccountRequests).toBe(0)
  })
})
