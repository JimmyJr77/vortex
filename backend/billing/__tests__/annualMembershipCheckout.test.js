import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ANNUAL_MEMBERSHIP_PROGRAM_NAME,
  ANNUAL_MEMBERSHIP_SPORT_NAME,
  assertAnnualMembershipCheckoutSessionBinding,
  annualMembershipCheckoutSessionIsPaid,
  commitAnnualMembershipCheckout,
  createAnnualRequestAndActivateWaived,
  ensureAnnualMembershipFamilyMemberAccess,
  getAnnualMembershipOffer,
  loadAnnualMembershipFee,
  persistAnnualMembershipCheckoutSessionState,
  priceAnnualMembershipSelections,
  validateAnnualMembershipPaidSettlementBinding,
} from '../annualMembershipCheckout.js'
import { checkoutFingerprint } from '../checkoutIdempotency.js'

test('membership catalog labels are stable for Sport/Program filters', () => {
  assert.equal(ANNUAL_MEMBERSHIP_SPORT_NAME, 'Membership')
  assert.equal(ANNUAL_MEMBERSHIP_PROGRAM_NAME, 'Annual Membership')
})

test('getAnnualMembershipOffer reports inactive when no membership window', async () => {
  const calls = []
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql: String(sql), params })
      if (String(sql).includes('FROM member')) return { rows: [{ facility_id: 7 }] }
      if (String(sql).includes('FROM additional_fee')) {
        return {
          rows: [
            {
              id: 1,
              facility_id: 1,
              name: 'Annual Fee',
              description: null,
              amount_cents: 8500,
              apply_basis: 'per_year',
              apply_interval: 1,
              trigger_type: 'once_per_year',
              scope_level: 'global',
              scope_ref_id: null,
              active: true,
              starts_at: null,
              ends_at: null,
              priority: 100,
              config: {},
            },
          ],
        }
      }
      if (String(sql).includes('FROM billing_subscription')) return { rows: [] }
      if (String(sql).includes('FROM additional_fee_redemption')) return { rows: [] }
      return { rows: [] }
    },
  }

  const offer = await getAnnualMembershipOffer(pool, 99)
  assert.equal(offer.available, true)
  assert.equal(offer.active, false)
  assert.equal(offer.amountCents, 8500)
  assert.equal(offer.sportName, 'Membership')
  assert.equal(offer.programName, 'Annual Membership')
  assert.equal(offer.fee?.feeId, 1)
  assert.deepEqual(calls.find((call) => call.sql.includes('FROM additional_fee')).params, [7])
  assert.equal(calls.some((call) => call.sql.includes('FROM facility')), false)
})

test('getAnnualMembershipOffer marks active when a paid annual redemption exists', async () => {
  const pool = {
    query: async (sql) => {
      if (String(sql).includes('FROM member')) return { rows: [{ facility_id: 7 }] }
      if (String(sql).includes('FROM additional_fee') && !String(sql).includes('redemption')) {
        return {
          rows: [
            {
              id: 1,
              facility_id: 1,
              name: 'Annual Fee',
              description: null,
              amount_cents: 8500,
              apply_basis: 'per_year',
              apply_interval: 1,
              trigger_type: 'once_per_year',
              scope_level: 'global',
              scope_ref_id: null,
              active: true,
              starts_at: null,
              ends_at: null,
              priority: 100,
              config: {},
            },
          ],
        }
      }
      if (String(sql).includes('FROM additional_fee_redemption')) {
        return {
          rows: [
            {
              fee_id: 1,
              created_at: '2026-07-27T12:00:00.000Z',
              satisfied_at: '2026-07-27T12:00:00.000Z',
              period_key: '2027-07-27',
              ended_at: null,
              service_period_start: '2026-07-27',
              billing_subscription_id: 15,
            },
          ],
        }
      }
      return { rows: [] }
    },
  }

  const offer = await getAnnualMembershipOffer(pool, 62)
  assert.equal(offer.active, true)
  assert.equal(offer.renewsOn, '2027-07-27')
})

