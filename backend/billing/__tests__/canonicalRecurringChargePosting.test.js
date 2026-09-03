import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileCanonicalRecurringChargesForMonth } from '../canonicalRecurringChargePosting.js'
import {
  ensureHouseholdCollectionInvoice,
  verifyCanonicalBillingAccount,
} from '../canonicalBillingMigration.js'

const TARGET_MONTH = '2026-09-01'
const TARGET_END = '2026-09-30'
const TIMEZONE = 'America/New_York'
const AFTER_BOUNDARY = new Date('2026-09-01T05:00:00.000Z')

function activeSubscription(overrides = {}) {
  return {
    id: 41,
    family_billing_account_id: 9,
    member_id: 7,
    source_type: 'scheduling_signup',
    source_id: '101',
    description: 'Tornadoes',
    monthly_amount_cents: 15_000,
    discount_amount_cents: 3_000,
    net_monthly_cents: 12_000,
    status: 'active',
    start_date: '2026-08-03',
    end_date: null,
    anchor_day: 1,
    next_bill_date: TARGET_MONTH,
    pricing_option_key: null,
    signup_id: 101,
    signup_status: 'confirmed',
    signup_orphaned_at: null,
    signup_created_at: '2026-08-28T12:00:00.000Z',
    enrollment_start_date: '2026-08-03',
    form_start_date: '2026-07-09',
    form_end_date: '2026-12-31',
    ...overrides,
  }
}

function pricing(lines = [{
  signupId: 101,
  subscriptionId: 41,
  memberId: 7,
  grossCents: 15_000,
  discountCents: 3_000,
  netCents: 12_000,
  priceAdjustmentId: null,
}]) {
  return {
    familyId: 3,
    periodKey: '2026-09',
    grossCents: lines.reduce((sum, line) => sum + Number(line.grossCents ?? 0), 0),
    discountCents: lines.reduce((sum, line) => sum + Number(line.discountCents ?? 0), 0),
    netCents: lines.reduce((sum, line) => sum + Number(line.netCents ?? 0), 0),
    lines,
    missingSubscriptionSignupIds: [],
  }
}

function exactTargetCharge(overrides = {}) {
  return {
    id: 700,
    family_billing_account_id: 9,
    member_id: 7,
    source_type: 'billing_subscription',
    source_id: '41:2026-09',
    description: 'Tornadoes',
    amount_cents: 12_000,
    gross_amount_cents: 15_000,
    discount_amount_cents: 3_000,
    charge_type: 'recurring',
    billing_interval: 'month',
    subscription_id: 41,
    service_period_start: TARGET_MONTH,
    service_period_end: TARGET_END,
    price_adjustment_id: null,
    ...overrides,
  }
}

