import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  annualMembershipPaidThroughDate,
  buildMembershipFirstAllocationPlan,
  endRefundedAnnualMembership,
  reverseRefundedApplicationsLocked,
} from '../paymentAllocation.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))

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

test('refund reversal retry resumes after its persisted slice without over-reversing', async () => {
  const applications = [
    {
      id: 101,
      billing_payment_id: 9,
      billing_charge_id: 41,
      amount_cents: 10000,
      application_kind: 'application',
      created_at: '2026-08-30T12:00:00Z',
    },
    {
      id: 102,
      billing_payment_id: 9,
      billing_charge_id: 41,
      amount_cents: 10000,
      application_kind: 'application',
      created_at: '2026-08-30T11:00:00Z',
    },
  ]
  const reversals = [{
    id: 201,
    billing_payment_id: 9,
    billing_charge_id: 41,
    amount_cents: 10000,
    application_kind: 'reversal',
    reverses_application_id: 101,
    idempotency_key: 'refund:77:application:101',
  }]
  let inserts = 0
  const db = {
    async query(sql, params = []) {
      const text = String(sql)
      if (/FROM billing_payment\s+WHERE/.test(text) && text.includes('FOR UPDATE')) {
        return { rows: [{ id: 9, family_billing_account_id: 7 }] }
      }
      if (text.includes('SELECT application.*')) return { rows: applications }
      if (text.includes('SELECT reversal.*')) return { rows: reversals.map((row) => ({ ...row })) }
      if (text.includes('INSERT INTO billing_payment_application')) {
        inserts += 1
        const row = {
          id: 201 + inserts,
          billing_payment_id: params[0],
          billing_charge_id: params[1],
          amount_cents: params[2],
          application_kind: 'reversal',
          reverses_application_id: params[3],
          idempotency_key: params[4],
        }
        reversals.push(row)
        return { rows: [row] }
      }
      throw new Error(`Unexpected refund-reversal query: ${text}`)
    },
  }
  const refund = {
    id: 77,
    family_billing_account_id: 7,
    payment_id: 9,
    related_charge_id: 41,
    ledger_treatment: 'reverse_charge',
    amount_cents: 15000,
  }

  const resumed = await reverseRefundedApplicationsLocked(db, { refund })
  const replayed = await reverseRefundedApplicationsLocked(db, { refund })

  assert.equal(inserts, 1)
  assert.equal(reversals.reduce((sum, row) => sum + row.amount_cents, 0), 15000)
  assert.deepEqual(resumed.map((row) => row.amount_cents), [10000, 5000])
  assert.deepEqual(replayed.map((row) => row.amount_cents), [10000, 5000])
})

test('refund reversal fails closed when locked applications cannot cover an exact charge refund', async () => {
  const db = {
    async query(sql) {
      const text = String(sql)
      if (/FROM billing_payment\s+WHERE/.test(text) && text.includes('FOR UPDATE')) {
        return { rows: [{ id: 9, family_billing_account_id: 7 }] }
      }
      if (text.includes('SELECT application.*')) {
        return {
          rows: [{
            id: 101,
            billing_payment_id: 9,
            billing_charge_id: 41,
            amount_cents: 5000,
            application_kind: 'application',
            created_at: '2026-08-30T12:00:00Z',
          }],
        }
      }
      if (text.includes('SELECT reversal.*')) return { rows: [] }
      if (text.includes('INSERT INTO billing_payment_application')) {
        return {
          rows: [{
            id: 201,
            billing_payment_id: 9,
            billing_charge_id: 41,
            amount_cents: 5000,
            application_kind: 'reversal',
            reverses_application_id: 101,
            idempotency_key: 'refund:77:application:101',
          }],
        }
      }
      throw new Error(`Unexpected refund-reversal query: ${text}`)
    },
  }

  await assert.rejects(
    reverseRefundedApplicationsLocked(db, {
      refund: {
        id: 77,
        family_billing_account_id: 7,
        payment_id: 9,
        related_charge_id: 41,
        ledger_treatment: 'reverse_charge',
        amount_cents: 10000,
      },
    }),
    (error) => error?.code === 'REFUND_SELECTED_CHARGE_APPLICATION_DRIFT',
  )
})

