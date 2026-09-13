import Joi from 'joi'
import { randomUUID } from 'node:crypto'
import { normalizeSessionComponentPlan } from './sessionComponentContract.js'
import { loadWorkoutProgrammingMaterials } from './workoutProgrammingLibrarians.js'
import { createProgrammingStaffRun, ProgrammingStaffError } from './programmingStaffRuntime.js'
import { normalizeCoachWorkoutRequest, allocateProgrammingComponentBudgets, canonicalIntentForProgrammingComponent,
  immutableProgrammingValue, programmingValueHash, parseProgrammingContract } from './workoutProgrammingRequest.js'

export const PROGRAMMING_DIRECTOR_VERSION = '1.0.0'
// Discovery hints into existing metadata, not a conversion of legacy workouts.
export const COMPONENT_DISCOVERY_PHASES = immutableProgrammingValue({
  prepare_and_access: ['prepare_and_access'], explosiveness: ['output'], strength: ['capacity'],
  capacity_competition: ['sustained_capacity'], body_control: ['movement_intelligence', 'resilience'],
})
const PURPOSES = Object.freeze({
  prepare_and_access: 'Adapt the Vortex Prepare & Access framework after downstream demands are prescribed.',
  explosiveness: 'Develop high-quality explosive intent with adequate recovery and controlled contacts.',
  strength: 'Develop foundational force production while accounting for earlier explosive work.',
  capacity_competition: 'Develop repeatability or competition within remaining fatigue and recovery capacity.',
  body_control: 'Develop booked body control and tumbling within demonstrated readiness and remaining fatigue capacity.',
})
const description = Joi.string().max(1500).required()
const notes = () => Joi.array().items(Joi.string().max(600)).max(20).required()
const jsonText = { type: 'string', maxLength: 1500, minLength: 1 }
const jsonNotes = { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 600, minLength: 1 } }
const jsonObject = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties })
const jsonEnumArray = (values, maxItems = 100) => ({ type: 'array', maxItems: values.length ? maxItems : 0, items: values.length
  ? { type: 'string', enum: [...new Set(values)] } : { type: 'string' } })
const unique = (values) => [...new Set(values)]
const methodIds = (resource) => resource.programming.candidates.map((entry) => entry.programmingMethodId)
const profileIds = (resource) => resource.exercises.candidates.map((entry) => entry.ref.deliveryProfileId)
const candidateFor = (resources, key) => resources.find((resource) => resource.componentKey === key)

function directorContract(request, resources) {
  const schema = Joi.object({ requestRevision: Joi.string().valid(request.revision).required(), summary: description,
    components: Joi.array().length(resources.length).items(Joi.object({
      key: Joi.string().valid(...resources.map((entry) => entry.componentKey)).required(), purpose: description, rationale: description,
      preferredExerciseProfileIds: Joi.array().items(Joi.string()).max(100).unique().required(),
      preferredProgrammingMethodIds: Joi.array().items(Joi.string()).max(100).unique().required(),
    })).unique('key').required(), watchPoints: notes(),
  })
  const outputSchema = jsonObject({ requestRevision: { type: 'string', enum: [request.revision] }, summary: jsonText,
    components: { type: 'array', minItems: resources.length, maxItems: resources.length,
      items: jsonObject({ key: { type: 'string', enum: resources.map((entry) => entry.componentKey) }, purpose: jsonText, rationale: jsonText,
        preferredExerciseProfileIds: jsonEnumArray(resources.flatMap(profileIds)), preferredProgrammingMethodIds: jsonEnumArray(resources.flatMap(methodIds)),
      }) }, watchPoints: jsonNotes,
  })
  return { outputSchema, parseOutput(raw) {
    const proposal = parseProgrammingContract(schema, raw, 'Director decision')
    for (let i = 0; i < resources.length; i += 1) {
      const resource = resources[i]
      const decision = proposal.components[i]
      if (decision.key !== resource.componentKey) throw new RangeError('Director must preserve component order')
      const control = request.components.find((component) => component.key === decision.key)
      const exerciseIds = profileIds(resource)
      const programmingIds = methodIds(resource)
      if (decision.preferredExerciseProfileIds.some((id) => !exerciseIds.includes(id))
        || decision.preferredProgrammingMethodIds.some((id) => !programmingIds.includes(id))) throw new RangeError('Director selected a foreign, stale or ineligible candidate')
      if (control.lockedExercises.some((ref) => !decision.preferredExerciseProfileIds.includes(ref.deliveryProfileId))
        || control.lockedProgrammingMethodIds.some((id) => !decision.preferredProgrammingMethodIds.includes(id))) throw new RangeError('Director removed a coach lock')
      if (control.selection === 'directed' || request.mode === 'coach_directed') {
        const directedProfiles = [...request.preferredExercises, ...control.preferredExercises, ...control.lockedExercises].map((ref) => ref.deliveryProfileId)
        const directedMethods = [...request.preferredProgrammingMethodIds, ...control.preferredProgrammingMethodIds, ...control.lockedProgrammingMethodIds]
        if (decision.preferredExerciseProfileIds.some((id) => !directedProfiles.includes(id))
          || decision.preferredProgrammingMethodIds.some((id) => !directedMethods.includes(id))) throw new RangeError('Director changed coach-directed selection')
      }
      // The Prepare specialist will select after the builder exposes demands.
      if (decision.key === 'prepare_and_access' && decision.preferredExerciseProfileIds.some((id) =>
        !control.lockedExercises.some((ref) => ref.deliveryProfileId === id))) throw new RangeError('Automatic preparation selection must wait for downstream demands')
    }
    return proposal
  } }
}