function recurringPostingFixture({
  subscriptions = [activeSubscription()],
  charges = [],
  invoices = [],
} = {}) {
  const calls = []
  const state = {
    subscriptions: subscriptions.map((row) => ({ ...row })),
    charges: charges.map((row) => ({ ...row })),
    invoices: invoices.map((row) => ({ ...row })),
    nextChargeId: 701,
  }
  const client = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(text)) return { rows: [] }
      if (/pg_advisory_xact_lock/.test(text)) return { rows: [{}] }
      if (/SELECT signup\.id/.test(text) && /FOR UPDATE OF signup/.test(text)) {
        return { rows: state.subscriptions.map((row) => ({ id: row.signup_id })).filter((row) => row.id != null) }
      }
      if (/SELECT subscription\.id/.test(text) && /FOR UPDATE OF subscription/.test(text)) {
        return { rows: state.subscriptions.map((row) => ({ id: row.id })) }
      }
      if (/SELECT account\.id, account\.family_id/.test(text)) {
        return { rows: [{
          id: 9,
          family_id: 3,
          household_monthly_billing_enabled: true,
          facility_id: 2,
          facility_timezone: TIMEZONE,
        }] }
      }
      if (/SELECT subscription\.\*/.test(text)) {
        return { rows: state.subscriptions.filter((row) => row.status !== 'cancelled').map((row) => ({ ...row })) }
      }
      if (/SELECT charge\.\*/.test(text)) {
        return { rows: state.charges.filter((row) => (
          String(row.service_period_start) <= String(params[2]) &&
          String(row.service_period_end) >= String(params[1])
        )).map((row) => ({ ...row })) }
      }
      if (/SELECT id, status, stripe_invoice_id/.test(text)) return { rows: state.invoices.map((row) => ({ ...row })) }
      if (/INSERT INTO billing_charge/.test(text)) {
        const sourceId = params[2]
        if (state.charges.some((row) => row.source_type === 'billing_subscription' && row.source_id === sourceId)) {
          return { rows: [] }
        }
        const row = {
          id: state.nextChargeId++,
          family_billing_account_id: params[0],
          member_id: params[1],
          source_type: 'billing_subscription',
          source_id: sourceId,
          description: params[3],
          amount_cents: params[4],
          gross_amount_cents: params[5],
          discount_amount_cents: params[6],
          charge_type: 'recurring',
          billing_interval: 'month',
          subscription_id: params[7],
          service_period_start: params[8],
          service_period_end: params[9],
          price_adjustment_id: params[10],
        }
        state.charges.push(row)
        return { rows: [{ id: row.id }] }
      }
      if (/UPDATE billing_subscription/.test(text)) {
        const subscription = state.subscriptions.find((row) => Number(row.id) === Number(params[0]))
        if (/SET next_bill_date = NULL/.test(text)) {
          if (
            subscription?.status === 'active' &&
            subscription.next_bill_date === params[1]
          ) {
            subscription.next_bill_date = null
            return { rows: [{ id: subscription.id }] }
          }
          return { rows: [] }
        }
        if (
          subscription?.status === 'active' &&
          subscription.next_bill_date === params[2]
        ) {
          subscription.next_bill_date = params[1]
          return { rows: [{ id: subscription.id }] }
        }
        return { rows: [] }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
    release() {},
  }
  return {
    db: {
      connect: async () => client,
      query: (...args) => client.query(...args),
    },
    client,
    calls,
    state,
  }
}

test('cutover posts exact target-month enrollment charges atomically and is idempotent', async () => {
  const fixture = recurringPostingFixture()
  let pricingCalls = 0
  const pricingResolver = async (_db, options) => {
    pricingCalls += 1
    assert.equal(options.familyId, 3)
    assert.equal(options.periodKey, '2026-09')
    assert.equal(options.ensureSchema, false)
    assert.equal(options.strictPricing, true)
    return pricing()
  }

  const first = await reconcileCanonicalRecurringChargesForMonth(fixture.db, {
    accountId: 9,
    billingMonth: TARGET_MONTH,
    facilityTimeZone: TIMEZONE,
    now: AFTER_BOUNDARY,
    apply: true,
    pricingResolver,
  })
  assert.equal(first.verified, true)
  assert.equal(first.expectedChargeCount, 1)
  assert.equal(first.expectedNetCents, 12_000)
  assert.deepEqual(first.postedChargeIds, [701])
  assert.equal(fixture.state.charges.length, 1)
  assert.equal(fixture.state.subscriptions[0].next_bill_date, '2026-10-01')
  assert.equal(pricingCalls, 2)
  assert.ok(fixture.calls.findIndex((call) => /COMMIT/.test(call.text)) > fixture.calls.findIndex((call) => /INSERT INTO billing_charge/.test(call.text)))

  const second = await reconcileCanonicalRecurringChargesForMonth(fixture.db, {
    accountId: 9,
    billingMonth: TARGET_MONTH,
    facilityTimeZone: TIMEZONE,
    now: AFTER_BOUNDARY,
    apply: true,
    pricingResolver,
  })
  assert.equal(second.verified, true)
  assert.deepEqual(second.postedChargeIds, [])
  assert.equal(fixture.state.charges.length, 1)
  assert.equal(fixture.calls.filter((call) => /INSERT INTO billing_charge/.test(call.text)).length, 1)
  assert.equal(pricingCalls, 4)
})

