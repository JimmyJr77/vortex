import Joi from 'joi'
import { randomUUID } from 'node:crypto'
import { normalizeCoachWorkoutRequest, parseProgrammingContract, programmingValueHash, immutableProgrammingValue } from './workoutProgrammingRequest.js'
import { SESSION_COMPONENT_ORDER } from './sessionComponentContract.js'
import { withCoachingLibrarySnapshot, libraryScopeId } from './coachingLibraryContext.js'
import { canonicalCardControlledTaxonomyIssues } from './canonicalCardRepository.js'
import { findPotentialCanonicalDuplicates } from './canonicalCardAuthoring.js'
import { loadCanonicalExerciseResearchCatalog } from './canonicalExerciseResearchRepository.js'
import { loadWorkoutProgrammingMaterialsInSnapshot } from './workoutProgrammingLibrarians.js'
import { programmingResourceRequests } from './workoutProgrammingDirector.js'
import { loadWorkoutProgrammingModification, modificationResourceSearches } from './workoutProgrammingModification.js'
import { programmingCandidateMaterials } from './workoutProgrammingBuilder.js'
import { filterProgrammingCandidateEligibility } from './workoutProgrammingEligibility.js'

const text = (max) => Joi.string().trim().min(1).max(max)
const keys = () => Joi.array().items(text(100)).max(20).unique().required()
const inputSchema = Joi.object({
  request: Joi.object().required(), componentKey: Joi.string().valid(...SESSION_COMPONENT_ORDER).required(),
  need: Joi.object({ canonicalName: text(160).required(), description: text(2000).min(20).required(),
    aliases: Joi.array().items(text(160)).max(20).unique().required(), familyKey: text(100).allow(null).required(),
    movementPatterns: keys().min(1), bodyRegions: keys().min(1), requiredEquipment: keys(),
  }).required(),
})

export function normalizeWorkoutExerciseGapResearchInput(raw) {
  const input = parseProgrammingContract(inputSchema, raw, 'Exercise gap research')
  const request = normalizeCoachWorkoutRequest(input.request)
  if (!programmingResourceRequests(request).some((entry) => entry.componentKey === input.componentKey)) {
    throw new TypeError('Exercise gap research requires a scheduled component')
  }
  return immutableProgrammingValue({ ...input, request })
}

