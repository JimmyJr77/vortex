import assert from 'node:assert/strict'
import test from 'node:test'
import { proposeWorkoutExercise, loadWorkoutExerciseProposal } from '../workoutExerciseProposal.js'
import { proposalFixtures, proposalRegistry } from './workoutExerciseProposalFixtures.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'
import { createProgrammingStaffRegistry } from '../programmingStaffRuntime.js'
import { createProgrammingStaffModelInvoker } from '../programmingStaffModel.js'
import { MockLanguageModelV3 } from 'ai/test'
import { compositionFixtures } from './workoutProgrammingBuilderFixtures.js'

const propose = (state, model = proposalRegistry(), options = {}) => proposeWorkoutExercise({ pool: state.pool, context: SCOPE, rawInput: state.input, registry: model.registry, ...options })

test('verified gap invokes Creator once and records a strict quarantined draft and complete trace in the existing audit', async () => {
  const state = proposalFixtures()
  const model = proposalRegistry()
  const original = structuredClone(state.input)
  const result = await propose(state, model)
  assert.equal(result.state, 'AI_PROPOSED', JSON.stringify(result.issues))
  assert.deepEqual(model.calls, ['director', 'creator'])
  assert.equal(result.proposal.kind, 'new_card')
  assert.equal(result.proposal.draft.status, 'draft')
  assert.equal(result.proposal.draft.contentConfidence, 60)
  assert.equal(result.proposal.draft.approvedVideoUrl, null)
  assert.equal(result.proposal.readiness.ready, false)
  assert.equal(result.canonicalDraftId, null)
  assert.equal(result.libraryApprovalGranted, false)
  assert.equal(result.proposal.draft.provenance.humanReviewRequired, true)
  assert.equal(result.trace.calls.length, 2)
  assert.equal(state.audit.rows.size, 1)
  const row = state.audit.rows.get(result.draftAuditId)
  assert.equal(row.status, 'validated')
  assert.equal(row.input_tokens, 250)
  assert.equal(row.output_tokens, 400)
  assert.equal(row.draft_json.assessment.exerciseGap.contentHash, result.assessment.exerciseGap.contentHash)
  assert.deepEqual(await loadWorkoutExerciseProposal(state.pool, SCOPE, result.draftAuditId), result)
  assert.equal(await loadWorkoutExerciseProposal(state.pool, { ...SCOPE, facilityId: '10' }, result.draftAuditId), null)
  assert.deepEqual(state.input, original)
  assert.equal(Object.isFrozen(state.input), false)
  assert.ok(state.audit.calls.every((entry) => !/^\s*(INSERT INTO coaching.exercise_(definition|variant|delivery_profile)|UPDATE|DELETE)/.test(entry.sql)))
})

test('unresolved research and reusable content never activate Creator or insert a proposal', async () => {
  const noRelease = proposalFixtures({ patch: { noRelease: true } })
  const model = proposalRegistry()
  assert.equal((await propose(noRelease, model)).state, 'NEEDS_COACH_REVIEW')
  assert.deepEqual(model.calls, [])
  assert.equal(noRelease.audit.rows.size, 0)
  const state = proposalFixtures()
  const reusable = proposalRegistry({ judge(output, input) {
    const card = input.research.relatedDefinitions.find((entry) => entry.eligibleProfileIds.length)
    output.alternatives.find((entry) => entry.definitionId === card.id).disposition = 'reusable'
  } })
  assert.equal((await propose(state, reusable)).state, 'REUSE_EXISTING')
  assert.deepEqual(reusable.calls, ['director'])
  assert.equal(state.audit.rows.size, 0)
})

