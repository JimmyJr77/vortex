import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateCanonicalProgrammingEligibility, evaluateCanonicalProgrammingRules } from '../canonicalProgrammingRules.js'
import { filterProgrammingCandidateEligibility } from '../workoutProgrammingEligibility.js'
import { generateWorkoutProgramming } from '../workoutProgrammingWorkflow.js'
import { compositionFixtures, compositionRegistry, validBuilder } from './workoutProgrammingBuilderFixtures.js'
import { attachRules, ruleFixtures } from './canonicalProgrammingRulesFixtures.js'
import { SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'

const filter = (state) => filterProgrammingCandidateEligibility({ groups: [{ key: state.activity.componentKey,
  candidates: [{ card: state.activity.card, profile: state.activity.profile, score: 1, methodIds: ['1'] }] }],
  request: state.request, athleteEvidence: state.athleteEvidence })

test('eligibility defers every contextual rule while whole-session QA still enforces sequencing', async () => {
  const state = await ruleFixtures()
  attachRules(state.activity.card, { prerequisites: [], sequenceRules: { requires: 'reviewed target' }, interferenceRules: { cap: 'reviewed target' } }, [
    { id: 'before', type: 'sequence', relation: 'requires_before', target: { targetType: 'variant', targetKey: uuid(999) } },
    { id: 'cap', type: 'dose_limit_after', target: { targetType: 'variant', targetKey: uuid(999) }, maximumSets: 0 },
  ], { sequenceRules: ['before'], interferenceRules: ['cap'] })
  const eligibility = evaluateCanonicalProgrammingEligibility({ ...state.activity, ...state })
  assert.equal(eligibility.status, 'PASS')
  assert.deepEqual(eligibility.evaluations.map((entry) => entry.status), ['DEFERRED', 'DEFERRED'])
  assert.equal(filter(state).groups[0].candidates.length, 1)
  assert.equal(evaluateCanonicalProgrammingRules({ ...state, activities: [state.activity] }).status, 'REVISE')
})

test('all-roster observed eligibility distinguishes a known violation from missing evidence or approval', async () => {
  const state = await ruleFixtures('body_control')
  assert.equal(filter(state).reports[0].status, 'ELIGIBLE')
  const evidence = structuredClone(state.athleteEvidence)
  evidence.observations.find((entry) => entry.kind === 'skill_progress' && entry.memberId === '102').data.score = 3
  let output = filter({ ...state, athleteEvidence: evidence })
  assert.equal(output.reports[0].status, 'INELIGIBLE')
  assert.equal(output.groups[0].candidates.length, 0)
  evidence.observations = evidence.observations.filter((entry) => entry.kind !== 'skill_progress')
  assert.equal(filter({ ...state, athleteEvidence: evidence }).reports[0].status, 'REQUIRES_REVIEW')
  const unapproved = structuredClone(state.activity)
  unapproved.card.programmingRulesReview.sourceHash = '0'.repeat(64)
  assert.equal(filter({ ...state, activity: unapproved }).reports[0].status, 'REQUIRES_REVIEW')
})

test('recorded exposure can disqualify a candidate before any session is selected', async () => {
  const state = await ruleFixtures()
  attachRules(state.activity.card, { prerequisites: [], weeklyExposure: { maximum: 1 } }, [
    { id: 'weekly', type: 'recorded_exposure', legacyExerciseIds: ['1'], windowDays: 7, maximumSessions: 1,
      minimumRecoveryHours: 0, historyScope: 'recorded_facility', eventTime: 'completion_logged_at' },
  ], { weeklyExposure: ['weekly'] })
  assert.equal(filter(state).reports[0].status, 'INELIGIBLE')
  assert.equal(filter(state).groups[0].candidates.length, 0)
})

test('Builder replaces a source-evidence gap with canonical eligible work and records the exclusion', async () => {
  const fixtures = compositionFixtures()
  const excluded = fixtures.activities[3]
  excluded.card.programming = { prerequisites: ['Unmapped reviewed source prerequisite'] }
  const builder = { ...validBuilder, async invoke(input) {
    assert.ok(input.components.every((component) => component.candidates.every((entry) => entry.deliveryProfileId !== excluded.profile.id)))
    return validBuilder.invoke(input)
  } }
  const { assumptions, ...request } = fixtures.request
  const result = await generateWorkoutProgramming({ pool: fixtures.pool(), context: SCOPE, rawRequest: request,
    registry: compositionRegistry([{ ...builder, id: 'test/eligible-builder' }]), builderCapabilityId: 'test/eligible-builder', maxRepairPasses: 0 })
  assert.equal(result.draft.status, 'READY_FOR_CRITIC')
  assert.ok(result.draft.activities.every((entry) => entry.profile.id !== excluded.profile.id))
  assert.equal(result.draft.candidateEligibility.find((entry) => entry.deliveryProfileId === excluded.profile.id).status, 'REQUIRES_REVIEW')
  assert.equal(result.qa.validation.status, 'PASS')
})

test('a locked exercise with unresolved eligibility stops composition without an AI override', async () => {
  const fixtures = compositionFixtures()
  const excluded = fixtures.activities[3]
  excluded.card.programming = { prerequisites: ['Unmapped source prerequisite'] }
  const { assumptions, ...request } = fixtures.request
  const result = await generateWorkoutProgramming({ pool: fixtures.pool(), context: SCOPE, registry: compositionRegistry(), rawRequest: {
    ...request, components: request.components.map((entry) => entry.key !== 'explosiveness' ? entry : { ...entry, lockedExercises: [
      { exerciseCardId: excluded.card.id, variantId: excluded.card.variantId, deliveryProfileId: excluded.profile.id, cardVersion: excluded.card.cardVersion },
    ] }),
  } })
  assert.equal(result.status, 'NEEDS_COACH_REVIEW')
  assert.equal(result.repairPasses, 0)
  assert.ok(result.trace.calls.every((entry) => !['session_builder', 'prepare_access', 'programming_critic'].includes(entry.role)))
  assert.ok(result.draft.issues.some((entry) => entry.code === 'candidate_eligibility_review_required'))
})