test('annual membership fee lookup requires and uses an explicit facility', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params })
      return {
        rows: [{
          id: 8,
          facility_id: 19,
          name: 'Facility 19 Annual Fee',
          amount_cents: 9900,
          apply_basis: 'per_year',
          trigger_type: 'once_per_year',
          active: true,
        }],
      }
    },
  }

  assert.equal(await loadAnnualMembershipFee(pool, null), null)
  const fee = await loadAnnualMembershipFee(pool, 19)
  assert.equal(fee.id, 8)
  assert.deepEqual(calls[0].params, [19])
  assert.equal(calls[0].sql.includes('SELECT id FROM facility LIMIT 1'), false)
})

test('annual membership member access uses canonical active household and facility scope', async () => {
  let captured
  const pool = {
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return {
        rows: [{
          id: '75',
          family_id: '42',
          facility_id: '9',
          first_name: 'Avery',
          last_name: 'Rivera',
        }],
      }
    },
  }

  const access = await ensureAnnualMembershipFamilyMemberAccess(pool, {
    familyId: 42,
    memberId: 75,
    facilityId: 9,
  })
  assert.equal(access.ok, true)
  assert.deepEqual(captured.params, [42, 75, 9])
  assert.match(captured.sql, /member\.facility_id = family\.facility_id/)
  assert.match(captured.sql, /annual_membership_family\.is_active = TRUE/)
  assert.match(captured.sql, /NOT EXISTS/)
  assert.match(captured.sql, /annual_membership_family_history\.member_id = member\.id/)
})

test('inactive billing accounts are rejected before annual membership reads or Stripe work', async () => {
  let queried = false
  const pool = {
    async query() {
      queried = true
      return { rows: [] }
    },
  }

  await assert.rejects(
    priceAnnualMembershipSelections(pool, {
      account: {
        id: 5,
        family_id: 42,
        family_facility_id: 9,
        payer_member_id: 74,
        is_active: false,
      },
      memberIds: [75],
      payerMemberId: 74,
    }),
    /not active/i,
  )
  assert.equal(queried, false)
})

test('stale paid subscription-mode annual checkout records cash before quarantine', async () => {
  const calls = []
  const { request, session } = paidAnnualCheckoutFixture()
  session.mode = 'subscription'
  session.subscription = { id: 'sub_annual_stale' }
  let payment = null
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] }
      if (text.includes('FROM annual_membership_checkout_request WHERE id')) {
        return { rows: [request] }
      }
      if (text.includes('INSERT INTO billing_payment')) {
        payment = {
          id: 602,
          family_billing_account_id: 8,
          amount_cents: 8500,
          external_processor: 'stripe',
          external_status: params[10],
          stripe_customer_id: 'cus_historical',
          stripe_payment_intent_id: 'pi_annual_paid',
          stripe_checkout_session_id: 'cs_annual_paid',
          stripe_invoice_id: null,
          newly_inserted: true,
          note: params[11],
        }
        return { rows: [payment] }
      }
      if (text.includes('FROM billing_payment p')) return { rows: payment ? [payment] : [] }
      if (text.includes('FROM billing_payment WHERE stripe_payment_intent_id')) {
        return { rows: payment ? [payment] : [] }
      }
      if (text.includes('UPDATE annual_membership_checkout_request')) {
        request.status = 'quarantined'
        request.error_message = params[1]
        return { rows: [{ status: 'quarantined' }] }
      }
      if (text.includes('UPDATE billing_payment')) {
        payment = { ...payment, external_status: 'reconciliation_required', note: params[8] }
        return { rows: [payment] }
      }
      if (text.includes('INSERT INTO stripe_billing_alert')) return { rows: [] }
      throw new Error(`Unexpected annual quarantine query: ${text}`)
    },
  }

  assert.equal(annualMembershipCheckoutSessionIsPaid(session), false)
  const result = await commitAnnualMembershipCheckout(pool, { stripeSession: session })
  assert.equal(result.status, 'quarantined')
  assert.equal(result.reason, 'forbidden_subscription_checkout')
  assert.equal(result.payment.external_status, 'reconciliation_required')
  const paymentWriteIndex = calls.findIndex(({ text }) => text.includes('INSERT INTO billing_payment'))
  const forbiddenAlertIndex = calls.findIndex(({ text }) => text.includes('INSERT INTO stripe_billing_alert'))
  assert.ok(paymentWriteIndex >= 0 && forbiddenAlertIndex > paymentWriteIndex)
  assert.equal(calls.some(({ text }) => /INSERT INTO billing_charge/.test(text)), false)
  assert.equal(calls.filter(({ text }) => text.includes('INSERT INTO stripe_billing_alert')).length, 2)
  const quarantineBegin = calls.findIndex(({ text }) => text === 'BEGIN')
  const ownerQuarantine = calls.findIndex(({ text }) => text.includes('UPDATE annual_membership_checkout_request'))
  const paymentQuarantine = calls.findIndex(({ text }) => text.includes('UPDATE billing_payment'))
  const quarantineCommit = calls.findIndex(({ text }, index) => index > paymentQuarantine && text === 'COMMIT')
  assert.ok(
    quarantineBegin >= 0
    && quarantineBegin < ownerQuarantine
    && ownerQuarantine < paymentQuarantine
    && paymentQuarantine < quarantineCommit,
  )
})

