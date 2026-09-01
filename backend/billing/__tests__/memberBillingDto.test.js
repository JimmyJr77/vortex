import assert from 'node:assert/strict'
import test from 'node:test'

import { buildMemberBillingOverviewDto } from '../memberBillingDto.js'

test('member overview is an explicit allowlist without provider or administrator metadata', () => {
  const dto = buildMemberBillingOverviewDto({
    revision: 'r1',
    account: {
      id: 8,
      familyId: 7,
      familyName: 'Rivera',
      payerMemberId: 11,
      stripeCustomerId: 'cus_secret',
      isActive: true,
    },
    members: [{ id: 11, name: 'Jordan Rivera', email: 'private@example.com', phone: '555-0100' }],
    summary: { balanceCents: 12000, latestPayment: { id: 99, amountCents: 5000, paidAt: '2026-08-01', method: 'card' } },
    paymentMethod: {
      available: true,
      stripeEnabled: true,
      error: 'provider diagnostic',
      paymentMethod: { id: 'pm_secret', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 },
    },
    enrollments: [{
      id: 4,
      source: 'signup',
      memberId: 11,
      memberName: 'Jordan Rivera',
      class_name: 'Tornadoes',
      adjustedCostCents: 12000,
      stripeSubscriptionScheduleId: 'sub_sched_secret',
      priceSyncError: 'internal failure',
      activePriceAdjustment: { createdByUserId: 44, discountRuleSnapshot: { secret: true } },
      arbitraryRawColumn: 'must not leak',
    }],
    monthlyInvoices: [{
      id: 5,
      billingMonth: '2026-09-01',
      status: 'open',
      totalCents: 12000,
      stripeInvoiceId: 'in_secret',
      hostedInvoiceUrl: 'https://provider.test/in_secret',
      failureMessage: 'provider detail',
      lineCount: 1,
      postPaymentCreditCents: 6376,
    }],
    adjustments: [{ createdByUserId: 44 }],
    subscriptions: [{ stripeSubscriptionId: 'sub_secret' }],
    alerts: [{ stripeObjectId: 'in_secret' }],
  })

  assert.equal(dto.account.familyName, 'Rivera')
  assert.equal(dto.members[0].email, null)
  assert.equal(dto.paymentMethod.paymentMethod.last4, '4242')
  assert.equal(dto.enrollments[0].class_name, 'Tornadoes')
  assert.equal(dto.monthlyInvoices[0].totalCents, 12000)
  assert.equal(dto.monthlyInvoices[0].postPaymentCreditCents, 6376)
  assert.deepEqual(dto.alerts, [])
  assert.deepEqual(dto.adjustments, [])
  assert.deepEqual(dto.subscriptions, [])

  const serialized = JSON.stringify(dto)
  for (const forbidden of [
    'cus_secret',
    'pm_secret',
    'sub_secret',
    'sub_sched_secret',
    'in_secret',
    'provider diagnostic',
    'internal failure',
    'createdByUserId',
    'discountRuleSnapshot',
    'arbitraryRawColumn',
  ]) {
    assert.equal(serialized.includes(forbidden), false, `member DTO leaked ${forbidden}`)
  }
})
