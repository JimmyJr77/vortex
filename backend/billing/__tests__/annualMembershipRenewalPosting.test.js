import test from 'node:test'
import assert from 'node:assert/strict'
import {
  postDueAnnualMembershipRenewals,
  postDueAnnualMembershipRenewalsLocked,
} from '../annualMembershipRenewalPosting.js'

const ACCOUNT = {
  id: 19,
  family_id: 29,
  is_active: true,
  facility_id: 39,
  facility_timezone: 'America/New_York',
}

function annualSubscription(overrides = {}) {
  return {
    id: 49,
    family_billing_account_id: ACCOUNT.id,
    member_id: 59,
    source_type: 'annual_membership',
    source_id: '69:59',
    description: 'Annual membership',
    status: 'active',
    auto_renewal: true,
    next_bill_date: '2027-09-01',
    stripe_subscription_id: null,
    stripe_subscription_item_id: null,
    stripe_subscription_schedule_id: null,
    family_id: ACCOUNT.family_id,
    facility_id: ACCOUNT.facility_id,
    facility_timezone: ACCOUNT.facility_timezone,
    resolved_member_id: 59,
    member_facility_id: ACCOUNT.facility_id,
    member_is_owned: true,
    fee_id: 69,
    fee_name: 'Annual membership',
    fee_amount_cents: 8500,
    fee_active: true,
    fee_starts_at: null,
    fee_ends_at: null,
    fee_facility_id: ACCOUNT.facility_id,
    fee_trigger_type: 'once_per_year',
    fee_apply_basis: 'per_year',
    renewal_pricing_id: null,
    renewal_pricing_kind: null,
    renewal_final_amount_cents: null,
    renewal_promo_code: null,
    renewal_discount_rule_id: null,
    ...overrides,
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function renewalFixture({ subscriptions = [annualSubscription()], rules = [] } = {}) {
  const state = {
    account: { ...ACCOUNT },
    subscriptions: subscriptions.map((row) => ({ ...row })),
    charges: [],
    promoRedemptions: [],
    entitlements: [],
    activities: [],
    rules: rules.map((row) => ({ ...row })),
    pricingUpdates: [],
  }
  let transactionSnapshot = null
  const calls = []
  const db = {
    release() {},
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text === 'BEGIN') {
        transactionSnapshot = clone(state)
        return { rows: [] }
      }
      if (text === 'COMMIT') {
        transactionSnapshot = null
        return { rows: [] }
      }
      if (text === 'ROLLBACK') {
        if (transactionSnapshot) {
          for (const key of Object.keys(state)) state[key] = clone(transactionSnapshot[key])
        }
        transactionSnapshot = null
        return { rows: [] }
      }
      if (text.includes('pg_advisory_lock')) return { rows: [{ pg_advisory_lock: null }] }
      if (text.includes('pg_advisory_unlock')) return { rows: [{ pg_advisory_unlock: true }] }
      if (/FROM family_billing_account account/.test(text) && /FOR UPDATE OF account/.test(text)) {
        return { rows: state.account ? [{ ...state.account }] : [] }
      }
      if (/FROM billing_subscription subscription/.test(text) && /renewal_pricing_id/.test(text)) {
        const asOfDate = String(params[2])
        return {
          rows: state.subscriptions
            .filter((row) => (
              row.status === 'active'
              && row.auto_renewal === true
              && row.next_bill_date != null
              && String(row.next_bill_date).slice(0, 10) <= asOfDate
            ))
            .map((row) => ({ ...row })),
        }
      }
      if (/FROM additional_fee/.test(text) && /FOR SHARE/.test(text)) {
        const source = state.subscriptions.find((row) => Number(row.fee_id) === Number(params[0]))
        return {
          rows: source
            ? [{
                id: source.fee_id,
                facility_id: source.fee_facility_id,
                name: source.fee_name,
                amount_cents: source.fee_amount_cents,
                active: source.fee_active,
                starts_at: source.fee_starts_at,
                ends_at: source.fee_ends_at,
                trigger_type: source.fee_trigger_type,
                apply_basis: source.fee_apply_basis,
              }]
            : [],
        }
      }
      if (text.includes('INSERT INTO billing_charge')) {
        const existing = state.charges.find((row) => row.source_id === params[2])
        if (existing) return { rows: [] }
        const charge = {
          id: 100 + state.charges.length,
          family_billing_account_id: params[0],
          member_id: params[1],
          source_type: 'additional_fee',
          source_id: params[2],
          description: params[3],
          amount_cents: params[4],
          gross_amount_cents: params[5],
          discount_amount_cents: params[6],
          subscription_id: params[7],
          service_period_start: params[8],
          service_period_end: params[9],
          collection_status: params[10],
          metadata: JSON.parse(params[11]),
        }
        state.charges.push(charge)
        return { rows: [{ ...charge }] }
      }
      if (/FROM billing_charge/.test(text) && /source_type = 'additional_fee'/.test(text)) {
        const charge = state.charges.find((row) => row.source_id === params[0])
        return { rows: charge ? [{ ...charge }] : [] }
      }
      if (text.includes('UPDATE billing_subscription') && text.includes('next_bill_date = $3::date')) {
        const subscription = state.subscriptions.find((row) => Number(row.id) === Number(params[0]))
        if (
          !subscription
          || Number(subscription.family_billing_account_id) !== Number(params[1])
          || subscription.status !== 'active'
          || subscription.auto_renewal !== true
          || String(subscription.next_bill_date).slice(0, 10) !== params[3]
          || subscription.stripe_subscription_id
          || subscription.stripe_subscription_item_id
          || subscription.stripe_subscription_schedule_id
        ) return { rows: [] }
        subscription.next_bill_date = params[2]
        return { rows: [{ id: subscription.id, next_bill_date: subscription.next_bill_date }] }
      }
      if (text.includes('SELECT id FROM discount_rule') && text.includes('FOR UPDATE')) {
        const rule = state.rules.find((row) => Number(row.id) === Number(params[0]))
        return { rows: rule ? [{ id: rule.id }] : [] }
      }
      if (text.includes('SELECT * FROM discount_rule')) return { rows: state.rules.map((row) => ({ ...row })) }
      if (text.includes('FROM discount_rule_tier')) return { rows: [] }
      if (text.includes('FROM discount_global_settings')) return { rows: [] }
      if (text.includes('COALESCE(SUM(units)') && text.includes('FROM discount_redemption')) {
        return { rows: [{ free_units: 0, discount_count: state.promoRedemptions.length }] }
      }
      if (text.includes('SELECT rule_id, COUNT(*) AS c FROM discount_redemption')) return { rows: [] }
      if (text.includes('FROM discount_redemption dr')) return { rows: [] }
      if (text.includes('FROM discount_redemption WHERE program_id')) return { rows: [] }
      if (text.includes('FROM discount_redemption WHERE form_id')) return { rows: [] }
      if (text.includes('WITH inserted AS (') && text.includes('INSERT INTO discount_redemption')) {
        const redemption = {
          id: 200 + state.promoRedemptions.length,
          rule_id: params[0],
          member_id: params[1],
          amount_cents: params[2],
          annual_membership_renewal_pricing_id: params[3],
        }
        state.promoRedemptions.push(redemption)
        const rule = state.rules.find((row) => Number(row.id) === Number(params[0]))
        if (rule) rule.redeemed_count = Number(rule.redeemed_count ?? 0) + 1
        return { rows: [{ id: redemption.id }] }
      }
      if (text.includes('UPDATE annual_membership_renewal_pricing')) {
        const updated = {
          id: params[0],
          pricing_kind: 'manual_final_price',
          final_amount_cents: params[1],
          promo_code: null,
          discount_rule_id: null,
          sync_status: 'not_required',
        }
        state.pricingUpdates.push(updated)
        return { rows: [updated] }
      }
      if (text.includes('INSERT INTO additional_fee_redemption')) {
        const existing = state.entitlements.find((row) => (
          Number(row.fee_id) === Number(params[0])
          && Number(row.member_id) === Number(params[1])
          && row.period_key === params[2]
        ))
        if (existing) return { rows: [] }
        const entitlement = {
          id: 300 + state.entitlements.length,
          fee_id: params[0],
          member_id: params[1],
          period_key: params[2],
          amount_cents: 0,
          billing_charge_id: params[3],
        }
        state.entitlements.push(entitlement)
        return { rows: [{ ...entitlement }] }
      }
      if (/FROM additional_fee_redemption/.test(text)) {
        const entitlement = state.entitlements.find((row) => (
          Number(row.fee_id) === Number(params[0])
          && Number(row.member_id) === Number(params[1])
          && row.period_key === params[2]
        ))
        return { rows: entitlement ? [{ ...entitlement }] : [] }
      }
      if (text.includes('INSERT INTO billing_account_activity')) {
        state.activities.push({ params })
        return { rows: [{ id: 400 + state.activities.length }] }
      }
      throw new Error(`Unexpected annual-renewal query: ${text}`)
    },
  }
  return { db, state, calls }
}

