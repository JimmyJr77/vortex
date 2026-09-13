import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeStagedCanonicalRevisionChange, changeStagedCanonicalRevision, canonicalStagedSourceCard, stageCanonicalDeliveryProfileInTransaction, readStagedCanonicalRevisionInTransaction } from '../canonicalCardStagedRevision.js'
import { stageWorkoutExerciseProposal, proposeWorkoutExercise } from '../workoutExerciseProposal.js'
import { proposalFixtures, proposalRegistry } from './workoutExerciseProposalFixtures.js'
import { stagedSourceFixture, stagedProposalRegistry } from './canonicalCardStagedRevisionFixtures.js'
import { SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'
import { programmingValueHash } from '../workoutProgrammingRequest.js'

test('staged source hashes preserve exact dates and governance but exclude their own revision history', () => {
  const source = stagedSourceFixture(proposalFixtures())
  const before = programmingValueHash(canonicalStagedSourceCard(source))
  source.revisions.push({ action: 'revision_staged' }); source.readiness = { ready: true }; source.testPacket = { status: 'passed' }
  assert.equal(programmingValueHash(canonicalStagedSourceCard(source)), before)
  source.updatedAt = new Date('2026-01-01T00:00:01Z')
  assert.notEqual(programmingValueHash(canonicalStagedSourceCard(source)), before)
  const current = programmingValueHash(canonicalStagedSourceCard(source))
  source.variants[0].status = 'review'
  assert.notEqual(programmingValueHash(canonicalStagedSourceCard(source)), current)
  source.reviews = [{ id: 'review-2', notes: 'Second independent record.' }, { id: 'review-1', notes: 'First independent record.' }]
  const withEvidence = programmingValueHash(canonicalStagedSourceCard(source))
  source.reviews.reverse()
  assert.equal(programmingValueHash(canonicalStagedSourceCard(source)), withEvidence)
})

test('human revision actions cannot publish, forge scope/source or skip optimistic concurrency', async () => {
  const pool = { connect() { assert.fail('Invalid staged actions must not query') } }
  const valid = { expectedEventHash: 'a'.repeat(64), action: 'submit', changeSummary: 'Submit this staged profile for independent review.' }
  assert.deepEqual(normalizeStagedCanonicalRevisionChange(valid), valid)
  for (const input of [{ ...valid, action: 'publish' }, { ...valid, action: 'approve' }, { ...valid, facilityId: '10' },
    { ...valid, sourceCard: {} }, { ...valid, expectedEventHash: null }, { ...valid, profile: {} },
    { ...valid, action: 'edit', profile: { approved: true } }, { ...valid, action: 'edit', profile: { status: 'published' } }]) {
    await assert.rejects(changeStagedCanonicalRevision(pool, SCOPE, uuid(1), input), TypeError)
  }
  await assert.rejects(stageWorkoutExerciseProposal(pool, SCOPE, uuid(1), { expectedProposalHash: 'a'.repeat(64), approved: true }), TypeError)
})

test('staging requires an actual stored profile proposal, exact source version and an unused delivery phase', async () => {
  const state = proposalFixtures()
  const record = await proposeWorkoutExercise({ pool: state.pool, context: SCOPE, rawInput: state.input, registry: stagedProposalRegistry(state) })
  assert.equal(record.proposal.kind, 'delivery_profile')
  const source = stagedSourceFixture(state)
  const client = { query() { assert.fail('Invalid target must not write staging history') } }
  const origin = { draftAuditId: record.draftAuditId, proposalHash: record.contentHash }
  await assert.rejects(stageCanonicalDeliveryProfileInTransaction(client, SCOPE, { ...source, cardVersion: 2 }, record.proposal, origin), { code: 'canonical_revision_source_changed' })
  await assert.rejects(stageCanonicalDeliveryProfileInTransaction(client, SCOPE, { ...source, status: 'draft' }, record.proposal, origin), { code: 'canonical_revision_source_changed' })
  source.variants[0].profiles[0].phaseKey = record.proposal.profile.phaseKey
  await assert.rejects(stageCanonicalDeliveryProfileInTransaction(client, SCOPE, source, record.proposal, origin), { code: 'canonical_revision_profile_conflict' })
  const newCard = await proposeWorkoutExercise({ pool: state.pool, context: SCOPE, rawInput: state.input, registry: proposalRegistry().registry })
  await assert.rejects(stageWorkoutExerciseProposal(state.pool, SCOPE, newCard.draftAuditId, { expectedProposalHash: newCard.contentHash }), { code: 'exercise_proposal_not_applicable' })
  assert.equal(await stageWorkoutExerciseProposal(state.pool, { ...SCOPE, facilityId: '10' }, record.draftAuditId, { expectedProposalHash: record.contentHash }), null)
})

test('an unsupported stored revision contract fails closed instead of appearing absent', async () => {
  const client = { async query() { return { rows: [{ snapshot_json: { workflow: 'future_contract' } }] } } }
  await assert.rejects(readStagedCanonicalRevisionInTransaction(client, SCOPE, uuid(1)), { code: 'canonical_revision_audit_conflict' })
})
