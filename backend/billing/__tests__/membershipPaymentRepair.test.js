import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FullyWaivedAnnualMembershipRepairError,
  parseFullyWaivedAnnualMembershipSource,
  repairFullyWaivedAnnualMembershipEntitlements,
} from '../membershipPaymentRepair.js'

function waivedCharge(overrides = {}) {
  return {
    id: 106,
    family_billing_account_id: 7,
    member_id: 11,
    source_type: 'additional_fee',
    source_id: '3:11:2027-08-28',
    description: 'Annual Membership',
    amount_cents: 0,
    gross_amount_cents: 8_500,
    discount_amount_cents: 8_500,
    charge_type: 'one_time',
    billing_interval: 'one_time',
    collection_status: 'none',
    metadata: { discountCode: 'WAIVE85' },
    created_at: '2026-08-28T14:30:00.000Z',
    family_id: 5,
    family_facility_id: 2,
    fee_id: 3,
    fee_facility_id: 2,
    fee_trigger_type: 'once_per_year',
    fee_apply_basis: 'per_year',
    member_matches_household: true,
    ...overrides,
  }
}

function exactPromo(overrides = {}) {
  return {
    id: 51,
    rule_id: 9,
    member_id: 11,
    signup_id: 44,
    kind: 'discount',
    amount_cents: 8_500,
    annual_membership_checkout_request_id: null,
    created_at: '2026-08-28T14:30:02.000Z',
    rule_facility_id: 2,
    rule_type: 'promo_code',
    rule_code: 'WAIVE85',
    signup_member_id: 11,
    ...overrides,
  }
}

