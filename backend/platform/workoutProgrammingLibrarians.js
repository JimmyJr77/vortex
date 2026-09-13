import { createHash, randomUUID } from 'node:crypto'
import { normalizeWorkoutIntent, SESSION_PHASE_ORDER } from './canonicalWorkoutContract.js'
import { normalizeSessionComponentPlan, SESSION_COMPONENT_ORDER } from './sessionComponentContract.js'
import { demandSignature, phaseCandidates, requiredEquipment, resolveAnchorPhaseKeys } from './canonicalExerciseSelection.js'
import { loadReleasedCanonicalLibrary } from './canonicalLibraryRepository.js'
import { loadPublishedProgrammingMethods } from './programmingLibraryRepository.js'
import { libraryScopeId, withCoachingLibrarySnapshot } from './coachingLibraryContext.js'
import { loadWorkoutAthleteEvidence } from './workoutAthleteEvidence.js'
import { scoreProgrammingMethodForBlock } from './programmingValidation.js'
import { normalizePhaseKey } from './sessionPhaseKeys.js'

function object(raw, path, fields) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError(`${path} must be an object`)
  const unknown = Object.keys(raw).filter((key) => !fields.includes(key))
  if (unknown.length) throw new TypeError(`${path} contains unknown fields: ${unknown.join(', ')}`)
}

function reference(card, profile) {
  return {
    exerciseCardId: String(card.id), variantId: String(card.variantId ?? card.id),
    deliveryProfileId: profile ? String(profile.id) : null, cardVersion: card.cardVersion,
  }
}

function canonicalReferenceId(value, field) {
  // Exercise definitions, variants and delivery profiles use UUID columns;
  // programming methods and authenticated facility/user IDs use bigint columns.
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new TypeError(`${field} must be a canonical UUID`)
  }
  return value.toLowerCase()
}

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

function searchRequest(raw) {
  object(raw, 'search', ['intent', 'componentKey', 'phaseKeys', 'equipment', 'equipmentScheduling', 'limit', 'requestRevision', 'downstreamExercises', 'preferredProgrammingMethodIds', 'excludedProgrammingMethodIds', 'preferredExercises', 'pinnedExercises', 'pinnedProgrammingMethodIds'])
  if (!SESSION_COMPONENT_ORDER.includes(raw.componentKey)) throw new TypeError('componentKey must be a Vortex session component')
  if (!Array.isArray(raw.phaseKeys) || !raw.phaseKeys.length || raw.phaseKeys.length > SESSION_PHASE_ORDER.length
    || raw.phaseKeys.some((key) => !SESSION_PHASE_ORDER.includes(key))
    || new Set(raw.phaseKeys).size !== raw.phaseKeys.length) throw new TypeError('phaseKeys must be unique existing delivery-profile phases')
  if (typeof raw.requestRevision !== 'string' || !raw.requestRevision.trim() || raw.requestRevision.length > 120) {
    throw new TypeError('requestRevision is required and must be at most 120 characters')
  }
  const limit = raw.limit ?? 25
  const equipmentScheduling = raw.equipmentScheduling ?? 'simultaneous'
  if (!['simultaneous', 'waves'].includes(equipmentScheduling)) throw new TypeError('equipmentScheduling must be simultaneous or waves')
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('limit must be from 1 to 100')
  // This boundary requires known group/clock context rather than the legacy
  // normalizer's nullable defaults. Other intent fields retain canonical rules.
  for (const field of ['durationMinutes', 'athleteCount', 'coachCount', 'ageMin', 'ageMax']) {
    if (!Number.isSafeInteger(raw.intent?.[field])) throw new TypeError(`intent.${field} must be an integer`)
  }
  const intent = normalizeWorkoutIntent(raw.intent)
  const plan = normalizeSessionComponentPlan({
    durationMinutes: intent.durationMinutes,
    equipment: { available: intent.equipmentAvailable, quantities: intent.equipmentQuantities, excluded: intent.equipmentAvoid },
    components: [{ key: raw.componentKey, budgetSeconds: 1, ...(raw.equipment === undefined ? {} : { equipment: raw.equipment }) }],
  })
  const equipment = plan.components[0].equipment
  const parseReferences = (references, field) => {
    if (!Array.isArray(references) || references.length > 100) throw new TypeError(`${field} must be an array of at most 100 canonical references`)
    return references.map((ref) => {
      object(ref, `${field} reference`, ['exerciseCardId', 'variantId', 'deliveryProfileId', 'cardVersion'])
      if (!Number.isSafeInteger(ref.cardVersion) || ref.cardVersion < 1) throw new TypeError(`${field} cardVersion must be a positive integer`)
      return {
        exerciseCardId: canonicalReferenceId(ref.exerciseCardId, 'exerciseCardId'),
        variantId: canonicalReferenceId(ref.variantId, 'variantId'),
        deliveryProfileId: canonicalReferenceId(ref.deliveryProfileId, 'deliveryProfileId'),
        cardVersion: ref.cardVersion,
      }
    })
  }
  const downstream = parseReferences(raw.downstreamExercises === undefined ? [] : raw.downstreamExercises, 'downstreamExercises')
  const pinnedExercises = parseReferences(raw.pinnedExercises === undefined ? [] : raw.pinnedExercises, 'pinnedExercises')
  const preferredExercises = parseReferences(raw.preferredExercises === undefined ? [] : raw.preferredExercises, 'preferredExercises')
  const methodIds = (value, field) => {
    if (value === undefined) return []
    if (!Array.isArray(value) || value.length > 100) throw new TypeError(`${field} must be an array of at most 100 IDs`)
    return [...new Set(value.map((id) => libraryScopeId(id, field)))]
  }
  const preferredMethodIds = methodIds(raw.preferredProgrammingMethodIds, 'preferredProgrammingMethodIds')
  const excludedMethodIds = methodIds(raw.excludedProgrammingMethodIds, 'excludedProgrammingMethodIds')
  const pinnedMethodIds = methodIds(raw.pinnedProgrammingMethodIds, 'pinnedProgrammingMethodIds')
  if (preferredMethodIds.some((id) => excludedMethodIds.includes(id))) throw new RangeError('programming methods cannot be both preferred and excluded')
  return {
    intent, componentKey: raw.componentKey, phaseKeys: [...raw.phaseKeys], equipment, equipmentScheduling, limit,
    requestRevision: raw.requestRevision, downstream, preferredMethodIds, excludedMethodIds, preferredExercises, pinnedExercises, pinnedMethodIds,
  }
}

