import assert from 'node:assert/strict'
import test from 'node:test'
import { researchWorkoutExerciseGap, normalizeWorkoutExerciseGapResearchInput } from '../workoutExerciseGapResearch.js'
import { loadCanonicalExerciseResearchCatalog } from '../canonicalExerciseResearchRepository.js'
import { compositionFixtures } from './workoutProgrammingBuilderFixtures.js'
import { exerciseGapResearchFixtures as fixtures } from './workoutExerciseGapFixtures.js'
import { SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'

const research = (state, input = {}) => researchWorkoutExerciseGap(state.pool, SCOPE, { request: state.request, componentKey: 'strength', need: state.need, ...input })
const codes = (result) => result.issues.map((entry) => entry.code)

test('research uses one read snapshot, current canonical ranking and stable source evidence without creating a gap', async () => {
  const state = fixtures()
  const result = await research(state)
  const repeat = await research(state)
  assert.equal(result.status, 'RESEARCH_READY_FOR_CONTENT_REVIEW', JSON.stringify(result.issues))
  assert.equal(result.resources.componentKey, 'strength')
  assert.ok(result.resources.programming.candidates.length)
  assert.ok(result.eligibility.some((entry) => entry.status === 'ELIGIBLE'))
  assert.ok(result.relatedDefinitions.some((entry) => entry.eligibleProfileIds.length))
  assert.equal(result.coverage.includesAllLifecycleStates, true)
  assert.equal(result.coverage.contextualConstraintsAppliedToCatalog, false)
  assert.equal(result.sourceHash, repeat.sourceHash)
  assert.equal(result.researchHash, repeat.researchHash)
  assert.notEqual(result.researchAuditId, repeat.researchAuditId)
  assert.equal(result.exerciseGap, null)
  assert.equal(result.creatorAuthorized, false)
  assert.equal(result.libraryApprovalGranted, false)
  assert.throws(() => { result.need.aliases.push('changed') }, TypeError)
  assert.equal(state.researchCalls.filter((entry) => entry.sql.startsWith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')).length, 2)
  assert.equal(state.researchCalls.filter((entry) => entry.sql === 'COMMIT').length, 2)
  assert.ok(state.researchCalls.every((entry) => !/^\s*(INSERT|UPDATE|DELETE)/.test(entry.sql)))
})

test('drafts, unreleased profiles, archived aliases and missing classification remain visible for content review', async () => {
  const state = fixtures()
  const prototype = state.rows[0]
  state.rows.push({ ...prototype, definition_id: uuid(9001), definition_status: 'draft', canonical_name: 'Draft concept',
    display_name: 'Draft concept', aliases: [state.need.canonicalName], variant_id: null, profile_id: null },
  { ...prototype, definition_id: uuid(9002), definition_status: 'archived', canonical_name: 'Archived concept',
    display_name: 'Archived concept', aliases: [state.need.canonicalName], variant_id: uuid(9012), profile_id: uuid(9022), profile_status: 'archived' },
  { ...prototype, definition_id: uuid(9003), canonical_name: 'Unclassified concept', display_name: 'Unclassified concept',
    movement_patterns: [], body_regions: [], variant_id: null, profile_id: null })
  const result = await research(state)
  assert.ok(codes(result).includes('existing_canonical_identity'))
  const draft = result.relatedDefinitions.find((entry) => entry.id === uuid(9001))
  assert.equal(draft.matches.exactIdentity, true)
  assert.equal(draft.status, 'draft')
  assert.equal(draft.inCurrentRelease, false)
  assert.deepEqual(draft.eligibleProfileIds, [])
  assert.deepEqual(draft.profiles, [])
  assert.equal(result.relatedDefinitions.find((entry) => entry.id === uuid(9002)).status, 'archived')
  assert.equal(result.relatedDefinitions.find((entry) => entry.id === uuid(9003)).matches.incompleteClassification, true)
  assert.equal(result.exerciseGap, null)
})

test('an equipment rejection preserves the existing content instead of claiming a missing exercise', async () => {
  const source = compositionFixtures()
  for (const card of source.options.cards) for (const profile of card.deliveryProfiles) profile.equipmentRequired = ['barbell']
  const state = fixtures({ patch: { cards: source.options.cards } })
  const result = await research(state)
  assert.equal(result.resources.exercises.eligibleCount, 0)
  assert.ok(result.resources.exercises.rejectionCounts['unavailable_equipment:barbell'])
  assert.ok(result.relatedDefinitions.length)
  assert.equal(result.creatorAuthorized, false)
  assert.equal(result.exerciseGap, null)
})

test('unknown taxonomy, missing releases and missing methods are distinct research findings', async () => {
  const unknown = fixtures()
  const changed = await research(unknown, { need: { ...unknown.need, requiredEquipment: ['unmapped_sled'] } })
  assert.ok(codes(changed).includes('unknown_authoring_taxonomy'))
  assert.deepEqual(changed.sources.taxonomyIssues.equipment, ['unmapped_sled'])
  const noRelease = await research(fixtures({ patch: { noRelease: true } }))
  assert.ok(codes(noRelease).includes('library_release_unavailable'))
  const noMethods = await research(fixtures({ patch: { methods: [], profiles: [], prescriptions: [] } }))
  assert.ok(codes(noMethods).includes('programming_coverage_missing'))
  for (const result of [changed, noRelease, noMethods]) {
    assert.equal(result.status, 'RESEARCH_REQUIRES_REVIEW')
    assert.equal(result.exerciseGap, null)
    assert.equal(result.creatorAuthorized, false)
  }
})

test('catalog pagination and evidence limits cannot silently turn a shortlist into complete gap research', async () => {
  const state = fixtures()
  const prototype = state.rows[0]
  state.rows.splice(0, state.rows.length, ...Array.from({ length: 501 }, (_, index) => ({ ...prototype, definition_id: uuid(index + 10000) })))
  const result = await research(state)
  assert.equal(result.coverage.catalogRowCount, 501)
  assert.equal(result.coverage.definitionCount, 501)
  assert.equal(result.coverage.catalogSearchComplete, true)
  assert.equal(result.relatedDefinitions.length, 100)
  assert.equal(result.coverage.evidenceTruncated, true)
  assert.ok(codes(result).includes('research_evidence_truncated'))
  assert.deepEqual(state.researchCalls.filter((entry) => entry.sql.includes('canonical_exercise_gap_research')).map((entry) => entry.params), [[SCOPE.facilityId, 501, 0], [SCOPE.facilityId, 501, 500]])
  let calls = 0
  const incomplete = await loadCanonicalExerciseResearchCatalog({ async query() { calls += 1; return { rows: Array(501).fill(prototype) } } }, SCOPE.facilityId)
  assert.equal(calls, 20)
  assert.equal(incomplete.rows.length, 10000)
  assert.equal(incomplete.searchComplete, false)
})

test('source and demand changes invalidate research hashes; retrieval failures roll back instead of returning gap evidence', async () => {
  const state = fixtures()
  const baseline = await research(state)
  state.rows[0].definition_status = 'review'
  const edited = await research(state)
  assert.notEqual(edited.sourceHash, baseline.sourceHash)
  assert.notEqual(edited.researchHash, baseline.researchHash)
  const demand = await research(state, { need: { ...state.need, description: 'A different requested movement goal that needs independent content review.' } })
  assert.equal(demand.sourceHash, edited.sourceHash)
  assert.notEqual(demand.researchHash, edited.researchHash)
  const failed = fixtures({ patch: { failQuery: 'SELECT pm.*' } })
  await assert.rejects(research(failed), /database unavailable/)
  assert.ok(failed.pool.calls.some((entry) => entry.sql === 'ROLLBACK'))
  assert.equal(failed.pool.calls.at(-1).sql, 'RELEASE')
})

test('research rejects client authority, unknown fields, impossible clocks and omitted components before reading sources', async () => {
  const state = fixtures()
  const input = { request: state.request, componentKey: 'strength', need: state.need }
  for (const patch of [{ facilityId: '10' }, { exerciseGap: { confirmed: true } }, { creatorAuthorized: true }, { sourceHash: 'claimed' },
    { need: { ...state.need, approval: true } }, { componentKey: 'not_a_component' }, { need: { ...state.need, movementPatterns: [] } }]) {
    assert.throws(() => normalizeWorkoutExerciseGapResearchInput({ ...input, ...patch }), TypeError)
  }
  const noTumbling = { ...state.request, logistics: { ...state.request.logistics, tumblingMinutes: 0, totalBookedMinutes: state.request.logistics.athleticMinutes } }
  assert.throws(() => normalizeWorkoutExerciseGapResearchInput({ ...input, request: noTumbling, componentKey: 'body_control' }), /scheduled component/)
  assert.throws(() => normalizeWorkoutExerciseGapResearchInput({ ...input, request: { ...state.request, logistics: { ...state.request.logistics, totalBookedMinutes: 1 } } }))
  assert.equal(state.pool.calls.length, 0)
})
