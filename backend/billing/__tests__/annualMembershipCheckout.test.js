import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ANNUAL_MEMBERSHIP_PROGRAM_NAME,
  ANNUAL_MEMBERSHIP_SPORT_NAME,
  getAnnualMembershipOffer,
} from '../annualMembershipCheckout.js'

test('membership catalog labels are stable for Sport/Program filters', () => {
  assert.equal(ANNUAL_MEMBERSHIP_SPORT_NAME, 'Membership')
  assert.equal(ANNUAL_MEMBERSHIP_PROGRAM_NAME, 'Annual Membership')
})

test('getAnnualMembershipOffer reports inactive when no membership window', async () => {
  const pool = {
    query: async (sql) => {
      if (String(sql).includes('FROM facility')) return { rows: [{ id: 1 }] }
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
})

test('getAnnualMembershipOffer marks active when annual subscription exists', async () => {
  const pool = {
    query: async (sql) => {
      if (String(sql).includes('FROM facility')) return { rows: [{ id: 1 }] }
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
      if (String(sql).includes('FROM billing_subscription')) {
        return {
          rows: [
            {
              id: 15,
              member_id: 62,
              source_id: '1:62',
              start_date: '2026-07-27',
              next_bill_date: '2027-07-27',
              status: 'active',
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
