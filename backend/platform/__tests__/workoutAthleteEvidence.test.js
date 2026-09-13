import assert from 'node:assert/strict'
import test from 'node:test'
import { withCoachingLibrarySnapshot } from '../coachingLibraryContext.js'
import { loadWorkoutAthleteEvidence } from '../workoutAthleteEvidence.js'
import { normalizeCoachWorkoutRequest } from '../workoutProgrammingRequest.js'
import { directWorkoutProgramming } from '../workoutProgrammingDirector.js'
import { buildWorkoutProgrammingDraft } from '../workoutProgrammingBuilder.js'
import { reviewWorkoutProgrammingDraft } from '../workoutProgrammingQA.js'
import { generateWorkoutProgramming } from '../workoutProgrammingWorkflow.js'
import { createProgrammingStaffRegistry } from '../programmingStaffRuntime.js'
import { compositionFixtures, compositionRegistry, validBuilder, validPrepare } from './workoutProgrammingBuilderFixtures.js'
import { validAthlete, validDirector, coachRequest } from './workoutProgrammingStaffFixtures.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'
import { rosterRequest, evidenceFixtures, evidencePool } from './workoutAthleteEvidenceFixtures.js'
const codes = (result) => result.findings.map((entry) => entry.code)
const read = (request, fixtures = evidenceFixtures()) => withCoachingLibrarySnapshot(evidencePool(fixtures), SCOPE,
  (client, scope) => loadWorkoutAthleteEvidence(client, scope, request))
const raw = ({ assumptions, ...request }) => request

test('typed evidence binds a complete, unique roster and preserves old ambiguous fields without reinterpretation', () => {
  const request = rosterRequest()
  assert.equal(request.athletes[0].evidenceReferences[0].kind, 'skill_progress')
  for (const patch of [
    { memberIds: ['101'] }, { memberIds: [] },
    { evidenceReferences: [{ kind: 'session', id: '00000000-0000-4000-8000-000000000001', memberId: '101' }] },
    { evidenceReferences: [{ kind: 'skill_progress', id: '71', memberId: '999' }] },
    { evidenceReferences: [{ kind: 'skill_progress', id: '71', memberId: '101', approved: true }] },
  ]) assert.throws(() => rosterRequest({ athletes: [{ ...request.athletes[0], ...patch }] }))
  assert.throws(() => rosterRequest({ athletes: [request.athletes[0], { ...request.athletes[0], key: 'second' }] }))
  assert.throws(() => normalizeCoachWorkoutRequest({ ...raw(request), logistics: { ...request.logistics, sessionDate: '2026-02-30' } }))
  assert.equal(rosterRequest({ athletes: [{ ...request.athletes[0], competencyEvidenceIds: ['71'] }] }).athletes[0].competencyEvidenceIds[0], '71')
})

test('anonymous planning reads no athlete tables and legacy evidence requests remain explicit review findings', async () => {
  const client = { async query() { assert.fail('Anonymous planning read athlete records') } }
  assert.equal((await loadWorkoutAthleteEvidence(client, SCOPE, normalizeCoachWorkoutRequest(coachRequest()))).status, 'ANONYMOUS')
  const request = normalizeCoachWorkoutRequest(coachRequest({ athletes: [{ ...coachRequest().athletes[0], competencyEvidenceIds: ['71'] }] }))
  assert.deepEqual(codes(await loadWorkoutAthleteEvidence(client, SCOPE, request)), ['untyped_athlete_evidence'])
})

test('scoped observations retain source meaning, unknown prerequisites, timestamps and stable hashes', async () => {
  const request = rosterRequest()
  const result = await read(request)
  assert.equal(result.status, 'HYDRATED')
  assert.equal(result.prerequisiteStatus, 'NOT_ESTABLISHED')
  assert.equal(result.observations.length, 4)
  assert.deepEqual(result.members.map((entry) => [entry.memberId, entry.athleteKey]), [['101', 'youth:1'], ['102', 'youth:2']])
  assert.equal(result.observations.find((entry) => entry.kind === 'completion_log').data.status, 'partial')
  assert.equal(result.observations.find((entry) => entry.kind === 'session').data.sourceType, 'session_and_attendance_only')
  assert.equal(result.history.find((entry) => entry.kind === 'wellness_checkin' && entry.memberId === '102').availableCount, 0)
  assert.equal(result.retrieval.outsideActivityKnown, false)
  assert.equal(result.readinessScore, undefined)
  assert.equal((await read(request)).contentHash, result.contentHash)
  assert.throws(() => { result.observations[0].data.status = 'verified' }, TypeError)
})