/**
 * Read-only, database-grounded specialist services. No model calls or writes.
 * Results are candidates for whole-session composition, not approved prescriptions.
 * Empty search results never authorize Exercise Creator or library publication.
 */
export async function searchWorkoutProgrammingResources(pool, context, raw) {
  const request = searchRequest(raw)
  return withCoachingLibrarySnapshot(pool, context, (client, scope) => searchScopedResources(client, scope, request))
}

/** All component searches for one Director decision share a database snapshot. */
export async function searchWorkoutProgrammingResourcesBatch(pool, context, rawRequests) {
  const materials = await loadWorkoutProgrammingMaterials(pool, context, rawRequests)
  return materials.resources
}

/** Internal composition material, hydrated within one authenticated snapshot. */
export async function loadWorkoutProgrammingMaterials(pool, context, rawRequests, { athleteRequest = null } = {}) {
  if (!Array.isArray(rawRequests) || rawRequests.length < 1 || rawRequests.length > 5) throw new TypeError('A staff search batch must contain one to five components')
  const requests = rawRequests.map(searchRequest)
  if (new Set(requests.map((request) => request.componentKey)).size !== requests.length) throw new TypeError('Duplicate components in staff search batch')
  return withCoachingLibrarySnapshot(pool, context, async (client, scope) => {
    const snapshot = await loadReleasedCanonicalLibrary(client, scope.facilityId)
    const methods = await loadPublishedProgrammingMethods(client, scope)
    const athleteEvidence = athleteRequest ? await loadWorkoutAthleteEvidence(client, scope, athleteRequest) : null
    const results = []
    for (const request of requests) results.push(await searchScopedResources(client, scope, request, snapshot, methods))
    return freeze({ resources: results, library: snapshot.library, release: snapshot.release, methods: methods.methods,
      libraryStatus: snapshot.status, programmingSearchComplete: methods.searchComplete, athleteEvidence })
  })
}

