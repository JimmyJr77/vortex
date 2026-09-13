import assert from 'node:assert/strict'
import test from 'node:test'
import { directWorkoutProgramming } from '../workoutProgrammingDirector.js'
import { buildWorkoutProgrammingDraft, validateProgrammingCoverage } from '../workoutProgrammingBuilder.js'
import { deriveProgrammingPreparationDemand } from '../workoutPreparation.js'
import { programmingValueHash } from '../workoutProgrammingRequest.js'
import { createProgrammingStaffRegistry } from '../programmingStaffRuntime.js'
import { compositionFixtures, compositionRegistry, validBuilder, validPrepare } from './workoutProgrammingBuilderFixtures.js'
import { validDirector, validAthlete } from './workoutProgrammingStaffFixtures.js'
import { SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'

async function fixtureIntent(fixtures = compositionFixtures(), patch = {}) {
  const { assumptions, ...rawRequest } = fixtures.request
  const registry = compositionRegistry()
  const intent = await directWorkoutProgramming({ pool: fixtures.pool(), context: SCOPE, rawRequest: { ...rawRequest, ...patch }, registry })
  return { fixtures, registry, intent }
}
const build = ({ fixtures, registry, intent }, patch = {}) => buildWorkoutProgrammingDraft({ pool: fixtures.pool(), context: SCOPE, sessionIntent: intent, registry, ...patch })

test('complete read-only composition selects downstream first and prepares against actual doses', async () => {
  const setup = await fixtureIntent()
  const pool = setup.fixtures.pool()
  const prepare = { ...validPrepare, async invoke(input) {
    assert.equal(pool.calls.at(-1).sql, 'RELEASE') // no model holds a DB transaction
    assert.equal(input.framework.frameworkVersion, '1.0.0')
    assert.equal(input.demand.exposures.length, 7)
    assert.ok(input.demand.exposures.every((entry) => entry.dose.sets > 0))
    return validPrepare.invoke(input)
  } }
  const registry = createProgrammingStaffRegistry([validBuilder, prepare])
  const draft = await build(setup, { pool, registry })
  assert.equal(draft.status, 'READY_FOR_CRITIC')
  assert.equal(draft.validatedWorkout, false)
  assert.equal(draft.creatorAuthorized, false)
  assert.equal(draft.activities.length, 10)
  assert.deepEqual(draft.activities.map((entry) => entry.componentKey), [
    'prepare_and_access', 'prepare_and_access', 'prepare_and_access', 'explosiveness', 'explosiveness', 'explosiveness',
    'strength', 'strength', 'strength', 'capacity_competition',
  ])
  assert.equal(draft.preparationProposal.downstreamHash, deriveProgrammingPreparationDemand(draft.activities).downstreamHash)
  assert.equal(draft.schedule.bookedSeconds, 3600)
  assert.equal(draft.schedule.components.at(-1).endSeconds, 3600)
  assert.equal(draft.schedule.resourceValidation.status, 'PASS')
  assert.equal(draft.coverage.status, 'PASS')
  assert.equal(draft.load.status, 'PASS')
  assert.deepEqual(draft.trace.calls.map((entry) => entry.role), ['session_builder', 'prepare_access'])
  assert.equal(pool.calls.filter((entry) => entry.sql.includes('SELECT pm.*')).length, 1)
  assert.throws(() => { draft.activities[0].dose.sets = 999 }, TypeError)
})

test('separate tumbling retains its booked timeline but cannot compose without reviewed current-readiness evidence', async () => {
  const setup = await fixtureIntent(compositionFixtures(), { logistics: { ...compositionFixtures().request.logistics,
    athleticMinutes: 90, tumblingMinutes: 30, totalBookedMinutes: 120 } })
  const result = await build(setup)
  assert.equal(result.status, 'NEEDS_COACH_REVIEW')
  const body = result.schedule.components.at(-1)
  assert.equal(body.key, 'body_control')
  assert.equal(body.startSeconds, 5400)
  assert.equal(body.endSeconds, 7200)
  assert.equal(result.activities.filter((entry) => entry.componentKey === 'body_control').length, 0)
  assert.equal(result.trace.calls.length, 0)
  assert.ok(result.issues.some((entry) => entry.code === 'candidate_eligibility_review_required' && entry.componentKey === 'body_control'))
})

test('changed clocks, constraints or release membership are rejected before composing', async () => {
  const setup = await fixtureIntent()
  const noSql = { async connect() { assert.fail('Invalid intent reached the database') } }
  const changed = structuredClone(setup.intent)
  changed.request.logistics.coachCount = 20
  await assert.rejects(build(setup, { pool: noSql, sessionIntent: changed }), { code: 'stale_request' })
  const clock = structuredClone(setup.intent)
  clock.componentPlan.components[1].budgetSeconds += 1
  await assert.rejects(build(setup, { pool: noSql, sessionIntent: clock }), { code: 'constraint_override' })
  await assert.rejects(build(setup, { pool: setup.fixtures.pool({ noRelease: true }) }), { code: 'stale_library_release' })
  const old = structuredClone(setup.intent)
  old.resources[0].libraryRelease.version = 'outdated'
  await assert.rejects(build(setup, { sessionIntent: old }), { code: 'stale_library_release' })
})

test('malformed builder authority or foreign IDs fall back to an explicit review draft', async () => {
  const setup = await fixtureIntent()
  for (const mutate of [
    (output) => { output.approved = true },
    (output) => { output.components[0].selections[0].deliveryProfileId = uuid(99999) },
    (output) => { output.components[0].selections[0].programmingMethodId = '99999' },
    (output) => { output.components[0].reserve.seconds = 9999 },
  ]) {
    const invalid = { ...validBuilder, async invoke(input) { const result = await validBuilder.invoke(input); mutate(result.output); return result } }
    const registry = createProgrammingStaffRegistry([invalid, validPrepare])
    const result = await build(setup, { registry })
    assert.equal(result.status, 'NEEDS_COACH_REVIEW')
    assert.equal(result.builderSource, 'deterministic_review_draft')
    assert.ok(result.issues.some((issue) => issue.code === 'invalid_output'))
    assert.equal(result.creatorAuthorized, false)
  }
})

test('Prepare specialist cannot use stale demands, omit framework purposes or invent movement support', async () => {
  const setup = await fixtureIntent()
  for (const mutate of [
    (output) => { output.downstreamHash = 'stale' },
    (output) => { output.selections[0].purposes = ['raise'] },
    (output) => { output.selections[2].addressesDemandIds = [] },
    (output) => { output.selections[2].addressesDemandIds = ['invented-demand'] },
    (output) => { output.selections[2].role = 'position_rehearsal' },
  ]) {
    const invalid = { ...validPrepare, async invoke(input) { const result = await validPrepare.invoke(input); mutate(result.output); return result } }
    const result = await build(setup, { registry: createProgrammingStaffRegistry([validBuilder, invalid]) })
    assert.equal(result.status, 'NEEDS_COACH_REVIEW')
    assert.equal(result.activities.filter((entry) => entry.componentKey === 'prepare_and_access').length, 0)
    assert.ok(result.issues.some((issue) => issue.code === 'preparation_requires_review'))
  }
  const fixtures = compositionFixtures()
  fixtures.options.cards.filter((card) => card.deliveryProfiles[0].phaseKey === 'prepare_and_access').forEach((card) => { card.movementPatterns = ['unrelated_pattern'] })
  const unsupported = await build(await fixtureIntent(fixtures))
  assert.ok(unsupported.issues.some((issue) => issue.code === 'invalid_output' && issue.capabilityId === validPrepare.id))
})

test('downstream reviewed set reductions occur before preparation demand is hashed', async () => {
  const fixtures = compositionFixtures()
  const explosive = fixtures.options.cards.find((card) => card.deliveryProfiles[0].phaseKey === 'output')
  explosive.stressProfile.impactStress = 55
  explosive.deliveryProfiles[0].dosage.contactsPerSet = 30
  const result = await build(await fixtureIntent(fixtures))
  assert.equal(result.status, 'READY_FOR_CRITIC')
  const reduction = result.repairs.find((entry) => entry.fromSets === 3 && entry.toSets === 1)
  assert.ok(reduction)
  const exposure = result.preparationDemand.exposures.find((entry) => entry.demandId === reduction.activityId)
  assert.equal(exposure.dose.sets, 1)
  assert.equal(exposure.dose.contacts, 30)
  assert.equal(exposure.doseHash, programmingValueHash(exposure.dose))
  assert.equal(result.preparationProposal.downstreamHash, result.preparationDemand.downstreamHash)
})

test('bounded Builder revision responds to cumulative conflicts before the Prepare specialist runs', async () => {
  const fixtures = compositionFixtures()
  fixtures.options.cards.filter((card) => card.deliveryProfiles[0].phaseKey === 'output').forEach((card) => { card.stressProfile.impactStress = 55 })
  let calls = 0
  const revising = { ...validBuilder, async invoke(input) {
    calls += 1
    const response = await validBuilder.invoke(input)
    if (input.findings) {
      assert.ok(input.findings.some((issue) => issue.code === 'load_or_composition_conflict'))
      response.output.components[0].selections = response.output.components[0].selections.slice(0, 2)
    }
    return response
  } }
  const result = await build(await fixtureIntent(fixtures), { registry: createProgrammingStaffRegistry([revising, validPrepare]) })
  assert.equal(result.status, 'READY_FOR_CRITIC')
  assert.equal(calls, 2)
  assert.equal(result.revisions.length, 1)
  assert.deepEqual(result.trace.calls.map((entry) => entry.role), ['session_builder', 'session_builder', 'prepare_access'])
  assert.equal(result.preparationDemand.exposures.filter((entry) => entry.componentKey === 'explosiveness').length, 2)
  assert.equal(result.load.totals.highImpactContacts, 36)
  assert.ok(result.compositionAttempts > result.activities.length)
})

test('preparation demand fingerprints change with actual work without freezing caller-owned records', () => {
  const fixture = compositionFixtures()
  const activity = structuredClone(fixture.activities.find((entry) => entry.componentKey === 'explosiveness'))
  const original = deriveProgrammingPreparationDemand([activity])
  activity.dose.sets += 1
  activity.card.movementPatterns.push('new_reviewed_pattern')
  const changed = deriveProgrammingPreparationDemand([activity])
  assert.notEqual(changed.downstreamHash, original.downstreamHash)
  assert.notEqual(changed.exposures[0].doseHash, original.exposures[0].doseHash)
  assert.equal(changed.frameworkHash, original.frameworkHash)
  assert.ok(!original.exposures[0].movementPatterns.includes('new_reviewed_pattern'))
})

test('required coverage, locks and exact duplicates stay deterministic final-draft checks', async () => {
  const setup = await fixtureIntent()
  const result = await build(setup)
  const request = structuredClone(result.request)
  request.priorities.push({ facet: 'tenet', value: 'strength', strength: 'required', weight: 70 })
  request.equipment.required = ['dumbbell']
  request.components[2].lockedProgrammingMethodIds = ['9999']
  const coverage = validateProgrammingCoverage(request, [...result.activities, result.activities[0]])
  for (const code of ['missing_required_priority', 'missing_required_equipment', 'missing_method_lock', 'duplicate_delivery_profile']) {
    assert.ok(coverage.issues.some((issue) => issue.code === code), code)
  }
})

test('missing model capabilities and canceled runs never finalize or authorize exercise creation', async () => {
  const setup = await fixtureIntent()
  const draft = await build(setup, { registry: createProgrammingStaffRegistry([]) })
  assert.equal(draft.status, 'NEEDS_COACH_REVIEW')
  assert.equal(draft.preparationProposal, null)
  assert.equal(draft.creatorAuthorized, false)
  assert.ok(draft.issues.some((issue) => issue.code === 'capability_unavailable'))
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(build(setup, { pool: { async connect() { assert.fail('Canceled request reached the database') } }, runOptions: { signal: controller.signal } }), { code: 'canceled' })
})
