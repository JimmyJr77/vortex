import test from 'node:test'
import assert from 'node:assert/strict'
import { acceptWorkoutExerciseProposal, normalizeExerciseProposalAcceptanceInput, proposeWorkoutExercise } from '../workoutExerciseProposal.js'
import { proposalFixtures, proposalRegistry } from './workoutExerciseProposalFixtures.js'
import { SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'

test('acceptance rejects client content, scope and approval authority before opening a transaction', async () => {
  const pool = { connect() { assert.fail('Invalid acceptance must not open a database transaction') } }
  const expectedProposalHash = 'a'.repeat(64)
  for (const raw of [null, [], {}, { expectedProposalHash: 'x' }, { expectedProposalHash, draft: {} },
    { expectedProposalHash, approved: true }, { expectedProposalHash, facilityId: '10' }, { expectedProposalHash, sourceProvenance: {} }]) {
    await assert.rejects(acceptWorkoutExerciseProposal(pool, SCOPE, uuid(1), raw), TypeError)
  }
  assert.deepEqual(normalizeExerciseProposalAcceptanceInput({ expectedProposalHash }), { expectedProposalHash })
  await assert.rejects(acceptWorkoutExerciseProposal(pool, SCOPE, 'not-a-uuid', { expectedProposalHash }), TypeError)
  await assert.rejects(acceptWorkoutExerciseProposal(pool, { ...SCOPE, userId: '0' }, uuid(1), { expectedProposalHash }), TypeError)
})

test('missing and foreign proposals remain invisible; invalid attempts and stale hashes cannot create cards', async () => {
  const state = proposalFixtures()
  const saved = await proposeWorkoutExercise({ pool: state.pool, context: SCOPE, rawInput: state.input,
    registry: proposalRegistry({ creator(draft) { draft.approved = true } }).registry })
  const accept = (scope, id, hash) => acceptWorkoutExerciseProposal(state.pool, scope, id, { expectedProposalHash: hash })
  assert.equal(await accept(SCOPE, uuid(12345), saved.contentHash), null)
  assert.equal(await accept({ ...SCOPE, facilityId: '10' }, saved.draftAuditId, saved.contentHash), null)
  await assert.rejects(accept(SCOPE, saved.draftAuditId, 'a'.repeat(64)), { code: 'exercise_proposal_audit_conflict' })
  await assert.rejects(accept(SCOPE, saved.draftAuditId, saved.contentHash), { code: 'exercise_proposal_not_applicable' })
  assert.ok(state.audit.calls.every(({ sql }) => !sql.startsWith('INSERT INTO coaching.exercise_definition_v1')))
})

test('profile proposals remain quarantined until a reviewed revision of their existing card can be staged', async () => {
  const state = proposalFixtures()
  const target = state.rows.find((row) => row.phase_key === 'output')
  const registry = proposalRegistry({ judge(output) {
    output.proposedKind = 'missing_delivery_profile'; output.targetDefinitionId = target.definition_id; output.targetVariantId = target.variant_id
    output.alternatives.find((entry) => entry.definitionId === target.definition_id).disposition = 'missing_delivery_profile'
  } }).registry
  const saved = await proposeWorkoutExercise({ pool: state.pool, context: SCOPE, rawInput: state.input, registry })
  assert.equal(saved.proposal.kind, 'delivery_profile')
  const before = structuredClone(state.rows)
  await assert.rejects(acceptWorkoutExerciseProposal(state.pool, SCOPE, saved.draftAuditId, { expectedProposalHash: saved.contentHash }),
    { code: 'exercise_proposal_revision_required' })
  assert.deepEqual(state.rows, before)
  assert.ok(state.audit.calls.every(({ sql }) => !/^(?:INSERT INTO|UPDATE) coaching\.exercise_(definition|variant|delivery_profile)_v1/.test(sql)))
})