test('refund reversal decrements remaining only after an exact conflict replay is loaded', async () => {
  const application = {
    id: 101,
    billing_payment_id: 9,
    billing_charge_id: 41,
    amount_cents: 10000,
    application_kind: 'application',
    created_at: '2026-08-30T12:00:00Z',
  }
  const replayed = {
    id: 201,
    billing_payment_id: 9,
    billing_charge_id: 41,
    amount_cents: 10000,
    application_kind: 'reversal',
    reverses_application_id: 101,
    idempotency_key: 'refund:77:application:101',
  }
  const calls = []
  const db = {
    async query(sql) {
      const text = String(sql)
      calls.push(text)
      if (/FROM billing_payment\s+WHERE/.test(text)) return { rows: [{ id: 9, family_billing_account_id: 7 }] }
      if (text.includes('SELECT application.*')) return { rows: [application] }
      if (text.includes('SELECT reversal.*')) return { rows: [] }
      if (text.includes('INSERT INTO billing_payment_application')) return { rows: [] }
      if (text.includes('WHERE idempotency_key = $1')) return { rows: [replayed] }
      throw new Error(`Unexpected refund conflict-replay query: ${text}`)
    },
  }

  const result = await reverseRefundedApplicationsLocked(db, {
    refund: {
      id: 77,
      family_billing_account_id: 7,
      payment_id: 9,
      related_charge_id: 41,
      ledger_treatment: 'reverse_charge',
      amount_cents: 10000,
    },
  })

  assert.deepEqual(result, [replayed])
  assert.ok(calls.some((sql) => sql.includes('WHERE idempotency_key = $1')))
})

function overpaymentReversalDb({ paymentCents, applicationCents, refundCents, existingReversals = [] }) {
  const reversals = existingReversals.map((row) => ({ ...row }))
  let inserts = 0
  return {
    get inserts() { return inserts },
    reversals,
    async query(sql, params = []) {
      const text = String(sql)
      if (/FROM billing_payment\s+WHERE/.test(text)) {
        return { rows: [{ id: 9, family_billing_account_id: 7, amount_cents: paymentCents }] }
      }
      if (text.includes('SELECT application.*')) {
        return {
          rows: applicationCents > 0
            ? [{
                id: 101,
                billing_payment_id: 9,
                billing_charge_id: 41,
                amount_cents: applicationCents,
                application_kind: 'application',
                created_at: '2026-08-30T12:00:00Z',
              }]
            : [],
        }
      }
      if (text.includes('SELECT reversal.*')) return { rows: reversals.map((row) => ({ ...row })) }
      if (text.includes('FROM billing_refund')) return { rows: [{ id: 77, amount_cents: refundCents }] }
      if (text.includes('INSERT INTO billing_payment_application')) {
        inserts += 1
        const row = {
          id: 201 + inserts,
          billing_payment_id: params[0],
          billing_charge_id: params[1],
          amount_cents: params[2],
          application_kind: 'reversal',
          reverses_application_id: params[3],
          idempotency_key: params[4],
        }
        reversals.push(row)
        return { rows: [row] }
      }
      throw new Error(`Unexpected overpayment-reversal query: ${text}`)
    },
  }
}

test('return-overpayment leaves valid applications intact when the selected payment has unapplied cash', async () => {
  const db = overpaymentReversalDb({ paymentCents: 10000, applicationCents: 8000, refundCents: 2000 })
  const result = await reverseRefundedApplicationsLocked(db, {
    refund: {
      id: 77,
      family_billing_account_id: 7,
      payment_id: 9,
      ledger_treatment: 'return_overpayment',
      amount_cents: 2000,
    },
  })

  assert.deepEqual(result, [])
  assert.equal(db.inserts, 0)
})