function fixture({
  charges = [waivedCharge()],
  promos = [exactPromo()],
  redemptions = [],
  subscriptions = [],
} = {}) {
  const state = {
    charges: structuredClone(charges),
    promos: structuredClone(promos),
    redemptions: structuredClone(redemptions),
    subscriptions: structuredClone(subscriptions),
    activities: [],
    alertResolved: false,
    alertResolutionWrites: 0,
    calls: [],
    released: false,
  }
  let transactionSnapshot = null

  const client = {
    async query(sql, params = []) {
      const text = String(sql).replace(/\s+/g, ' ').trim()
      state.calls.push({ text, params })
      if (text.includes('pg_advisory_lock(hashtextextended')) return { rows: [{ pg_advisory_lock: null }] }
      if (text.includes('pg_advisory_unlock(hashtextextended')) return { rows: [{ pg_advisory_unlock: true }] }
      if (text === 'BEGIN') {
        transactionSnapshot = structuredClone({
          redemptions: state.redemptions,
          subscriptions: state.subscriptions,
          activities: state.activities,
          alertResolved: state.alertResolved,
          alertResolutionWrites: state.alertResolutionWrites,
        })
        return { rows: [] }
      }
      if (text === 'COMMIT') {
        transactionSnapshot = null
        return { rows: [] }
      }
      if (text === 'ROLLBACK') {
        Object.assign(state, transactionSnapshot)
        transactionSnapshot = null
        return { rows: [] }
      }
      if (text.includes('AS member_matches_household') && text.includes('FROM billing_charge charge')) {
        return { rows: structuredClone(state.charges), rowCount: state.charges.length }
      }
      if (text.includes('FROM discount_redemption redemption') && text.includes('JOIN discount_rule rule')) {
        const [memberId, amountCents, facilityId, requestId, , promoCode] = params
        const rows = state.promos.filter((row) => (
          Number(row.member_id) === Number(memberId)
          && Number(row.amount_cents) === Number(amountCents)
          && Number(row.rule_facility_id) === Number(facilityId)
          && (requestId == null
            ? row.annual_membership_checkout_request_id == null
            : Number(row.annual_membership_checkout_request_id) === Number(requestId))
          && (!promoCode || String(row.rule_code).toUpperCase() === String(promoCode).toUpperCase())
        ))
        return { rows: structuredClone(rows), rowCount: rows.length }
      }
      if (text.includes('FROM additional_fee_redemption redemption') && text.includes('OR redemption.billing_charge_id')) {
        const [feeId, memberId, periodKey, chargeId] = params
        const rows = state.redemptions.filter((row) => (
          (Number(row.fee_id) === Number(feeId)
            && Number(row.member_id) === Number(memberId)
            && row.period_key === periodKey)
          || Number(row.billing_charge_id) === Number(chargeId)
        )).map((row) => ({
          ...row,
          signup_member_id: row.signup_id == null ? null : row.signup_member_id ?? 11,
        }))
        return { rows: structuredClone(rows), rowCount: rows.length }
      }
      if (text.startsWith('SELECT id, period_key, billing_charge_id, satisfied_at, ended_at FROM additional_fee_redemption')) {
        const [feeId, memberId] = params
        const rows = state.redemptions.filter((row) => (
          Number(row.fee_id) === Number(feeId) && Number(row.member_id) === Number(memberId)
        ))
        return { rows: structuredClone(rows), rowCount: rows.length }
      }
      if (text.startsWith('SELECT * FROM billing_subscription WHERE source_id')) {
        const rows = state.subscriptions.filter((row) => row.source_id === params[0])
        return { rows: structuredClone(rows), rowCount: rows.length }
      }
      if (text.startsWith('UPDATE additional_fee_redemption SET billing_charge_id')) {
        const [id, chargeId, satisfiedAt, feeId, memberId, periodKey] = params
        const row = state.redemptions.find((candidate) => Number(candidate.id) === Number(id))
        if (
          !row
          || Number(row.fee_id) !== Number(feeId)
          || Number(row.member_id) !== Number(memberId)
          || row.period_key !== periodKey
          || Number(row.amount_cents) !== 0
          || row.ended_at != null
          || (row.billing_charge_id != null && Number(row.billing_charge_id) !== Number(chargeId))
          || (row.satisfied_at != null && new Date(row.satisfied_at).getTime() !== new Date(satisfiedAt).getTime())
        ) return { rows: [], rowCount: 0 }
        row.billing_charge_id ??= chargeId
        row.satisfied_at ??= satisfiedAt
        return { rows: [structuredClone(row)], rowCount: 1 }
      }
      if (text.startsWith('INSERT INTO additional_fee_redemption')) {
        const [feeId, memberId, signupId, periodKey, chargeId, satisfiedAt] = params
        const duplicate = state.redemptions.some((row) => (
          Number(row.fee_id) === Number(feeId)
          && Number(row.member_id) === Number(memberId)
          && row.period_key === periodKey
        ))
        if (duplicate) return { rows: [], rowCount: 0 }
        const row = {
          id: 600 + state.redemptions.length,
          fee_id: feeId,
          member_id: memberId,
          signup_id: signupId,
          signup_member_id: signupId == null ? null : memberId,
          period_key: periodKey,
          amount_cents: 0,
          billing_charge_id: chargeId,
          satisfied_at: satisfiedAt,
          created_at: satisfiedAt,
          ended_at: null,
          end_reason: null,
        }
        state.redemptions.push(row)
        return { rows: [structuredClone(row)], rowCount: 1 }
      }
      if (text.startsWith('UPDATE billing_subscription SET next_bill_date')) {
        const [id, nextBillDate, anchorDay, accountId, memberId, sourceId] = params
        const row = state.subscriptions.find((candidate) => Number(candidate.id) === Number(id))
        if (
          !row
          || Number(row.family_billing_account_id) !== Number(accountId)
          || Number(row.member_id) !== Number(memberId)
          || row.source_id !== sourceId
          || row.status !== 'active'
          || row.stripe_subscription_id != null
          || row.stripe_subscription_item_id != null
          || row.stripe_subscription_schedule_id != null
        ) return { rows: [], rowCount: 0 }
        row.next_bill_date = nextBillDate
        row.anchor_day = anchorDay
        row.pricing_option_key = 'annual_membership'
        return { rows: [structuredClone(row)], rowCount: 1 }
      }
      if (text.startsWith('INSERT INTO billing_subscription')) {
        const [accountId, memberId, sourceId, description, startDate, anchorDay, nextBillDate] = params
        const duplicate = state.subscriptions.some((row) => row.source_id === sourceId && row.status !== 'cancelled')
        if (duplicate) return { rows: [], rowCount: 0 }
        const row = {
          id: 700 + state.subscriptions.length,
          family_billing_account_id: accountId,
          member_id: memberId,
          source_type: 'annual_membership',
          source_id: sourceId,
          description,
          monthly_amount_cents: 0,
          discount_amount_cents: 0,
          net_monthly_cents: 0,
          status: 'active',
          start_date: startDate,
          end_date: null,
          anchor_day: anchorDay,
          next_bill_date: nextBillDate,
          pricing_option_key: 'annual_membership',
          auto_renewal: true,
          stripe_subscription_id: null,
          stripe_subscription_item_id: null,
          stripe_subscription_schedule_id: null,
        }
        state.subscriptions.push(row)
        return { rows: [structuredClone(row)], rowCount: 1 }
      }
      if (text.startsWith('INSERT INTO billing_account_activity')) {
        const eventKey = params[0]
        if (state.activities.some((row) => row.event_key === eventKey)) return { rows: [], rowCount: 0 }
        const row = { id: state.activities.length + 1, event_key: eventKey, params: structuredClone(params) }
        state.activities.push(row)
        return { rows: [structuredClone(row)], rowCount: 1 }
      }
      if (text.startsWith('SELECT family_billing_account_id, member_id, related_charge_id, event_type FROM billing_account_activity')) {
        const existing = state.activities.find((row) => row.event_key === params[0])
        if (!existing) return { rows: [], rowCount: 0 }
        return { rows: [{
          family_billing_account_id: existing.params[1],
          member_id: existing.params[2],
          related_charge_id: existing.params[4],
          event_type: existing.params[7],
        }], rowCount: 1 }
      }
      if (text.startsWith('UPDATE stripe_billing_alert SET resolved_at')) {
        if (!state.alertResolved) {
          state.alertResolved = true
          state.alertResolutionWrites += 1
          return { rows: [{}], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
    release() { state.released = true },
  }
  const pool = {
    async connect() { return client },
    async query(sql, params) { return client.query(sql, params) },
  }
  return { pool, client, state }
}

test('strict annual source parser rejects normalized or malformed substitutes', () => {
  assert.deepEqual(parseFullyWaivedAnnualMembershipSource('3:11:2027-08-28'), {
    feeId: 3,
    memberId: 11,
    periodKey: '2027-08-28',
  })
  assert.equal(parseFullyWaivedAnnualMembershipSource('3:11:2027-02-29'), null)
  assert.equal(parseFullyWaivedAnnualMembershipSource('3:11:2027-08-28:extra'), null)
  assert.equal(parseFullyWaivedAnnualMembershipSource('fee:11:2027-08-28'), null)
})

test('waived annual repair creates the exact entitlement and local-only schedule idempotently', async () => {
  const { pool, state } = fixture()
  const first = await repairFullyWaivedAnnualMembershipEntitlements(pool, { accountId: 7, apply: true })

  assert.deepEqual(first, {
    mode: 'apply',
    scanned: 1,
    repaired: 1,
    schedulesRepaired: 1,
    correct: 0,
    blocked: [],
  })
  assert.equal(state.redemptions.length, 1)
  assert.deepEqual({
    feeId: state.redemptions[0].fee_id,
    memberId: state.redemptions[0].member_id,
    signupId: state.redemptions[0].signup_id,
    periodKey: state.redemptions[0].period_key,
    chargeId: state.redemptions[0].billing_charge_id,
    satisfiedAt: state.redemptions[0].satisfied_at,
  }, {
    feeId: 3,
    memberId: 11,
    signupId: 44,
    periodKey: '2027-08-28',
    chargeId: 106,
    satisfiedAt: '2026-08-28T14:30:00.000Z',
  })
  assert.equal(state.subscriptions.length, 1)
  assert.deepEqual({
    sourceType: state.subscriptions[0].source_type,
    sourceId: state.subscriptions[0].source_id,
    nextBillDate: state.subscriptions[0].next_bill_date,
    stripeSubscriptionId: state.subscriptions[0].stripe_subscription_id,
    stripeItemId: state.subscriptions[0].stripe_subscription_item_id,
    stripeScheduleId: state.subscriptions[0].stripe_subscription_schedule_id,
  }, {
    sourceType: 'annual_membership',
    sourceId: '3:11',
    nextBillDate: '2027-08-28',
    stripeSubscriptionId: null,
    stripeItemId: null,
    stripeScheduleId: null,
  })
  assert.equal(state.activities.length, 1)
  assert.equal(state.alertResolved, true)

  const second = await repairFullyWaivedAnnualMembershipEntitlements(pool, { accountId: 7, apply: true })
  assert.deepEqual(second, {
    mode: 'apply',
    scanned: 1,
    repaired: 0,
    schedulesRepaired: 0,
    correct: 1,
    blocked: [],
  })
  assert.equal(state.redemptions.length, 1)
  assert.equal(state.subscriptions.length, 1)
  assert.equal(state.activities.length, 1)
  assert.equal(state.alertResolutionWrites, 1)
  assert.equal(state.released, true)
})

test('waived annual repair links an existing redemption without replacing its signup and preserves renewal opt-out', async () => {
  const { pool, state } = fixture({
    redemptions: [{
      id: 61,
      fee_id: 3,
      member_id: 11,
      signup_id: 44,
      signup_member_id: 11,
      period_key: '2027-08-28',
      amount_cents: 0,
      billing_charge_id: null,
      satisfied_at: null,
      ended_at: null,
      end_reason: null,
    }],
    subscriptions: [{
      id: 71,
      family_billing_account_id: 7,
      member_id: 11,
      source_type: 'annual_membership',
      source_id: '3:11',
      description: 'Annual Membership',
      monthly_amount_cents: 0,
      discount_amount_cents: 0,
      net_monthly_cents: 0,
      status: 'active',
      start_date: '2026-08-28',
      end_date: null,
      anchor_day: 1,
      next_bill_date: '2027-08-01',
      pricing_option_key: null,
      auto_renewal: false,
      stripe_subscription_id: null,
      stripe_subscription_item_id: null,
      stripe_subscription_schedule_id: null,
    }],
  })

  await repairFullyWaivedAnnualMembershipEntitlements(pool, { accountId: 7, apply: true })
  assert.equal(state.redemptions[0].id, 61)
  assert.equal(state.redemptions[0].signup_id, 44)
  assert.equal(state.redemptions[0].billing_charge_id, 106)
  assert.equal(state.redemptions[0].satisfied_at, '2026-08-28T14:30:00.000Z')
  assert.equal(state.subscriptions[0].next_bill_date, '2027-08-28')
  assert.equal(state.subscriptions[0].anchor_day, 28)
  assert.equal(state.subscriptions[0].pricing_option_key, 'annual_membership')
  assert.equal(state.subscriptions[0].auto_renewal, false)
})

test('waived annual repair rolls back and leaves the review open when promo provenance is ambiguous', async () => {
  const { pool, state } = fixture({
    promos: [exactPromo(), exactPromo({ id: 52 })],
  })
  await assert.rejects(
    repairFullyWaivedAnnualMembershipEntitlements(pool, { accountId: 7, apply: true }),
    (error) => error instanceof FullyWaivedAnnualMembershipRepairError
      && error.code === 'fully_waived_annual_membership_repair_conflict'
      && error.details.matchingPromoRedemptionIds.length === 2,
  )
  assert.equal(state.redemptions.length, 0)
  assert.equal(state.subscriptions.length, 0)
  assert.equal(state.activities.length, 0)
  assert.equal(state.alertResolved, false)
  assert.ok(state.calls.some((call) => call.text === 'ROLLBACK'))
})

test('waived annual repair fails closed when the exact entitlement is already linked to another charge', async () => {
  const { pool, state } = fixture({
    redemptions: [{
      id: 61,
      fee_id: 3,
      member_id: 11,
      signup_id: 44,
      signup_member_id: 11,
      period_key: '2027-08-28',
      amount_cents: 0,
      billing_charge_id: 999,
      satisfied_at: null,
      ended_at: null,
      end_reason: null,
    }],
  })
  await assert.rejects(
    repairFullyWaivedAnnualMembershipEntitlements(pool, { accountId: 7, apply: true }),
    (error) => error.code === 'fully_waived_annual_membership_repair_conflict'
      && error.details.existingBillingChargeId === 999,
  )
  assert.equal(state.redemptions[0].billing_charge_id, 999)
  assert.equal(state.redemptions[0].satisfied_at, null)
  assert.equal(state.subscriptions.length, 0)
  assert.equal(state.alertResolved, false)
})

test('waived annual repair dry run reports conflicts without opening a transaction or mutating data', async () => {
  const { pool, state } = fixture({ promos: [exactPromo(), exactPromo({ id: 52 })] })
  const report = await repairFullyWaivedAnnualMembershipEntitlements(pool, { accountId: 7 })
  assert.equal(report.mode, 'dry_run')
  assert.equal(report.blocked.length, 1)
  assert.equal(report.blocked[0].code, 'fully_waived_annual_membership_repair_conflict')
  assert.equal(state.calls.some((call) => call.text === 'BEGIN'), false)
  assert.equal(state.redemptions.length, 0)
  assert.equal(state.subscriptions.length, 0)
})