async function searchScopedResources(client, scope, request, sharedSnapshot = null, sharedMethods = null) {
  const snapshot = sharedSnapshot ?? await loadReleasedCanonicalLibrary(client, scope.facilityId)
  const { library, release } = snapshot
  const downstreamCards = request.downstream.map((ref) => {
    const card = library.find((entry) => String(entry.id) === ref.exerciseCardId && String(entry.variantId) === ref.variantId
      && entry.cardVersion === ref.cardVersion && entry.deliveryProfiles.some((profile) => String(profile.id) === ref.deliveryProfileId))
    if (!card) throw new RangeError('Downstream reference is unavailable in the current facility release or has a stale version')
    return card
  })
  const signature = downstreamCards.length ? demandSignature(downstreamCards) : null
  const anchorPhases = new Set(resolveAnchorPhaseKeys(request.intent))
  // Narrow availability without changing whole-session required preferences:
  // an equipment requirement can be satisfied by a different component.
  const scopedIntent = {
    ...request.intent,
    equipmentAvailable: request.equipment.allowed,
    equipmentQuantities: request.equipment.quantities,
    focuses: [...request.intent.focuses, ...request.equipment.preferred.filter((value) => !request.intent.focuses.some((focus) =>
      focus.facet === 'equipment' && focus.value === value && ['preferred', 'strong_preference'].includes(focus.strength)))
      .map((value) => ({ facet: 'equipment', value, scopes: ['whole_session'], strength: 'preferred', weight: 70 }))],
  }
  const rejectionCounts = {}
  const rejectionSamples = []
  let rejectedCount = 0
  const exercises = request.phaseKeys.flatMap((phaseKey) => phaseCandidates(
    library, { phaseKey }, scopedIntent, rejectionCounts,
    { isAnchor: anchorPhases.has(phaseKey), anchorDemandSignature: signature, equipmentScheduling: request.equipmentScheduling },
    { allProfiles: true, onRejected: ({ card, profile, reasons }) => {
      rejectedCount += 1
      if (rejectionSamples.length < 100) rejectionSamples.push({ ref: reference(card, profile), phaseKey, reasons })
    } },
  )).map((entry) => {
    const bonus = request.preferredExercises.some((ref) => ref.exerciseCardId === String(entry.card.id)
      && ref.variantId === String(entry.card.variantId) && ref.deliveryProfileId === String(entry.profile.id) && ref.cardVersion === entry.card.cardVersion) ? 20 : 0
    return bonus ? { ...entry, score: entry.score + bonus, components: { ...entry.components, coachExactReference: bonus } } : entry
  }).sort((a, b) => b.score - a.score || b.jitter - a.jitter
    || String(a.card.id).localeCompare(String(b.card.id)) || String(a.profile.id).localeCompare(String(b.profile.id)))

  // Fetch all pages before ranking. Never let name ordering / first-page size
  // make a canonical method disappear from the programming librarian's pool.
  const { methods, searchComplete: methodSearchComplete } = sharedMethods ?? await loadPublishedProgrammingMethods(client, scope)
  const methodRejections = []
  const programmingCandidates = methods.flatMap((method) => request.phaseKeys.flatMap((phaseKey) => {
    const id = String(method.id)
    const profile = method.phase_profiles.find((entry) => normalizePhaseKey(entry.phaseKey) === phaseKey)
    const reasons = []
    if (request.excludedMethodIds.includes(id)) reasons.push('explicit_programming_method_exclusion')
    if (profile?.role === 'avoid' || method.incompatible_phases.some((key) => normalizePhaseKey(key) === phaseKey)) reasons.push('incompatible_programming_phase')
    if (!profile && normalizePhaseKey(method.best_session_phase) !== phaseKey
      && !method.compatible_session_phases.some((key) => normalizePhaseKey(key) === phaseKey)) reasons.push('programming_phase_not_supported')
    if (reasons.length) { methodRejections.push({ programmingMethodId: id, phaseKey, reasons }); return [] }
    const baseScore = scoreProgrammingMethodForBlock(method, {
      phaseKey, groupSize: request.intent.athleteCount, youth: request.intent.ageMin < 18,
      lowImpact: request.intent.limitations.includes('low_impact') || request.intent.modifiers.includes('reduce_impact'),
    })
    const preferenceBonus = request.preferredMethodIds.includes(id) ? 20 : 0
    return [{
      programmingMethodId: id, name: method.name, phaseKey, phaseRole: profile?.role ?? 'conditional',
      score: baseScore + preferenceBonus, scoreComponents: { existingBlockScore: baseScore, coachPreference: preferenceBonus },
      rationale: profile?.phaseRationale ?? method.coach_summary ?? method.definition ?? '',
      requiresBlockValidation: true,
    }]
  })).sort((a, b) => b.score - a.score || a.programmingMethodId.localeCompare(b.programmingMethodId) || a.phaseKey.localeCompare(b.phaseKey))

  const missingPreferredMethodIds = request.preferredMethodIds.filter((id) => !methods.some((method) => String(method.id) === id))
  const sameRef = (a, b) => ['exerciseCardId', 'variantId', 'deliveryProfileId', 'cardVersion'].every((key) => a[key] === b[key])
  // Ranking limits must never hide an eligible coach lock. Pins do not waive
  // eligibility and may extend the returned shortlist beyond its ranked limit.
  const selectedExercises = exercises.filter((entry, index) => index < request.limit
    || request.pinnedExercises.some((ref) => sameRef(ref, reference(entry.card, entry.profile))))
  const selectedMethods = programmingCandidates.filter((entry, index) => index < request.limit || request.pinnedMethodIds.includes(entry.programmingMethodId))
  const exerciseStatus = snapshot.status !== 'ready' ? 'LIBRARY_UNAVAILABLE'
    : exercises.length ? 'MATCHES' : 'NO_ELIGIBLE_MATCH'
  return freeze({
    schemaVersion: '1.0.0',
    searchAuditId: randomUUID(),
    requestRevision: request.requestRevision,
    requestHash: createHash('sha256').update(JSON.stringify(request)).digest('hex'),
    componentKey: request.componentKey,
    libraryRelease: release ? { id: String(release.id), version: release.version, ruleVersion: release.rule_version } : null,
    exercises: {
      status: exerciseStatus,
      candidates: selectedExercises.map(({ card, profile, score, components }) => ({
        ref: reference(card, profile), name: card.displayName ?? card.canonicalName, phaseKey: profile.phaseKey,
        score, scoreComponents: components, rationale: profile.purpose,
        unknownQuantityKeys: requiredEquipment(card, profile).filter((key) => request.equipment.quantities[key] == null),
      })),
      eligibleCount: exercises.length,
      searchedVariantCount: library.length,
      rejectionCounts, rejectionSamples, rejectedCount,
      rejectionSamplesTruncated: rejectedCount > rejectionSamples.length,
      releaseStatus: snapshot.status,
      unavailablePinnedExercises: request.pinnedExercises.filter((ref) => !selectedExercises.some((entry) => sameRef(ref, reference(entry.card, entry.profile)))),
    },
    programming: {
      status: !methodSearchComplete ? 'SEARCH_INCOMPLETE' : programmingCandidates.length ? 'MATCHES' : 'NO_ELIGIBLE_MATCH',
      candidates: selectedMethods, eligibleCount: programmingCandidates.length,
      searchedMethodCount: methods.length, searchComplete: methodSearchComplete,
      rejections: methodRejections.slice(0, 100), rejectionsTruncated: methodRejections.length > 100,
      missingPreferredMethodIds,
      unavailablePinnedProgrammingMethodIds: request.pinnedMethodIds.filter((id) => !selectedMethods.some((entry) => entry.programmingMethodId === id)),
    },
    // A true gap also requires duplicate/draft-library research and review of
    // alternative constraints. Neither zero matches nor outages prove a gap.
    exerciseGap: null,
    creatorAuthorized: false,
    nextAction: exerciseStatus === 'LIBRARY_UNAVAILABLE' ? 'review_library_release'
      : exerciseStatus === 'NO_ELIGIBLE_MATCH' ? 'review_constraints_and_library_coverage'
        : !methodSearchComplete ? 'complete_programming_search'
          : !programmingCandidates.length ? 'review_programming_coverage' : 'compose_and_validate_session',
  })
}
