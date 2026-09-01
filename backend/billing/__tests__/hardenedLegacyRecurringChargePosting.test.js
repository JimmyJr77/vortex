import test from 'node:test'
import assert from 'node:assert/strict'
import { postHardenedLegacyRecurringChargesForMonth } from '../hardenedLegacyRecurringChargePosting.js'

const BASE_SUBSCRIPTION = {
  id: 41,
  family_billing_account_id: 9,
  member_id: 7,
  source_type: 'scheduling_signup',
  source_id: '101',
  description: 'Tornadoes',
  status: 'active',
  next_bill_date: '2026-09-01',
  end_date: null,
  signup_id: 101,
  signup_status: 'confirmed',
  signup_orphaned_at: null,
  signup_created_at: '2026-08-15',
  enrollment_start_date: '2026-08-15',
  pricing_breakdown: { billingType: 'recurring' },
  cancel_effective_date: null,
  pause_effective_date: null,
  form_start_date: '2026-08-01',
  form_end_date: null,
  group_active_start: '2026-08-01',
  group_active_end: null,
  offering_start_date: '2026-08-01',
  offering_end_date: null,
}

const PRICE_LINE = {
  subscriptionId: 41,
  signupId: 101,
  memberId: 7,
  grossCents: 15000,
  discountCents: 3000,
  netCents: 12000,
  priceAdjustmentId: null,
}

