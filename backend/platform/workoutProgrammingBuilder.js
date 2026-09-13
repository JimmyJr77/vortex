import Joi from 'joi'
import { randomUUID } from 'node:crypto'
import { normalizeCoachWorkoutRequest, programmingValueHash, immutableProgrammingValue, parseProgrammingContract, programmingComponentPlan } from './workoutProgrammingRequest.js'
import { programmingResourceRequests, validateProgrammingDirectorProposal } from './workoutProgrammingDirector.js'
import { loadWorkoutProgrammingMaterials } from './workoutProgrammingLibrarians.js'
import { resolveCanonicalProgrammingDose, ProgrammingPrescriptionError } from './canonicalProgrammingDose.js'
import { selectProgrammingMethodPrescription, resolveProgrammingMethodClock } from './programmingMethodClock.js'
import { scheduleCanonicalExercise, scheduleProgrammingSession } from './workoutResourceScheduler.js'
import { evaluateProgrammingLoadSequence } from './workoutLoadLedger.js'
import { focusMatchesCard, requiredEquipment } from './canonicalExerciseSelection.js'
import { createProgrammingStaffRun, ProgrammingStaffError } from './programmingStaffRuntime.js'
import { deriveProgrammingPreparationDemand, preparationCapabilityContract, VORTEX_PREPARATION_CAPABILITY_CONTEXT } from './workoutPreparation.js'
import { filterProgrammingCandidateEligibility } from './workoutProgrammingEligibility.js'

export const PROGRAMMING_BUILDER_VERSION = '1.0.0'
const reserveSchema = Joi.object({ purpose: Joi.string().valid('recovery', 'coaching', 'readiness_check').required(), rationale: Joi.string().max(1000).required() })
const propertyObject = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties })
const boundedText = (maxLength) => ({ type: 'string', minLength: 1, maxLength })
const reserveJson = propertyObject({ purpose: { type: 'string', enum: ['recovery', 'coaching', 'readiness_check'] }, rationale: boundedText(1000) })
const refMatches = (ref, card, profile) => ref.exerciseCardId === card.id && ref.variantId === card.variantId && ref.deliveryProfileId === profile.id && ref.cardVersion === card.cardVersion

export function programmingCandidateMaterials(materials) {
  return materials.resources.map((resource) => ({ key: resource.componentKey, candidates: resource.exercises.candidates.flatMap((candidate) => {
    const card = materials.library.find((entry) => refMatches(candidate.ref, entry, { id: candidate.ref.deliveryProfileId }))
    const profile = card?.deliveryProfiles.find((entry) => entry.id === candidate.ref.deliveryProfileId)
    if (!card || !profile) throw new ProgrammingStaffError('stale_library_reference', 'A search reference is absent from its canonical snapshot')
    const methodIds = [...new Set(resource.programming.candidates.filter((entry) => entry.phaseKey === profile.phaseKey).map((entry) => entry.programmingMethodId))]
    return [{ card, profile, score: candidate.score, methodIds }]
  }) }))
}

function boundedCandidateGroups(groups, request, director, previousDraft = null) {
  return groups.map((group) => {
    const control = request.components.find((entry) => entry.key === group.key)
    const preferred = new Set([...(director.components.find((entry) => entry.key === group.key)?.preferredExerciseProfileIds ?? []),
      ...(previousDraft?.activities.filter((entry) => entry.componentKey === group.key).map((entry) => entry.profile.id) ?? []),
      ...[...request.preferredExercises, ...control.preferredExercises, ...control.lockedExercises].map((ref) => ref.deliveryProfileId)])
    const required = [...request.priorities, ...control.priorities].filter((entry) => entry.strength === 'required')
    for (const priority of required) {
      const candidate = group.candidates.find((entry) => focusMatchesCard(priority, entry.card, entry.profile, entry.profile.phaseKey))
      if (candidate) preferred.add(candidate.profile.id)
    }
    for (const key of request.equipment.required) {
      const candidate = group.candidates.find((entry) => requiredEquipment(entry.card, entry.profile).includes(key))
      if (candidate) preferred.add(candidate.profile.id)
    }
    return { ...group, candidates: group.candidates.filter((entry, index) => index < 20 || preferred.has(entry.profile.id)) }
  })
}