function paidAnnualCheckoutFixture() {
  const snapshot = {
    version: 1,
    currency: 'usd',
    members: [{
      memberId: 62,
      feeId: 4,
      feeName: 'Annual Membership',
      triggerType: 'once_per_year',
      applyBasis: 'per_year',
      grossCents: 8500,
      discountCents: 0,
      netCents: 8500,
      promo: null,
    }],
    expectedAmountCents: 8500,
  }
  const pricingHash = checkoutFingerprint(snapshot)
  const request = {
    id: 77,
    family_billing_account_id: 8,
    payer_member_id: 13,
    pricing_snapshot: snapshot,
    pricing_snapshot_hash: pricingHash,
    currency: 'usd',
    expected_amount_cents: 8500,
    stripe_checkout_session_id: 'cs_annual_paid',
    status: 'pending',
  }
  const session = {
    id: 'cs_annual_paid',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 8500,
    currency: 'usd',
    customer: 'cus_historical',
    payment_intent: 'pi_annual_paid',
    created: 1_788_200_000,
    metadata: {
      checkoutType: 'annual_membership',
      familyBillingAccountId: '8',
      memberId: '62',
      memberIds: '62',
      payerMemberId: '13',
      feeId: '4',
      amountCents: '8500',
      annualMembershipCheckoutRequestId: '77',
      pricingSnapshotHash: pricingHash,
    },
  }
  return { request, session, snapshot }
}

test('paid annual settlement binds to its immutable request without the current customer link', () => {
  const { request, session, snapshot } = paidAnnualCheckoutFixture()
  assert.deepEqual(validateAnnualMembershipPaidSettlementBinding(session, request, snapshot), {
    ok: true,
    requestId: 77,
    accountId: 8,
    payerMemberId: 13,
    customerId: 'cus_historical',
    paidMembers: [62],
  })
  const mismatch = validateAnnualMembershipPaidSettlementBinding(
    { ...session, id: 'cs_foreign' },
    request,
    snapshot,
  )
  assert.equal(mismatch.ok, false)
  assert.ok(mismatch.problems.includes('checkout_session_mismatch'))
})

