import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adjustmentOverlapConflict,
  loadPostedSubscriptionAmountsByPeriod,
  postedPriceDifferenceCents,
  previewEnrollmentPriceAdjustment,
  resolvePromoAdjustment,
} from '../customerBillingAdjustments.js'

test('price adjustment enrollment scope follows canonical active household membership', async () => {
  let contextSql = ''
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (/information_schema\.tables/.test(text)) return { rows: [{ table_name: 'programs' }] }
      if (/table_name = 'program'/.test(text)) return { rows: [{ column_name: 'programs_id' }] }
      if (/table_name = 'scheduling_form'/.test(text)) {
        return { rows: [{ column_name: 'programs_id' }, { column_name: 'program_id' }] }
      }
      contextSql = text
      return { rows: [] }
    },
  }

  await assert.rejects(
    previewEnrollmentPriceAdjustment(pool, {
      signupId: 77,
      facilityId: 5,
      input: {
        kind: 'fixed_final_price',
        finalPriceCents: 10000,
        effectiveFromMonth: '2026-09-01',
        reason: 'Test adjustment',
      },
    }),
    /recurring enrollment could not be found/i,
  )

  assert.match(contextSql, /JOIN family_billing_account account/)
  assert.match(contextSql, /account\.id = bs\.family_billing_account_id/)
  assert.match(contextSql, /bs\.member_id = s\.member_id/)
  assert.match(contextSql, /FROM family_member adjustment_membership/)
  assert.match(contextSql, /adjustment_membership\.family_id = f\.id/)
  assert.match(contextSql, /adjustment_membership\.is_active = TRUE/)
  assert.match(contextSql, /NOT EXISTS[\s\S]*adjustment_membership_history/)
  assert.doesNotMatch(contextSql, /JOIN family f ON f\.id = m\.family_id/)
})

test('distinct stackable promo assignments may share an enrollment billing window', () => {
  const first = {
    kind: 'promo_code',
    promo_code: 'SAVE10',
    discount_rule_id: 10,
    discount_rule_snapshot: { stackable: true },
  }
  const second = {
    kind: 'promo_code',
    promoCode: 'SAVE20',
    discountRuleId: 20,
    discountRuleSnapshot: { stackable: true },
  }

  assert.equal(adjustmentOverlapConflict(first, second), null)
  assert.match(
    adjustmentOverlapConflict(first, { ...second, promoCode: 'save10' }),
    /already assigned/i,
  )
  assert.match(
    adjustmentOverlapConflict(first, { kind: 'fixed_final_price' }),
    /fixed final price/i,
  )
  assert.match(
    adjustmentOverlapConflict(first, {
      ...second,
      discountRuleSnapshot: { stackable: false },
    }),
    /non-stackable/i,
  )
  assert.match(
    adjustmentOverlapConflict(
      { ...first, discount_rule_snapshot: { stackable: true, exclusivityGroup: 'seasonal' } },
      { ...second, discountRuleSnapshot: { stackable: true, exclusivityGroup: 'seasonal' } },
    ),
    /exclusive discount group/i,
  )
})

test('billing managers may assign a globally scoped tuition promo without a public program allow-list', async () => {
  const queries = []
  const pool = {
    async query(sql) {
      queries.push(String(sql))
      if (/FROM discount_rule/.test(String(sql))) {
        return {
          rows: [{
            id: 9,
            facility_id: 1,
            name: '50% Off',
            description: null,
            type: 'promo_code',
            amount_type: 'percent',
            amount_value: 5000,
            apply_to: 'order_total',
            calc_base: 'pre',
            priority: 1,
            stackable: true,
            exclusivity_group: null,
            max_discount_cents: null,
            max_redemptions: null,
            redeemed_count: 0,
            scope_level: 'global',
            scope_ref_id: null,
            starts_at: '2026-01-01T05:00:00.000Z',
            ends_at: '2027-01-01T04:59:59.000Z',
            active: true,
            config: {
              code: '50OFFVORTEX26',
              eligibility_rules: [],
            },
          }],
        }
      }
      if (/FROM discount_redemption/.test(String(sql))) {
        return { rows: [{ total: 0, member_total: 0, family_total: 0 }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const promo = await resolvePromoAdjustment(
    pool,
    {
      facility_id: 1,
      member_id: 74,
      family_id: 48,
      sport_id: 1,
      program_id: 13,
      form_id: 29,
      offering_id: 271,
      responses: {},
    },
    '50offvortex26',
    '2026-08-01',
    null,
  )

  assert.equal(promo.code, '50OFFVORTEX26')
  assert.equal(promo.effectiveFrom, '2026-08-01')
  assert.equal(promo.effectiveThrough, '2026-12-01')
  assert.equal(promo.snapshot.expiresOn, '2027-01-01')
  assert.equal(
    queries.some((sql) => /pricing_benefit_selection|pricing_promo_codes/.test(sql)),
    false,
  )
  const redemptionSql = queries.find((sql) => /FROM discount_redemption/.test(sql)) ?? ''
  assert.match(redemptionSql, /FROM family_member redemption_membership/)
  assert.match(redemptionSql, /redemption_membership\.family_id = \$3/)
  assert.match(redemptionSql, /redemption_membership\.is_active = TRUE/)
  assert.match(redemptionSql, /NOT EXISTS[\s\S]*redemption_membership_history/)
  assert.doesNotMatch(redemptionSql, /SELECT id FROM member WHERE family_id = \$3/)
})

test('posted adjustment periods include enrollment-first-month and recurring-cycle charges', async () => {
  let queryText = ''
  let queryParams = []
  const pool = {
    async query(sql, params) {
      queryText = String(sql)
      queryParams = params
      return {
        rows: [
          { period_key: '2026-08', amount_cents: 7125 },
          { period_key: '2026-09', amount_cents: 12000 },
        ],
      }
    },
  }

  const posted = await loadPostedSubscriptionAmountsByPeriod(pool, {
    billingSubscriptionId: 27,
    effectiveFrom: '2026-08-01',
    effectiveThrough: '2026-09-01',
  })

  assert.match(queryText, /COALESCE\(service_period_start, created_at::date\)/)
  assert.match(queryText, /subscription_id = \$1/)
  assert.doesNotMatch(queryText, /source_type = 'billing_subscription'/)
  assert.deepEqual(queryParams, [27, '2026-08-01', '2026-09-01'])
  assert.equal(posted.get('2026-08'), 7125)
  assert.equal(posted.get('2026-09'), 12000)
})

test('a posted charge changes the ledger balance even when its service month is still upcoming', () => {
  assert.equal(postedPriceDifferenceCents(12000, 7125), 4875)
  assert.equal(postedPriceDifferenceCents(7125, 12000), -4875)
  assert.equal(postedPriceDifferenceCents(7125, null), 0)
})
