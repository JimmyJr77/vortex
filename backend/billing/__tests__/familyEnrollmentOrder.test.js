import test from 'node:test'
import assert from 'node:assert/strict'
import { combineFamilyDiscountContexts, familyMemberDiscounts, combineFamilyEnrollmentPreviews } from '../familyEnrollmentOrder.js'
import { computeEnrollmentDueNowCents } from '../stripeEnrollmentCheckout.js'

const rule = { id: 7, name: 'Family spend', type: 'spend_volume', active: true, amountType: 'percent', amountValue: 1000,
  applyTo: 'order_total', calcBase: 'post', priority: 100, stackable: true, config: {}, tiers: [
    { threshold: 25000, amountType: 'percent', amountValue: 1000, minPaidEnrollments: 2 },
    { threshold: 30000, amountType: 'percent', amountValue: 1500, minPaidEnrollments: 2 },
  ] }
const line = (memberId, key, baseCents) => ({ memberId, familyId: 1, key, baseCents, listCents: baseCents, finalCents: baseCents, formId: 1, programId: 1, includeInSubtotal: true })
const context = (memberId, lines, rules = [rule], caps = {}) => ({ memberId, context: { lines, rules, caps } })

test('siblings in the same class qualify together and keep separate fulfillment keys', () => {
  const combined = combineFamilyDiscountContexts([context(11, [line(11,'slot',15000)]), context(12,[line(12,'slot',15000)])])
  assert.equal(combined.totalDiscountCents, 4500)
  assert.equal(combined.lines.length, 2)
  const first = familyMemberDiscounts(combined,11), second = familyMemberDiscounts(combined,12)
  assert.equal(first.lines[0].key, 'slot')
  assert.equal(second.lines[0].key, 'slot')
  assert.equal(first.lines[0].finalCents + second.lines[0].finalCents,25500)
})

test('existing household classes count once and order discounts allocate once', () => {
  const existing = { ...line(10,'existing',15000), signupId: 98, shadowOnly: true, includeInSubtotal: false }
  const combined = combineFamilyDiscountContexts([context(11,[line(11,'slot',15000),existing]), context(12,[line(12,'slot',10000),existing])])
  assert.equal(combined.accountLines.length,1)
  assert.equal(combined.totalDiscountCents,6000)
  const totals = [11,12].map(id=>familyMemberDiscounts(combined,id).totalCents)
  assert.deepEqual(totals,[12750,8500])
})

test('promo caps distinguish siblings but enforce one shared family limit', () => {
  const promo = { ...rule, type: 'promo_code', applyTo: 'per_class', config: { code: 'SAVE', discountKind: 'amount', max_redemptions_per_member: 1 }, tiers: [] }
  const calculate = config => combineFamilyDiscountContexts([
    context(11,[line(11,'a',10000),line(11,'b',10000)],[{...promo,config}]),
    context(12,[line(12,'a',10000)],[{...promo,config}]),
  ],['SAVE'])
  assert.equal(calculate(promo.config).totalDiscountCents,2000)
  assert.equal(calculate({...promo.config,max_redemptions_per_family:1}).totalDiscountCents,1000)
  const prior = combineFamilyDiscountContexts([
    context(11,[line(11,'a',10000)],[promo],{ruleMemberRedeemed:{7:1}}),
    context(12,[line(12,'a',10000)],[promo],{ruleMemberRedeemed:{}}),
  ],['SAVE'])
  assert.equal(familyMemberDiscounts(prior,11).totalDiscountCents,0)
  assert.equal(familyMemberDiscounts(prior,12).totalDiscountCents,1000)
})

test('family due now includes each child fee and proration but carried balance only once', () => {
  const preview = { hasPricing: true, existingClasses: [], newSignups: [{ slotKey:'slot', displayLine:'Gymnastics' }], formSummaries: [],
    newSignupMonthlyTotal:150, additionalFeesMonthly:0, additionalFeesOneTime:85,
    firstMonth:{enabled:true,items:[{slotKey:'slot',proratedCents:3000}],totalCents:3000,totalProratedCents:3000,totalPrepaidCents:0},
    additionalFees:{enabled:true,items:[{name:'Annual Fee',amountCents:8500}],totalOneTimeCents:8500,totalMonthlyCents:0},
    carriedForward:{creditCents:0,debitCents:2000,totalCents:2000} }
  const combined = combineFamilyEnrollmentPreviews([{memberId:11,memberName:'One',preview},{memberId:12,memberName:'Two',preview}], { totalDiscountCents:4500 })
  assert.equal(combined.additionalFees.items.length,2)
  assert.equal(combined.firstMonth.totalCents,6000)
  assert.equal(combined.estimatedMonthlyTotal,255)
  assert.equal(computeEnrollmentDueNowCents(combined),25000)
  assert.notEqual(combined.newSignups[0].slotKey,combined.newSignups[1].slotKey)
})