test('canonical posting requests strict pricing and rolls back pricing-engine failure', async () => {
  const fixture = recurringPostingFixture()
  await assert.rejects(
    reconcileCanonicalRecurringChargesForMonth(fixture.db, {
      accountId: 9,
      billingMonth: TARGET_MONTH,
      facilityTimeZone: TIMEZONE,
      now: AFTER_BOUNDARY,
      apply: true,
      pricingResolver: async (_db, options) => {
        assert.equal(options.strictPricing, true)
        throw new Error('injected strict pricing failure')
      },
    }),
    /injected strict pricing failure/,
  )
  assert.equal(fixture.state.charges.length, 0)
  assert.ok(fixture.calls.some((call) => call.text === 'ROLLBACK'))
})

test('cutover posting keeps a passed PoolClient checked out and uses it for nested work', async () => {
  const fixture = recurringPostingFixture()
  let releases = 0
  fixture.client.connect = async () => assert.fail('a checked-out PoolClient must not reconnect')
  fixture.client.release = () => { releases += 1 }

  const result = await reconcileCanonicalRecurringChargesForMonth(fixture.client, {
    accountId: 9,
    billingMonth: TARGET_MONTH,
    facilityTimeZone: TIMEZONE,
    now: AFTER_BOUNDARY,
    apply: true,
    pricingResolver: async (lockedDb) => {
      assert.equal(lockedDb, fixture.client)
      return pricing()
    },
  })

  assert.equal(result.verified, true)
  assert.equal(releases, 0)
  assert.equal(fixture.calls[0].text, 'BEGIN')
  assert.match(fixture.calls[1].text, /pg_advisory_xact_lock/)
  assert.equal(fixture.calls.at(-1).text, 'COMMIT')
})

test('preexisting target charges require exact continuing schedule parity', async (t) => {
  for (const scenario of [
    { name: 'missing next bill', nextBillDate: null },
    { name: 'target date was not advanced', nextBillDate: TARGET_MONTH },
    { name: 'stale prior date', nextBillDate: '2026-08-01' },
  ]) {
    await t.test(scenario.name, async () => {
      const fixture = recurringPostingFixture({
        subscriptions: [activeSubscription({ next_bill_date: scenario.nextBillDate })],
        charges: [exactTargetCharge()],
      })
      await assert.rejects(
        reconcileCanonicalRecurringChargesForMonth(fixture.db, {
          accountId: 9,
          billingMonth: TARGET_MONTH,
          facilityTimeZone: TIMEZONE,
          now: AFTER_BOUNDARY,
          apply: false,
          pricingResolver: async () => pricing(),
        }),
        (error) => error.details?.issues?.some((entry) => [
          'target_month_subscription_schedule_not_advanced',
          'target_month_subscription_prior_period_due',
        ].includes(entry.code)),
      )
    })
  }

  await t.test('next month due passes', async () => {
    const fixture = recurringPostingFixture({
      subscriptions: [activeSubscription({ next_bill_date: '2026-10-01' })],
      charges: [exactTargetCharge()],
    })
    const result = await reconcileCanonicalRecurringChargesForMonth(fixture.db, {
      accountId: 9,
      billingMonth: TARGET_MONTH,
      facilityTimeZone: TIMEZONE,
      now: AFTER_BOUNDARY,
      apply: false,
      pricingResolver: async () => pricing(),
    })
    assert.equal(result.verified, true)
  })
})

test('a target-ending enrollment may have no next bill after its exact charge', async () => {
  const fixture = recurringPostingFixture({
    subscriptions: [activeSubscription({
      next_bill_date: null,
      end_date: TARGET_END,
      cancel_effective_date: '2026-10-01',
    })],
    charges: [exactTargetCharge()],
  })
  const result = await reconcileCanonicalRecurringChargesForMonth(fixture.db, {
    accountId: 9,
    billingMonth: TARGET_MONTH,
    facilityTimeZone: TIMEZONE,
    now: AFTER_BOUNDARY,
    apply: false,
    pricingResolver: async () => pricing(),
  })
  assert.equal(result.verified, true)
})