function fixture({ subscription = BASE_SUBSCRIPTION, failCas = false, facilityTimeZone = 'America/New_York' } = {}) {
  const state = {
    subscription: { ...subscription },
    charges: [],
    nextChargeId: 700,
  }
  const calls = []
  let snapshot = null
  const db = {
    release() {},
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text === 'BEGIN') {
        snapshot = structuredClone(state)
        return { rows: [] }
      }
      if (text === 'ROLLBACK') {
        Object.assign(state, structuredClone(snapshot))
        return { rows: [] }
      }
      if (text === 'COMMIT' || /pg_advisory_xact_lock/.test(text)) return { rows: [] }
      if (/SELECT account\.id, account\.family_id/.test(text)) {
        return { rows: [{ id: 9, family_id: 3, is_active: true, household_monthly_billing_enabled: false, facility_timezone: facilityTimeZone }] }
      }
      if (/FOR UPDATE OF signup/.test(text) || /FOR UPDATE OF subscription/.test(text)) return { rows: [{ id: 101 }] }
      if (/SELECT subscription\.\*/.test(text)) {
        return { rows: state.subscription.status === 'cancelled' ? [] : [{ ...state.subscription }] }
      }
      if (/SELECT \* FROM billing_charge/.test(text)) return { rows: state.charges.map((row) => ({ ...row })) }
      if (/SELECT charge\.\*/.test(text)) return { rows: state.charges.map((row) => ({ ...row })) }
      if (/INSERT INTO billing_charge/.test(text)) {
        const charge = {
          id: state.nextChargeId++,
          family_billing_account_id: params[0],
          member_id: params[1],
          source_type: 'billing_subscription',
          source_id: params[2],
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
        state.charges.push(charge)
        return { rows: [{ id: charge.id }] }
      }
      if (/UPDATE billing_subscription/.test(text) && /next_bill_date = \$2::date/.test(text)) {
        if (
          failCas ||
          state.subscription.status !== 'active' ||
          state.subscription.next_bill_date !== params[2]
        ) return { rows: [] }
        state.subscription.next_bill_date = params[1]
        return { rows: [{ id: state.subscription.id }] }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  return { db, state, calls }
}

const pricingResolver = async () => ({ lines: [{ ...PRICE_LINE }] })

test('hardened legacy posting uses authoritative pricing and advances by CAS', async () => {
  const setup = fixture()
  const result = await postHardenedLegacyRecurringChargesForMonth(setup.db, {
    accountId: 9,
    billingMonth: '2026-09-01',
    facilityTimeZone: 'America/New_York',
    now: new Date('2026-09-01T05:00:00.000Z'),
    pricingResolver,
  })
  assert.equal(result.verified, true)
  assert.deepEqual(result.postedChargeIds, [700])
  assert.equal(setup.state.charges[0].amount_cents, 12000)
  assert.equal(setup.state.subscription.next_bill_date, '2026-10-01')
})

test('hardened legacy posting rejects future lifecycle catch-up and missing canonical pricing', async (t) => {
  await t.test('future enrollment with stale due schedule', async () => {
    const setup = fixture({
      subscription: {
        ...BASE_SUBSCRIPTION,
        enrollment_start_date: '2026-10-03',
        offering_start_date: '2026-10-03',
      },
    })
    await assert.rejects(
      postHardenedLegacyRecurringChargesForMonth(setup.db, {
        accountId: 9,
        billingMonth: '2026-09-01',
        facilityTimeZone: 'America/New_York',
        now: new Date('2026-09-01T05:00:00.000Z'),
        pricingResolver: async () => ({ lines: [] }),
      }),
      (error) => error.code === 'legacy_recurring_exclusion_schedule_invalid',
    )
    assert.equal(setup.state.charges.length, 0)
  })

  await t.test('no persisted-price fallback', async () => {
    const setup = fixture()
    await assert.rejects(
      postHardenedLegacyRecurringChargesForMonth(setup.db, {
        accountId: 9,
        billingMonth: '2026-09-01',
        facilityTimeZone: 'America/New_York',
        now: new Date('2026-09-01T05:00:00.000Z'),
        pricingResolver: async () => ({ lines: [] }),
      }),
      (error) => error.code === 'legacy_recurring_pricing_line_missing',
    )
    assert.equal(setup.state.charges.length, 0)
  })
})

test('hardened legacy posting rolls back charge insertion on a lifecycle CAS race', async () => {
  const setup = fixture({ failCas: true })
  await assert.rejects(
    postHardenedLegacyRecurringChargesForMonth(setup.db, {
      accountId: 9,
      billingMonth: '2026-09-01',
      facilityTimeZone: 'America/New_York',
      now: new Date('2026-09-01T05:00:00.000Z'),
      pricingResolver,
    }),
    (error) => error.code === 'legacy_recurring_schedule_cas_failed',
  )
  assert.equal(setup.state.charges.length, 0)
  assert.ok(setup.calls.some((call) => call.text === 'ROLLBACK'))
})

test('hardened legacy posting requests strict pricing and rolls back pricing-engine failure', async () => {
  const setup = fixture()
  await assert.rejects(
    postHardenedLegacyRecurringChargesForMonth(setup.db, {
      accountId: 9,
      billingMonth: '2026-09-01',
      facilityTimeZone: 'America/New_York',
      now: new Date('2026-09-01T05:00:00.000Z'),
      pricingResolver: async (_db, options) => {
        assert.equal(options.strictPricing, true)
        throw new Error('injected strict pricing failure')
      },
    }),
    /injected strict pricing failure/,
  )
  assert.equal(setup.state.charges.length, 0)
  assert.ok(setup.calls.some((call) => call.text === 'ROLLBACK'))
})

test('terminal legacy enrollment clears its next bill and cannot be charged next month', async () => {
  const setup = fixture({
    subscription: { ...BASE_SUBSCRIPTION, offering_end_date: '2026-09-30' },
  })
  await postHardenedLegacyRecurringChargesForMonth(setup.db, {
    accountId: 9,
    billingMonth: '2026-09-01',
    facilityTimeZone: 'America/New_York',
    now: new Date('2026-09-01T05:00:00.000Z'),
    pricingResolver,
  })
  assert.equal(setup.state.subscription.next_bill_date, null)
  setup.state.subscription.status = 'cancelled'
  const rerun = await postHardenedLegacyRecurringChargesForMonth(setup.db, {
    accountId: 9,
    billingMonth: '2026-10-01',
    facilityTimeZone: 'America/New_York',
    now: new Date('2026-10-01T05:00:00.000Z'),
    pricingResolver: async () => ({ lines: [] }),
  })
  assert.deepEqual(rerun.postedChargeIds, [])
  assert.equal(setup.state.charges.length, 1)
})

test('hardened legacy posting honors the facility civil month boundary', async () => {
  const instant = new Date('2026-09-01T00:30:00.000Z')
  await assert.rejects(
    postHardenedLegacyRecurringChargesForMonth(fixture().db, {
      accountId: 9,
      billingMonth: '2026-09-01',
      facilityTimeZone: 'America/New_York',
      now: instant,
      pricingResolver,
    }),
    (error) => error.code === 'recurring_charge_before_facility_boundary',
  )
  const setup = fixture({ facilityTimeZone: 'Pacific/Kiritimati' })
  const result = await postHardenedLegacyRecurringChargesForMonth(setup.db, {
    accountId: 9,
    billingMonth: '2026-09-01',
    facilityTimeZone: 'Pacific/Kiritimati',
    now: instant,
    pricingResolver,
  })
  assert.equal(result.verified, true)
})
