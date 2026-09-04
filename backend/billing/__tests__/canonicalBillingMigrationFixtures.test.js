import test from 'node:test'
import assert from 'node:assert/strict'
import {
  authoritativeBillingDateExceptions,
  buildLockedBillingParityDimensions,
  classifyBillingMigrationIssues,
  evaluateBillingMigrationParity,
  payerExceptions,
} from '../canonicalBillingMigrationAudit.js'

const TARGET_MONTH = '2026-09-01'
const AUDIT_NOW = new Date('2026-08-31T16:00:00.000Z')
const DIMENSION_NAMES = [
  'balance',
  'outstandingAmount',
  'nextMonthRecurringFee',
  'enrollments',
  'membershipsAndPaidThroughOwnership',
  'transactionsVisibleRecordManifest',
  'twelveMonthHistory',
  'bundlesAndRecomputedEntitlementBalance',
]

function pricingParity(pricing, subscriptions) {
  return evaluateBillingMigrationParity({
    pricing,
    subscriptions: subscriptions.map((subscription) => ({
      signupId: /^\d+$/.test(String(subscription.sourceId ?? ''))
        ? Number(subscription.sourceId)
        : null,
      signupStatus: 'confirmed',
      signupOrphanedAt: null,
      signupCreatedAt: '2026-08-01T12:00:00.000Z',
      enrollmentStartDate: '2026-08-01',
      ...subscription,
    })),
    targetMonth: TARGET_MONTH,
  })
}

function dimensionsFor(fixture) {
  return buildLockedBillingParityDimensions({
    ...fixture,
    pricingParity: pricingParity(fixture.pricing, fixture.subscriptions),
    targetMonth: TARGET_MONTH,
    now: AUDIT_NOW,
  })
}

function verdicts(dimensions) {
  return Object.fromEntries(Object.entries(dimensions).map(([name, value]) => [name, value.matched]))
}

function expectEveryDimensionMatched(dimensions) {
  assert.deepEqual(verdicts(dimensions), Object.fromEntries(DIMENSION_NAMES.map((name) => [name, true])))
}

const EMPTY_FINANCIAL = {
  ledger: {
    charge_cents: 0,
    payment_cents: 0,
    refund_cents: 0,
    ledger_running_balance_cents: 0,
  },
}

const EMPTY_CANONICAL_FINANCIAL = {
  chargesCents: 0,
  paymentsCents: 0,
  refundsCents: 0,
  balanceCents: 0,
  outstandingBalanceCents: 0,
  recurringBillingMonth: '2026-09',
}

const SINGLE_CLASS_FIXTURE = {
  subscriptions: [{
    id: 101,
    memberId: 7,
    sourceType: 'scheduling_signup',
    sourceId: '501',
    status: 'active',
    nextBillDate: '2026-09-01',
    netMonthlyCents: 12_000,
    discountAmountCents: 0,
  }],
  pricing: {
    grossCents: 12_000,
    discountCents: 0,
    netCents: 12_000,
    missingSubscriptionSignupIds: [],
    lines: [{
      signupId: 501,
      subscriptionId: 101,
      grossCents: 12_000,
      discountCents: 0,
      netCents: 12_000,
      localGrossCents: 12_000,
      localDiscountCents: 0,
      localNetCents: 12_000,
    }],
  },
  artifacts: [{
    itemType: 'billing_charge',
    sourceSnapshot: {
      id: 201,
      member_id: 7,
      charge_type: 'recurring',
      billing_interval: 'month',
      amount_cents: 12_000,
      discount_amount_cents: 0,
      applied_amount_cents: 0,
      remaining_amount_cents: 12_000,
      service_period_start: '2026-09-01',
      service_period_end: '2026-09-30',
      created_at: '2026-08-28T14:00:00.000Z',
      metadata: {},
    },
  }],
  financial: {
    ledger: {
      charge_cents: 12_000,
      payment_cents: 0,
      refund_cents: 0,
      ledger_running_balance_cents: 12_000,
    },
  },
  evidence: {
    canonicalFinancial: {
      chargesCents: 12_000,
      paymentsCents: 0,
      refundsCents: 0,
      balanceCents: 12_000,
      outstandingBalanceCents: 0,
      recurringBillingMonth: '2026-09',
    },
    visibleTransactions: [{
      entry_kind: 'charge',
      ref_id: 201,
      member_id: 7,
      amount_cents: 12_000,
      occurred_at: '2026-08-28T14:00:00.000Z',
      billing_month: '2026-09-01',
    }],
    membershipOwnership: [],
    paidThrough: [{
      subscription_id: 101,
      member_id: 7,
      next_bill_date: '2026-09-01',
      paid_through_date: null,
      derived_next_bill_date: null,
      owner_mismatch_count: 0,
    }],
  },
}