test('terminal target charges normalize both target and next-month schedules to no next bill', async (t) => {
  for (const scenario of [
    { name: 'missing target charge', nextBillDate: TARGET_MONTH, charges: [], posted: [701] },
    { name: 'preexisting target charge', nextBillDate: '2026-10-01', charges: [exactTargetCharge()], posted: [] },
  ]) {
    await t.test(scenario.name, async () => {
      const fixture = recurringPostingFixture({
        subscriptions: [activeSubscription({
          next_bill_date: scenario.nextBillDate,
          end_date: TARGET_END,
          cancel_effective_date: '2026-10-01',
        })],
        charges: scenario.charges,
      })
      const result = await reconcileCanonicalRecurringChargesForMonth(fixture.db, {
        accountId: 9,
        billingMonth: TARGET_MONTH,
        facilityTimeZone: TIMEZONE,
        now: AFTER_BOUNDARY,
        apply: true,
        pricingResolver: async () => pricing(),
      })
      assert.equal(result.verified, true)
      assert.deepEqual(result.postedChargeIds, scenario.posted)
      assert.equal(fixture.state.subscriptions[0].next_bill_date, null)

      fixture.state.subscriptions[0].status = 'cancelled'
      const nextMonth = await reconcileCanonicalRecurringChargesForMonth(fixture.db, {
        accountId: 9,
        billingMonth: '2026-10-01',
        facilityTimeZone: TIMEZONE,
        now: new Date('2026-10-01T05:00:00.000Z'),
        apply: false,
        pricingResolver: async () => pricing([]),
      })
      assert.equal(nextMonth.verified, true)
      assert.equal(nextMonth.expectedChargeCount, 0)
    })
  }
})

test('continuing schedule CAS cannot resurrect a lifecycle change after the due snapshot', async () => {
  const fixture = recurringPostingFixture()
  const originalQuery = fixture.client.query
  let changed = false
  fixture.client.query = async (sql, params = []) => {
    if (!changed && /SET next_bill_date = \$2::date/.test(String(sql))) {
      changed = true
      fixture.state.subscriptions[0].status = 'paused'
    }
    return originalQuery(sql, params)
  }
  fixture.db.query = (...args) => fixture.client.query(...args)

  await assert.rejects(
    reconcileCanonicalRecurringChargesForMonth(fixture.db, {
      accountId: 9,
      billingMonth: TARGET_MONTH,
      facilityTimeZone: TIMEZONE,
      now: AFTER_BOUNDARY,
      apply: true,
      pricingResolver: async () => pricing(),
    }),
    (error) => error.code === 'target_month_recurring_charge_parity_failed',
  )
  assert.equal(fixture.state.subscriptions[0].next_bill_date, TARGET_MONTH)
  assert.ok(fixture.calls.some((call) => call.text === 'ROLLBACK'))
})

test('cutover fails closed on an extra or mismatched target-month recurring line', async () => {
  const fixture = recurringPostingFixture({
    charges: [{
      id: 700,
      family_billing_account_id: 9,
      member_id: 7,
      source_type: 'billing_subscription',
      source_id: '99:2026-09',
      amount_cents: 11_999,
      gross_amount_cents: 15_000,
      discount_amount_cents: 3_001,
      charge_type: 'recurring',
      billing_interval: 'month',
      subscription_id: 99,
      service_period_start: TARGET_MONTH,
      service_period_end: TARGET_END,
      price_adjustment_id: null,
    }],
  })
  await assert.rejects(
    reconcileCanonicalRecurringChargesForMonth(fixture.db, {
      accountId: 9,
      billingMonth: TARGET_MONTH,
      facilityTimeZone: TIMEZONE,
      now: AFTER_BOUNDARY,
      apply: false,
      pricingResolver: async () => pricing(),
    }),
    (error) => {
      assert.equal(error.code, 'target_month_recurring_charge_parity_failed')
      assert.ok(error.details.issues.some((entry) => entry.code === 'target_month_recurring_charge_extra'))
      return true
    },
  )
})