function enforceDirectedChoices(request, key, selections) {
  const control = request.components.find((entry) => entry.key === key)
  if (control.lockedExercises.some((ref) => !selections.some((entry) => entry.deliveryProfileId === ref.deliveryProfileId))
    || control.lockedProgrammingMethodIds.some((id) => !selections.some((entry) => entry.programmingMethodId === id))) throw new RangeError('Session Builder removed a coach lock')
  if (control.selection === 'directed' || request.mode === 'coach_directed') {
    const profiles = [...request.preferredExercises, ...control.preferredExercises, ...control.lockedExercises].map((entry) => entry.deliveryProfileId)
    const methods = [...request.preferredProgrammingMethodIds, ...control.preferredProgrammingMethodIds, ...control.lockedProgrammingMethodIds]
    if (selections.some((entry) => !profiles.includes(entry.deliveryProfileId) || !methods.includes(entry.programmingMethodId))) throw new RangeError('Session Builder changed coach-directed choices')
  }
}

export function builderCapabilityContract(request, downstream) {
  const selection = Joi.object({ deliveryProfileId: Joi.string().required(), programmingMethodId: Joi.string().required(), rationale: Joi.string().max(600).required() })
  const schema = Joi.object({ requestRevision: Joi.string().valid(request.revision).required(), summary: Joi.string().max(1500).required(),
    components: Joi.array().length(downstream.length).unique('key').items(Joi.object({ key: Joi.string().required(),
      selections: Joi.array().min(1).max(8).unique('deliveryProfileId').items(selection).required(), reserve: reserveSchema.required(),
    })).required(), watchPoints: Joi.array().items(Joi.string().max(600)).max(20).required() })
  return { outputSchema: propertyObject({ requestRevision: { type: 'string', enum: [request.revision] }, summary: boundedText(1500),
    components: { type: 'array', minItems: downstream.length, maxItems: downstream.length, items: propertyObject({
      key: { type: 'string', enum: downstream.map((entry) => entry.key) }, selections: { type: 'array', minItems: 1, maxItems: 8,
        items: propertyObject({ deliveryProfileId: { type: 'string', enum: downstream.flatMap((entry) => entry.candidates.map((candidate) => candidate.profile.id)) },
          programmingMethodId: { type: 'string' }, rationale: boundedText(600) }) }, reserve: reserveJson,
    }) }, watchPoints: { type: 'array', maxItems: 20, items: boundedText(600) },
  }), parseOutput(raw) {
    const proposal = parseProgrammingContract(schema, raw, 'Session Builder proposal')
    proposal.components.forEach((component, index) => {
      if (component.key !== downstream[index].key) throw new RangeError('Session Builder changed component order')
      for (const choice of component.selections) {
        const candidate = downstream[index].candidates.find((entry) => entry.profile.id === choice.deliveryProfileId)
        if (!candidate?.methodIds.includes(choice.programmingMethodId)) throw new RangeError('Session Builder chose a foreign or component-inappropriate canonical pair')
      }
      enforceDirectedChoices(request, component.key, component.selections)
    })
    return proposal
  } }
}

function candidateSummaries(groups, materials) {
  return groups.map((group) => ({ key: group.key, candidates: group.candidates.map(({ card, profile, methodIds }) => ({
    deliveryProfileId: profile.id, exerciseName: card.displayName ?? card.canonicalName, familyId: card.familyId,
    movementPatterns: card.movementPatterns, bodyRegions: card.bodyRegions, compositionProfile: card.compositionProfile,
    programming: card.programming,
    taskDemands: card.taskDemands, stressProfile: card.stressProfile, dosage: profile.dosage, purpose: profile.purpose,
    equipment: requiredEquipment(card, profile), methodIds,
  })), methods: materials.methods.filter((method) => group.candidates.some((entry) => entry.methodIds.includes(String(method.id))))
    .map((method) => ({ id: String(method.id), name: method.name, programmingType: method.programming_type,
      fatigueProfile: method.fatigue_profile, prescriptions: method.prescriptions, workRestStructure: method.work_rest_structure,
      builderRules: method.workout_builder_rules, validatorRules: method.validator_rules, coaching: method.coach_summary })),
  }))
}