const MULTI_MEMBER_DISCOUNT_FIXTURE = {
  subscriptions: [
    {
      id: 111,
      memberId: 7,
      sourceType: 'scheduling_signup',
      sourceId: '511',
      status: 'active',
      nextBillDate: '2026-09-01',
      netMonthlyCents: 12_000,
      discountAmountCents: 3_000,
    },
    {
      id: 112,
      memberId: 8,
      sourceType: 'scheduling_signup',
      sourceId: '512',
      status: 'active',
      nextBillDate: '2026-09-01',
      netMonthlyCents: 12_000,
      discountAmountCents: 3_000,
    },
  ],
  pricing: {
    grossCents: 30_000,
    discountCents: 6_000,
    netCents: 24_000,
    missingSubscriptionSignupIds: [],
    lines: [
      {
        signupId: 511,
        subscriptionId: 111,
        grossCents: 15_000,
        discountCents: 3_000,
        netCents: 12_000,
        localGrossCents: 15_000,
        localDiscountCents: 3_000,
        localNetCents: 12_000,
      },
      {
        signupId: 512,
        subscriptionId: 112,
        grossCents: 15_000,
        discountCents: 3_000,
        netCents: 12_000,
        localGrossCents: 15_000,
        localDiscountCents: 3_000,
        localNetCents: 12_000,
      },
    ],
  },
  artifacts: [],
  financial: EMPTY_FINANCIAL,
  evidence: {
    canonicalFinancial: EMPTY_CANONICAL_FINANCIAL,
    visibleTransactions: [],
    membershipOwnership: [],
    paidThrough: [
      {
        subscription_id: 111,
        member_id: 7,
        next_bill_date: '2026-09-01',
        paid_through_date: null,
        derived_next_bill_date: null,
        owner_mismatch_count: 0,
      },
      {
        subscription_id: 112,
        member_id: 8,
        next_bill_date: '2026-09-01',
        paid_through_date: null,
        derived_next_bill_date: null,
        owner_mismatch_count: 0,
      },
    ],
  },
}

const ANNUAL_MEMBERSHIP_FIXTURE = {
  subscriptions: [{
    id: 121,
    memberId: 7,
    sourceType: 'scheduling_signup',
    sourceId: '521',
    status: 'active',
    nextBillDate: '2026-10-01',
    netMonthlyCents: 12_000,
    discountAmountCents: 3_000,
  }],
  pricing: {
    grossCents: 15_000,
    discountCents: 3_000,
    netCents: 12_000,
    missingSubscriptionSignupIds: [],
    lines: [{
      signupId: 521,
      subscriptionId: 121,
      grossCents: 15_000,
      discountCents: 3_000,
      netCents: 12_000,
      localGrossCents: 15_000,
      localDiscountCents: 3_000,
      localNetCents: 12_000,
    }],
  },
  artifacts: [{
    itemType: 'annual_membership',
    sourceSnapshot: {
      id: 221,
      member_id: 7,
      source_id: '85:7',
      next_bill_date: '2027-08-30',
    },
  }],
  financial: EMPTY_FINANCIAL,
  evidence: {
    canonicalFinancial: EMPTY_CANONICAL_FINANCIAL,
    visibleTransactions: [],
    membershipOwnership: [{
      charge_id: 321,
      charge_member_id: 7,
      source_member_id: 7,
      redemption_member_id: 7,
      subscription_member_id: 7,
      collection_status: 'paid',
      amount_cents: 8_500,
      applied_cents: 8_500,
    }],
    paidThrough: [{
      subscription_id: 121,
      member_id: 7,
      next_bill_date: '2026-10-01',
      paid_through_date: '2026-09-30',
      derived_next_bill_date: '2026-10-01',
      owner_mismatch_count: 0,
    }],
  },
}

