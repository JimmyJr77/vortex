import Joi from 'joi'
import { VORTEX_PREPARATION_FRAMEWORK_VERSION, VORTEX_PREPARATION_PURPOSES, VORTEX_PREPARATION_SECTION } from '../shared/vortexPreparationFramework.js'
import { demandSignature, approvedTaxonomyAssignments } from './canonicalExerciseSelection.js'
import { immutableProgrammingValue, programmingValueHash, parseProgrammingContract } from './workoutProgrammingRequest.js'

export function deriveProgrammingPreparationDemand(activities) {
  const downstream = activities.filter((entry) => entry.componentKey !== 'prepare_and_access')
  const exposures = downstream.map((entry) => ({ demandId: entry.activityId, componentKey: entry.componentKey,
    ref: { exerciseCardId: entry.card.id, variantId: entry.card.variantId, deliveryProfileId: entry.profile.id, cardVersion: entry.card.cardVersion },
    exerciseName: entry.card.displayName ?? entry.card.canonicalName, familyId: entry.card.familyId,
    movementPatterns: entry.card.movementPatterns ?? [], anatomyProfile: entry.card.anatomyProfile ?? {},
    movementGeometry: entry.card.movementGeometry ?? {}, taskDemands: entry.card.taskDemands ?? {},
    stressProfile: entry.card.stressProfile ?? {}, taxonomy: approvedTaxonomyAssignments(entry.card, entry.profile),
    dose: entry.dose, doseHash: programmingValueHash(entry.dose),
  }))
  const content = { frameworkVersion: VORTEX_PREPARATION_FRAMEWORK_VERSION, frameworkHash: programmingValueHash(VORTEX_PREPARATION_SECTION),
    exposures, signature: demandSignature(downstream.map((entry) => entry.card)) }
  return immutableProgrammingValue(structuredClone({ ...content, downstreamHash: programmingValueHash(content) }))
}

function preparationMatch(card, profile, exposure) {
  const reviewedTargets = card.compositionProfile?.preparesFor ?? []
  if (reviewedTargets.some((target) => [exposure.familyId, exposure.ref.exerciseCardId, exposure.ref.variantId].includes(target))) return true
  if ((card.movementPatterns ?? []).some((pattern) => exposure.movementPatterns.includes(pattern))) return true
  const meaningfulFacets = ['training_family', 'athletic_niche']
  return approvedTaxonomyAssignments(card, profile).some((assignment) => meaningfulFacets.includes(assignment.facetType)
    && exposure.taxonomy.some((entry) => entry.facetType === assignment.facetType && entry.key === assignment.key))
}

