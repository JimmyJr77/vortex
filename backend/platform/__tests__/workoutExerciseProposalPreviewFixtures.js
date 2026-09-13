import { proposalFixtures, proposalRegistry, syntheticGapDraft } from './workoutExerciseProposalFixtures.js'
import { quarantineAiExerciseCardDraft } from '../canonicalAiCardDraft.js'
import { uuid } from './workoutProgrammingLibrarianFixtures.js'
import { stagedRevisionPreviewFixture } from './canonicalStagedRevisionPreviewFixtures.js'

/** Loopback preview only. Source/model/storage rows are synthetic; services and contracts are production code. */
export function exerciseProposalPreviewFixtures() {
  const state = proposalFixtures()
  const cards = new Map()
  const staged = stagedRevisionPreviewFixture(state)
  const control = { mode: 'new_card', delayMs: 0, denyLibrary: false, inFlight: 0, lastInput: null, creatorCalls: 0 }
  const pool = { async connect() {
    const client = await state.pool.connect()
    const stagedQuery = staged.connect()
    const pending = new Map()
    return { async query(sql, params = []) {
      const stagedResult = await stagedQuery(sql, params)
      if (stagedResult) return stagedResult
      if (sql.startsWith('SELECT id,to_char(created_at')) {
        const rows = [...state.audit.rows.values()].filter((row) => row.facility_id === params[0]
          && row.draft_json.workflow === 'vortex_exercise_proposal_v1').sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id))
          .filter((row) => !params[1] || row.created_at.toISOString() < params[1] || row.created_at.toISOString() === params[1] && row.id < params[2])
        return { rows: rows.slice(0, params[3]).map((row) => ({ id: row.id, created_at: row.created_at.toISOString(),
          name: row.draft_json.request.need.canonicalName, component_key: row.draft_json.request.componentKey,
          state: row.draft_json.state, kind: row.draft_json.proposal?.kind ?? null })) }
      }
      if (sql.startsWith('SELECT id,card_version,status,provenance_json')) {
        return { rows: [...cards.values(), ...pending.values()].filter((card) => card.facilityId === params[0]
          && (sql.includes("provenance_json->'exerciseProposal'") ? card.provenance.exerciseProposal?.auditId === params[1] : card.id === params[1]))
          .map((card) => ({ id: card.id, card_version: card.cardVersion, status: card.status, provenance_json: card.provenance })) }
      }
      if (sql.includes('FROM coaching.exercise_definition_v1 definition')) return { rows: [] }
      if (sql.startsWith('INSERT INTO coaching.exercise_definition_v1')) {
        const provenance = JSON.parse(params[22])
        const record = state.audit.rows.get(provenance.exerciseProposal.auditId).draft_json
        const card = { ...structuredClone(record.proposal.draft), id: uuid(91000 + cards.size), facilityId: params[0], cardVersion: 1,
          createdBy: Number(params[21]), reviewedBy: null, approvedBy: null, updatedAt: new Date().toISOString(), provenance,
          reviews: [], revisions: [], relationships: [], readiness: record.proposal.readiness, testPacket: null }
        card.variants[0].id = uuid(92000 + cards.size); card.variants[0].profiles[0].id = uuid(93000 + cards.size)
        pending.set(card.id, card)
        return { rows: [{ id: card.id }] }
      }
      if (sql.startsWith('INSERT INTO coaching.exercise_variant_v1')) return { rows: [{ id: [...pending.values()][0].variants[0].id }] }
      if (sql.startsWith('INSERT INTO coaching.exercise_delivery_profile_v1')) return { rows: [{ id: [...pending.values()][0].variants[0].profiles[0].id }] }
      if (/^(INSERT INTO coaching\.exercise_card_revision_v1|DELETE FROM coaching\.exercise_taxonomy_|UPDATE coaching\.exercise_(variant|delivery_profile)_v1)/.test(sql)) return { rows: [] }
      if (sql === 'COMMIT') for (const [id, card] of pending) cards.set(id, card)
      if (sql === 'ROLLBACK') pending.clear()
      return client.query(sql, params)
    }, release: (error) => client.release(error) }
  } }
  const model = proposalRegistry({ judge(output, input) {
    if (control.mode === 'needs_review') { output.needAssessment = 'needs_coach_review'; output.questions = ['Confirm the intended stimulus before adding content.'] }
    if (control.mode === 'reuse') {
      const candidate = input.research.relatedDefinitions.find((card) => card.eligibleProfileIds.length)
      if (!candidate) throw new Error('Synthetic reuse requires an eligible source')
      output.proposedKind = 'none'; output.alternatives.find((entry) => entry.definitionId === candidate.id).disposition = 'reusable'
    }
    if (control.mode === 'profile') {
      const target = state.rows.find((row) => row.phase_key === 'output')
      output.proposedKind = 'missing_delivery_profile'; output.targetDefinitionId = target.definition_id; output.targetVariantId = target.variant_id
      output.alternatives.find((entry) => entry.definitionId === target.definition_id).disposition = 'missing_delivery_profile'
    }
  }, creator(draft) {
    control.creatorCalls++
    if (control.mode === 'invalid') draft.approved = true
  }, async duringCreator(_input, context) {
    if (control.delayMs) await new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(Object.assign(new Error('Synthetic creator canceled'), { code: 'canceled' })) }
      const timer = setTimeout(() => { context.signal.removeEventListener('abort', abort); resolve() }, control.delayMs)
      context.signal.addEventListener('abort', abort, { once: true })
      if (context.signal.aborted) abort()
    })
  } })
  const terms = (values) => [...values].map((key, index) => ({ id: index + 1, key, name: key.replaceAll('_', ' ') }))
  const taxonomy = { tenets: [], methodologies: [], physiology: [], sports: [], intents: [],
    patterns: terms(state.taxonomy.movement_pattern), bodyRegions: terms(state.taxonomy.body_region), equipment: terms(state.taxonomy.equipment) }
  const getCard = (id) => {
    if (cards.has(id)) return cards.get(id)
    if (id === staged.source.id) return staged.source
    const source = state.rows.find((row) => row.definition_id === id)
    if (!source) return null
    const { draft, readiness } = quarantineAiExerciseCardDraft(syntheticGapDraft({ unmetDemand: { canonicalName: source.canonical_name,
      familyKey: source.family_key, movementPatterns: source.movement_patterns, bodyRegions: source.body_regions, requiredEquipment: source.required_equipment }, phaseKey: source.phase_key }),
    { modelVersion: 'synthetic-source-rendering' })
    return { ...draft, id, cardVersion: source.card_version, status: source.definition_status, readiness,
      updatedAt: source.definition_updated_at, createdBy: 8, reviews: [], revisions: [], relationships: [], testPacket: null,
      variants: [{ ...draft.variants[0], id: source.variant_id, profiles: [{ ...draft.variants[0].profiles[0], id: source.profile_id }] }] }
  }
  return { ...state, pool, cards, staged, control, taxonomy, getCard, registry: model.registry, reset() {
    if (control.inFlight) throw new Error('Synthetic exercise work is still running')
    state.audit.rows.clear(); cards.clear(); staged.reset(); control.mode = 'new_card'; control.delayMs = 0; control.denyLibrary = false; control.lastInput = null; control.creatorCalls = 0
  } }
}