test('paid annual cash is recorded before current authorization drift is quarantined', async (t) => {
  for (const scenario of [
    { name: 'inactive account', expectedReason: 'account_inactive' },
    { name: 'remapped customer', expectedReason: 'settlement_customer_mismatch', customerId: 'cus_remapped' },
    { name: 'changed payer', expectedReason: 'payer_mismatch', payerMemberId: 99 },
    { name: 'removed athlete', expectedReason: 'member_scope_invalid', denyMemberId: 62 },
  ]) {
    await t.test(scenario.name, async () => {
      const { request, session } = paidAnnualCheckoutFixture()
      const calls = []
      let insertCount = 0
      let paymentStatus = 'settled'
      let paymentNote = null
      const pool = {
        async query(sql, params = []) {
          const text = String(sql)
          calls.push({ text, params })
          if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
          if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
          if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] }
          if (/FROM annual_membership_checkout_request WHERE id/.test(text)) {
            return { rows: [{ ...request }] }
          }
          if (/INSERT INTO billing_payment/.test(text)) {
            insertCount += 1
            return {
              rows: [{
                id: 601,
                family_billing_account_id: params[0],
                amount_cents: params[1],
                external_processor: 'stripe',
                external_status: insertCount === 1 ? params[10] : paymentStatus,
                stripe_customer_id: params[4],
                stripe_payment_intent_id: params[5],
                stripe_checkout_session_id: params[6],
                stripe_invoice_id: params[7],
                newly_inserted: insertCount === 1,
                note: insertCount === 1 ? params[11] : paymentNote,
              }],
            }
          }
          if (/SELECT account\.\*, family\.facility_id/.test(text)) {
            if (scenario.expectedReason === 'account_inactive') return { rows: [] }
            return {
              rows: [{
                id: 8,
                family_id: 20,
                family_facility_id: 9,
                payer_member_id: scenario.payerMemberId ?? 13,
                stripe_customer_id: scenario.customerId ?? 'cus_historical',
                is_active: true,
              }],
            }
          }
          if (/FROM family\s+JOIN member/.test(text)) {
            const memberId = Number(params[1])
            if (memberId === Number(scenario.denyMemberId)) return { rows: [] }
            return { rows: [{ id: memberId, family_id: 20, facility_id: 9 }] }
          }
          if (/UPDATE annual_membership_checkout_request/.test(text) && /RETURNING status/.test(text)) {
            request.status = 'quarantined'
            request.error_message = params[1]
            return { rows: [{ status: 'quarantined' }] }
          }
          if (/UPDATE billing_payment/.test(text)) {
            paymentStatus = 'reconciliation_required'
            paymentNote = params[8]
            return { rows: [{
              id: 601,
              family_billing_account_id: 8,
              amount_cents: 8500,
              external_processor: 'stripe',
              external_status: paymentStatus,
              stripe_customer_id: 'cus_historical',
              stripe_payment_intent_id: 'pi_annual_paid',
              stripe_checkout_session_id: 'cs_annual_paid',
              stripe_invoice_id: null,
              note: paymentNote,
            }] }
          }
          if (/INSERT INTO stripe_billing_alert/.test(text)) return { rows: [] }
          throw new Error(`Unexpected paid annual quarantine query: ${text}`)
        },
      }

      const result = await commitAnnualMembershipCheckout(pool, {
        stripeSession: session,
        accountId: 8,
      })
      assert.equal(result.status, 'quarantined')
      assert.equal(result.reason, scenario.expectedReason)
      assert.equal(result.payment.id, 601)
      assert.equal(result.payment.external_status, 'reconciliation_required')
      const paymentWriteIndex = calls.findIndex(({ text }) => /INSERT INTO billing_payment/.test(text))
      const currentAccountIndex = calls.findIndex(({ text }) => /SELECT account\.\*/.test(text))
      assert.ok(paymentWriteIndex >= 0 && paymentWriteIndex < currentAccountIndex)
      assert.equal(calls.some(({ text }) => /INSERT INTO billing_charge/.test(text)), false)
      assert.equal(calls.some(({ text }) => /preserveEnrollmentCheckoutPaymentMethod/.test(text)), false)
      assert.equal(calls.filter(({ text }) => /INSERT INTO stripe_billing_alert/.test(text)).length, 1)

      const replay = await commitAnnualMembershipCheckout(pool, {
        stripeSession: session,
        accountId: 8,
      })
      assert.equal(replay.status, 'quarantined')
      assert.equal(replay.reason, 'paid_checkout_refund_required')
      assert.equal(replay.payment.external_status, 'reconciliation_required')
      assert.equal(insertCount, 2)
      const alertWrites = calls.filter(({ text }) => /INSERT INTO stripe_billing_alert/.test(text))
      assert.equal(alertWrites.length, 2)
      assert.equal(new Set(alertWrites.map(({ params }) => params[0])).size, 1)
    })
  }
})