function fallbackBuilderProposal(request, director, groups) {
  return { requestRevision: request.revision, summary: 'Deterministic composition draft pending staff judgment.', watchPoints: [],
    components: groups.map((group) => {
      const control = request.components.find((entry) => entry.key === group.key)
      const decision = director.components.find((entry) => entry.key === group.key)
      const candidates = [...group.candidates].sort((a, b) => Number(control.lockedExercises.some((ref) => ref.deliveryProfileId === b.profile.id))
        - Number(control.lockedExercises.some((ref) => ref.deliveryProfileId === a.profile.id))
        || Number(decision.preferredExerciseProfileIds.includes(b.profile.id)) - Number(decision.preferredExerciseProfileIds.includes(a.profile.id)) || b.score - a.score)
      const allowedProfiles = [...request.preferredExercises, ...control.preferredExercises, ...control.lockedExercises].map((ref) => ref.deliveryProfileId)
      const directed = request.mode === 'coach_directed' || control.selection === 'directed'
      const families = new Set()
      const selections = []
      for (const candidate of candidates) {
        if (selections.length >= Math.max(3, control.lockedExercises.length) || (directed && !allowedProfiles.includes(candidate.profile.id))) continue
        if (families.has(candidate.card.familyId) && !control.lockedExercises.some((ref) => ref.deliveryProfileId === candidate.profile.id)) continue
        const preferredMethods = [...control.lockedProgrammingMethodIds, ...decision.preferredProgrammingMethodIds, ...control.preferredProgrammingMethodIds, ...request.preferredProgrammingMethodIds]
        const programmingMethodId = preferredMethods.find((id) => candidate.methodIds.includes(id)) ?? (directed ? null : candidate.methodIds[0])
        if (!programmingMethodId) continue
        families.add(candidate.card.familyId)
        selections.push({ deliveryProfileId: candidate.profile.id, programmingMethodId, rationale: 'Existing canonical ranking and Director preferences; requires coaching review.' })
      }
      return { key: group.key, selections, reserve: { purpose: 'coaching', rationale: 'Unassigned teaching and recovery time requires coach review.' } }
    }),
  }
}