test('missing roster members, incorrect ages, unavailable references and changed source hashes cannot pass', async () => {
  const request = rosterRequest()
  const missing = evidenceFixtures(); missing.members = []
  assert.ok(codes(await read(request, missing)).includes('unavailable_cohort_member'))
  const wrongAge = evidenceFixtures(); wrongAge.members[0].age = 9
  assert.ok(codes(await read(request, wrongAge)).includes('roster_age_mismatch'))
  const absent = evidenceFixtures(); absent['skill_progress:explicit'] = []
  assert.ok(codes(await read(request, absent)).includes('unavailable_athlete_evidence'))
  const pinned = rosterRequest({ athletes: [{ ...request.athletes[0], evidenceReferences: [{ ...request.athletes[0].evidenceReferences[0], expectedSourceHash: 'f'.repeat(64) }] }] })
  assert.ok(codes(await read(pinned)).includes('stale_athlete_evidence_reference'))
  const foreign = evidenceFixtures(); foreign['skill_progress:explicit'][0].member_id = '999'
  await assert.rejects(read(request, foreign), /unrequested reference/)
})

test('bounded history and long evidence cannot silently become complete context', async () => {
  const fixtures = evidenceFixtures()
  fixtures['completion_log:history'][0].source_count = 26
  fixtures['skill_progress:explicit'][0].data.note = 'x'.repeat(2500)
  const result = await read(rosterRequest(), fixtures)
  assert.ok(codes(result).includes('athlete_history_truncated'))
  assert.ok(codes(result).includes('athlete_evidence_truncated'))
  const oldHash = result.observations.find((entry) => entry.kind === 'skill_progress').sourceHash
  fixtures['skill_progress:explicit'][0].data.note += 'Changed beyond the preview boundary.'
  assert.notEqual((await read(rosterRequest(), fixtures)).observations.find((entry) => entry.kind === 'skill_progress').sourceHash, oldHash)
})

const critic = { id: 'vortex/programming-critic', role: 'programming_critic', version: 'test-evidence', async invoke(input) {
  assert.equal(input.athleteEvidence.status, 'HYDRATED')
  return { output: { draftId: input.draftId, reviewHash: input.reviewHash, status: 'PASS', summary: 'Reviewed observed evidence without certifying competency.',
    assessments: input.reviewAreas.map((area) => ({ area, status: 'PASS', summary: 'Review uses available observations and explicit remaining unknowns.' })), findings: [] } }
} }
async function workflowSetup() {
  const fixture = compositionFixtures()
  const memberIds = Array.from({ length: 15 }, (_, i) => String(i + 101))
  const source = evidenceFixtures(memberIds)
  const pool = evidencePool(source, fixture.pool())
  const request = { ...raw(fixture.request), athletes: [{ ...fixture.request.athletes[0], memberIds,
    evidenceReferences: [{ kind: 'skill_progress', id: '71', memberId: '101' }] }] }
  return { pool, request, source, fixture }
}

test('one-snapshot workflow sends source observations to Athlete Development, Builder and the independently reconstructed Critic', async () => {
  const { pool, request } = await workflowSetup()
  const seen = []
  const observe = (capability) => ({ ...capability, async invoke(input, context) {
    assert.equal(pool.calls.at(-1).sql, 'RELEASE')
    assert.equal(input.athleteEvidence.observations.length, 4)
    assert.equal(input.athleteEvidence.prerequisiteStatus, 'NOT_ESTABLISHED')
    seen.push(capability.role)
    return capability.invoke(input, context)
  } })
  const registry = createProgrammingStaffRegistry([observe(validDirector), observe(validAthlete), observe(validBuilder), observe(validPrepare), observe(critic)])
  const result = await generateWorkoutProgramming({ pool, context: SCOPE, rawRequest: request, registry })
  assert.equal(result.status, 'QA_PASSED', JSON.stringify(result.findings))
  assert.deepEqual(seen, ['athlete_development', 'director', 'session_builder', 'prepare_access', 'programming_critic'])
  assert.equal(result.validatedWorkout, false)
  assert.equal(pool.calls.filter((entry) => entry.sql.startsWith('BEGIN')).length, 4)
})

test('source changes after advice stop composition and changes during Critic PASS invalidate that pass', async () => {
  const { pool, request, source } = await workflowSetup()
  const registry = compositionRegistry([critic])
  const sessionIntent = await directWorkoutProgramming({ pool, context: SCOPE, rawRequest: request, registry })
  source['wellness_checkin:history'][0].data.soreness = 8
  const staleDraft = await buildWorkoutProgrammingDraft({ pool, context: SCOPE, sessionIntent, registry })
  assert.equal(staleDraft.status, 'NEEDS_COACH_REVIEW')
  assert.equal(staleDraft.trace.calls.length, 0)
  assert.ok(staleDraft.issues.some((entry) => entry.code === 'stale_athlete_evidence'))
  source['wellness_checkin:history'][0].data.soreness = 3
  const draft = await buildWorkoutProgrammingDraft({ pool, context: SCOPE, sessionIntent, registry })
  const changingCritic = createProgrammingStaffRegistry([{ ...critic, async invoke(input) {
    source['wellness_checkin:history'][0].data.soreness = 8
    return critic.invoke(input)
  } }])
  const result = await reviewWorkoutProgrammingDraft({ pool, context: SCOPE, sessionIntent, draft, registry: changingCritic })
  assert.equal(result.critic.status, 'PASS')
  assert.equal(result.status, 'NEEDS_COACH_REVIEW')
  assert.ok(codes(result).includes('stale_athlete_evidence'))
  assert.ok(codes(result).includes('review_target_changed'))
})