test('return-overpayment reverses only the selected payment over-application and replays exactly', async () => {
  const db = overpaymentReversalDb({ paymentCents: 10000, applicationCents: 10000, refundCents: 2000 })
  const refund = {
    id: 77,
    family_billing_account_id: 7,
    payment_id: 9,
    ledger_treatment: 'return_overpayment',
    amount_cents: 2000,
  }

  const first = await reverseRefundedApplicationsLocked(db, { refund })
  const replay = await reverseRefundedApplicationsLocked(db, { refund })

  assert.equal(db.inserts, 1)
  assert.deepEqual(first.map((row) => row.amount_cents), [2000])
  assert.deepEqual(replay.map((row) => row.amount_cents), [2000])
})

test('reverse-charge fails closed rather than spilling onto another charge application', async () => {
  const applications = [
    { id: 101, billing_payment_id: 9, billing_charge_id: 41, amount_cents: 5000, application_kind: 'application', created_at: '2026-08-30T12:00:00Z' },
    { id: 102, billing_payment_id: 9, billing_charge_id: 42, amount_cents: 10000, application_kind: 'application', created_at: '2026-08-30T11:00:00Z' },
  ]
  let inserts = 0
  const db = {
    async query(sql) {
      const text = String(sql)
      if (/FROM billing_payment\s+WHERE/.test(text)) return { rows: [{ id: 9, family_billing_account_id: 7, amount_cents: 15000 }] }
      if (text.includes('SELECT application.*')) return { rows: applications }
      if (text.includes('SELECT reversal.*')) return { rows: [] }
      if (text.includes('INSERT INTO billing_payment_application')) {
        inserts += 1
        return { rows: [] }
      }
      throw new Error(`Unexpected reverse-charge drift query: ${text}`)
    },
  }

  await assert.rejects(
    reverseRefundedApplicationsLocked(db, {
      refund: {
        id: 77,
        family_billing_account_id: 7,
        payment_id: 9,
        related_charge_id: 41,
        ledger_treatment: 'reverse_charge',
        amount_cents: 10000,
      },
    }),
    (error) => error?.code === 'REFUND_SELECTED_CHARGE_APPLICATION_DRIFT',
  )
  assert.equal(inserts, 0)
})

test('annual membership refund rediscovers the exact canceled Stripe subscription on retry', async () => {
  const subscription = {
    id: 301,
    stripe_subscription_id: 'sub_annual_301',
    member_id: 8,
    source_id: '5:8',
    status: 'cancelled',
    end_date: '2026-08-31',
  }
  const queries = []
  const db = {
    async query(sql, params = []) {
      const text = String(sql)
      queries.push({ text, params })
      if (text.includes('JOIN additional_fee fee')) {
        return { rows: [{ id: 41, member_id: 8, fee_id: 5 }] }
      }
      if (text.includes('UPDATE additional_fee_redemption')) return { rows: [] }
      if (text.includes('FROM billing_subscription')) return { rows: [subscription] }
      if (text.includes('UPDATE billing_subscription')) return { rows: [subscription] }
      if (text.includes('INSERT INTO billing_account_activity')) return { rows: [] }
      throw new Error(`Unexpected membership-refund retry query: ${text}`)
    },
  }

  const result = await endRefundedAnnualMembership(db, null, {
    id: 77,
    family_billing_account_id: 7,
    related_charge_id: 41,
    payment_id: 9,
    created_at: '2026-08-31T12:00:00Z',
  })

  assert.equal(result.ended, true)
  assert.deepEqual(result.subscriptions, [subscription])
  const lookup = queries.find(({ text }) => text.includes('FROM billing_subscription'))
  assert.deepEqual(lookup.params.slice(0, 3), [7, 8, '5:8'])
  assert.match(lookup.text, /status <> 'cancelled'[\s\S]*OR end_date =/)
})

test('pending, failed, and unclassified payment rows never fund charges', () => {
  const plan = buildMembershipFirstAllocationPlan({
    payments: [
      { id: 1, amountCents: 1000, paidAt: '2026-01-02', status: 'pending' },
      { id: 2, amountCents: 1000, paidAt: '2026-01-03', status: 'failed' },
      { id: 3, amountCents: 1000, paidAt: '2026-01-04', status: '' },
      { id: 4, amountCents: 1000, paidAt: '2026-01-05', status: 'succeeded' },
    ],
    charges: [charge(10, 4000, '2026-01-01')],
  })

  assert.deepEqual(plan.map(({ paymentId, amountCents }) => ({ paymentId, amountCents })), [
    { paymentId: 4, amountCents: 1000 },
  ])
})