test('posts one standard ledger renewal, advances the anniversary, and replays idempotently', async () => {
  const fixture = renewalFixture()
  const input = {
    accountId: ACCOUNT.id,
    asOfDate: '2027-09-01',
    asOfTimestamp: new Date('2027-09-01T05:00:00.000Z'),
  }
  const first = await postDueAnnualMembershipRenewals(fixture.db, input)
  const replay = await postDueAnnualMembershipRenewals(fixture.db, input)

  assert.deepEqual(first, {
    accountId: ACCOUNT.id,
    subscriptionsProcessed: 1,
    chargesPosted: 1,
    periodsAdvanced: 1,
    postedChargeIds: [100],
    replayedChargeIds: [],
  })
  assert.equal(replay.chargesPosted, 0)
  assert.equal(replay.periodsAdvanced, 0)
  assert.equal(fixture.state.charges.length, 1)
  assert.equal(fixture.state.charges[0].source_id, '69:59:2028-09-01')
  assert.equal(fixture.state.charges[0].amount_cents, 8500)
  assert.equal(fixture.state.charges[0].gross_amount_cents, 8500)
  assert.equal(fixture.state.charges[0].discount_amount_cents, 0)
  assert.equal(fixture.state.charges[0].service_period_start, '2027-09-01')
  assert.equal(fixture.state.charges[0].service_period_end, '2028-08-31')
  assert.equal(fixture.state.subscriptions[0].next_bill_date, '2028-09-01')
  assert.equal(fixture.state.activities.length, 1)
  assert.equal(
    fixture.calls.filter((call) => call.text.includes('pg_advisory_lock')).length,
    2,
  )
})

