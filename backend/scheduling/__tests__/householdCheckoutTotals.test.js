import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OrderPricingFacilityScopeError,
  resolveHouseholdCheckoutMonthlyTotals,
  resolveOrderPricingFacilityId,
} from '../orderPricing.js'

test('household checkout total uses full account list minus household discount', () => {
  // Maddox 2×$150 + Cannon $150 = $450; 20% family spend = $90 → $360
  const result = resolveHouseholdCheckoutMonthlyTotals({
    existingMonthlyTotal: 300,
    newSignupMonthlyTotal: 150,
    engineDiscountMonthly: 90,
  })
  assert.equal(result.monthlySubtotal, 450)
  assert.equal(result.estimatedMonthlyTotal, 360)
})

test('household checkout total does not subtract discount from cart-only subtotal', () => {
  // Regression: $150 cart − $90 household discount must not become $60
  const buggyCartOnly = 150 - 90
  assert.equal(buggyCartOnly, 60)
  const result = resolveHouseholdCheckoutMonthlyTotals({
    existingMonthlyTotal: 300,
    newSignupMonthlyTotal: 150,
    engineDiscountMonthly: 90,
  })
  assert.notEqual(result.estimatedMonthlyTotal, buggyCartOnly)
  assert.equal(result.estimatedMonthlyTotal, 360)
})

function facilityScopePool({ canonicalFamilyId = 7, memberFacilityId = 12, familyFacilityId = 12 } = {}) {
  return {
    async query(sql) {
      const text = String(sql)
      if (/WITH viewer AS/.test(text)) {
        return { rows: canonicalFamilyId == null ? [] : [{ family_id: canonicalFamilyId }] }
      }
      if (/FROM member\s+WHERE id = \$1/.test(text)) {
        return { rows: memberFacilityId == null ? [] : [{ facility_id: memberFacilityId }] }
      }
      if (/FROM family\s+WHERE id = \$1/.test(text)) {
        return { rows: familyFacilityId == null ? [] : [{ facility_id: familyFacilityId }] }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
}

test('order pricing accepts one matching family, member, and program facility', async () => {
  const facilityId = await resolveOrderPricingFacilityId(facilityScopePool(), {
    memberId: 9,
    familyId: 7,
    scopeMeta: new Map([['program:4', { programsId: 4, programRow: { facility_id: 12 } }]]),
  })
  assert.equal(facilityId, 12)
})

test('order pricing fails closed when program and household facilities differ', async () => {
  await assert.rejects(
    resolveOrderPricingFacilityId(facilityScopePool(), {
      memberId: 9,
      familyId: 7,
      scopeMeta: new Map([['program:4', { programsId: 4, programRow: { facility_id: 99 } }]]),
    }),
    (error) => {
      assert.ok(error instanceof OrderPricingFacilityScopeError)
      assert.match(error.message, /different facilities/i)
      assert.deepEqual(error.details.candidates.map((candidate) => candidate.facilityId), [12, 12, 99])
      return true
    },
  )
})

test('order pricing fails closed when a member has no canonical family', async () => {
  await assert.rejects(
    resolveOrderPricingFacilityId(facilityScopePool({ canonicalFamilyId: null }), {
      memberId: 9,
      scopeMeta: new Map([['program:4', { programsId: 4, programRow: { facility_id: 12 } }]]),
    }),
    /exactly one active billing family/i,
  )
})
