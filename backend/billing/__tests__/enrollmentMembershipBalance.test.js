import test from 'node:test'
import assert from 'node:assert/strict'
import { loadEnrollmentMembershipBills, includeMembershipBillsInBalance, validateEnrollmentMembershipBills, applyEnrollmentMembershipBills } from '../enrollmentMembershipBalance.js'
import { computeEnrollmentDueNowCents, computeEnrollmentCheckoutPurchaseCents } from '../stripeEnrollmentCheckout.js'
const bill = { chargeId: 675, accountId: 10949, memberId: 211, feeId: 1, amountCents: 8500, name: 'Annual Fee' }
const row = { id: 675, family_billing_account_id: 10949, member_id: 211, remaining_cents: 8500, description: 'Annual Fee' }

test('existing membership is included once with tuition and is not a new purchase', () => {
  const carriedForward = includeMembershipBillsInBalance({ items: [], totalCents: 0 }, [bill])
  const preview = { firstMonth: { totalCents: 10000 }, additionalFeesOneTime: 0, carriedForward }
  assert.equal(computeEnrollmentDueNowCents(preview), 18500)
  assert.equal(computeEnrollmentCheckoutPurchaseCents(preview), 10000)
  assert.equal(carriedForward.items[0].amountCents, 8500)
})
test('future pause credits cannot silently waive the enrollment membership', () => {
  const balance = includeMembershipBillsInBalance({ items: [], totalCents: -10000, creditsCents: 10000 }, [bill])
  assert.equal(balance.totalCents, 8500)
})
test('partly paid membership includes only its remaining balance', async () => {
  const bills = await loadEnrollmentMembershipBills({ async query(sql, args) {
    assert.deepEqual(args, [211, '1', 10949])
    assert.match(sql, /external_status IN \('settled','succeeded'\)/)
    assert.match(sql, /billing_charge_credit_application/)
    return { rows: [{ ...row, remaining_cents: 3500 }] }
  } }, { memberId: 211, feeId: 1, accountId: 10949 })
  assert.equal(includeMembershipBillsInBalance({ items: [], totalCents: 0 }, bills).totalCents, 3500)
})
test('checkout accepts the same existing bill but rejects changed balances', async () => {
  await validateEnrollmentMembershipBills({ query: async () => ({ rows: [row] }) }, { bills: [bill], accountId: 10949, memberId: 211 })
  await assert.rejects(validateEnrollmentMembershipBills({ query: async () => ({ rows: [{ ...row, remaining_cents: 5000 }] }) }, { bills: [bill], accountId: 10949, memberId: 211 }), /changed/)
})
test('settlement pins the membership payment to the athlete and replays without duplication', async () => {
  let stored = null; let writes = 0
  const db = { async query(sql, params) {
    if (sql.startsWith('SELECT * FROM billing_payment_application')) return { rows: stored ? [stored] : [] }
    if (sql.includes('enrollment-membership:existing-bills')) return { rows: [row] }
    if (sql.includes('AS available')) return { rows: [{ available: 8500 }] }
    if (sql.startsWith('INSERT INTO billing_payment_application')) {
      writes++
      stored = { billing_payment_id: params[0], billing_charge_id: params[1], amount_cents: params[2], application_kind: 'application' }
      return { rows: [] }
    }
    throw Error(sql)
  } }
  const options = { bills: [bill], accountId: 10949, memberId: 211, payment: { id: 99 } }
  await applyEnrollmentMembershipBills(db, options)
  await applyEnrollmentMembershipBills(db, options)
  assert.equal(writes, 1)
  assert.equal(stored.billing_charge_id, 675)
  await assert.rejects(applyEnrollmentMembershipBills(db, { ...options, memberId: 212 }), /ownership/)
})
test('settlement refuses to allocate money that is already spent', async () => {
  let writes = 0
  const db = { async query(sql) {
    if (sql.startsWith('SELECT * FROM billing_payment_application')) return { rows: [] }
    if (sql.includes('enrollment-membership:existing-bills')) return { rows: [row] }
    if (sql.includes('AS available')) return { rows: [{ available: 0 }] }
    writes++; return { rows: [] }
  } }
  await assert.rejects(applyEnrollmentMembershipBills(db, { bills: [bill], accountId: 10949, memberId: 211, payment: { id: 99 } }), /cannot cover/)
  assert.equal(writes, 0)
})

test('pricing adds membership automatically, or reuses an unpaid bill, across free classes', async () => {
  const { computeAdditionalFeesLayer } = await import('../../scheduling/orderPricing.js')
  const args = { facilityId: 1, memberId: 211, familyId: 106,
    newSignupItems: [{ slotKey: '38:288:364', formId: 38, billingType: 'recurring', incrementalMonthly: 0 }],
    formRows: new Map(), scopeMeta: new Map(), offeringBySlotGroup: new Map(), filteredNew: [],
    existingCount: 0, promoCodes: [] }
  let existing = false
  const db = { async query(sql) {
    if (sql.includes('SELECT * FROM additional_fee')) return { rows: [{ id: 1, amount_cents: 8500, name: 'Annual Fee', apply_basis: 'per_year', trigger_type: 'once_per_year', scope_level: 'global', active: true }] }
    if (sql.includes('enrollment-membership:existing-bills')) return { rows: existing ? [row] : [] }
    if (sql.includes('additional_fee_redemption')) return { rows: [] }
    throw Error(sql)
  } }
  const fresh = await computeAdditionalFeesLayer(db, args)
  assert.equal(fresh.totalOneTimeCents, 8500)
  assert.equal(fresh.items.length, 1)
  existing = true
  const reused = await computeAdditionalFeesLayer(db, args)
  assert.equal(reused.totalOneTimeCents, 0)
  assert.deepEqual(reused.existingMembershipBills, [bill])
})