test('annual Checkout overlap remains blocked after the local expiry clock passes', async () => {
  const { snapshot } = paidAnnualCheckoutFixture()
  const calls = []
  const pool = {
    async query(sql) {
      const text = String(sql)
      calls.push(text)
      if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] }
      if (/FROM annual_membership_checkout_request/.test(text) && /request_key = \$2/.test(text)) {
        return { rows: [] }
      }
      if (/SELECT owner_kind, owner_id, owner_status/.test(text)) return { rows: [] }
      if (/WITH completed_owner AS/.test(text)) return { rows: [] }
      if (/FROM additional_fee_redemption r/.test(text)) return { rows: [] }
      if (/SELECT request\.id/.test(text) && /jsonb_array_elements/.test(text)) {
        assert.doesNotMatch(text, /expires_at\s*>\s*now\(\)/)
        return { rows: [{ id: 91 }] }
      }
      throw new Error(`Unexpected annual overlap query: ${text}`)
    },
  }

  await assert.rejects(
    createAnnualRequestAndActivateWaived(pool, {
      account: { id: 8, family_id: 20 },
      payerMemberId: 13,
      requestKey: 'new-annual-key',
      requestFingerprint: 'a'.repeat(64),
      snapshot,
    }),
    /already open/i,
  )
  assert.equal(calls.some((text) => /INSERT INTO annual_membership_checkout_request/.test(text)), false)
})

test('annual Checkout creation rejects a nonterminal enrollment purchase owner', async () => {
  const { snapshot } = paidAnnualCheckoutFixture()
  let overlapQueryReached = false
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] }
      if (/FROM annual_membership_checkout_request/.test(text) && /request_key = \$2/.test(text)) {
        return { rows: [] }
      }
      if (/SELECT owner_kind, owner_id, owner_status/.test(text)) {
        return {
          rows: [{ owner_kind: 'enrollment', owner_id: 44, owner_status: 'pending' }],
        }
      }
      if (/FROM additional_fee_redemption r/.test(text)) return { rows: [] }
      if (/SELECT request\.id/.test(text) && /jsonb_array_elements/.test(text)) {
        overlapQueryReached = true
      }
      throw new Error(`Unexpected annual cross-flow query: ${text}`)
    },
  }

  await assert.rejects(
    createAnnualRequestAndActivateWaived(pool, {
      account: { id: 8, family_id: 20 },
      payerMemberId: 13,
      requestKey: 'new-annual-key',
      requestFingerprint: 'b'.repeat(64),
      snapshot,
    }),
    /payable enrollment or annual-membership Checkout/i,
  )
  assert.equal(overlapQueryReached, false)
})

test('waived annual activation rejects a nonterminal enrollment purchase owner', async () => {
  const { snapshot: paidSnapshot } = paidAnnualCheckoutFixture()
  const snapshot = {
    ...paidSnapshot,
    expectedAmountCents: 0,
    members: paidSnapshot.members.map((member) => ({
      ...member,
      discountCents: member.grossCents,
      netCents: 0,
      promo: { code: 'WAIVED', ruleId: 91 },
    })),
  }
  let inserted = false
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] }
      if (/FROM annual_membership_checkout_request/.test(text) && /request_key = \$2/.test(text)) {
        return { rows: [] }
      }
      if (/SELECT owner_kind, owner_id, owner_status/.test(text)) {
        return {
          rows: [{ owner_kind: 'enrollment', owner_id: 44, owner_status: 'pending' }],
        }
      }
      if (/FROM additional_fee_redemption r/.test(text)) return { rows: [] }
      if (/INSERT INTO annual_membership_checkout_request/.test(text)) inserted = true
      throw new Error(`Unexpected waived annual cross-flow query: ${text}`)
    },
  }

  await assert.rejects(
    createAnnualRequestAndActivateWaived(pool, {
      account: { id: 8, family_id: 20 },
      payerMemberId: 13,
      requestKey: 'waived-annual-key',
      requestFingerprint: 'd'.repeat(64),
      snapshot,
    }),
    /payable enrollment or annual-membership Checkout/i,
  )
  assert.equal(inserted, false)
})