function realizeSelections({ request, componentPlan, groups, methods, proposal, prior = [], preservedActivities = [], maxAttempts = 500 }) {
  const activities = []
  const issues = []
  const repairs = []
  let attempts = 0
  for (const component of proposal.components) {
    const control = componentPlan.components.find((entry) => entry.key === component.key)
    const group = groups.find((entry) => entry.key === component.key)
    let elapsedSeconds = 0
    for (const [index, selection] of component.selections.entries()) {
      const candidate = group.candidates.find((entry) => entry.profile.id === selection.deliveryProfileId)
      const method = methods.find((entry) => String(entry.id) === selection.programmingMethodId)
      if (!candidate || !method || !candidate.methodIds.includes(String(method.id))) {
        issues.push({ code: 'unavailable_canonical_pair', componentKey: component.key }); continue
      }
      const { card, profile } = candidate
      let methodClock
      try { methodClock = resolveProgrammingMethodClock(method, selectProgrammingMethodPrescription(method, request)) } catch (error) {
        issues.push({ code: error.code ?? 'invalid_method_clock', componentKey: component.key, programmingMethodId: String(method.id), detail: error.message }); continue
      }
      const preserved = preservedActivities.find((entry) => entry.componentKey === component.key && entry.profile.id === profile.id)
      const sourceHash = programmingValueHash({ card, profile, method })
      if (preserved && (sourceHash !== preserved.sourceHash || String(preserved.method.id) !== String(method.id))) {
        issues.push({ code: 'stale_preserved_activity', componentKey: component.key, deliveryProfileId: profile.id }); continue
      }
      const minimum = preserved?.dose.sets ?? methodClock.targetSets ?? profile.dosage?.setsMin ?? profile.dosage?.sets
      const maximum = profile.dosage?.setsMax ?? profile.dosage?.sets
      const preferredSets = preserved?.dose.sets ?? methodClock.targetSets ?? Math.min(profile.dosage?.sets, maximum)
      let selected = null
      let rejection = null
      if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(preferredSets) || !Number.isSafeInteger(maximum)
        || minimum < 1 || preferredSets < minimum || maximum < preferredSets || maximum > 100) {
        issues.push({ code: 'invalid_reviewed_set_range', componentKey: component.key, deliveryProfileId: profile.id }); continue
      }
      for (let sets = preferredSets; sets >= minimum; sets -= 1) {
        if (attempts >= maxAttempts) return { activities, issues: [...issues, { code: 'composition_budget_exhausted' }], repairs, attempts }
        attempts += 1
        try {
          const dose = resolveCanonicalProgrammingDose({ card, profile, method, request, componentKey: component.key,
            proposal: preserved ? { sets, reps: preserved.dose.reps, workSeconds: preserved.dose.workSeconds, restSeconds: preserved.dose.restSeconds } : { sets } })
          if (preserved && programmingValueHash(dose) !== programmingValueHash(preserved.dose)) throw new ProgrammingPrescriptionError('stale_preserved_dose', 'Repair cannot alter a preserved activity dose')
          const activity = { activityId: preserved?.activityId ?? `${component.key}:${index + 1}`, componentKey: component.key, card, profile, method, dose,
            rationale: selection.rationale, sourceHash }
          const schedule = scheduleCanonicalExercise({ ...activity, request, component: { ...control, budgetSeconds: control.budgetSeconds - elapsedSeconds } })
          const ordered = [...prior, ...activities, activity].sort((a, b) => componentPlan.components.findIndex((entry) => entry.key === a.componentKey)
            - componentPlan.components.findIndex((entry) => entry.key === b.componentKey))
          const load = evaluateProgrammingLoadSequence({ request, activities: ordered })
          if (load.status !== 'PASS') throw new ProgrammingPrescriptionError('load_or_composition_conflict', 'Dose conflicts with cumulative session loading', { issues: load.issues })
          selected = activity
          elapsedSeconds += schedule.elapsedSeconds
          if (sets !== preferredSets) repairs.push({ activityId: activity.activityId, code: 'reviewed_set_reduction', fromSets: preferredSets, toSets: sets, reason: rejection?.code })
          break
        } catch (error) { rejection = error }
      }
      if (selected) activities.push(selected)
      else issues.push({ code: rejection?.code ?? 'no_feasible_prescription', componentKey: component.key, deliveryProfileId: profile.id,
        detail: rejection?.message ?? 'No reviewed dose fits', findings: rejection?.details?.issues ?? [] })
    }
  }
  return { activities, issues, repairs, attempts }
}