const BUNDLE_FIXTURE = {
  subscriptions: [],
  pricing: {
    grossCents: 0,
    discountCents: 0,
    netCents: 0,
    missingSubscriptionSignupIds: [],
    lines: [],
  },
  artifacts: [
    {
      itemType: 'bundle_pass',
      sourceSnapshot: {
        id: 401,
        member_id: 7,
        class_count_purchased: 10,
        classes_remaining: 7,
      },
    },
    {
      itemType: 'bundle_usage',
      sourceSnapshot: {
        id: 402,
        member_pass_id: 401,
        credit_delta: -2,
        classes_used: 2,
      },
    },
    {
      itemType: 'bundle_usage',
      sourceSnapshot: {
        id: 403,
        member_pass_id: 401,
        credit_delta: null,
        classes_used: 1,
      },
    },
  ],
  financial: EMPTY_FINANCIAL,
  evidence: {
    canonicalFinancial: EMPTY_CANONICAL_FINANCIAL,
    visibleTransactions: [],
    membershipOwnership: [],
    paidThrough: [],
  },
}

const REFUND_CREDIT_UNAPPLIED_FIXTURE = {
  subscriptions: [],
  pricing: {
    grossCents: 0,
    discountCents: 0,
    netCents: 0,
    missingSubscriptionSignupIds: [],
    lines: [],
  },
  artifacts: [
    {
      itemType: 'billing_charge',
      sourceSnapshot: {
        id: 601,
        member_id: 7,
        charge_type: 'one_time',
        billing_interval: 'one_time',
        amount_cents: 10_000,
        applied_amount_cents: 0,
        remaining_amount_cents: 10_000,
        service_period_start: '2026-08-01',
        service_period_end: '2026-08-31',
        created_at: '2026-08-01T12:00:00.000Z',
        metadata: {},
      },
    },
    {
      itemType: 'billing_charge',
      sourceSnapshot: {
        id: 602,
        member_id: 7,
        charge_type: 'credit',
        billing_interval: 'one_time',
        amount_cents: -2_000,
        applied_amount_cents: 0,
        remaining_amount_cents: 0,
        related_charge_id: 601,
        service_period_start: '2026-08-01',
        service_period_end: '2026-08-31',
        created_at: '2026-08-02T12:00:00.000Z',
        metadata: {},
      },
    },
    {
      itemType: 'billing_payment',
      sourceSnapshot: {
        id: 603,
        amount_cents: 5_000,
        applied_amount_cents: 3_000,
        remaining_amount_cents: 2_000,
        paid_at: '2026-08-05T12:00:00.000Z',
      },
    },
    {
      itemType: 'billing_refund',
      sourceSnapshot: {
        id: 604,
        payment_id: 603,
        amount_cents: 1_000,
        external_status: 'succeeded',
        created_at: '2026-08-06T12:00:00.000Z',
      },
    },
  ],
  financial: {
    ledger: {
      charge_cents: 8_000,
      payment_cents: 5_000,
      refund_cents: 1_000,
      ledger_running_balance_cents: 4_000,
    },
  },
  evidence: {
    canonicalFinancial: {
      chargesCents: 8_000,
      paymentsCents: 5_000,
      refundsCents: 1_000,
      balanceCents: 4_000,
      outstandingBalanceCents: 8_000,
      recurringBillingMonth: '2026-09',
    },
    visibleTransactions: [
      {
        entry_kind: 'charge',
        ref_id: 601,
        member_id: 7,
        amount_cents: 10_000,
        occurred_at: '2026-08-01T12:00:00.000Z',
        billing_month: '2026-08-01',
      },
      {
        entry_kind: 'charge',
        ref_id: 602,
        member_id: 7,
        amount_cents: -2_000,
        occurred_at: '2026-08-02T12:00:00.000Z',
        billing_month: '2026-08-01',
      },
      {
        entry_kind: 'payment',
        ref_id: 603,
        member_id: null,
        amount_cents: -5_000,
        occurred_at: '2026-08-05T12:00:00.000Z',
        billing_month: '2026-08-05',
      },
      {
        entry_kind: 'refund',
        ref_id: 604,
        member_id: null,
        amount_cents: 1_000,
        occurred_at: '2026-08-06T12:00:00.000Z',
        billing_month: '2026-08-06',
      },
    ],
    membershipOwnership: [],
    paidThrough: [],
  },
}

