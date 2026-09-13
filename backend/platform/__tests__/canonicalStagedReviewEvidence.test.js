import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeStagedCanonicalReviewInput, evaluateStagedCanonicalReview, createStagedCanonicalReviewEvidence,
  currentStagedReviewEvidence, stagedCanonicalCandidateHash, stagedCanonicalProfile, replaceStagedReviewEvidence } from '../canonicalStagedReviewEvidence.js'
import { reviewStagedCanonicalRevision } from '../canonicalCardStagedRevision.js'
import { stagedReviewEvidenceFixture, stagedMediaReviewInput } from './canonicalStagedReviewEvidenceFixtures.js'
import { SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'

const now = new Date('2026-09-13T12:00:00Z')
const cardReview = (decision = 'approve') => ({ kind: 'card', decision, expectedEventHash: 'b'.repeat(64), notes: 'Synthetic independent review of the exact proposed card version.' })
let eventNumber = 700
async function record(state, raw, user = '8') {
  const input = normalizeStagedCanonicalReviewInput(raw)
  const evaluated = await evaluateStagedCanonicalReview(state.client, state.event, now)
  const review = createStagedCanonicalReviewEvidence(state.event, input, user, uuid(eventNumber++), evaluated, now)
  state.event.reviewEvidence = replaceStagedReviewEvidence(state.event.reviewEvidence, review)
  return review
}
async function reviewClassifications(state) {
  const block = stagedCanonicalProfile(state.event).taxonomyV2
  for (const [kind, records] of Object.entries(block)) for (const value of records) {
    await record(state, { kind: 'taxonomy', recordType: kind === 'assignments' ? 'assignment' : 'decision',
      facetType: value.facetType, termKey: value.key ?? null, outcome: 'approve', notes: 'Synthetic independent classification review with observed rationale.', expectedEventHash: 'b'.repeat(64) })
  }
}

test('review contracts reject actor/source/approval flags and invalid evidence before accessing storage', async () => {
  const pool = { connect() { assert.fail('Invalid review must not access the database') } }
  const valid = cardReview()
  for (const patch of [{ reviewerUserId: '8' }, { approved: true }, { libraryApprovalGranted: true }, { card: {} }, { candidateHash: 'a'.repeat(64) },
    { kind: 'publish' }, { notes: 'too short' }, { expectedEventHash: '' }, { decision: 'publish' }]) {
    await assert.rejects(reviewStagedCanonicalRevision(pool, SCOPE, uuid(1), { ...valid, ...patch }), TypeError)
  }
  const { event } = stagedReviewEvidenceFixture()
  for (const patch of [{ exactVariantMatch: 'true' }, { demonstrationQualityScore: 101 }, { reviewBasis: { reviewMethod: 'inferred' } }]) {
    assert.throws(() => normalizeStagedCanonicalReviewInput({ ...stagedMediaReviewInput(event), ...patch }))
  }
})

test('complete independent taxonomy/media/card reviews yield candidate approval without changing the candidate or source', async () => {
  const state = stagedReviewEvidenceFixture()
  const before = structuredClone(state.event.card), source = structuredClone(state.event.sourceCard)
  const candidateHash = stagedCanonicalCandidateHash(state.event)
  await assert.rejects(record(state, cardReview()), { code: 'canonical_revision_not_ready' })
  await reviewClassifications(state)
  assert.equal((await evaluateStagedCanonicalReview(state.client, state.event, now)).readiness.ready, false)
  await record(state, stagedMediaReviewInput(state.event))
  const ready = await evaluateStagedCanonicalReview(state.client, state.event, now)
  assert.equal(ready.readiness.ready, true, JSON.stringify(ready.readiness.issues))
  assert.notEqual(ready.testPacket.status, 'failed', JSON.stringify(ready.testPacket))
  assert.equal(ready.approval, null)
  const approval = await record(state, cardReview())
  const reviewed = await evaluateStagedCanonicalReview(state.client, state.event, now)
  assert.deepEqual(reviewed.approval, approval)
  assert.equal(approval.details.evidenceHash, reviewed.evidenceHash)
  assert.equal(stagedCanonicalCandidateHash(state.event), candidateHash)
  assert.deepEqual(state.event.card, before); assert.deepEqual(state.event.sourceCard, source)
  assert.equal(state.event.card.approvedBy, null); assert.equal(state.event.libraryApprovalGranted, false)
  assert.ok(stagedCanonicalProfile(state.event).taxonomyV2.assignments.every((entry) => entry.reviewStatus === 'suggested'))
})

test('every source author and staged contributor is excluded from reviewing their own changes', async () => {
  const state = stagedReviewEvidenceFixture(); state.event.contributorUserIds.push('9')
  for (const actor of ['7', '9']) await assert.rejects(record(state, cardReview('request_changes'), actor), { code: 'canonical_revision_independent_review' })
  assert.equal((await record(state, cardReview('request_changes'), '8')).reviewerUserId, '8')
})

test('later evidence, rejections, media expiry and registry deprecation invalidate current card approval', async () => {
  const state = stagedReviewEvidenceFixture()
  await reviewClassifications(state); await record(state, stagedMediaReviewInput(state.event)); await record(state, cardReview())
  assert.ok((await evaluateStagedCanonicalReview(state.client, state.event, now)).approval)
  await record(state, { ...stagedMediaReviewInput(state.event), demonstrationQualityScore: 95 })
  assert.equal((await evaluateStagedCanonicalReview(state.client, state.event, now)).approval, null)
  await record(state, cardReview())
  assert.equal((await evaluateStagedCanonicalReview(state.client, state.event, new Date('2027-09-13T12:00:00Z'))).approval, null)
  state.control.unavailableTerms.add('tenet:strength')
  let evaluated = await evaluateStagedCanonicalReview(state.client, state.event, now)
  assert.equal(evaluated.readiness.ready, false); assert.equal(evaluated.approval, null)
  await assert.rejects(record(state, { kind: 'taxonomy', recordType: 'assignment', facetType: 'tenet', termKey: 'strength', outcome: 'approve',
    expectedEventHash: 'b'.repeat(64), notes: 'Synthetic review of a now deprecated classification term.' }), /currently controlled/)
  state.control.unavailableTerms.clear()
  state.control.unavailableTerms.add('training_family:general_resistance')
  assert.equal((await evaluateStagedCanonicalReview(state.client, state.event, now)).approval, null)
  state.control.unavailableTerms.clear()
  await record(state, { kind: 'taxonomy', recordType: 'assignment', facetType: 'tenet', termKey: 'strength', outcome: 'reject',
    expectedEventHash: 'b'.repeat(64), notes: 'Synthetic rejection after checking this exact classification.' })
  evaluated = await evaluateStagedCanonicalReview(state.client, state.event, now)
  assert.equal(evaluated.approval, null)
  assert.ok(evaluated.readiness.issues.some((issue) => issue.code === 'staged_taxonomy_review'))
})

test('evidence cannot be replayed onto edited content or reference another source classification', async () => {
  const state = stagedReviewEvidenceFixture()
  await record(state, stagedMediaReviewInput(state.event))
  assert.throws(() => currentStagedReviewEvidence({ ...state.event, stagedRevisionId: uuid(999) }), { code: 'canonical_revision_audit_conflict' })
  stagedCanonicalProfile(state.event).coachInstructions = 'A different instruction changes the content that was reviewed.'
  assert.throws(() => currentStagedReviewEvidence(state.event), { code: 'canonical_revision_audit_conflict' })
  state.event.reviewEvidence = []
  await assert.rejects(record(state, { kind: 'taxonomy', recordType: 'assignment', facetType: 'training_family', termKey: 'general_resistance',
    outcome: 'approve', expectedEventHash: 'b'.repeat(64), notes: 'Attempt to review a fixed source classification through staging.' }), /existing classification/)
})