export function validateProgrammingCoverage(request, activities) {
  const issues = []
  const usedProfiles = new Set()
  for (const entry of activities) {
    if (usedProfiles.has(entry.profile.id)) issues.push({ code: 'duplicate_delivery_profile', deliveryProfileId: entry.profile.id })
    usedProfiles.add(entry.profile.id)
  }
  for (const control of request.components.filter((entry) => entry.budgetSeconds !== 0)) {
    const selected = activities.filter((entry) => entry.componentKey === control.key)
    if (new Set(selected.map((entry) => entry.card.variantId)).size !== selected.length) issues.push({ code: 'duplicate_component_variant', componentKey: control.key })
    if (!selected.length) issues.push({ code: 'empty_component', componentKey: control.key })
    for (const ref of control.lockedExercises) if (!selected.some((entry) => refMatches(ref, entry.card, entry.profile))) issues.push({ code: 'missing_exercise_lock', componentKey: control.key, deliveryProfileId: ref.deliveryProfileId })
    for (const id of control.lockedProgrammingMethodIds) if (!selected.some((entry) => String(entry.method.id) === id)) issues.push({ code: 'missing_method_lock', componentKey: control.key, programmingMethodId: id })
    for (const priority of control.priorities.filter((entry) => entry.strength === 'required')) if (!selected.some((entry) => focusMatchesCard(priority, entry.card, entry.profile, entry.profile.phaseKey))) {
      issues.push({ code: 'missing_required_priority', componentKey: control.key, facet: priority.facet, value: priority.value })
    }
  }
  for (const priority of request.priorities.filter((entry) => entry.strength === 'required')) if (!activities.some((entry) => focusMatchesCard(priority, entry.card, entry.profile, entry.profile.phaseKey))) {
    issues.push({ code: 'missing_required_priority', facet: priority.facet, value: priority.value })
  }
  for (const key of request.equipment.required) if (!activities.some((entry) => (requiredEquipment(entry.card, entry.profile).length ? requiredEquipment(entry.card, entry.profile) : ['none']).includes(key))) {
    issues.push({ code: 'missing_required_equipment', equipmentKey: key })
  }
  return immutableProgrammingValue({ status: issues.length ? 'REVISE' : 'PASS', issues })
}

export function scheduleProgrammingDraft({ request, componentPlan, activities, builderProposal, preparationProposal }) {
  return scheduleProgrammingSession({ request, componentPlan, components: componentPlan.components.map((control) => ({
    key: control.key, activities: activities.filter((entry) => entry.componentKey === control.key), reserve: control.key === 'prepare_and_access'
      ? (preparationProposal ? { purpose: 'readiness_check', rationale: 'Observe movement quality, answer questions and confirm readiness before explosive work.' } : null)
      : builderProposal.components.find((entry) => entry.key === control.key)?.reserve,
  })) })
}

function revisionContract(base, previousProposal, mutableComponentKeys) {
  return { ...base, parseOutput(raw) {
    const value = base.parseOutput(raw)
    for (const component of value.components) if (!mutableComponentKeys.includes(component.key)
      && programmingValueHash(component) !== programmingValueHash(previousProposal.components.find((entry) => entry.key === component.key))) {
      throw new RangeError('Repair changed a component outside its permitted scope')
    }
    return value
  } }
}

function validateRevision(request, sessionIntent, revision) {
  if (!revision) return null
  if (Object.keys(revision).some((key) => !['previousDraft', 'mutableComponentKeys', 'feedback'].includes(key))) throw new ProgrammingStaffError('invalid_repair_scope', 'Repair contains unknown authority or scope fields')
  const { previousDraft, mutableComponentKeys, feedback } = revision
  if (!previousDraft || previousDraft.requestHash !== sessionIntent.requestHash || previousDraft.intentId !== sessionIntent.intentId
    || programmingValueHash(previousDraft.request) !== programmingValueHash(request)
    || programmingValueHash(previousDraft.componentPlan) !== programmingValueHash(sessionIntent.componentPlan)
    || previousDraft.status !== 'READY_FOR_CRITIC' || previousDraft.builderSource !== 'session_builder') {
    throw new ProgrammingStaffError('invalid_repair_source', 'Repair requires a complete draft for the same server-owned coach intent')
  }
  if (!Array.isArray(mutableComponentKeys) || new Set(mutableComponentKeys).size !== mutableComponentKeys.length
    || mutableComponentKeys.some((key) => key === 'prepare_and_access' || !previousDraft.componentPlan.components.some((entry) => entry.key === key))
    || !Array.isArray(feedback) || !feedback.length || feedback.length > 40) throw new ProgrammingStaffError('invalid_repair_scope', 'Repair requires a bounded downstream scope and actionable QA feedback')
  const keys = previousDraft.componentPlan.components.filter((entry) => entry.key !== 'prepare_and_access').map((entry) => entry.key)
  if (mutableComponentKeys.length && programmingValueHash(keys.slice(keys.indexOf(mutableComponentKeys[0]))) !== programmingValueHash(mutableComponentKeys)) {
    throw new ProgrammingStaffError('invalid_repair_scope', 'Downstream repair scope must include later components affected by load changes')
  }
  const checkedFeedback = parseProgrammingContract(Joi.array().min(1).max(40).items(Joi.object({
    area: Joi.string().max(80).required(), route: Joi.string().valid('session_builder', 'prepare_access').required(),
    message: Joi.string().max(800).required(), recommendedAction: Joi.string().max(1000).required(),
    activityIds: Joi.array().max(52).unique().items(Joi.string().valid(...previousDraft.activities.map((entry) => entry.activityId))).required(),
    componentKeys: Joi.array().max(5).unique().items(Joi.string().valid(...previousDraft.componentPlan.components.map((entry) => entry.key))).required(),
  })), feedback, 'Programming repair feedback')
  return immutableProgrammingValue(structuredClone({ ...revision, feedback: checkedFeedback }))
}