test('cutover refuses to add a missing recurring charge after a monthly invoice exists', async () => {
  const fixture = recurringPostingFixture({ invoices: [{ id: 88, status: 'draft', stripe_invoice_id: null }] })
  await assert.rejects(
    reconcileCanonicalRecurringChargesForMonth(fixture.db, {
      accountId: 9,
      billingMonth: TARGET_MONTH,
      facilityTimeZone: TIMEZONE,
      now: AFTER_BOUNDARY,
      apply: true,
      pricingResolver: async () => pricing(),
    }),
    (error) => error.code === 'target_month_invoice_precedes_recurring_charges',
  )
  assert.equal(fixture.state.charges.length, 0)
  assert.ok(fixture.calls.some((call) => call.text === 'ROLLBACK'))
})

test('a no-invoice month is charge-complete only when canonical expected charges are zero', async () => {
  const zeroFixture = recurringPostingFixture({ subscriptions: [] })
  const zero = await reconcileCanonicalRecurringChargesForMonth(zeroFixture.db, {
    accountId: 9,
    billingMonth: TARGET_MONTH,
    facilityTimeZone: TIMEZONE,
    now: AFTER_BOUNDARY,
    apply: false,
    pricingResolver: async () => pricing([]),
  })
  assert.equal(zero.verified, true)
  assert.equal(zero.expectedChargeCount, 0)
  assert.equal(zero.expectedNetCents, 0)

  const positiveFixture = recurringPostingFixture()
  const positive = await reconcileCanonicalRecurringChargesForMonth(positiveFixture.db, {
    accountId: 9,
    billingMonth: TARGET_MONTH,
    facilityTimeZone: TIMEZONE,
    now: AFTER_BOUNDARY,
    apply: false,
    pricingResolver: async () => pricing(),
  })
  assert.equal(positive.verified, false)
  assert.deepEqual(positive.issues.map((entry) => entry.code), ['target_month_recurring_charge_missing'])
})

test('future-dated active subscriptions are valid target-month lifecycle exclusions', async () => {
  const fixture = recurringPostingFixture({
    subscriptions: [activeSubscription({
      signup_id: 101,
      signup_status: 'confirmed',
      signup_orphaned_at: null,
      enrollment_start_date: '2026-10-03',
      start_date: '2026-10-03',
      next_bill_date: '2026-11-01',
      form_start_date: '2026-10-03',
      form_end_date: '2026-12-31',
    })],
  })
  const result = await reconcileCanonicalRecurringChargesForMonth(fixture.db, {
    accountId: 9,
    billingMonth: TARGET_MONTH,
    facilityTimeZone: TIMEZONE,
    now: AFTER_BOUNDARY,
    apply: false,
    pricingResolver: async () => pricing([]),
  })
  assert.equal(result.verified, true)
  assert.equal(result.expectedChargeCount, 0)
  assert.deepEqual(result.excludedSubscriptions, [{
    subscriptionId: 41,
    signupId: 101,
    reason: 'enrollment_starts_after_target_month',
  }])
})

test('cancellation- and pause-effective subscriptions are valid target-month lifecycle exclusions', async (t) => {
  const cases = [
    {
      name: 'cancellation',
      overrides: { cancel_effective_date: TARGET_MONTH, next_bill_date: null },
      reason: 'cancellation_effective_by_target_month',
    },
    {
      name: 'pause',
      overrides: { pause_effective_date: TARGET_MONTH, next_bill_date: TARGET_MONTH },
      reason: 'pause_effective_by_target_month',
    },
  ]
  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const fixture = recurringPostingFixture({
        subscriptions: [activeSubscription({
          signup_id: 101,
          signup_status: 'confirmed',
          signup_orphaned_at: null,
          enrollment_start_date: '2026-08-03',
          form_start_date: '2026-07-09',
          form_end_date: '2026-12-31',
          ...scenario.overrides,
        })],
      })
      const result = await reconcileCanonicalRecurringChargesForMonth(fixture.db, {
        accountId: 9,
        billingMonth: TARGET_MONTH,
        facilityTimeZone: TIMEZONE,
        now: AFTER_BOUNDARY,
        apply: false,
        pricingResolver: async () => pricing([]),
      })
      assert.equal(result.verified, true)
      assert.equal(result.expectedChargeCount, 0)
      assert.equal(result.excludedSubscriptions[0]?.reason, scenario.reason)
    })
  }
})

