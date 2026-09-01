import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ANNUAL_MEMBERSHIP_PROGRAM_NAME,
  ANNUAL_MEMBERSHIP_SPORT_NAME,
  annualMembershipCheckoutSessionIsPaid,
  commitAnnualMembershipCheckout,
  ensureAnnualMembershipFamilyMemberAccess,
  getAnnualMembershipOffer,
  loadAnnualMembershipFee,
  priceAnnualMembershipSelections,
} from '../annualMembershipCheckout.js'

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

test('stale subscription-mode annual checkout is quarantined before membership writes', async () => {
  const calls = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('INSERT INTO stripe_billing_alert')) return { rows: [] }
      throw new Error(`Unexpected annual quarantine query: ${text}`)
    },
  }
  const session = {
    id: 'cs_annual_stale',
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    subscription: { id: 'sub_annual_stale' },
    metadata: {
      checkoutType: 'annual_membership',
      familyBillingAccountId: '8',
      memberId: '62',
      memberIds: '62',
      payerMemberId: '13',
      feeId: '4',
    },
  }

  assert.equal(annualMembershipCheckoutSessionIsPaid(session), false)
  await assert.rejects(
    commitAnnualMembershipCheckout(pool, { stripeSession: session }),
    (error) => (
      error?.code === 'STRIPE_CHECKOUT_SUBSCRIPTION_MODE_FORBIDDEN'
      && error.stripeSubscriptionId === 'sub_annual_stale'
    ),
  )
  assert.equal(calls.length, 1)
  assert.match(calls[0].text, /INSERT INTO stripe_billing_alert/)
  assert.match(String(calls[0].params[5]), /sub_annual_stale/)
  assert.equal(calls.some(({ text }) => /INSERT INTO billing_charge/.test(text)), false)
  assert.equal(calls.some(({ text }) => /billing_subscription/.test(text)), false)
})