export function validateProgrammingDirectorProposal(request, resources, raw) {
  return immutableProgrammingValue(directorContract(request, resources).parseOutput(raw))
}

export function programmingResourceRequests(request, limit = 25) {
  const budgets = allocateProgrammingComponentBudgets(request)
  return request.components.filter((component) => budgets[component.key] > 0).map((component) => ({
    intent: canonicalIntentForProgrammingComponent(request, component.key), requestRevision: request.revision, componentKey: component.key,
    phaseKeys: COMPONENT_DISCOVERY_PHASES[component.key], equipment: component.equipment, equipmentScheduling: 'waves', limit,
    preferredProgrammingMethodIds: unique([...request.preferredProgrammingMethodIds, ...component.preferredProgrammingMethodIds, ...component.lockedProgrammingMethodIds])
      .filter((id) => !component.excludedProgrammingMethodIds.includes(id)),
    excludedProgrammingMethodIds: unique([...request.excludedProgrammingMethodIds, ...component.excludedProgrammingMethodIds]),
    preferredExercises: [...request.preferredExercises, ...component.preferredExercises],
    pinnedExercises: component.lockedExercises, pinnedProgrammingMethodIds: component.lockedProgrammingMethodIds,
  }))
}

function athleteContract(request) {
  const cohortKeys = request.athletes.map((entry) => entry.key)
  const schema = Joi.object({ observations: Joi.array().length(cohortKeys.length).unique('cohortKey').items(Joi.object({
    cohortKey: Joi.string().valid(...cohortKeys).required(), summary: description, unknowns: notes(), recommendations: notes(),
  })).required(), watchPoints: notes() })
  return { outputSchema: jsonObject({ observations: { type: 'array', minItems: cohortKeys.length, maxItems: cohortKeys.length,
    items: jsonObject({ cohortKey: { type: 'string', enum: cohortKeys }, summary: jsonText, unknowns: jsonNotes, recommendations: jsonNotes }) }, watchPoints: jsonNotes }),
  parseOutput: (raw) => parseProgrammingContract(schema, raw, 'Athlete Development advice') }
}

function consultantContract(resources, sources) {
  const schema = Joi.object({ summary: description, watchPoints: notes(), recommendations: Joi.array().max(20).items(Joi.object({
    componentKey: Joi.string().valid(...resources.map((entry) => entry.componentKey)).required(), programmingMethodId: Joi.string().required(),
    rationale: description, sourceReferenceIds: Joi.array().items(Joi.string()).max(30).unique().required(),
  })).required() })
  return { outputSchema: jsonObject({ summary: jsonText, watchPoints: jsonNotes, recommendations: { type: 'array', maxItems: 20,
    items: jsonObject({ componentKey: { type: 'string', enum: resources.map((entry) => entry.componentKey) },
      programmingMethodId: { type: 'string' }, rationale: jsonText, sourceReferenceIds: jsonEnumArray(sources.map((entry) => entry.id), 30),
    }) } }), parseOutput(raw) {
    const result = parseProgrammingContract(schema, raw, 'Methodology Consultant advice')
    for (const recommendation of result.recommendations) {
      if (!methodIds(candidateFor(resources, recommendation.componentKey)).includes(recommendation.programmingMethodId)) throw new RangeError('Consultant referenced an unavailable method')
      if (recommendation.sourceReferenceIds.some((id) => !sources.some((source) => source.id === id))) throw new RangeError('Consultant invented a source reference')
    }
    return result
  } }
}

function startingProposal(request, resources) {
  return { requestRevision: request.revision, summary: 'Deterministic session-intent draft awaiting coaching judgment and whole-session composition.', watchPoints: [],
    components: resources.map((resource) => {
      const control = request.components.find((entry) => entry.key === resource.componentKey)
      return { key: control.key, purpose: PURPOSES[control.key], rationale: 'Preserve coach controls; resolve prescriptions and shared fatigue in the component-aware builder.',
        preferredExerciseProfileIds: control.lockedExercises.filter((ref) => profileIds(resource).includes(ref.deliveryProfileId)).map((ref) => ref.deliveryProfileId),
        preferredProgrammingMethodIds: control.lockedProgrammingMethodIds.filter((id) => methodIds(resource).includes(id)),
      }
    }),
  }
}