test('stale catch-up schedules cannot hide behind target-month lifecycle exclusions', async (t) => {
  const cases = [
    {
      name: 'future enrollment with a prior-period next bill',
      overrides: {
        enrollment_start_date: '2026-10-03',
        start_date: '2026-10-03',
        form_start_date: '2026-10-03',
        next_bill_date: '2026-08-01',
      },
      issueCode: 'target_month_subscription_exclusion_schedule_invalid',
      scheduleReason: 'future_enrollment_schedule_before_service_month',
    },
    {
      name: 'boundary cancellation with a prior-period next bill',
      overrides: { cancel_effective_date: TARGET_MONTH, next_bill_date: '2026-08-01' },
      issueCode: 'target_month_subscription_prior_period_due',
      scheduleReason: 'excluded_subscription_prior_period_due',
    },
    {
      name: 'boundary pause with a prior-period next bill',
      overrides: { pause_effective_date: TARGET_MONTH, next_bill_date: '2026-08-01' },
      issueCode: 'target_month_subscription_prior_period_due',
      scheduleReason: 'excluded_subscription_prior_period_due',
    },
  ]

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const fixture = recurringPostingFixture({
        subscriptions: [activeSubscription(scenario.overrides)],
      })
      await assert.rejects(
        reconcileCanonicalRecurringChargesForMonth(fixture.db, {
          accountId: 9,
          billingMonth: TARGET_MONTH,
          facilityTimeZone: TIMEZONE,
          now: AFTER_BOUNDARY,
          apply: false,
          pricingResolver: async () => pricing([]),
        }),
        (error) => {
          const issue = error.details?.issues?.find((entry) => entry.code === scenario.issueCode)
          assert.equal(issue?.scheduleReason, scenario.scheduleReason)
          return true
        },
      )
      assert.equal(fixture.calls.some((call) => /INSERT INTO billing_charge/.test(call.text)), false)
    })
  }
})

test('orphaned active mappings and charges for non-billable subscriptions still fail closed', async (t) => {
  const orphaned = activeSubscription({
    signup_id: 101,
    signup_status: 'confirmed',
    signup_orphaned_at: new Date('2026-08-20T12:00:00.000Z'),
  })
  await t.test('orphaned mapping', async () => {
    const fixture = recurringPostingFixture({ subscriptions: [orphaned] })
    await assert.rejects(
      reconcileCanonicalRecurringChargesForMonth(fixture.db, {
        accountId: 9,
        billingMonth: TARGET_MONTH,
        facilityTimeZone: TIMEZONE,
        now: AFTER_BOUNDARY,
        apply: false,
        pricingResolver: async () => pricing([]),
      }),
      (error) => error.details?.issues?.some((entry) => entry.code === 'target_month_subscription_extra'),
    )
  })

  await t.test('stale ended mapping is not excused by a boundary cancellation', async () => {
    const stale = activeSubscription({
      end_date: '2026-08-31',
      cancel_effective_date: TARGET_MONTH,
      next_bill_date: null,
    })
    const fixture = recurringPostingFixture({ subscriptions: [stale] })
    await assert.rejects(
      reconcileCanonicalRecurringChargesForMonth(fixture.db, {
        accountId: 9,
        billingMonth: TARGET_MONTH,
        facilityTimeZone: TIMEZONE,
        now: AFTER_BOUNDARY,
        apply: false,
        pricingResolver: async () => pricing([]),
      }),
      (error) => error.details?.issues?.some((entry) =>
        entry.code === 'target_month_subscription_extra' &&
        entry.lifecycleReason === 'active_subscription_already_ended'
      ),
    )
  })

  await t.test('unexpected charge for a future enrollment', async () => {
    const future = activeSubscription({
      signup_id: 101,
      signup_status: 'confirmed',
      signup_orphaned_at: null,
      enrollment_start_date: '2026-10-03',
      start_date: '2026-10-03',
      next_bill_date: '2026-11-01',
    })
    const fixture = recurringPostingFixture({
      subscriptions: [future],
      charges: [{
        id: 700,
        family_billing_account_id: 9,
        member_id: 7,
        source_type: 'billing_subscription',
        source_id: '41:2026-09',
        amount_cents: 12_000,
        gross_amount_cents: 15_000,
        discount_amount_cents: 3_000,
        charge_type: 'recurring',
        billing_interval: 'month',
        subscription_id: 41,
        service_period_start: TARGET_MONTH,
        service_period_end: TARGET_END,
        price_adjustment_id: null,
      }],
    })
    await assert.rejects(
      reconcileCanonicalRecurringChargesForMonth(fixture.db, {
        accountId: 9,
        billingMonth: TARGET_MONTH,
        facilityTimeZone: TIMEZONE,
        now: AFTER_BOUNDARY,
        apply: false,
        pricingResolver: async () => pricing([]),
      }),
      (error) => error.details?.issues?.some((entry) => entry.code === 'target_month_recurring_charge_extra'),
    )
  })
})

