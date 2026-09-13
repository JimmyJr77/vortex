import { normalizeCoachWorkoutRequest, programmingValueHash, immutableProgrammingValue } from './workoutProgrammingRequest.js'
import { programmingResourceRequests } from './workoutProgrammingDirector.js'
import { loadWorkoutProgrammingMaterials } from './workoutProgrammingLibrarians.js'
import { programmingCandidateMaterials } from './workoutProgrammingBuilder.js'
import { filterProgrammingCandidateEligibility } from './workoutProgrammingEligibility.js'
import { loadWorkoutProgrammingModification, modificationResourceSearches } from './workoutProgrammingModification.js'

/** Human-readable canonical choices; the model and coach still cannot authorize missing evidence or new cards. */
export async function loadWorkoutProgrammingChoices(pool, context, rawRequest) {
  const request = normalizeCoachWorkoutRequest(rawRequest)
  const modification = await loadWorkoutProgrammingModification({ pool, context, request })
  const materials = await loadWorkoutProgrammingMaterials(pool, context, modificationResourceSearches(programmingResourceRequests(request, 100), modification), { athleteRequest: request })
  const candidates = programmingCandidateMaterials(materials)
  const eligibility = filterProgrammingCandidateEligibility({ groups: candidates, request, athleteEvidence: materials.athleteEvidence })
  return immutableProgrammingValue({ requestHash: programmingValueHash(request), release: materials.resources[0]?.libraryRelease ?? null,
    findings: materials.athleteEvidence.findings, searchComplete: materials.programmingSearchComplete,
    components: candidates.map((group) => ({ key: group.key,
      exercises: group.candidates.map(({ card, profile, methodIds }) => ({
        ref: { exerciseCardId: card.id, variantId: card.variantId, deliveryProfileId: profile.id, cardVersion: card.cardVersion },
        name: card.displayName ?? card.canonicalName, purpose: profile.purpose, methodIds,
        eligibility: eligibility.reports.find((entry) => entry.componentKey === group.key && entry.deliveryProfileId === profile.id)?.status,
        findings: eligibility.reports.find((entry) => entry.componentKey === group.key && entry.deliveryProfileId === profile.id)?.result.findings ?? [],
      })),
      methods: materials.methods.filter((method) => group.candidates.some((entry) => entry.methodIds.includes(String(method.id))))
        .map((method) => ({ id: String(method.id), name: method.name, type: method.programming_type, summary: method.coach_summary ?? null })),
    })), creatorAuthorized: false, libraryApprovalGranted: false })
}