/** Read-only composition. Final Critic, fresh source validation and approval remain separate gates. */
export async function buildWorkoutProgrammingDraft({ pool, context, sessionIntent, registry,
  builderCapabilityId = 'vortex/session-builder', prepareCapabilityId = 'vortex/prepare-access', runOptions = {}, staffRun = null, revision = null }) {
  const { assumptions: _assumptions, ...coachInput } = sessionIntent.request ?? {}
  const request = normalizeCoachWorkoutRequest(coachInput)
  if (programmingValueHash(request) !== sessionIntent.requestHash || programmingValueHash(request) !== programmingValueHash(sessionIntent.request)) throw new ProgrammingStaffError('stale_request', 'Session intent does not match immutable coach truth')
  if (request.mode === 'modify_existing') throw new ProgrammingStaffError('source_workout_adapter_required', 'Modify Existing requires a verified persisted source workout')
  const componentPlan = programmingComponentPlan(request)
  if (programmingValueHash(componentPlan) !== programmingValueHash(sessionIntent.componentPlan)) throw new ProgrammingStaffError('constraint_override', 'Session intent changed coach clocks or equipment')
  const repair = validateRevision(request, sessionIntent, revision)
  const run = staffRun ?? createProgrammingStaffRun(registry, { maxCalls: 4, maxOutputTokens: 12000, perCallOutputTokens: 3000, ...runOptions })
  const canceled = () => { run.assertActive(); if (runOptions.signal?.aborted) throw new ProgrammingStaffError('canceled', 'Programming composition was canceled') }
  canceled()
  const searches = programmingResourceRequests(request, 100).map((search) => {
    const previous = repair?.previousDraft.activities.filter((entry) => entry.componentKey === search.componentKey) ?? []
    return { ...search, pinnedExercises: [...search.pinnedExercises, ...previous.map((entry) => ({ exerciseCardId: entry.card.id,
      variantId: entry.card.variantId, deliveryProfileId: entry.profile.id, cardVersion: entry.card.cardVersion }))],
    pinnedProgrammingMethodIds: [...new Set([...search.pinnedProgrammingMethodIds, ...previous.map((entry) => String(entry.method.id))])] }
  })
  const materials = await loadWorkoutProgrammingMaterials(pool, context, searches, { athleteRequest: request })
  canceled()
  const currentRelease = materials.resources[0].libraryRelease
  if (!currentRelease || sessionIntent.resources.some((resource) => programmingValueHash(resource.libraryRelease) !== programmingValueHash(currentRelease))) {
    throw new ProgrammingStaffError('stale_library_release', 'Library release changed or is unavailable; refresh session intent before composing')
  }
  const director = validateProgrammingDirectorProposal(request, materials.resources, sessionIntent.proposal)
  const eligibility = filterProgrammingCandidateEligibility({ groups: programmingCandidateMaterials(materials), request, athleteEvidence: materials.athleteEvidence })
  const groups = boundedCandidateGroups(eligibility.groups, request, director, repair?.previousDraft)
  const downstream = groups.filter((entry) => entry.key !== 'prepare_and_access')
  const issues = [...(sessionIntent.issues ?? [])]
  for (const group of groups) {
    const control = request.components.find((entry) => entry.key === group.key)
    const unavailable = eligibility.reports.filter((entry) => entry.componentKey === group.key && entry.status !== 'ELIGIBLE')
    const locked = unavailable.filter((entry) => control.lockedExercises.some((ref) => ref.deliveryProfileId === entry.deliveryProfileId)
      || repair?.previousDraft.activities.some((activity) => activity.componentKey === group.key && activity.profile.id === entry.deliveryProfileId
        && group.key !== 'prepare_and_access' && !repair.mutableComponentKeys.includes(group.key)))
    if (locked.length || group.candidates.length < (group.key === 'prepare_and_access' ? 3 : 1)) issues.push({
      code: 'candidate_eligibility_review_required', componentKey: group.key,
      detail: 'Eligible canonical choices cannot satisfy this component or its preserved coach choices.',
      findings: (locked.length ? locked : unavailable).map((entry) => ({ deliveryProfileId: entry.deliveryProfileId, status: entry.status, findings: entry.result.findings })),
    })
  }
  const evidenceBlocked = materials.athleteEvidence.findings.length > 0 || materials.athleteEvidence.contentHash !== sessionIntent.athleteEvidence?.contentHash
  issues.push(...materials.athleteEvidence.findings.map((entry) => ({ ...entry, route: 'athlete_development' })))
  if (materials.athleteEvidence.contentHash !== sessionIntent.athleteEvidence?.contentHash) issues.push({ code: 'stale_athlete_evidence', route: 'athlete_development',
    detail: 'Roster or source observations changed after Athlete Development advice; refresh the session intent.' })
  if (!materials.programmingSearchComplete) issues.push({ code: 'incomplete_programming_search' })
  const input = { request, componentPlan, director, athleteAdvice: sessionIntent.athleteAdvice, consultantAdvice: sessionIntent.consultantAdvice,
    athleteEvidence: materials.athleteEvidence,
    components: candidateSummaries(downstream, materials), ...(repair ? { revision: { mutableComponentKeys: repair.mutableComponentKeys,
      previousProposal: repair.previousDraft.builderProposal, feedback: repair.feedback,
      previousActivities: repair.previousDraft.activities.map((entry) => ({ activityId: entry.activityId, componentKey: entry.componentKey,
        deliveryProfileId: entry.profile.id, programmingMethodId: String(entry.method.id), dose: entry.dose })), previousLoad: repair.previousDraft.load } } : {}) }
  const baseContract = builderCapabilityContract(request, downstream)
  const contract = repair ? revisionContract(baseContract, repair.previousDraft.builderProposal, repair.mutableComponentKeys) : baseContract
  const prepareOnly = repair && repair.mutableComponentKeys.length === 0
  const preservedActivities = repair?.previousDraft.activities.filter((entry) => entry.componentKey !== 'prepare_and_access' && !repair.mutableComponentKeys.includes(entry.componentKey)) ?? []
  const call = async (capabilityId, role, contract, input) => {
    if (evidenceBlocked || issues.some((entry) => entry.code === 'candidate_eligibility_review_required')) return null
    try { return await run.call({ capabilityId, role, ...contract, input }) } catch (error) {
      if (error.code === 'canceled') throw error
      issues.push({ code: error.code ?? 'capability_failed', capabilityId, detail: `${role} proposal requires review.` })
      return null
    }
  }
  let builderProposal = prepareOnly ? contract.parseOutput(repair.previousDraft.builderProposal)
    : downstream.every((entry) => entry.candidates.some((candidate) => candidate.methodIds.length))
      ? await call(builderCapabilityId, 'session_builder', contract, input) : null
  const builderSource = builderProposal ? 'session_builder' : 'deterministic_review_draft'
  if (!builderProposal) {
    issues.push({ code: 'builder_review_required' })
    builderProposal = repair?.previousDraft.builderProposal ?? fallbackBuilderProposal(request, director, downstream)
  }
  let realized = realizeSelections({ request, componentPlan, groups: downstream, methods: materials.methods, proposal: builderProposal, preservedActivities })
  let compositionAttempts = realized.attempts
  const revisions = []
  if (realized.issues.length && builderSource === 'session_builder' && !prepareOnly) {
    const revisionProposal = await call(builderCapabilityId, 'session_builder', contract, { ...input, previousProposal: builderProposal, findings: realized.issues })
    if (revisionProposal) {
      revisions.push({ role: 'session_builder', findings: realized.issues })
      builderProposal = revisionProposal
      realized = realizeSelections({ request, componentPlan, groups: downstream, methods: materials.methods, proposal: builderProposal, preservedActivities })
      compositionAttempts += realized.attempts
    }
  }
  issues.push(...realized.issues)
  const demand = deriveProgrammingPreparationDemand(realized.activities)
  const prepareGroup = groups.find((entry) => entry.key === 'prepare_and_access')
  const prepareCandidates = prepareGroup.candidates.filter((entry) => entry.methodIds.length)
  let preparationProposal = null
  let preparation = { activities: [], issues: [], repairs: [], attempts: 0 }
  if (demand.exposures.some((entry) => entry.componentKey === 'explosiveness') && prepareCandidates.length >= 3) {
    preparationProposal = await call(prepareCapabilityId, 'prepare_access', preparationCapabilityContract({ request, demand, candidates: prepareCandidates }), {
      request, framework: VORTEX_PREPARATION_CAPABILITY_CONTEXT, demand, athleteEvidence: materials.athleteEvidence,
      ...(repair ? { revision: { previousProposal: repair.previousDraft.preparationProposal, feedback: repair.feedback,
        previousDownstreamHash: repair.previousDraft.preparationDemand.downstreamHash } } : {}),
      components: candidateSummaries([prepareGroup], materials), remainingLoad: evaluateProgrammingLoadSequence({ request, activities: realized.activities }).entries.at(-1)?.remaining ?? null,
    })
    if (preparationProposal) preparation = realizeSelections({ request, componentPlan, groups: [prepareGroup], methods: materials.methods, prior: realized.activities,
      proposal: { components: [{ key: 'prepare_and_access', selections: preparationProposal.selections }] } })
  }
  if (!preparationProposal) issues.push({ code: 'preparation_requires_review', detail: 'Demand-driven Vortex preparation is incomplete; no exercise creation is authorized.' })
  issues.push(...preparation.issues)
  const activities = [...preparation.activities, ...realized.activities]
  const coverage = validateProgrammingCoverage(request, activities)
  const load = evaluateProgrammingLoadSequence({ request, activities })
  const schedule = scheduleProgrammingDraft({ request, componentPlan, activities, builderProposal, preparationProposal })
  issues.push(...coverage.issues, ...load.issues, ...schedule.resourceValidation.issues)
  if (schedule.status !== 'SCHEDULED') issues.push({ code: 'schedule_requires_composition' })
  canceled()
  return immutableProgrammingValue({ schemaVersion: PROGRAMMING_BUILDER_VERSION, draftId: randomUUID(), request, requestHash: sessionIntent.requestHash,
    intentId: sessionIntent.intentId, libraryRelease: currentRelease, componentPlan, builderSource, builderProposal, preparationProposal,
    preparationDemand: demand, activities, schedule, load, coverage, candidateEligibility: eligibility.reports, issues, repairs: [...realized.repairs, ...preparation.repairs],
    status: issues.length ? 'NEEDS_COACH_REVIEW' : 'READY_FOR_CRITIC', validatedWorkout: false, creatorAuthorized: false,
    trace: run.telemetry(), revisions, compositionAttempts: compositionAttempts + preparation.attempts,
  })
}
