import { assessWorkoutExerciseGap } from './workoutExerciseGapAssessment.js'
import { normalizeWorkoutExerciseGapResearchInput, researchWorkoutExerciseGapInSnapshot } from './workoutExerciseGapResearch.js'
import { createProgrammingStaffRun, ProgrammingStaffError } from './programmingStaffRuntime.js'
import { withCoachingLibrarySnapshot, libraryScopeId } from './coachingLibraryContext.js'
import { loadCanonicalAuthoringTaxonomy, saveCanonicalCardDraftInTransaction, withCanonicalCardTransaction } from './canonicalCardRepository.js'
import { loadReleasedCanonicalLibrary } from './canonicalLibraryRepository.js'
import { loadCanonicalExerciseResearchCatalog } from './canonicalExerciseResearchRepository.js'
import { findPotentialCanonicalDuplicates } from './canonicalCardAuthoring.js'
import { requiredEquipment } from './canonicalExerciseSelection.js'
import { exerciseCardDraftSchema, canonicalAiDraftOutputContract } from './canonicalAiCardDraftContract.js'
import { quarantineAiExerciseCardDraft } from './canonicalAiCardDraft.js'
import { immutableProgrammingValue, programmingValueHash } from './workoutProgrammingRequest.js'

const fail = (code, message) => { throw new ProgrammingStaffError(code, message) }
const sameKeys = (a, b) => programmingValueHash([...a].sort()) === programmingValueHash([...b].sort())

async function proposalContext(client, scope, rawInput, gap) {
  const research = await researchWorkoutExerciseGapInSnapshot(client, scope, rawInput)
  if (research.researchHash !== gap.researchHash) fail('exercise_gap_sources_changed', 'Exercise gap sources changed before the proposal could be recorded.')
  const taxonomy = await loadCanonicalAuthoringTaxonomy(client)
  let target = null
  if (gap.target) {
    const snapshot = await loadReleasedCanonicalLibrary(client, scope.facilityId)
    const card = snapshot.library.find((entry) => entry.id === gap.target.exerciseCardId && entry.variantId === gap.target.variantId && entry.cardVersion === gap.target.cardVersion)
    const definition = research.relatedDefinitions.find((entry) => entry.id === gap.target.exerciseCardId)
    const variant = definition?.variants.find((entry) => entry.id === gap.target.variantId)
    if (!card || !variant) fail('exercise_gap_sources_changed', 'The proposed delivery context no longer has its exact released source variant.')
    if (requiredEquipment(card, null).some((key) => !gap.unmetDemand.requiredEquipment.includes(key))) {
      fail('exercise_proposal_target_equipment_conflict', 'The proposed demand must retain the existing variant’s required physical equipment. Review that demand before creating a delivery profile.')
    }
    target = { card, definition, variant }
  }
  return { research, taxonomy, target, contextHash: programmingValueHash({ researchHash: research.researchHash, taxonomy, target }) }
}

function proposalContract(gap, context) {
  const schema = exerciseCardDraftSchema(context.taxonomy)
  const profileSchema = schema.properties.variants.items.properties.profiles.items
  profileSchema.properties.phaseKey.enum = [gap.phaseKey]
  let outputSchema = schema
  if (gap.reason === 'missing_delivery_profile') {
    outputSchema = { type: 'object', additionalProperties: false, required: ['profile', 'assumptions', 'uncertainties'], properties: {
      profile: profileSchema, assumptions: schema.properties.assumptions, uncertainties: schema.properties.uncertainties,
    } }
  } else {
    schema.properties.canonicalName.enum = [gap.unmetDemand.canonicalName]
    if (gap.unmetDemand.familyKey) schema.properties.familyKey.enum = [gap.unmetDemand.familyKey]
    for (const key of ['movementPatterns', 'bodyRegions', 'requiredEquipment']) {
      schema.properties[key].minItems = schema.properties[key].maxItems = gap.unmetDemand[key].length
      if (gap.unmetDemand[key].length) schema.properties[key].items.enum = gap.unmetDemand[key]
    }
    schema.properties.optionalEquipment.maxItems = 0
    schema.properties.variants.minItems = schema.properties.variants.maxItems = 1
    schema.properties.variants.items.properties.profiles.minItems = schema.properties.variants.items.properties.profiles.maxItems = 1
  }
  const contract = canonicalAiDraftOutputContract(outputSchema)
  return { outputSchema, parseOutput(raw) {
    const value = contract.parseOutput(raw)
    const profiles = gap.target ? [value.profile] : value.variants.flatMap((variant) => variant.profiles)
    for (const profile of profiles) {
      const dose = profile.dosage
      if (dose.setsMin > dose.setsMax || (dose.repsMin == null) !== (dose.repsMax == null) || dose.repsMin > dose.repsMax
        || dose.repsMin == null && dose.workSeconds == null) throw new TypeError('Proposed dose ranges must be ordered and specify repetitions or work time')
    }
    if (!gap.target && (!sameKeys(value.movementPatterns, gap.unmetDemand.movementPatterns) || !sameKeys(value.bodyRegions, gap.unmetDemand.bodyRegions)
      || !sameKeys(value.requiredEquipment, gap.unmetDemand.requiredEquipment) || value.optionalEquipment.length
      || gap.unmetDemand.familyKey && value.familyKey !== gap.unmetDemand.familyKey)) {
      throw new TypeError('The proposed movement must retain the researched taxonomy, equipment and declared family')
    }
    return value
  } }
}