const UNCHARGED_DROP_IN_FIXTURE = {
  subscriptions: [],
  pricing: {
    grossCents: 0,
    discountCents: 0,
    netCents: 0,
    missingSubscriptionSignupIds: [],
    lines: [],
  },
  artifacts: [{
    itemType: 'other',
    sourceSnapshot: {
      id: 701,
      member_id: 8,
      record_type: 'drop_in',
      amount_cents: 2_500,
      status: 'confirmed',
      class_date: '2026-08-20',
      created_at: '2026-08-18T12:00:00.000Z',
    },
  }],
  financial: EMPTY_FINANCIAL,
  evidence: {
    canonicalFinancial: EMPTY_CANONICAL_FINANCIAL,
    visibleTransactions: [{
      entry_kind: 'drop_in',
      ref_id: 701,
      member_id: 8,
      amount_cents: 2_500,
      occurred_at: '2026-08-20',
      billing_month: '2026-08-20',
    }],
    membershipOwnership: [],
    paidThrough: [],
  },
}

test('single-class fixture matches all locked dimensions exactly', () => {
  const dimensions = dimensionsFor(SINGLE_CLASS_FIXTURE)
  expectEveryDimensionMatched(dimensions)
  assert.deepEqual(dimensions.balance.legacy, {
    chargeCents: 12_000,
    paymentCents: 0,
    refundCents: 0,
    balanceCents: 12_000,
  })
  assert.deepEqual(dimensions.outstandingAmount.legacy, { outstandingAmountCents: 0 })
  assert.deepEqual(dimensions.enrollments.legacy, [{ signupId: 501, subscriptionId: 101 }])
})

test('multi-member family discount fixture locks aggregate and per-enrollment totals', () => {
  const dimensions = dimensionsFor(MULTI_MEMBER_DISCOUNT_FIXTURE)
  expectEveryDimensionMatched(dimensions)
  assert.deepEqual(dimensions.nextMonthRecurringFee.legacy, {
    targetMonth: TARGET_MONTH,
    grossCents: 30_000,
    discountCents: 6_000,
    netCents: 24_000,
  })
  assert.deepEqual(dimensions.nextMonthRecurringFee.canonical, dimensions.nextMonthRecurringFee.legacy)
  assert.deepEqual(dimensions.enrollments.canonical, [
    { signupId: 511, subscriptionId: 111 },
    { signupId: 512, subscriptionId: 112 },
  ])
})

test('annual membership ownership and paid-through fixture passes, while owner drift blocks parity', () => {
  const dimensions = dimensionsFor(ANNUAL_MEMBERSHIP_FIXTURE)
  expectEveryDimensionMatched(dimensions)
  assert.equal(dimensions.membershipsAndPaidThroughOwnership.matched, true)
  assert.deepEqual(dimensions.membershipsAndPaidThroughOwnership.legacy, {
    annualSubscriptions: [{
      id: 221,
      memberId: 7,
      sourceId: '85:7',
      nextBillDate: '2027-08-30',
    }],
    enrollmentNextBillDates: [{
      subscriptionId: 121,
      memberId: 7,
      nextBillDate: '2026-10-01',
    }],
  })

  const drifted = structuredClone(ANNUAL_MEMBERSHIP_FIXTURE)
  drifted.evidence.membershipOwnership[0].redemption_member_id = 8
  const driftedDimensions = dimensionsFor(drifted)
  assert.equal(driftedDimensions.membershipsAndPaidThroughOwnership.matched, false)
  assert.deepEqual(
    Object.entries(driftedDimensions).filter(([, value]) => !value.matched).map(([name]) => name),
    ['membershipsAndPaidThroughOwnership'],
  )
})