export function preparationCapabilityContract({ request, demand, candidates }) {
  const profiles = candidates.map((entry) => entry.profile.id)
  const methods = [...new Set(candidates.flatMap((entry) => entry.methodIds))]
  const demandIds = demand.exposures.map((entry) => entry.demandId)
  const schema = Joi.object({ requestRevision: Joi.string().valid(request.revision).required(), downstreamHash: Joi.string().valid(demand.downstreamHash).required(),
    summary: Joi.string().max(1500).required(), selections: Joi.array().min(3).max(20).unique('deliveryProfileId').items(Joi.object({
      deliveryProfileId: Joi.string().valid(...profiles).required(), programmingMethodId: Joi.string().valid(...methods).required(),
      role: Joi.string().valid('base', 'position_rehearsal', 'progressive_bridge').required(),
      purposes: Joi.array().items(Joi.string().valid(...VORTEX_PREPARATION_PURPOSES)).min(1).unique().required(),
      addressesDemandIds: Joi.array().items(Joi.string().valid(...demandIds)).unique().required(), rationale: Joi.string().max(800).required(),
    })).required(), watchPoints: Joi.array().items(Joi.string().max(600)).max(20).required() })
  const selectionProperties = {
    deliveryProfileId: { type: 'string', enum: profiles }, programmingMethodId: { type: 'string', enum: methods },
    role: { type: 'string', enum: ['base', 'position_rehearsal', 'progressive_bridge'] },
    purposes: { type: 'array', minItems: 1, items: { type: 'string', enum: VORTEX_PREPARATION_PURPOSES } },
    addressesDemandIds: { type: 'array', items: { type: 'string', enum: demandIds } }, rationale: { type: 'string', maxLength: 800 },
  }
  return { outputSchema: { type: 'object', additionalProperties: false, required: ['requestRevision', 'downstreamHash', 'summary', 'selections', 'watchPoints'],
    properties: { requestRevision: { type: 'string', enum: [request.revision] }, downstreamHash: { type: 'string', enum: [demand.downstreamHash] },
      summary: { type: 'string', maxLength: 1500 }, selections: { type: 'array', minItems: 3, maxItems: 20, items: {
        type: 'object', additionalProperties: false, required: Object.keys(selectionProperties), properties: selectionProperties } },
      watchPoints: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 600 } },
    } }, parseOutput(raw) {
    const proposal = parseProgrammingContract(schema, raw, 'Prepare & Access proposal')
    const positions = proposal.selections.filter((entry) => entry.role === 'position_rehearsal')
    const bridges = proposal.selections.filter((entry) => entry.role === 'progressive_bridge')
    if (positions.length !== 1 || bridges.length !== 1 || !proposal.selections.some((entry) => entry.role === 'base')) throw new RangeError('Preparation needs its familiar base and exactly two daily-specific tasks')
    const coveredPurposes = new Set(proposal.selections.flatMap((entry) => entry.purposes))
    if (VORTEX_PREPARATION_PURPOSES.some((purpose) => !coveredPurposes.has(purpose))) throw new RangeError('Preparation does not cover the Vortex framework purposes')
    let lastRole = -1
    for (const selection of proposal.selections) {
      const roleIndex = ['base', 'position_rehearsal', 'progressive_bridge'].indexOf(selection.role)
      if (roleIndex < lastRole) throw new RangeError('Preparation must progress from the base to position rehearsal and the explosive bridge')
      lastRole = roleIndex
      const candidate = candidates.find((entry) => entry.profile.id === selection.deliveryProfileId)
      if (!candidate.methodIds.includes(selection.programmingMethodId)) throw new RangeError('Preparation method is not a candidate for this profile')
      const matches = selection.addressesDemandIds.map((id) => demand.exposures.find((entry) => entry.demandId === id))
      if (matches.some((exposure) => !preparationMatch(candidate.card, candidate.profile, exposure))) throw new RangeError('Preparation demand attribution is not supported by canonical movement metadata')
      if (selection.role !== 'base' && !matches.length) throw new RangeError('Daily-specific preparation must address selected downstream work')
      if (selection.role === 'progressive_bridge' && !matches.some((exposure) => exposure.componentKey === 'explosiveness')) throw new RangeError('The preparation bridge must address selected explosive work')
    }
    const control = request.components.find((entry) => entry.key === 'prepare_and_access')
    if (control.lockedExercises.some((ref) => !proposal.selections.some((entry) => entry.deliveryProfileId === ref.deliveryProfileId))
      || control.lockedProgrammingMethodIds.some((id) => !proposal.selections.some((entry) => entry.programmingMethodId === id))) throw new RangeError('Preparation removed a coach lock')
    if (control.selection === 'directed' || request.mode === 'coach_directed') {
      const allowedProfiles = [...request.preferredExercises, ...control.preferredExercises, ...control.lockedExercises].map((entry) => entry.deliveryProfileId)
      const allowedMethods = [...request.preferredProgrammingMethodIds, ...control.preferredProgrammingMethodIds, ...control.lockedProgrammingMethodIds]
      if (proposal.selections.some((entry) => !allowedProfiles.includes(entry.deliveryProfileId) || !allowedMethods.includes(entry.programmingMethodId))) throw new RangeError('Preparation changed coach-directed choices')
    }
    return immutableProgrammingValue(proposal)
  } }
}

export const VORTEX_PREPARATION_CAPABILITY_CONTEXT = immutableProgrammingValue({
  frameworkVersion: VORTEX_PREPARATION_FRAMEWORK_VERSION, frameworkHash: programmingValueHash(VORTEX_PREPARATION_SECTION),
  purposes: VORTEX_PREPARATION_PURPOSES, guidance: VORTEX_PREPARATION_SECTION,
})