test('posts all anniversaries in the household invoice month before that invoice is frozen', async () => {
  const fixture = renewalFixture({
    subscriptions: [annualSubscription({ next_bill_date: '2027-09-27' })],
  })
  const result = await postDueAnnualMembershipRenewals(fixture.db, {
    accountId: ACCOUNT.id,
    asOfDate: '2027-09-01',
    billingThroughDate: '2027-09-30',
    asOfTimestamp: new Date('2027-09-01T05:00:00.000Z'),
  })

  assert.equal(result.chargesPosted, 1)
  assert.equal(fixture.state.charges[0].service_period_start, '2027-09-27')
  assert.equal(fixture.state.charges[0].service_period_end, '2028-09-26')
  assert.equal(fixture.state.subscriptions[0].next_bill_date, '2028-09-27')
})

test('rejects a billing-through date before the as-of date', async () => {
  const fixture = renewalFixture()
  await assert.rejects(
    postDueAnnualMembershipRenewals(fixture.db, {
      accountId: ACCOUNT.id,
      asOfDate: '2027-09-30',
      billingThroughDate: '2027-09-01',
    }),
    /cannot precede/,
  )
})

test('a compatible pre-existing Bill-now renewal advances the schedule without a duplicate', async () => {
  const fixture = renewalFixture()
  fixture.state.charges.push({
    id: 91,
    family_billing_account_id: ACCOUNT.id,
    member_id: 59,
    source_type: 'additional_fee',
    source_id: '69:59:2028-09-01',
    amount_cents: 8500,
    gross_amount_cents: 8500,
    discount_amount_cents: 0,
    subscription_id: null,
    service_period_start: '2027-09-01',
    service_period_end: '2027-09-01',
  })

  const result = await postDueAnnualMembershipRenewalsLocked(fixture.db, {
    accountId: ACCOUNT.id,
    asOfDate: '2027-09-01',
    asOfTimestamp: new Date('2027-09-01T05:00:00.000Z'),
  })

  assert.equal(result.chargesPosted, 0)
  assert.equal(result.periodsAdvanced, 1)
  assert.deepEqual(result.replayedChargeIds, [91])
  assert.equal(fixture.state.charges.length, 1)
  assert.equal(fixture.state.subscriptions[0].next_bill_date, '2028-09-01')
})