test('a profile proposal cannot remove the existing variant’s required physical equipment', async () => {
  const cards = compositionFixtures().options.cards
  const card = cards.find((entry) => entry.deliveryProfiles.some((profile) => profile.phaseKey === 'output'))
  card.equipmentRoles = [{ key: 'barbell', role: 'required' }]
  const state = proposalFixtures({ patch: { cards } })
  const model = proposalRegistry({ judge(output) {
    output.proposedKind = 'missing_delivery_profile'; output.targetDefinitionId = card.id; output.targetVariantId = card.variantId
    output.alternatives.find((entry) => entry.definitionId === card.id).disposition = 'missing_delivery_profile'
  } })
  await assert.rejects(propose(state, model), { code: 'exercise_proposal_target_equipment_conflict' })
  assert.deepEqual(model.calls, ['director'])
  assert.equal(state.audit.rows.size, 0)
})

test('a profile gap produces only an exact existing-variant profile proposal and leaves source content unchanged', async () => {
  const state = proposalFixtures()
  const target = state.rows.find((row) => row.phase_key === 'output')
  const model = proposalRegistry({ judge(output) {
    output.proposedKind = 'missing_delivery_profile'; output.targetDefinitionId = target.definition_id; output.targetVariantId = target.variant_id
    output.alternatives.find((entry) => entry.definitionId === target.definition_id).disposition = 'missing_delivery_profile'
  } })
  const original = structuredClone(state.rows)
  const result = await propose(state, model)
  assert.equal(result.state, 'AI_PROPOSED', JSON.stringify(result.issues))
  assert.equal(result.proposal.kind, 'delivery_profile')
  assert.equal(result.proposal.draft, undefined)
  assert.equal(result.proposal.target.variantId, target.variant_id)
  assert.equal(result.proposal.profile.phaseKey, result.assessment.exerciseGap.phaseKey)
  assert.equal(result.proposal.profile.id, null)
  assert.deepEqual(result.proposal.profile.dosage.sets, [1, 2])
  assert.deepEqual(state.rows, original)
  const duplicateKey = proposalRegistry({ judge(output) {
    output.proposedKind = 'missing_delivery_profile'; output.targetDefinitionId = target.definition_id; output.targetVariantId = target.variant_id
    output.alternatives.find((entry) => entry.definitionId === target.definition_id).disposition = 'missing_delivery_profile'
  }, creator(output) { output.profile.profileKey = target.profile_key } })
  const invalid = await propose(state, duplicateKey)
  assert.equal(invalid.state, 'NEEDS_COACH_REVIEW')
  assert.equal(invalid.issues[0].code, 'exercise_proposal_duplicate_profile_key')
})

test('malformed schemas, nested approval claims, changed gap identity, unknown taxonomy and invalid doses remain invalid audited attempts', async () => {
  const transforms = [
    (draft) => { draft.status = 'published' },
    (draft) => { draft.variants[0].structuredProfileReview = { reviewStatus: 'approved' } },
    (draft) => { draft.variants[0].profiles[0].approvedBy = '7' },
    (draft) => { draft.canonicalName = 'Unresearched movement' },
    (draft) => { draft.movementPatterns = ['invented_pattern'] },
    (draft) => { draft.requiredEquipment = ['barbell'] },
    (draft) => { draft.variants[0].profiles[0].phaseKey = 'restore' },
    (draft) => { draft.variants[0].profiles[0].dosage.setsMin = 3 },
    (draft) => { draft.variants[0].profiles[0].dosage.repsMin = null },
    (draft) => { draft.variants[0].profiles[0].stopRules = [] },
  ]
  for (const creator of transforms) {
    const state = proposalFixtures()
    const result = await propose(state, proposalRegistry({ creator }))
    assert.equal(result.state, 'NEEDS_COACH_REVIEW')
    assert.equal(result.proposal, null)
    assert.equal(state.audit.rows.size, 1)
    assert.equal(state.audit.rows.get(result.draftAuditId).status, 'invalid')
    assert.equal(result.trace.calls.at(-1).status, 'failed')
    assert.equal(result.issues[0].code, 'invalid_output')
  }
})