/** Only session intent. This cannot validate, save, approve or publish a workout. */
export async function directWorkoutProgramming({ pool, context, rawRequest, registry, directorCapabilityId = 'vortex/director',
  athleteCapabilityId = 'vortex/athlete-development', runOptions = {}, staffRun = null }) {
  const request = normalizeCoachWorkoutRequest(rawRequest)
  if (request.mode === 'modify_existing') throw new ProgrammingStaffError('source_workout_adapter_required',
    'Modify Existing requires the component-aware persisted-workout adapter; the source workout has not been changed')
  const run = staffRun ?? createProgrammingStaffRun(registry, runOptions)
  const checkCanceled = () => { run.assertActive(); if (runOptions.signal?.aborted) throw new ProgrammingStaffError('canceled', 'Programming run was canceled') }
  checkCanceled()
  const budgets = allocateProgrammingComponentBudgets(request)
  const active = request.components.filter((component) => budgets[component.key] > 0)
  const componentPlan = normalizeSessionComponentPlan({ durationMinutes: request.logistics.totalBookedMinutes,
    equipment: { available: request.equipment.available, quantities: request.equipment.quantities, excluded: request.equipment.excluded },
    components: active.map((component) => ({ key: component.key, budgetSeconds: budgets[component.key], equipment: component.equipment })),
  })
  const { resources, athleteEvidence } = await loadWorkoutProgrammingMaterials(pool, context, programmingResourceRequests(request), { athleteRequest: request })
  checkCanceled()
  const issues = athleteEvidence.findings.map((entry) => ({ ...entry, route: 'athlete_development' }))
  for (const resource of resources) {
    if (resource.exercises.status !== 'MATCHES' || resource.programming.status !== 'MATCHES') {
      issues.push({ code: 'library_coverage_requires_review', componentKey: resource.componentKey, detail: resource.nextAction })
    }
    if (resource.exercises.unavailablePinnedExercises.length || resource.programming.unavailablePinnedProgrammingMethodIds.length) {
      issues.push({ code: 'coach_lock_unavailable', componentKey: resource.componentKey, detail: 'A locked reference is stale, unavailable or ineligible. Coach locks were retained in the request.' })
    }
  }
  let proposal = startingProposal(request, resources)
  let athleteAdvice = null
  const consultantAdvice = []
  let decisionSource = 'deterministic_draft'
  const input = { request, componentPlan, resources, athleteEvidence, preparationSelection: 'deferred_until_downstream_prescription' }
  const optionalCall = async (capabilityId, role, contract, payload) => {
    try { return await run.call({ capabilityId, role, input: payload, ...contract }) } catch (error) {
      if (error.code === 'canceled') throw error
      issues.push({ code: error.code ?? 'capability_failed', capabilityId, detail: `${role} advice could not be validated; coach constraints remain in force.` })
      return null
    }
  }
  if (!issues.length) {
    if (athleteCapabilityId) athleteAdvice = await optionalCall(athleteCapabilityId, 'athlete_development', athleteContract(request), input)
    for (const capabilityId of request.consultants) {
      let sources
      try { sources = registry.get(capabilityId, 'methodology_consultant').sourceReferences } catch (error) {
        issues.push({ code: error.code, capabilityId, detail: 'Requested methodology consultant is not registered for that role.' })
        continue
      }
      const advice = await optionalCall(capabilityId, 'methodology_consultant', consultantContract(resources, sources), { ...input, athleteAdvice, sourceReferences: sources })
      if (advice) consultantAdvice.push({ capabilityId, sourceReferences: sources, advice })
    }
    const decision = await optionalCall(directorCapabilityId, 'director', directorContract(request, resources), { ...input, athleteAdvice, consultantAdvice })
    if (decision) { proposal = decision; decisionSource = 'vortex_director' }
  }
  checkCanceled()
  for (const control of active) {
    const decision = proposal.components.find((entry) => entry.key === control.key)
    if (control.key !== 'prepare_and_access' && (control.selection === 'directed' || request.mode === 'coach_directed')
      && (!decision.preferredExerciseProfileIds.length || !decision.preferredProgrammingMethodIds.length)) {
      issues.push({ code: 'coach_direction_incomplete', componentKey: control.key, detail: 'Coach-directed exercise and programming choices require completion.' })
    }
  }
  return immutableProgrammingValue({ schemaVersion: PROGRAMMING_DIRECTOR_VERSION, intentId: randomUUID(),
    request, requestHash: programmingValueHash(request), componentPlan, resources, proposal, athleteAdvice, consultantAdvice, athleteEvidence,
    decisionSource, status: issues.length ? 'NEEDS_COACH_REVIEW' : 'INTENT_READY', issues,
    preparationStatus: 'DEFERRED_UNTIL_DOWNSTREAM_PRESCRIPTION', omittedComponentKeys: request.components.filter((component) => budgets[component.key] === 0).map((component) => component.key),
    validatedWorkout: false, creatorAuthorized: false, trace: run.telemetry(),
  })
}