test('valid athlete renewal promo is revalidated, posted, and redeemed transactionally', async () => {
  const fixture = renewalFixture({
    subscriptions: [annualSubscription({
      renewal_pricing_id: 79,
      renewal_pricing_kind: 'promo_code',
      renewal_final_amount_cents: 4250,
      renewal_promo_code: 'HALF',
      renewal_discount_rule_id: 89,
    })],
    rules: [{
      id: 89,
      facility_id: ACCOUNT.facility_id,
      name: 'Half annual membership',
      active: true,
      type: 'promo_code',
      amount_type: 'percent',
      amount_value: 5000,
      apply_to: 'order',
      calc_base: 'list',
      priority: 10,
      stackable: true,
      scope_level: 'global',
      max_redemptions: 10,
      redeemed_count: 0,
      config: { code: 'HALF', benefit_type: 'annual_membership' },
    }],
  })

  const result = await postDueAnnualMembershipRenewals(fixture.db, {
    accountId: ACCOUNT.id,
    asOfDate: '2027-09-01',
    asOfTimestamp: new Date('2027-09-01T05:00:00.000Z'),
  })

  assert.equal(result.chargesPosted, 1)
  assert.equal(fixture.state.charges[0].amount_cents, 4250)
  assert.equal(fixture.state.charges[0].gross_amount_cents, 8500)
  assert.equal(fixture.state.charges[0].discount_amount_cents, 4250)
  assert.equal(fixture.state.charges[0].metadata.promoCode, 'half')
  assert.equal(fixture.state.promoRedemptions.length, 1)
  assert.equal(fixture.state.promoRedemptions[0].rule_id, 89)
  assert.equal(fixture.state.promoRedemptions[0].amount_cents, 4250)
  assert.equal(
    fixture.calls.some((call) => (
      call.text.includes('SELECT id FROM discount_rule') && call.text.includes('FOR UPDATE')
    )),
    true,
  )
})