function rankResearchDefinitions(rows, need, phaseKeys, materials, eligibility) {
  const definitions = new Map()
  for (const row of rows) {
    let card = definitions.get(String(row.definition_id))
    if (!card) {
      card = { id: String(row.definition_id), canonicalName: row.canonical_name, displayName: row.display_name,
        aliases: row.aliases ?? [], familyKey: row.family_key, description: row.description, cardVersion: row.card_version,
        status: row.definition_status, movementPatterns: row.movement_patterns ?? [], bodyRegions: row.body_regions ?? [],
        requiredEquipment: row.required_equipment ?? [], variants: [], profiles: [] }
      definitions.set(card.id, card)
    }
    if (row.variant_id && !card.variants.some((entry) => entry.id === String(row.variant_id))) {
      card.variants.push({ id: String(row.variant_id), key: row.variant_key, name: row.variant_name, status: row.variant_status })
    }
    if (row.profile_id) card.profiles.push({ id: String(row.profile_id), variantId: String(row.variant_id), key: row.profile_key,
      phaseKey: row.phase_key, role: row.role, purpose: row.purpose, status: row.profile_status, equipmentRequired: row.equipment_required ?? [] })
  }
  const cards = [...definitions.values()]
  const duplicateMatches = new Map(findPotentialCanonicalDuplicates(need, cards).map((entry) => [entry.id, entry]))
  const releasedIds = new Set((materials.release?.definition_ids ?? []).map(String))
  const eligibleProfiles = new Set(eligibility.reports.filter((entry) => entry.status === 'ELIGIBLE').map((entry) => entry.deliveryProfileId))
  return cards.map((card) => {
    const identity = duplicateMatches.get(card.id)
    const matches = { identityScore: identity?.score ?? 0, exactIdentity: identity?.exactCollision ?? false,
      family: !!need.familyKey && need.familyKey === card.familyKey,
      movementPatterns: need.movementPatterns.filter((key) => card.movementPatterns.includes(key)),
      bodyRegions: need.bodyRegions.filter((key) => card.bodyRegions.includes(key)),
      phaseKeys: [...new Set(card.profiles.filter((profile) => phaseKeys.includes(profile.phaseKey)).map((profile) => profile.phaseKey))],
      incompleteClassification: !card.movementPatterns.length || !card.bodyRegions.length }
    // Broad research deliberately includes partial/retired cards and phase alternatives.
    // Scoring orders evidence; it never establishes semantic equivalence or safety.
    const score = matches.identityScore + (matches.exactIdentity ? 100 : 0) + (matches.family ? 40 : 0)
      + 20 * matches.movementPatterns.length + 5 * matches.bodyRegions.length + 5 * matches.phaseKeys.length
    return { ...card, score, matches, inCurrentRelease: releasedIds.has(card.id),
      releasedVariantIds: [...new Set(materials.library.filter((entry) => String(entry.id) === card.id && entry.cardVersion === card.cardVersion).map((entry) => String(entry.variantId)))],
      eligibleProfileIds: card.profiles.filter((profile) => eligibleProfiles.has(profile.id)).map((profile) => profile.id) }
  }).filter((card) => card.score > 0 || card.matches.incompleteClassification)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

/**
 * Ground a proposed unmet demand in canonical content and current programming.
 * This read-only packet is input to content judgment, never an ExerciseGap grant.
 * Empty, truncated, unapproved or context-ineligible results cannot activate Creator.
 */
export async function researchWorkoutExerciseGap(pool, context, rawInput) {
  normalizeWorkoutExerciseGapResearchInput(rawInput)
  return withCoachingLibrarySnapshot(pool, context, (client, scope) => researchWorkoutExerciseGapInSnapshot(client, scope, rawInput))
}

/** Internal transaction boundary used when recording a freshly revalidated proposal. */
export async function researchWorkoutExerciseGapInSnapshot(client, context, rawInput) {
  const { request, componentKey, need } = normalizeWorkoutExerciseGapResearchInput(rawInput)
  const scope = { facilityId: libraryScopeId(context.facilityId, 'facilityId'), userId: libraryScopeId(context.userId, 'userId') }
    const modification = await loadWorkoutProgrammingModification({ context: scope, request, snapshotClient: client })
    const searches = modificationResourceSearches(programmingResourceRequests(request, 100), modification).filter((entry) => entry.componentKey === componentKey)
    const taxonomyIssues = await canonicalCardControlledTaxonomyIssues(client, { ...need, optionalEquipment: [], variants: [] })
    const materials = await loadWorkoutProgrammingMaterialsInSnapshot(client, scope, searches, { athleteRequest: request })
    const catalog = await loadCanonicalExerciseResearchCatalog(client, scope.facilityId)
    const resource = materials.resources[0]
    const eligibility = filterProgrammingCandidateEligibility({ groups: programmingCandidateMaterials(materials), request, athleteEvidence: materials.athleteEvidence })
    const related = rankResearchDefinitions(catalog.rows, need, searches[0].phaseKeys, materials, eligibility)
    const issues = []
    const issue = (code, detail) => issues.push({ code, detail })
    if (Object.values(taxonomyIssues).some((entries) => entries.length)) issue('unknown_authoring_taxonomy', 'The demand contains keys outside the existing canonical authoring vocabulary.')
    if (!catalog.searchComplete) issue('canonical_research_incomplete', 'The canonical lifecycle catalog exceeded the bounded search. Complete the catalog search before judging an exercise gap.')
    if (related.length > 100) issue('research_evidence_truncated', 'More than 100 related definitions require review. The returned shortlist cannot establish an exercise gap.')
    if (materials.libraryStatus !== 'ready') issue('library_release_unavailable', 'The current approved release is unavailable or contains no eligible cards. Resolve release coverage first.')
    if (!materials.programmingSearchComplete) issue('programming_search_incomplete', 'The programming library search did not complete.')
    if (!resource.programming.eligibleCount) issue('programming_coverage_missing', 'No published programming method matches the requested component; a new exercise cannot supply a missing method.')
    if (resource.exercises.eligibleCount > resource.exercises.candidates.length || resource.exercises.rejectionSamplesTruncated) {
      issue('context_evidence_truncated', 'Contextual exercise evidence is truncated. Complete that review before judging a gap.')
    }
    const exact = related.filter((card) => card.matches.exactIdentity)
    if (exact.length) issue('existing_canonical_identity', 'An existing name or alias matches the requested identity. Review that card and its delivery profiles before proposing new content.')
    const source = { catalogHash: programmingValueHash(catalog.rows), taxonomyIssues, release: resource.libraryRelease,
      libraryHash: programmingValueHash(materials.library), programmingHash: programmingValueHash(materials.methods),
      athleteEvidenceHash: programmingValueHash(materials.athleteEvidence),
      parent: modification?.context ?? null }
    const requestHash = programmingValueHash(request)
    const sourceHash = programmingValueHash(source)
    return immutableProgrammingValue({ schemaVersion: '1.0.0', researchAuditId: randomUUID(), requestRevision: request.revision,
      requestHash, researchHash: programmingValueHash({ scope, requestHash, componentKey, need, sourceHash }), componentKey, need, scope,
      sourceHash, sources: source,
      coverage: { catalogSearchComplete: catalog.searchComplete, catalogRowCount: catalog.rows.length,
        definitionCount: new Set(catalog.rows.map((row) => row.definition_id)).size, relatedDefinitionCount: related.length,
        evidenceTruncated: related.length > 100, programmingSearchComplete: materials.programmingSearchComplete,
        includesAllLifecycleStates: true, contextualConstraintsAppliedToCatalog: false },
      status: issues.length ? 'RESEARCH_REQUIRES_REVIEW' : 'RESEARCH_READY_FOR_CONTENT_REVIEW',
      relatedDefinitions: related.slice(0, 100), resources: resource, eligibility: eligibility.reports,
      athleteFindings: materials.athleteEvidence.findings, issues,
      exerciseGap: null, creatorAuthorized: false, libraryApprovalGranted: false,
    })
}
