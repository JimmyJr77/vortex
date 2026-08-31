import test from 'node:test'
import assert from 'node:assert/strict'
import { planLateStartEnrollmentRepair } from '../initialEnrollmentProrationRepair.js'

const mondayCalendar = [{
  id: 306,
  slot_group_id: 230,
  day_of_week: 1,
  start_time: '17:30:00',
  end_time: '19:00:00',
  sg_active_start: '2026-07-09',
  sg_active_end: '2026-12-31',
  sg_dates_tbd: false,
  form_start_date: '2026-07-09',
  form_end_date: '2026-12-31',
}]

test('late-start full tuition is assigned to September and the August class is prorated', () => {
  const plan = planLateStartEnrollmentRepair({
    charge_id: 16,
    slot_group_id: 230,
    time_slot_id: 306,
    enrollment_start_date: '2026-08-25',
    service_period_start: '2026-08-04',
    service_period_end: '2026-08-31',
    monthly_amount_cents: 15000,
    net_monthly_cents: 15000,
  }, mondayCalendar)

  assert.equal(plan.nextPeriodStart, '2026-09-01')
  assert.equal(plan.nextPeriodEnd, '2026-09-30')
  assert.equal(plan.proration.remainingClasses, 1)
  assert.equal(plan.proratedNetCents, 3750)
  assert.equal(plan.proratedGrossCents, 3750)
})

test('a prior temporary proration credit stays visible to the repair for linked reversal', () => {
  const plan = planLateStartEnrollmentRepair({
    charge_id: 32,
    slot_group_id: 230,
    time_slot_id: 306,
    enrollment_start_date: '2026-08-25',
    service_period_start: '2026-08-25',
    service_period_end: '2026-08-31',
    monthly_amount_cents: 12750,
    net_monthly_cents: 12750,
    prior_proration_credit_cents: 9562,
    prior_proration_credit_ids: [54],
  }, mondayCalendar)

  assert.equal(plan.prior_proration_credit_cents, 9562)
  assert.deepEqual(plan.prior_proration_credit_ids, [54])
  assert.equal(plan.proratedNetCents, 3188)
})

test('a late start with no remaining classes carries the full charge to its first service month', () => {
  const plan = planLateStartEnrollmentRepair({
    charge_id: 17,
    slot_group_id: 230,
    time_slot_id: 306,
    enrollment_start_date: '2026-08-31',
    service_period_start: '2026-08-04',
    service_period_end: '2026-08-31',
    monthly_amount_cents: 15000,
    net_monthly_cents: 15000,
  }, [{ ...mondayCalendar[0], day_of_week: 2 }])

  assert.equal(plan.nextPeriodStart, '2026-09-01')
  assert.equal(plan.proratedNetCents, 0)
})
