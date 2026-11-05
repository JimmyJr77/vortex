import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareFamilyEnrollmentCheckout } from '../familyEnrollmentCheckout.js'

const selection = { classEventId: 3, schedulingFormId: 9, slotGroupId: 225, timeSlotId: 301,
  enrollmentStartDate: '2026-11-02', selectedPricingOptionKey: 'monthly', scheduleLabel: 'Monday' }

test('family signup prepares a future-start class for checkout without confirming or billing it', async () => {
  const queries = []
  const result = await prepareFamilyEnrollmentCheckout({ async query(sql, params) {
    queries.push({ sql, params })
    assert.match(sql.trim(), /^SELECT/)
    return { rows: [{ class_label: 'Tornadoes', programs_id: '2' }] }
  } }, { memberId: 205, enrollment: selection })
  assert.equal(queries.length, 1)
  assert.deepEqual(queries[0].params, [9, 3, 225, 301, 205, null, null, null, []])
  assert.match(queries[0].sql,/participant\.facility_id=class_scope\.facility_id/)
  assert.deepEqual(result, { memberId: 205, classEventId: 3, formId: 9, slotGroupId: 225,
    timeSlotId: 301, enrollmentStartDate: '2026-11-02', classLabel: 'Tornadoes', programsId: 2,
    selectedPricingOptionKey: 'monthly', scheduleLabel: 'Monday' })
  assert.equal(result.status, undefined)
  assert.equal(result.schedulingSignupId, undefined)
})

test('family checkout rejects missing athlete, schedule, or date before account commit', async () => {
  const db = { async query() { throw new Error('Must validate before querying') } }
  for (const [memberId, enrollment] of [
    [NaN, selection], [205, { ...selection, timeSlotId: undefined }],
    [205, { ...selection, slotGroupId: -1 }], [205, { ...selection, enrollmentStartDate: '' }],
  ]) {
    await assert.rejects(prepareFamilyEnrollmentCheckout(db, { memberId, enrollment }),
      /Select a valid|enrollment start date/i)
  }
})

test('inactive or mismatched class time cannot enter the checkout handoff', async () => {
  await assert.rejects(prepareFamilyEnrollmentCheckout({ async query() { return { rows: [] } } },
    { memberId: 205, enrollment: selection }), /no longer available/)
})

test('submitted program, offering, and facility must match the complete enrollment chain', async () => {
  const calls = []
  await assert.rejects(prepareFamilyEnrollmentCheckout({ async query(sql, params) {
    calls.push({ sql, params })
    return { rows: [] }
  } }, {
    memberId: 205, facilityId: 7,
    enrollment: { ...selection, programsId: 2, offeringId: 8, offeringIds: [8, 9, 8] },
  }), /no longer available/)
  assert.deepEqual(calls[0].params, [9, 3, 225, 301, 205, 7, 2, 8, [8, 9]])
  assert.match(calls[0].sql, /parent_scope.facility_id=class_scope.facility_id/)
  assert.match(calls[0].sql, /participant.facility_id=\$6/)
  assert.match(calls[0].sql, /sg.offering_id=\$8/)
  assert.match(calls[0].sql, /offering.form_id=sf.id/)
  assert.match(calls[0].sql, /FOR SHARE OF/)
})

test('malformed optional relations are rejected before database access', async () => {
  const db = { async query() { assert.fail('invalid ids must not reach the database') } }
  for (const change of [{ programsId: -1 }, { offeringId: 'other' }, { offeringIds: '8' }, { offeringIds: [8, 'other'] }]) {
    await assert.rejects(prepareFamilyEnrollmentCheckout(db, {
      memberId: 205, enrollment: { ...selection, ...change },
    }), /Select valid/)
  }
})
