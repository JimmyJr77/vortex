import assert from 'node:assert/strict'
import test from 'node:test'
import { loadWorkoutProgrammingChoices } from '../workoutProgrammingChoices.js'
import { loadWorkoutAthleteEvidenceChoices } from '../workoutAthleteEvidence.js'
import { compositionFixtures } from './workoutProgrammingBuilderFixtures.js'
import { ruleFixtures } from './canonicalProgrammingRulesFixtures.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'
import { withCoachingLibrarySnapshot } from '../coachingLibraryContext.js'
import { evidencePool } from './workoutAthleteEvidenceFixtures.js'

test('coach choices reuse ranked released pairs and retain blocked evidence without authorizing creation', async () => {
  const fixtures = compositionFixtures()
  fixtures.options.cards[3].programming = { prerequisites: ['Unmapped source prerequisite'] }
  const { assumptions, ...request } = fixtures.request
  const choices = await loadWorkoutProgrammingChoices(fixtures.pool(), SCOPE, request)
  assert.equal(choices.components.length, 4)
  const candidate = choices.components.find((entry) => entry.key === 'explosiveness').exercises.find((entry) => entry.ref.exerciseCardId === fixtures.options.cards[3].id)
  assert.equal(candidate.eligibility, 'REQUIRES_REVIEW')
  assert.ok(candidate.findings.some((entry) => entry.code === 'readiness_evidence_adapter_required'))
  assert.ok(choices.components.every((component) => component.exercises.every((entry) => entry.methodIds.every((id) => component.methods.some((method) => method.id === id)))))
  assert.equal(choices.creatorAuthorized, false)
  assert.equal(choices.libraryApprovalGranted, false)
})

test('evidence choices share exact source hashes and omit private/raw record fields', async () => {
  const state = await ruleFixtures()
  state.source['skill_progress:history'] = state.source['skill_progress:explicit'].filter((entry) => entry.member_id === '101')
  const choices = await withCoachingLibrarySnapshot(evidencePool(state.source), SCOPE, (client, scope) => loadWorkoutAthleteEvidenceChoices(client, scope,
    { memberId: '101', kind: 'skill_progress', asOfDate: state.request.logistics.sessionDate }))
  assert.equal(choices.length, 1)
  assert.equal(choices[0].sourceHash, state.athleteEvidence.observations.find((entry) => entry.kind === 'skill_progress' && entry.memberId === '101').sourceHash)
  assert.equal(choices[0].measurement, '4 / 5')
  assert.equal(choices[0].coachObserved, true)
  assert.equal(choices[0].data, undefined)
  assert.equal(choices[0].note, undefined)
  await assert.rejects(loadWorkoutAthleteEvidenceChoices({}, SCOPE, { memberId: '101', kind: 'anything', asOfDate: '2026-09-12' }), TypeError)
  await assert.rejects(loadWorkoutAthleteEvidenceChoices({}, SCOPE, { memberId: '101', kind: 'skill_progress', asOfDate: '2026-02-30' }), TypeError)
})
