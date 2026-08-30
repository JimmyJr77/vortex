import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMembershipFirstAllocationPlan } from '../paymentAllocation.js'

const settled = (id, amountCents, paidAt) => ({ id, amountCents, paidAt, status: 'settled' })
const charge = (id, amountCents, createdAt, isAnnualMembership = false) => ({
  id,
  amountCents,
  createdAt,
  servicePeriodStart: createdAt.slice(0, 10),
  isAnnualMembership,
})

test('Barnett repair applies membership first, two class payments next, and leaves one class due', () => {
  const charges = [
    charge(29, 7125, '2026-08-26T10:00:00Z'),
    charge(30, 7125, '2026-08-26T10:01:00Z'),
    charge(31, 7125, '2026-08-26T10:02:00Z'),
    charge(26, 8500, '2026-08-27T10:00:00Z', true),
  ]
  const payments = [
    settled(24, 8500, '2026-08-27T11:00:00Z'),
    settled(36, 7125, '2026-08-30T11:00:00Z'),
    settled(37, 7125, '2026-08-30T11:01:00Z'),
  ]
  const plan = buildMembershipFirstAllocationPlan({ payments, charges })

  assert.deepEqual(plan.map(({ paymentId, chargeId, amountCents }) => ({ paymentId, chargeId, amountCents })), [
    { paymentId: 24, chargeId: 26, amountCents: 8500 },
    { paymentId: 36, chargeId: 29, amountCents: 7125 },
    { paymentId: 37, chargeId: 30, amountCents: 7125 },
  ])
  const charged = charges.reduce((sum, item) => sum + item.amountCents, 0)
  const paid = payments.reduce((sum, item) => sum + item.amountCents, 0)
  assert.equal(charged - paid, 7125)
})

test('database Date objects are allocated in chronological payment order', () => {
  const plan = buildMembershipFirstAllocationPlan({
    payments: [
      settled(24, 8500, new Date('2026-08-27T03:46:58Z')),
      settled(36, 7125, new Date('2026-08-30T08:32:32Z')),
    ],
    charges: [
      charge(22, 8500, '2026-08-27T03:46:58Z', true),
      charge(29, 7125, '2026-08-26T10:00:00Z'),
    ],
  })
  assert.deepEqual(plan.map(({ paymentId, chargeId }) => ({ paymentId, chargeId })), [
    { paymentId: 24, chargeId: 22 },
    { paymentId: 36, chargeId: 29 },
  ])
})

test('membership fees can be partially funded by several payments before tuition', () => {
  const plan = buildMembershipFirstAllocationPlan({
    payments: [settled(1, 4000, '2026-01-02'), settled(2, 6000, '2026-01-03')],
    charges: [charge(10, 8500, '2026-01-01', true), charge(11, 5000, '2025-12-01')],
  })
  assert.deepEqual(plan.map(({ chargeId, amountCents }) => ({ chargeId, amountCents })), [
    { chargeId: 10, amountCents: 4000 },
    { chargeId: 10, amountCents: 4500 },
    { chargeId: 11, amountCents: 1500 },
  ])
})

test('all sibling membership fees precede older tuition charges', () => {
  const plan = buildMembershipFirstAllocationPlan({
    payments: [settled(1, 17000, '2026-01-05')],
    charges: [
      charge(1, 20000, '2025-12-01'),
      charge(2, 8500, '2026-01-02', true),
      charge(3, 8500, '2026-01-03', true),
    ],
  })
  assert.deepEqual(plan.map((item) => item.chargeId), [2, 3])
})

test('an exact custom-charge application stays pinned before general allocation', () => {
  const plan = buildMembershipFirstAllocationPlan({
    payments: [settled(1, 5000, '2026-01-02'), settled(2, 8500, '2026-01-03')],
    charges: [charge(10, 8500, '2026-01-01', true), charge(99, 5000, '2026-01-02')],
    applications: [{ paymentId: 1, chargeId: 99, amountCents: 5000, applicationKind: 'application' }],
  })
  assert.deepEqual(plan.map(({ paymentId, chargeId, amountCents }) => ({ paymentId, chargeId, amountCents })), [
    { paymentId: 2, chargeId: 10, amountCents: 8500 },
  ])
})

test('refunded money is not reallocated after its application is reversed', () => {
  const plan = buildMembershipFirstAllocationPlan({
    payments: [settled(1, 8500, '2026-01-02')],
    charges: [charge(10, 8500, '2026-01-01', true)],
    applications: [
      { paymentId: 1, chargeId: 10, amountCents: 8500, applicationKind: 'application' },
      { paymentId: 1, chargeId: 10, amountCents: 8500, applicationKind: 'reversal' },
    ],
    refunds: [{ paymentId: 1, amountCents: 8500, status: 'succeeded' }],
  })
  assert.deepEqual(plan, [])
})