test('bundle purchase and signed usage fixture reproduces the stored entitlement balance', () => {
  const dimensions = dimensionsFor(BUNDLE_FIXTURE)
  expectEveryDimensionMatched(dimensions)
  assert.deepEqual(dimensions.bundlesAndRecomputedEntitlementBalance.legacy, [{
    passId: 401,
    memberId: 7,
    storedEntitlementBalance: 7,
  }])
  assert.deepEqual(dimensions.bundlesAndRecomputedEntitlementBalance.canonical, [{
    passId: 401,
    memberId: 7,
    recomputedEntitlementBalance: 7,
  }])

  const drifted = structuredClone(BUNDLE_FIXTURE)
  drifted.artifacts[0].sourceSnapshot.classes_remaining = 8
  const driftedDimensions = dimensionsFor(drifted)
  assert.equal(driftedDimensions.bundlesAndRecomputedEntitlementBalance.matched, false)
})

test('refund, linked credit, and unapplied payment fixture preserves distinct balance semantics', () => {
  const dimensions = dimensionsFor(REFUND_CREDIT_UNAPPLIED_FIXTURE)
  expectEveryDimensionMatched(dimensions)
  assert.deepEqual(dimensions.balance.legacy, {
    chargeCents: 8_000,
    paymentCents: 5_000,
    refundCents: 1_000,
    balanceCents: 4_000,
  })
  // Outstanding is the $8,000 adjusted charge. The returned $1,000 is not a
  // new debt; only a reversed application or linked charge offset can change
  // a charge's outstanding amount. The payment's $2,000 remainder remains a
  // future credit rather than a second reduction of the charge-level amount.
  assert.deepEqual(dimensions.outstandingAmount.legacy, { outstandingAmountCents: 8_000 })
  assert.deepEqual(dimensions.outstandingAmount.canonical, { outstandingAmountCents: 8_000 })
  assert.equal(dimensions.transactionsVisibleRecordManifest.legacy.count, 4)
})

test('uncharged drop-in fixture remains visible exactly once in the transaction manifest', () => {
  const dimensions = dimensionsFor(UNCHARGED_DROP_IN_FIXTURE)
  expectEveryDimensionMatched(dimensions)
  assert.deepEqual(
    {
      legacyCount: dimensions.transactionsVisibleRecordManifest.legacy.count,
      canonicalCount: dimensions.transactionsVisibleRecordManifest.canonical.count,
      hashesMatch:
        dimensions.transactionsVisibleRecordManifest.legacy.manifestHash ===
        dimensions.transactionsVisibleRecordManifest.canonical.manifestHash,
    },
    { legacyCount: 1, canonicalCount: 1, hashesMatch: true },
  )

  const omitted = structuredClone(UNCHARGED_DROP_IN_FIXTURE)
  omitted.evidence.visibleTransactions = []
  const omittedDimensions = dimensionsFor(omitted)
  assert.equal(omittedDimensions.transactionsVisibleRecordManifest.matched, false)
  assert.deepEqual(
    [
      omittedDimensions.transactionsVisibleRecordManifest.legacy.count,
      omittedDimensions.transactionsVisibleRecordManifest.canonical.count,
    ],
    [1, 0],
  )
})