test('generated aliases are rechecked against all canonical states and cannot become duplicate proposals', async () => {
  const state = proposalFixtures()
  const duplicate = state.rows[0].canonical_name
  await assert.rejects(propose(state, proposalRegistry({ creator(draft) { draft.aliases = [duplicate] } })), { code: 'exercise_proposal_duplicate' })
  assert.equal(state.audit.rows.size, 0)
  assert.ok(state.audit.calls.some((entry) => entry.sql === 'ROLLBACK'))
  await assert.rejects(propose(state, proposalRegistry({ creator(draft) { draft.slug = state.rows[0].slug } })), { code: 'exercise_proposal_duplicate' })
  assert.equal(state.audit.rows.size, 0)
})

test('source and taxonomy changes during Creator prevent the final audit write', async () => {
  for (const change of [(state) => { state.rows[0].definition_status = 'review' }, (state) => { state.taxonomy.equipment.add('new_equipment') }]) {
    const state = proposalFixtures()
    await assert.rejects(propose(state, proposalRegistry({ duringCreator() { change(state) } })), { code: 'exercise_gap_sources_changed' })
    assert.equal(state.audit.rows.size, 0)
  }
})

test('cancellation, write failures and a forged request cannot leave a successful audit or card', async () => {
  const controller = new AbortController()
  const canceled = proposalFixtures()
  await assert.rejects(propose(canceled, proposalRegistry({ duringCreator() { controller.abort() } }), { runOptions: { signal: controller.signal } }), { code: 'canceled' })
  assert.equal(canceled.audit.rows.size, 0)
  const failing = proposalFixtures()
  failing.audit.failInsert = true
  await assert.rejects(propose(failing), /audit write failure/)
  assert.equal(failing.audit.rows.size, 0)
  assert.ok(failing.audit.calls.some((entry) => entry.sql === 'ROLLBACK'))
  const invalid = proposalFixtures()
  invalid.input.exerciseGap = { reason: 'missing_movement' }
  const model = proposalRegistry()
  await assert.rejects(propose(invalid, model), /not allowed/)
  assert.deepEqual(model.calls, [])
})

test('audit tampering cannot masquerade as the recorded proposal', async () => {
  const state = proposalFixtures()
  const saved = await propose(state)
  state.audit.rows.get(saved.draftAuditId).draft_json.libraryApprovalGranted = true
  await assert.rejects(loadWorkoutExerciseProposal(state.pool, SCOPE, saved.draftAuditId), { code: 'exercise_proposal_audit_conflict' })
})

test('the installed AI SDK runs the Director and Creator roles through their actual structured-output contracts', async () => {
  const scripted = proposalRegistry()
  const instructions = []
  const model = new MockLanguageModelV3({ doGenerate: async ({ prompt }) => {
    instructions.push(prompt.find((entry) => entry.role === 'system').content)
    const input = JSON.parse(prompt.find((entry) => entry.role === 'user').content.find((entry) => entry.type === 'text').text).context
    const capability = input.task === 'assess_exercise_gap' ? scripted.registry.get('vortex/director', 'director') : scripted.registry.get('vortex/exercise-creator', 'exercise_creator')
    const response = await capability.invoke(input, {})
    return { content: [{ type: 'text', text: JSON.stringify(response.output) }], finishReason: { unified: 'stop', raw: 'stop' },
      usage: { inputTokens: { total: 50 }, outputTokens: { total: 100 } }, warnings: [] }
  } })
  const registry = createProgrammingStaffRegistry([['vortex/director', 'director'], ['vortex/exercise-creator', 'exercise_creator']].map(([id, role]) => ({
    id, role, version: 'sdk-contract-test', invoke: createProgrammingStaffModelInvoker({ model, role, modelVersion: 'sdk-mock' }),
  })))
  const result = await propose(proposalFixtures(), { registry })
  assert.equal(result.state, 'AI_PROPOSED', JSON.stringify(result.issues))
  assert.equal(instructions.length, 2)
  assert.match(instructions[0], /task assess_exercise_gap/)
  assert.match(instructions[1], /Vortex Exercise Creator/)
  assert.match(instructions[1], /Human review is mandatory/)
  assert.deepEqual(result.trace.calls.map((entry) => entry.role), ['director', 'exercise_creator'])
})