test('annual creation resumes the exact durable request before checking competing owners', async () => {
  const { request, snapshot } = paidAnnualCheckoutFixture()
  const requestFingerprint = 'e'.repeat(64)
  Object.assign(request, {
    request_key: 'same-annual-key',
    request_fingerprint: requestFingerprint,
  })
  let commonAdmissionQueried = false
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] }
      if (/FROM annual_membership_checkout_request/.test(text) && /request_key = \$2/.test(text)) {
        return { rows: [request] }
      }
      if (/SELECT owner_kind, owner_id, owner_status/.test(text)) {
        commonAdmissionQueried = true
      }
      throw new Error(`Unexpected annual same-key replay query: ${text}`)
    },
  }

  const replay = await createAnnualRequestAndActivateWaived(pool, {
    account: { id: 8, family_id: 20 },
    payerMemberId: 13,
    requestKey: request.request_key,
    requestFingerprint,
    snapshot,
  })
  assert.equal(replay.id, request.id)
  assert.equal(commonAdmissionQueried, false)
})

test('annual creation rechecks active membership after stale pricing under the account lock', async () => {
  const { snapshot } = paidAnnualCheckoutFixture()
  let inserted = false
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] }
      if (/FROM annual_membership_checkout_request/.test(text) && /request_key = \$2/.test(text)) {
        return { rows: [] }
      }
      if (/SELECT owner_kind, owner_id, owner_status/.test(text)) return { rows: [] }
      if (/WITH completed_owner AS/.test(text)) return { rows: [] }
      if (/FROM additional_fee_redemption r/.test(text)) {
        return {
          rows: [{
            fee_id: 4,
            created_at: '2026-09-03T12:00:00.000Z',
            satisfied_at: '2026-09-03T12:00:00.000Z',
            period_key: '2027-09-03',
            ended_at: null,
            service_period_start: '2026-09-03',
            billing_subscription_id: 17,
          }],
        }
      }
      if (/INSERT INTO annual_membership_checkout_request/.test(text)) inserted = true
      throw new Error(`Unexpected stale annual pricing query: ${text}`)
    },
  }

  await assert.rejects(
    createAnnualRequestAndActivateWaived(pool, {
      account: { id: 8, family_id: 20 },
      payerMemberId: 13,
      requestKey: 'stale-annual-price',
      requestFingerprint: 'f'.repeat(64),
      snapshot,
    }),
    /already has an active annual membership/i,
  )
  assert.equal(inserted, false)
})

test('annual creation fails closed when the lock-scoped membership recheck cannot run', async () => {
  const { snapshot } = paidAnnualCheckoutFixture()
  let inserted = false
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] }
      if (/FROM annual_membership_checkout_request/.test(text) && /request_key = \$2/.test(text)) {
        return { rows: [] }
      }
      if (/SELECT owner_kind, owner_id, owner_status/.test(text)) return { rows: [] }
      if (/WITH completed_owner AS/.test(text)) return { rows: [] }
      if (/FROM additional_fee_redemption r/.test(text)) {
        const error = new Error('simulated membership recheck failure')
        error.code = '08006'
        throw error
      }
      if (/INSERT INTO annual_membership_checkout_request/.test(text)) inserted = true
      throw new Error(`Unexpected failed annual membership recheck query: ${text}`)
    },
  }

  await assert.rejects(
    createAnnualRequestAndActivateWaived(pool, {
      account: { id: 8, family_id: 20 },
      payerMemberId: 13,
      requestKey: 'failed-membership-recheck',
      requestFingerprint: '1'.repeat(64),
      snapshot,
    }),
    /simulated membership recheck failure/,
  )
  assert.equal(inserted, false)
})