test('an application owned by a pending payment cannot satisfy or block a charge', () => {
  const plan = buildMembershipFirstAllocationPlan({
    payments: [
      { id: 1, amountCents: 5000, paidAt: '2026-01-02', status: 'pending' },
      settled(2, 5000, '2026-01-03'),
    ],
    charges: [charge(10, 5000, '2026-01-01')],
    applications: [
      { paymentId: 1, chargeId: 10, amountCents: 5000, applicationKind: 'application' },
    ],
  })

  assert.deepEqual(plan.map(({ paymentId, chargeId, amountCents }) => ({ paymentId, chargeId, amountCents })), [
    { paymentId: 2, chargeId: 10, amountCents: 5000 },
  ])
})

test('paid-state allocation queries only count settled or succeeded payment applications', () => {
  const source = fs.readFileSync(path.join(testDirectory, '../paymentAllocation.js'), 'utf8')
  const activateSource = source.slice(
    source.indexOf('async function activatePaidMemberships'),
    source.indexOf('async function restoreMissingAnnualMembershipPromoCredits'),
  )
  const refreshSource = source.slice(
    source.indexOf('async function refreshChargeStatuses'),
    source.indexOf('async function advancePaidThroughEnrollmentSubscriptions'),
  )
  const advanceSource = source.slice(
    source.indexOf('async function advancePaidThroughEnrollmentSubscriptions'),
    source.indexOf('export async function repairEnrollmentBillingCoverage'),
  )

  assert.match(activateSource, /JOIN billing_payment payment ON payment\.id = application\.billing_payment_id/)
  assert.match(activateSource, /payment\.external_status IN \('settled', 'succeeded'\)/)
  assert.equal(
    [...refreshSource.matchAll(/payment\.external_status IN \('settled', 'succeeded'\)/g)].length,
    3,
  )
  assert.match(advanceSource, /JOIN billing_payment payment ON payment\.id = application\.billing_payment_id/)
  assert.match(advanceSource, /payment\.external_status IN \('settled', 'succeeded'\)/)
})

test('annual membership replay cannot move paid-through backward', () => {
  const source = fs.readFileSync(path.join(testDirectory, '../paymentAllocation.js'), 'utf8')
  assert.match(
    source,
    /next_bill_date = GREATEST\(billing_subscription\.next_bill_date, EXCLUDED\.next_bill_date\)/,
  )
})

test('ledger annual renewal keeps its scheduled anniversary when payment arrives late', () => {
  assert.equal(
    annualMembershipPaidThroughDate(
      { source_id: '69:59:2028-09-01' },
      new Date('2027-09-12T14:00:00.000Z'),
    ),
    '2028-09-01',
  )
  assert.equal(
    annualMembershipPaidThroughDate(
      { source_id: 'legacy-source' },
      new Date('2027-09-12T14:00:00.000Z'),
    ),
    '2028-09-12',
  )
})

test('new paid annual memberships default to ledger renewal without a Stripe setup alert', () => {
  const source = fs.readFileSync(path.join(testDirectory, '../paymentAllocation.js'), 'utf8')
  const activateSource = source.slice(
    source.indexOf('async function activatePaidMemberships'),
    source.indexOf('async function restoreMissingAnnualMembershipPromoCredits'),
  )
  assert.match(activateSource, /'annual_membership', TRUE\)/)
  assert.doesNotMatch(activateSource, /membership_autorenewal_setup_required/)
  // The conflict update intentionally does not overwrite auto_renewal, so an
  // explicit opt-out such as O'Brien remains disabled on allocation replay.
  const conflictUpdate = activateSource.slice(activateSource.indexOf('ON CONFLICT'))
  assert.doesNotMatch(conflictUpdate, /auto_renewal\s*=/)
})