test('drop-in parity compares the facility calendar date instead of timezone-coerced instants', () => {
  const fixture = structuredClone(UNCHARGED_DROP_IN_FIXTURE)
  fixture.artifacts[0].sourceSnapshot.class_date = new Date('2026-08-20T04:00:00.000Z')
  fixture.evidence.visibleTransactions[0].occurred_at = new Date('2026-08-20T00:00:00.000Z')
  fixture.evidence.visibleTransactions[0].billing_month = new Date('2026-08-20T04:00:00.000Z')

  const dimensions = dimensionsFor(fixture)
  assert.equal(dimensions.transactionsVisibleRecordManifest.matched, true)
})

test('ambiguous and inactive payer fixtures have exact blocking classifications', () => {
  const inactive = payerExceptions({
    is_active: true,
    payer_member_id: 7,
    payer_id: 7,
    payer_is_active: false,
    payer_direct_family_active: false,
    payer_family_membership_active: false,
    billing_email: 'billing@example.com',
    payer_email: 'payer@example.com',
    stripe_customer_id: null,
    stripe_customer_active_account_count: 0,
    family_facility_id: 2,
    payer_facility_id: 2,
    facility_ids: [2],
    family_facility_count: 1,
    family_active_member_count: 1,
    family_member_facility_count: 1,
    facility_timezone: 'America/New_York',
  })
  assert.deepEqual(inactive.map((issue) => [issue.code, issue.severity, issue.repairable]), [
    ['payer_not_active_family_member', 'blocking', false],
  ])
  assert.equal(classifyBillingMigrationIssues(inactive), 'blocked')

  const missing = payerExceptions({
    is_active: true,
    payer_member_id: null,
    payer_id: null,
    billing_email: 'billing@example.com',
    payer_email: null,
    stripe_customer_id: null,
    stripe_customer_active_account_count: 0,
    family_facility_id: 2,
    payer_facility_id: null,
    facility_ids: [2],
    family_facility_count: 1,
    family_active_member_count: 1,
    family_member_facility_count: 1,
    facility_timezone: 'America/New_York',
  })
  assert.deepEqual(missing.map((issue) => [issue.code, issue.severity, issue.repairable]), [
    ['payer_missing', 'blocking', false],
  ])
  assert.equal(classifyBillingMigrationIssues(missing), 'blocked')
})

test('missing recurring service-period fixtures distinguish deterministic repair from ambiguity', () => {
  const subscription = {
    id: 801,
    status: 'active',
    sourceType: 'scheduling_signup',
    sourceId: '901',
    signupStatus: 'confirmed',
    signupCreatedAt: '2026-08-28T12:00:00.000Z',
    enrollmentStartDate: '2026-08-28',
    classActiveStart: '2026-07-09',
    classActiveEnd: '2026-12-31',
  }
  const missingBoth = authoritativeBillingDateExceptions({
    subscriptions: [subscription],
    artifacts: [{
      itemType: 'billing_charge',
      sourceSnapshot: {
        id: 802,
        charge_type: 'recurring',
        billing_interval: 'month',
        source_type: 'scheduling_signup',
        subscription_id: 801,
        service_period_start: null,
        service_period_end: null,
      },
    }],
  })
  assert.deepEqual(missingBoth.map((issue) => [issue.code, issue.severity, issue.repairable]), [
    ['recurring_charge_service_period_missing', 'blocking', true],
  ])
  assert.equal(classifyBillingMigrationIssues(missingBoth), 'repairable')

  const partialPeriod = authoritativeBillingDateExceptions({
    subscriptions: [subscription],
    artifacts: [{
      itemType: 'billing_charge',
      sourceSnapshot: {
        id: 803,
        charge_type: 'recurring',
        billing_interval: 'month',
        source_type: 'scheduling_signup',
        subscription_id: 801,
        service_period_start: '2026-08-28',
        service_period_end: null,
      },
    }],
  })
  assert.deepEqual(partialPeriod.map((issue) => [issue.code, issue.severity, issue.repairable]), [
    ['recurring_charge_service_period_missing', 'blocking', false],
  ])
  assert.equal(classifyBillingMigrationIssues(partialPeriod), 'blocked')
})