test('annual Checkout persists exact Stripe expiry for request and promo reservation atomically', async () => {
  const { request, session, snapshot } = paidAnnualCheckoutFixture()
  const requestFingerprint = 'c'.repeat(64)
  Object.assign(request, {
    request_key: 'annual-request-77',
    request_fingerprint: requestFingerprint,
  })
  Object.assign(session, {
    status: 'expired',
    payment_status: 'unpaid',
    expires_at: 2_000_000_123,
    url: null,
  })
  const writes = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] }
      if (/SELECT request\.\*, account\.stripe_customer_id/.test(text)) {
        return {
          rows: [{
            ...request,
            pricing_snapshot: snapshot,
            is_active: false,
            stripe_customer_id: 'cus_changed',
            stripe_customer_owner_count: 2,
          }],
        }
      }
      if (/UPDATE annual_membership_checkout_request/.test(text)) {
        writes.push({ text, params })
        return {
          rows: [{
            ...request,
            status: 'expired',
            expires_at: new Date(params[4] * 1000),
            stripe_checkout_session_url: null,
          }],
        }
      }
      if (/UPDATE annual_membership_checkout_promo_reservation/.test(text)) {
        writes.push({ text, params })
        return { rows: [] }
      }
      throw new Error(`Unexpected annual state query: ${text}`)
    },
  }

  assert.equal(
    assertAnnualMembershipCheckoutSessionBinding(session, request, snapshot),
    true,
  )
  const updated = await persistAnnualMembershipCheckoutSessionState(pool, {
    request,
    session,
    requestFingerprint,
    payerMemberId: 13,
  })
  assert.equal(updated.status, 'expired')
  assert.equal(updated.expires_at.toISOString(), '2033-05-18T03:35:23.000Z')
  assert.equal(writes.length, 2)
  assert.match(writes[0].text, /expires_at = to_timestamp/)
  assert.match(writes[1].text, /annual_membership_checkout_promo_reservation/)
  assert.deepEqual(writes[1].params, [77, 2_000_000_123])
})

test('paid annual fulfillment freezes non-cooperating authorization mutations through commit', () => {
  const source = String(commitAnnualMembershipCheckout)
  const transactionAt = source.indexOf("await db.query('BEGIN')")
  const membershipLockAt = source.indexOf('LOCK TABLE family_member IN SHARE MODE')
  const requestLockAt = source.indexOf('FOR UPDATE OF request', membershipLockAt)
  const accountLockAt = source.indexOf('FOR SHARE OF account, household_family', requestLockAt)
  const memberLockAt = source.indexOf('WHERE member.id = ANY($1::bigint[])', accountLockAt)
  const lockedAccountReadAt = source.indexOf('loadActiveAnnualMembershipAccount(db', memberLockAt)
  const entitlementAt = source.indexOf('persistAnnualMembershipLedger(db', lockedAccountReadAt)
  const exactPaymentAt = source.indexOf('applyAndSettlePaidCheckoutFulfillment(db', entitlementAt)
  const ownerCompleteAt = source.indexOf("SET status = 'completed'", exactPaymentAt)
  const commitAt = source.indexOf("await db.query('COMMIT')", ownerCompleteAt)

  assert.ok(transactionAt >= 0)
  assert.ok(transactionAt < membershipLockAt)
  assert.ok(membershipLockAt < requestLockAt)
  assert.ok(requestLockAt < accountLockAt)
  assert.ok(accountLockAt < memberLockAt)
  assert.ok(memberLockAt < lockedAccountReadAt)
  assert.ok(lockedAccountReadAt < entitlementAt)
  assert.ok(entitlementAt < exactPaymentAt)
  assert.ok(exactPaymentAt < ownerCompleteAt)
  assert.ok(ownerCompleteAt < commitAt)
  assert.match(source.slice(exactPaymentAt, ownerCompleteAt), /manageTransaction: false/)
})