test('an expired renewal promo is invalidated locally and the current standard fee is posted', async () => {
  const fixture = renewalFixture({
    subscriptions: [annualSubscription({
      renewal_pricing_id: 79,
      renewal_pricing_kind: 'promo_code',
      renewal_final_amount_cents: 4250,
      renewal_promo_code: 'EXPIRED',
      renewal_discount_rule_id: 89,
    })],
    rules: [{
      id: 89,
      facility_id: ACCOUNT.facility_id,
      name: 'Expired annual membership promo',
      active: true,
      type: 'promo_code',
      amount_type: 'percent',
      amount_value: 5000,
      apply_to: 'order',
      calc_base: 'list',
      priority: 10,
      stackable: true,
      scope_level: 'global',
      max_redemptions: 10,
      redeemed_count: 0,
      ends_at: '2026-12-31T23:59:59.000Z',
      config: { code: 'EXPIRED', benefit_type: 'annual_membership' },
    }],
  })

  await postDueAnnualMembershipRenewals(fixture.db, {
    accountId: ACCOUNT.id,
    asOfDate: '2027-09-01',
    asOfTimestamp: new Date('2027-09-01T05:00:00.000Z'),
  })

  assert.equal(fixture.state.charges[0].amount_cents, 8500)
  assert.equal(fixture.state.charges[0].discount_amount_cents, 0)
  assert.equal(fixture.state.pricingUpdates.length, 1)
  assert.equal(fixture.state.pricingUpdates[0].pricing_kind, 'manual_final_price')
  assert.equal(fixture.state.pricingUpdates[0].sync_status, 'not_required')
  assert.equal(fixture.state.promoRedemptions.length, 0)
  assert.equal(fixture.state.activities.length, 2)
})

test('a fully waived renewal records its zero-dollar entitlement without creating an invoice balance', async () => {
  const fixture = renewalFixture({
    subscriptions: [annualSubscription({
      renewal_pricing_id: 79,
      renewal_pricing_kind: 'manual_final_price',
      renewal_final_amount_cents: 0,
    })],
  })

  await postDueAnnualMembershipRenewals(fixture.db, {
    accountId: ACCOUNT.id,
    asOfDate: '2027-09-01',
    asOfTimestamp: new Date('2027-09-01T05:00:00.000Z'),
  })

  assert.equal(fixture.state.charges[0].amount_cents, 0)
  assert.equal(fixture.state.charges[0].collection_status, 'paid')
  assert.equal(fixture.state.entitlements.length, 1)
  assert.equal(fixture.state.entitlements[0].period_key, '2028-09-01')
  assert.equal(fixture.state.entitlements[0].billing_charge_id, fixture.state.charges[0].id)
})

test('does not post disabled renewals and fails closed while any Stripe collector remains attached', async () => {
  const disabled = renewalFixture({ subscriptions: [annualSubscription({ auto_renewal: false })] })
  const disabledResult = await postDueAnnualMembershipRenewals(disabled.db, {
    accountId: ACCOUNT.id,
    asOfDate: '2027-09-01',
  })
  assert.equal(disabledResult.chargesPosted, 0)
  assert.equal(disabled.state.charges.length, 0)
  assert.match(
    disabled.calls.find((call) => call.text.includes('FROM billing_subscription subscription')).text,
    /subscription\.auto_renewal = TRUE/,
  )

  const linked = renewalFixture({
    subscriptions: [annualSubscription({ stripe_subscription_id: 'sub_legacy_annual' })],
  })
  await assert.rejects(
    postDueAnnualMembershipRenewals(linked.db, {
      accountId: ACCOUNT.id,
      asOfDate: '2027-09-01',
    }),
    (error) => error?.code === 'annual_membership_remote_collector_attached',
  )
  assert.equal(linked.state.charges.length, 0)
  assert.equal(linked.state.subscriptions[0].next_bill_date, '2027-09-01')
  assert.equal(linked.calls.some((call) => call.text === 'ROLLBACK'), true)
})

test('fails closed when the athlete is no longer owned by the billing household', async () => {
  const fixture = renewalFixture({ subscriptions: [annualSubscription({ member_is_owned: false })] })
  await assert.rejects(
    postDueAnnualMembershipRenewals(fixture.db, {
      accountId: ACCOUNT.id,
      asOfDate: '2027-09-01',
    }),
    (error) => error?.code === 'annual_membership_renewal_member_scope_invalid',
  )
  assert.equal(fixture.state.charges.length, 0)
  assert.equal(fixture.state.subscriptions[0].next_bill_date, '2027-09-01')
})