function quarantineProposal(gap, source, raw, modelVersion) {
  if (!gap.target) {
    const result = quarantineAiExerciseCardDraft(raw, { modelVersion })
    return { kind: 'new_card', draft: result.draft, readiness: result.readiness }
  }
  // Reuse the existing profile normalizer/quarantine using actual source identity
  // and difficulty. The temporary carrier is never returned or saved as a card.
  const { card, definition, variant } = source.target
  if (definition.profiles.some((profile) => profile.variantId === variant.id && profile.key === raw.profile.profileKey)) {
    fail('exercise_proposal_duplicate_profile_key', 'Choose an unused profile key for this exact variant; existing profiles remain unchanged.')
  }
  const quarantined = quarantineAiExerciseCardDraft({ canonicalName: card.canonicalName, displayName: card.displayName, slug: card.slug,
    familyKey: card.familyId, description: definition.description, aliases: definition.aliases,
    movementPatterns: card.movementPatterns, bodyRegions: card.bodyRegions, requiredEquipment: gap.unmetDemand.requiredEquipment, optionalEquipment: [],
    variants: [{ variantKey: variant.key, displayName: variant.name, difficulty: card.difficulty, profiles: [raw.profile] }],
    assumptions: raw.assumptions, uncertainties: raw.uncertainties }, { modelVersion })
  return { kind: 'delivery_profile', target: gap.target, profile: quarantined.draft.variants[0].profiles[0],
    provenance: quarantined.draft.provenance, humanReviewRequired: true }
}

async function duplicateFindings(client, scope, proposal) {
  if (proposal.kind !== 'new_card') return []
  const catalog = await loadCanonicalExerciseResearchCatalog(client, scope.facilityId)
  if (!catalog.searchComplete) fail('exercise_proposal_search_incomplete', 'Complete canonical duplicate research before recording this proposal.')
  const definitions = [...new Map(catalog.rows.map((row) => [String(row.definition_id), { id: String(row.definition_id),
    canonicalName: row.canonical_name, displayName: row.display_name, aliases: row.aliases, familyKey: row.family_key }])).values()]
  const duplicates = findPotentialCanonicalDuplicates(proposal.draft, definitions)
  for (const row of catalog.rows) if (row.slug === proposal.draft.slug && !duplicates.some((entry) => entry.id === String(row.definition_id))) {
    duplicates.push({ id: String(row.definition_id), slug: row.slug, displayName: row.display_name, score: 100, exactCollision: true })
  }
  return duplicates
}

async function recordProposalAudit({ pool, scope, rawInput, assessment, source, proposal, issues, run }) {
  const client = await pool.connect()
  let discard
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
    run.assertActive()
    if (proposal) {
      const current = await proposalContext(client, scope, rawInput, assessment.exerciseGap)
      if (current.contextHash !== source.contextHash) fail('exercise_gap_sources_changed', 'Canonical proposal sources or authoring taxonomy changed during creation.')
      const duplicates = await duplicateFindings(client, scope, proposal)
      if (duplicates.length) fail('exercise_proposal_duplicate', 'The proposed card name or alias overlaps existing canonical content; review the existing identities first.')
    }
    run.assertActive()
    const trace = run.telemetry()
    const creator = trace.calls.find((entry) => entry.role === 'exercise_creator')
    const completeUsage = trace.calls.every((entry) => entry.usage)
    const content = { schemaVersion: '1.0.0', workflow: 'vortex_exercise_proposal_v1', scope, request: rawInput,
      assessment, proposal, issues, trace, state: proposal ? 'AI_PROPOSED' : 'NEEDS_COACH_REVIEW',
      canonicalDraftId: null, humanReviewRequired: true, libraryApprovalGranted: false }
    const envelope = { ...content, contentHash: programmingValueHash(content) }
    const result = await client.query(`INSERT INTO coaching.exercise_card_ai_draft_audit_v1
      (facility_id,user_id,request_hash,model_version,status,draft_json,validation_errors_json,latency_ms,input_tokens,output_tokens)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10) RETURNING id,created_at`,
    [scope.facilityId, scope.userId, assessment.research.researchHash, creator?.modelVersion ?? null, proposal ? 'validated' : 'invalid',
      JSON.stringify(envelope), JSON.stringify(issues), Math.min(2147483647, trace.calls.reduce((sum, call) => sum + call.latencyMs, 0)),
      completeUsage ? trace.calls.reduce((sum, call) => sum + call.usage.inputTokens, 0) : null,
      completeUsage ? trace.calls.reduce((sum, call) => sum + call.usage.outputTokens, 0) : null])
    run.assertActive()
    await client.query('COMMIT')
    return immutableProgrammingValue({ ...envelope, draftAuditId: String(result.rows[0].id), createdAt: new Date(result.rows[0].created_at).toISOString() })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch (rollbackError) { discard = rollbackError }
    throw error
  } finally { client.release(discard) }
}

