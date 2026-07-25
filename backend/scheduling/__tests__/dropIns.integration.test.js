import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isActiveSlotOccurrence,
  occurrenceDatesThroughTwoMonths,
  resolveDropInFreePass,
  resolveDropInOutcome,
} from '../dropIns.js'
import { finalizePendingDropIn } from '../../platform/familySignup.js'

test('requested drop-in date must satisfy occurrence rule and effective date window', () => {
  const weekly = {
    day_of_week: 2,
    specific_date: null,
    active_start: '2026-07-01',
    active_end: '2026-07-31',
    dates_tbd: false,
  }
  assert.equal(isActiveSlotOccurrence(weekly, '2026-07-14'), true)
  assert.equal(isActiveSlotOccurrence(weekly, '2026-07-15'), false)
  assert.equal(isActiveSlotOccurrence(weekly, '2026-08-04'), false)

  const specific = { ...weekly, day_of_week: null, specific_date: '2026-07-18' }
  assert.equal(isActiveSlotOccurrence(specific, '2026-07-18'), true)
  assert.equal(isActiveSlotOccurrence(specific, '2026-07-25'), false)
  assert.equal(isActiveSlotOccurrence({ ...weekly, dates_tbd: true }, '2026-07-14'), false)
})

test('free-day promo codes and admin pass grants resolve against the selected class scope', async () => {
  const promoQueries = []
  const promoPool = {
    async query(sql, params) {
      promoQueries.push({ sql, params })
      return { rows: [{ template_id: 71 }] }
    },
  }
  assert.deepEqual(
    await resolveDropInFreePass(promoPool, {
      member: null,
      email: 'new@example.com',
      promoCode: ' workout-free ',
      slot: { program_id: 5, form_id: 8, offering_id: 13 },
    }),
    { benefitType: 'promo_code', templateId: 71, promoCode: 'WORKOUT-FREE' },
  )
  assert.deepEqual(promoQueries[0].params, ['WORKOUT-FREE', 5, 8, 13, null, 'new@example.com'])
  assert.match(promoQueries[0].sql, /max_redemptions/)

  const grantPool = {
    async query() {
      return { rows: [{ grant_id: 91, template_id: 72 }] }
    },
  }
  assert.deepEqual(
    await resolveDropInFreePass(grantPool, {
      member: { id: 22 },
      promoCode: '',
      slot: { program_id: 5, form_id: 8, offering_id: null },
    }),
    { benefitType: 'free_pass', grantId: 91, templateId: 72 },
  )
})

test('existing paid members and annual-credit members remain immediately confirmed', () => {
  assert.deepEqual(resolveDropInOutcome({
    member: { id: 10 },
    benefits: { annualCreditsRemaining: 0 },
    useFreeTrial: false,
  }), { benefitType: 'paid', status: 'confirmed' })
  assert.deepEqual(resolveDropInOutcome({
    member: { id: 11 },
    benefits: { annualCreditsRemaining: 2 },
    useFreeTrial: false,
  }), { benefitType: 'annual_credit', status: 'confirmed' })
  assert.deepEqual(resolveDropInOutcome({
    member: { id: 12 },
    benefits: { annualCreditsRemaining: 0, adminCreditsRemaining: 2 },
    useFreeTrial: false,
  }), { benefitType: 'admin_credit', status: 'confirmed' })
  assert.deepEqual(resolveDropInOutcome({
    member: null,
    benefits: { annualCreditsRemaining: 0 },
    useFreeTrial: true,
  }), { benefitType: 'free_trial', status: 'account_required' })
})

test('weekly occurrences cover the complete two-month booking horizon', () => {
  const dates = occurrenceDatesThroughTwoMonths(3, new Date('2026-07-25T12:00:00Z'))
  assert.equal(dates[0], '2026-07-29')
  assert.equal(dates.at(-1), '2026-09-23')
  assert.equal(dates.length, 9)
  assert.ok(dates.every((date) => date >= '2026-07-25' && date <= '2026-09-25'))
})

test('family signup attaches and confirms a pending free-trial drop-in without charging', async () => {
  const calls = []
  const client = {
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('FROM drop_in_registration d')) {
        return { rows: [{
          id: 41,
          first_name: 'Avery',
          last_name: 'Stone',
          email: 'parent@example.com',
          benefit_type: 'free_trial',
          amount_cents: 0,
          base_price_cents: 4000,
          class_date: '2026-07-18',
          title: 'Gymnastics',
        }] }
      }
      return { rows: [] }
    },
  }

  const result = await finalizePendingDropIn(client, 41, {
    primaryEmail: 'PARENT@example.com',
    createdMembers: [
      { member: { id: 7, family_id: 3, first_name: 'Parent', last_name: 'Stone' } },
      { member: { id: 8, family_id: 3, first_name: 'Avery', last_name: 'Stone' } },
    ],
  })

  assert.deepEqual(result, { id: 41, memberId: 8, status: 'confirmed', benefitType: 'free_trial' })
  assert.ok(calls.some(({ sql, params }) =>
    sql.includes("status = 'confirmed'") && params[1] === 8))
  assert.equal(calls.some(({ sql }) => sql.includes('INSERT INTO billing_charge')), false)
})

test('paid pending drop-in is attached and charged while annual-credit handoff remains free', async () => {
  for (const benefitType of ['paid', 'annual_credit']) {
    const calls = []
    const client = {
      async query(sql, params) {
        calls.push({ sql, params })
        if (sql.includes('FROM drop_in_registration d')) {
          return { rows: [{
            id: benefitType === 'paid' ? 51 : 52,
            first_name: 'Jordan',
            last_name: 'Lee',
            email: 'jordan@example.com',
            benefit_type: benefitType,
            amount_cents: benefitType === 'paid' ? 3500 : 0,
            base_price_cents: 4000,
            class_date: '2026-07-21',
            title: 'Ninja',
          }] }
        }
        if (sql.includes('FROM family_billing_account')) return { rows: [{ id: 99 }] }
        return { rows: [] }
      },
    }
    await finalizePendingDropIn(client, benefitType === 'paid' ? 51 : 52, {
      primaryEmail: 'jordan@example.com',
      createdMembers: [{ member: { id: 12, family_id: 4, first_name: 'Jordan', last_name: 'Lee' } }],
    })
    assert.equal(
      calls.some(({ sql }) => sql.includes('INSERT INTO billing_charge')),
      benefitType === 'paid',
    )
  }
})