test('cutover charge posting follows the facility civil boundary', async () => {
  const fixture = recurringPostingFixture()
  await assert.rejects(
    reconcileCanonicalRecurringChargesForMonth(fixture.db, {
      accountId: 9,
      billingMonth: TARGET_MONTH,
      facilityTimeZone: TIMEZONE,
      now: new Date('2026-09-01T03:59:59.000Z'),
      apply: true,
      pricingResolver: async () => pricing(),
    }),
    (error) => error.code === 'target_month_charge_posting_before_boundary',
  )
  assert.equal(fixture.calls.length, 0)
})

test('invoice orchestration keeps the account lock while charge parity runs before Stripe invoicing', async () => {
  const events = []
  const db = {
    async query(sql) {
      if (/FROM family_billing_account account/.test(String(sql))) {
        return { rows: [{ id: 9, facility_id: 2, household_monthly_billing_enabled: true }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const lockedDb = { query: async () => ({ rows: [] }) }
  const result = await ensureHouseholdCollectionInvoice(db, {
    id: 17,
    billing_migration_run_id: 12,
    lease_owner: 'migration-worker-1',
    parity_snapshot: { timezone: TIMEZONE },
  }, {
    accountId: 9,
    targetMonth: TARGET_MONTH,
    now: AFTER_BOUNDARY,
    apply: true,
    environment: { BILLING_HOUSEHOLD_INVOICE_ENABLED: 'true' },
    accountLock: async (_db, accountId, callback) => {
      events.push(`lock:${accountId}`)
      const value = await callback(lockedDb)
      events.push('unlock')
      return value
    },
    pauseCreditProcessor: async (receivedDb, options) => {
      assert.equal(receivedDb, lockedDb)
      assert.equal(options.strict, true)
      assert.equal(options.accountId, 9)
      events.push('pause-credits')
      return 0
    },
    recurringChargeReconciler: async (receivedDb, options) => {
      assert.equal(receivedDb, lockedDb)
      assert.equal(options.apply, true)
      events.push('charges-committed')
      return { verified: true, expectedChargeCount: 1, expectedNetCents: 12_000 }
    },
    invoiceFactory: async (receivedDb, options) => {
      assert.equal(receivedDb, lockedDb)
      assert.deepEqual(options.migrationAuthorization, {
        migrationId: 17,
        runId: 12,
        leaseOwner: 'migration-worker-1',
        effectiveCollectionMonth: TARGET_MONTH,
      })
      events.push('stripe-invoice')
      return { created: true, invoice: { id: 77 } }
    },
  })
  assert.deepEqual(events, ['lock:9', 'pause-credits', 'charges-committed', 'stripe-invoice', 'unlock'])
  assert.equal(result.invoice.invoice.id, 77)
})

test('a due pause-credit failure quarantines first household collection before charges or invoice', async () => {
  const events = []
  const db = {
    async query(sql) {
      if (/FROM family_billing_account account/.test(String(sql))) {
        return { rows: [{ id: 9, family_id: 3, facility_id: 2, household_monthly_billing_enabled: true }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  await assert.rejects(
    ensureHouseholdCollectionInvoice(db, {
      parity_snapshot: { timezone: TIMEZONE },
    }, {
      accountId: 9,
      targetMonth: TARGET_MONTH,
      now: AFTER_BOUNDARY,
      apply: true,
      accountLock: async (_db, _accountId, callback) => callback(db),
      pauseCreditProcessor: async () => {
        events.push('credit-failed')
        const error = new Error('injected due pause-credit failure')
        error.code = 'pause_credit_postcondition_failed'
        throw error
      },
      recurringChargeReconciler: async () => {
        events.push('charges')
        return { verified: true }
      },
      invoiceFactory: async () => {
        events.push('invoice')
        return { created: true }
      },
    }),
    (error) => error.code === 'pause_credit_postcondition_failed',
  )
  assert.deepEqual(events, ['credit-failed'])
})

function verificationDb({ openChargeCount = 0, openChargeCents = 0 } = {}) {
  return {
    async query(sql) {
      const text = String(sql)
      if (/SELECT \* FROM family_billing_account/.test(text)) {
        return { rows: [{ id: 9, stripe_customer_id: 'cus_9', household_monthly_billing_enabled: true }] }
      }
      if (/SELECT id, status, next_bill_date/.test(text)) return { rows: [] }
      if (/SELECT invoice\.\*/.test(text)) return { rows: [] }
      if (text.includes('canonical-billing:collectible-balance')) {
        return { rows: [{
          collectible_balance_cents: openChargeCount > 0 ? openChargeCents : 0,
        }] }
      }
      if (/SELECT \* FROM billing_account_migration_item/.test(text)) return { rows: [] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
}

test('verification cannot mark missing canonical recurring charges complete without an invoice', async () => {
  const verification = await verifyCanonicalBillingAccount(verificationDb(), {
    migration: {
      id: 44,
      family_billing_account_id: 9,
      cutover_month: TARGET_MONTH,
      parity_snapshot: { timezone: TIMEZONE },
    },
    stripe: {},
    now: new Date('2026-09-02T12:00:00.000Z'),
    inspectCollectorInventory: false,
    recurringChargeInspector: async () => ({
      verified: false,
      issues: [{
        code: 'target_month_recurring_charge_missing',
        message: 'Subscription 41 is missing its target-month recurring charge.',
      }],
      expectedChargeCount: 1,
      expectedNetCents: 12_000,
    }),
  })
  assert.equal(verification.verified, false)
  assert.ok(verification.issues.some((entry) => entry.code === 'target_month_recurring_charge_missing'))
})

test('fully credited target tuition can verify without a zero-dollar invoice', async () => {
  const verification = await verifyCanonicalBillingAccount(verificationDb(), {
    migration: {
      id: 44,
      family_billing_account_id: 9,
      cutover_month: TARGET_MONTH,
      parity_snapshot: { timezone: TIMEZONE },
    },
    stripe: {},
    now: new Date('2026-09-02T12:00:00.000Z'),
    inspectCollectorInventory: false,
    recurringChargeInspector: async () => ({
      verified: true,
      issues: [],
      expectedChargeCount: 1,
      expectedNetCents: 12_000,
    }),
  })
  assert.equal(verification.verified, true)
})

test('a positive collectible remainder still requires a household invoice', async () => {
  const verification = await verifyCanonicalBillingAccount(verificationDb({
    openChargeCount: 1,
    openChargeCents: 4_000,
  }), {
    migration: {
      id: 44,
      family_billing_account_id: 9,
      cutover_month: TARGET_MONTH,
      parity_snapshot: { timezone: TIMEZONE },
    },
    stripe: {},
    now: new Date('2026-09-02T12:00:00.000Z'),
    inspectCollectorInventory: false,
    recurringChargeInspector: async () => ({
      verified: true,
      issues: [],
      expectedChargeCount: 1,
      expectedNetCents: 12_000,
    }),
  })
  assert.equal(verification.verified, false)
  assert.ok(verification.issues.some((entry) => entry.code === 'household_invoice_missing'))
})
