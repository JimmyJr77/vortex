import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCanonicalProgrammingDose, canonicalContactExposure } from '../canonicalProgrammingDose.js'
import { executionActivity, executionRequest } from './workoutProgrammingExecutionFixtures.js'

test('canonical dose retains reviewed clocks, source IDs, bounds, cues and contacts', () => {
  const request = executionRequest()
  const activity = executionActivity()
  const dose = resolveCanonicalProgrammingDose({ ...activity, request })
  assert.equal(dose.programmingMethodId, '1')
  assert.equal(dose.methodPrescriptionId, '101')
  assert.deepEqual([dose.sets, dose.workSeconds, dose.restSeconds, dose.activeSecondsPerAthlete], [3, 10, 60, 30])
  assert.equal(dose.contacts, 18)
  assert.equal(dose.contactExposure.source, 'profile_contacts_per_set')
  assert.ok(dose.stopRules.includes('End before quality declines.'))
  assert.throws(() => { dose.sets = 99 }, TypeError)
})

test('only reviewed dose ranges permit adaptation; time pressure cannot stretch work or cut rest', () => {
  const request = executionRequest()
  const activity = executionActivity()
  const reduced = resolveCanonicalProgrammingDose({ ...activity, request, proposal: { sets: 1 } })
  assert.equal(reduced.contacts, 6)
  for (const proposal of [{ sets: 0 }, { sets: 4 }, { workSeconds: 30 }, { restSeconds: 10 }, { reps: 30 }, { rpe: 10 }, { sets: '2' }]) {
    assert.throws(() => resolveCanonicalProgrammingDose({ ...activity, request, proposal }))
  }
  activity.profile.dosage.restSecondsMax = 120
  assert.throws(() => resolveCanonicalProgrammingDose({ ...activity, request, proposal: { restSeconds: 120 } }), { code: 'method_clock_mismatch' })
})

test('null contact metadata falls through to reviewed estimates or rep models and unknown stays unknown', () => {
  const { card, profile } = executionActivity()
  profile.dosage.contactsPerSet = null
  assert.deepEqual(canonicalContactExposure(card, profile, 3, 6), { contacts: 18, contactsPerSet: 6, source: 'variant_contacts_per_rep' })
  profile.dosage.contactEstimate = { planningDefaultContactsPerSet: 8 }
  assert.equal(canonicalContactExposure(card, profile, 3, 6).contacts, 24)
  delete profile.dosage.contactEstimate
  delete card.loadProfile.landingContactsPerRep
  assert.equal(canonicalContactExposure(card, profile, 3, 6).contacts, null)
  assert.throws(() => resolveCanonicalProgrammingDose({ card, profile, method: executionActivity().method, request: executionRequest(), componentKey: 'explosiveness' }),
    { code: 'unknown_high_impact_contacts' })
})

test('method profiles must cover the cohort and phase without overriding exercise bounds', () => {
  const request = executionRequest()
  for (const mutate of [
    (entry) => { entry.method.prescriptions[0].age_min = 15 },
    (entry) => { entry.method.prescriptions[0].training_experience = 'advanced' },
    (entry) => { entry.method.prescriptions = [] },
    (entry) => { entry.method.incompatible_phases = ['output'] },
    (entry) => { entry.method.prescriptions[0].default_work_seconds = 50 },
    (entry) => { entry.profile.dosage.workSeconds = null },
    (entry) => { entry.profile.dosage.setsMin = 4 },
  ]) {
    const activity = executionActivity()
    mutate(activity)
    assert.throws(() => resolveCanonicalProgrammingDose({ ...activity, request }))
  }
})

test('high-fatigue capacity cannot be prescribed before booked tumbling', () => {
  const base = executionRequest()
  const request = executionRequest({ logistics: { ...base.logistics, tumblingMinutes: 30, totalBookedMinutes: 90 } })
  const activity = executionActivity('capacity_competition', 5, request)
  activity.method.fatigue_profile.fatigue_level = 'high'
  assert.throws(() => resolveCanonicalProgrammingDose({ ...activity, request }), { code: 'fatigue_before_tumbling' })
})