/** One shared Director -> Creator budget; only server-researched gaps can enter quarantine. */
export async function proposeWorkoutExercise({ pool, context, rawInput, registry, runOptions = {} }) {
  normalizeWorkoutExerciseGapResearchInput(rawInput)
  rawInput = structuredClone(rawInput)
  const scope = { facilityId: libraryScopeId(context.facilityId, 'facilityId'), userId: libraryScopeId(context.userId, 'userId') }
  const run = createProgrammingStaffRun(registry, { maxCalls: 2, timeoutMs: 120000, perCallTimeoutMs: 20000,
    maxOutputTokens: 16000, perCallOutputTokens: 8000, ...runOptions })
  const assessment = await assessWorkoutExerciseGap({ pool, context: scope, rawInput, registry, staffRun: run })
  if (assessment.status !== 'GAP_CONFIRMED') return immutableProgrammingValue({ state: assessment.status, assessment, proposal: null,
    draftAuditId: null, humanReviewRequired: true, libraryApprovalGranted: false, trace: run.telemetry() })
  const gap = assessment.exerciseGap
  const source = await withCoachingLibrarySnapshot(pool, scope, (client) => proposalContext(client, scope, rawInput, gap))
  run.assertActive()
  let proposal
  try {
    const raw = await run.call({ capabilityId: 'vortex/exercise-creator', role: 'exercise_creator',
      input: { task: 'propose_gap_content', gap, taxonomy: source.taxonomy, target: source.target,
        boundaries: ['Return the exact existing canonical AI authoring schema.', 'This content is unverified and requires independent human review.',
          'Do not claim readiness, approved taxonomy, verified media, publication or a validated workout.'] }, ...proposalContract(gap, source) })
    proposal = quarantineProposal(gap, source, raw, run.telemetry().calls.at(-1).modelVersion)
  } catch (error) {
    if (['canceled', 'deadline_exceeded'].includes(error.code)) throw error
    run.assertActive()
    return recordProposalAudit({ pool, scope, rawInput, assessment, source, proposal: null,
      issues: [{ code: error.code ?? 'exercise_proposal_invalid', detail: String(error.message).slice(0, 1000) }], run })
  }
  return recordProposalAudit({ pool, scope, rawInput, assessment, source, proposal, issues: [], run })
}

/** Existing audit storage is a review queue, not a second exercise library. */
export async function loadWorkoutExerciseProposal(pool, context, id) {
  validateProposalId(id)
  return withCoachingLibrarySnapshot(pool, context, (client, scope) => readProposalAudit(client, scope, id))
}

function validateProposalId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new TypeError('A proposal audit UUID is required')
}

async function readProposalAudit(client, scope, id, lock = false) {
  const result = await client.query(`SELECT id,created_at,draft_json FROM coaching.exercise_card_ai_draft_audit_v1
    WHERE id=$1 AND facility_id=$2${lock ? ' FOR UPDATE' : ''}`, [id, scope.facilityId])
  const row = result.rows[0]
  if (!row || row.draft_json?.workflow !== 'vortex_exercise_proposal_v1') return null
  const { contentHash, ...content } = row.draft_json
  if (content.schemaVersion !== '1.0.0' || content.scope?.facilityId !== scope.facilityId || programmingValueHash(content) !== contentHash) {
    fail('exercise_proposal_audit_conflict', 'The stored proposal audit does not match its recorded content.')
  }
  return immutableProgrammingValue({ ...row.draft_json, draftAuditId: String(row.id), createdAt: new Date(row.created_at).toISOString() })
}

export function normalizeExerciseProposalAcceptanceInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length !== 1
    || typeof raw.expectedProposalHash !== 'string' || !/^[a-f0-9]{64}$/.test(raw.expectedProposalHash)) {
    throw new TypeError('Accept the reviewed proposal using its expectedProposalHash only')
  }
  return { expectedProposalHash: raw.expectedProposalHash }
}

function acceptanceResult(record, card, alreadyAccepted) {
  const origin = card.provenance_json?.exerciseProposal
  if (origin?.auditId !== record.draftAuditId || origin.contentHash !== record.contentHash) {
    fail('exercise_proposal_audit_conflict', 'The canonical draft has a conflicting proposal origin.')
  }
  return immutableProgrammingValue({ draftAuditId: record.draftAuditId, proposalHash: record.contentHash,
    canonicalCardId: String(card.id), cardVersion: Number(card.card_version), status: card.status,
    acceptedBy: origin.acceptedBy, acceptedAt: origin.acceptedAt, alreadyAccepted, libraryApprovalGranted: false })
}

/** Explicit human acceptance creates one ordinary canonical draft, never publication approval. */
export async function acceptWorkoutExerciseProposal(pool, context, id, rawInput) {
  validateProposalId(id)
  const { expectedProposalHash } = normalizeExerciseProposalAcceptanceInput(rawInput)
  const scope = { facilityId: libraryScopeId(context.facilityId, 'facilityId'), userId: libraryScopeId(context.userId, 'userId') }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await withCanonicalCardTransaction(pool, scope.facilityId, async (client) => {
        const record = await readProposalAudit(client, scope, id, true)
        if (!record) return null
        if (record.contentHash !== expectedProposalHash) fail('exercise_proposal_audit_conflict', 'Reopen the exact proposal before accepting it.')
        if (record.state !== 'AI_PROPOSED' || !record.proposal || record.assessment.status !== 'GAP_CONFIRMED') {
          fail('exercise_proposal_not_applicable', 'This attempt has no quarantined proposal to accept.')
        }
        if (record.proposal.kind !== 'new_card') {
          fail('exercise_proposal_revision_required', 'This profile needs a reviewed revision of its existing card. Keep the proposal quarantined until that revision workflow is available.')
        }
        const existing = await client.query(`SELECT id,card_version,status,provenance_json FROM coaching.exercise_definition_v1
          WHERE facility_id=$1 AND provenance_json->'exerciseProposal'->>'auditId'=$2`, [scope.facilityId, record.draftAuditId])
        if (existing.rows.length > 1) fail('exercise_proposal_audit_conflict', 'More than one canonical card references this proposal; review the library identities.')
        if (existing.rows[0]) return acceptanceResult(record, existing.rows[0], true)
        // Research hashes include the originating actor. Rehydrate that same source
        // context; the current authenticated human owns acceptance and the new draft.
        await proposalContext(client, record.scope, record.request, record.assessment.exerciseGap)
        if ((await duplicateFindings(client, scope, record.proposal)).length) {
          fail('exercise_proposal_duplicate', 'The proposal overlaps existing canonical content; review those identities before accepting it.')
        }
        const sourceProvenance = { ...record.proposal.draft.provenance, exerciseProposal: {
          auditId: record.draftAuditId, contentHash: record.contentHash, acceptedBy: scope.userId, acceptedAt: new Date().toISOString(),
        } }
        const saved = await saveCanonicalCardDraftInTransaction(client, scope.facilityId, scope.userId, record.proposal.draft,
          { sourceProvenance, changeSummary: `Accepted exercise proposal ${record.draftAuditId} as an unapproved canonical draft.` })
        const card = await client.query(`SELECT id,card_version,status,provenance_json FROM coaching.exercise_definition_v1
          WHERE facility_id=$1 AND id=$2`, [scope.facilityId, saved.id])
        return acceptanceResult(record, card.rows[0], false)
      }, { repeatableRead: true })
    } catch (error) {
      // A concurrent writer can commit while this transaction waits on the
      // canonical advisory lock. Retry with a fresh snapshot to recover its draft.
      if (attempt < 2 && ['40001', '23505'].includes(error.code)) continue
      if (error.code === '23505' || error.status === 409 && error.details?.duplicates?.length) {
        fail('exercise_proposal_duplicate', 'Canonical content already occupies this proposal’s identity. Reopen the library and review it before accepting.')
      }
      if (error.code === '40001') fail('exercise_gap_sources_changed', 'Canonical sources kept changing during acceptance. Reopen the proposal before retrying.')
      throw error
    }
  }
}
