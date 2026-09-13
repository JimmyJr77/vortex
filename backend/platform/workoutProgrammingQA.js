import Joi from 'joi'
import { randomUUID } from 'node:crypto'
import { normalizeCoachWorkoutRequest, programmingValueHash, immutableProgrammingValue, parseProgrammingContract, programmingComponentPlan } from './workoutProgrammingRequest.js'
import { programmingResourceRequests, validateProgrammingDirectorProposal } from './workoutProgrammingDirector.js'
import { loadWorkoutProgrammingMaterials } from './workoutProgrammingLibrarians.js'
import { programmingCandidateMaterials, builderCapabilityContract, scheduleProgrammingDraft, validateProgrammingCoverage } from './workoutProgrammingBuilder.js'
import { deriveProgrammingPreparationDemand, preparationCapabilityContract, VORTEX_PREPARATION_CAPABILITY_CONTEXT } from './workoutPreparation.js'
import { resolveCanonicalProgrammingDose } from './canonicalProgrammingDose.js'
import { evaluateProgrammingLoadSequence } from './workoutLoadLedger.js'
import { createProgrammingStaffRun, ProgrammingStaffError } from './programmingStaffRuntime.js'
import { SESSION_COMPONENT_ORDER } from './sessionComponentContract.js'
import { evaluateProgrammingMethodRules } from './programmingMethodRules.js'
import { evaluateCanonicalProgrammingRules } from './canonicalProgrammingRules.js'

export const PROGRAMMING_QA_VERSION = '1.0.0'
export const PROGRAMMING_QA_AREAS = Object.freeze(['impact_volume', 'development_readiness', 'redundancy', 'sequencing', 'cumulative_fatigue',
  'equipment_space', 'timing_recovery', 'complexity_supervision', 'preparation', 'objectives', 'methodology', 'coach_controls'])
export const PROGRAMMING_QA_ROUTES = Object.freeze(['director', 'athlete_development', 'programming_librarian', 'exercise_librarian', 'prepare_access', 'session_builder', 'coach'])
const obj = () => Joi.object().unknown(true).required()
const hashSchema = Joi.string().hex().length(64).required()
const uuid = () => Joi.string().guid().required()
const text = (length) => Joi.string().max(length).required()
const ref = (activity) => ({ exerciseCardId: activity.card.id, variantId: activity.card.variantId,
  deliveryProfileId: activity.profile.id, cardVersion: activity.card.cardVersion })
const same = (a, b) => programmingValueHash(a) === programmingValueHash(b)
const shape = Joi.object({ schemaVersion: Joi.string().valid(PROGRAMMING_QA_VERSION).required(), draftId: uuid(), intentId: uuid(),
  request: obj(), requestHash: hashSchema, libraryRelease: obj(), componentPlan: obj(),
  builderSource: Joi.string().valid('session_builder', 'deterministic_review_draft').required(), builderProposal: obj(),
  preparationProposal: Joi.object().unknown(true).allow(null).required(), preparationDemand: obj(),
  activities: Joi.array().max(52).unique('activityId').items(Joi.object({ activityId: text(120),
    componentKey: Joi.string().valid(...SESSION_COMPONENT_ORDER).required(),
    card: Joi.object({ id: uuid(), variantId: uuid(), cardVersion: Joi.number().integer().min(1).required() }).unknown(true).required(),
    profile: Joi.object({ id: uuid() }).unknown(true).required(), method: Joi.object({ id: Joi.string().pattern(/^[1-9][0-9]*$/).required() }).unknown(true).required(),
    dose: obj(), rationale: text(800), sourceHash: hashSchema,
  })).required(), schedule: obj(), load: obj(), coverage: obj(), issues: Joi.array().max(1000).items(obj().optional()).required(),
  candidateEligibility: Joi.array().max(1000).items(obj().optional()).required(),
  repairs: Joi.array().max(100).items(obj().optional()).required(), revisions: Joi.array().max(10).items(obj().optional()).required(), trace: obj(),
  status: Joi.string().valid('READY_FOR_CRITIC', 'NEEDS_COACH_REVIEW').required(), validatedWorkout: Joi.boolean().valid(false).required(),
  creatorAuthorized: Joi.boolean().valid(false).required(), compositionAttempts: Joi.number().integer().min(0).max(1500).required(),
})

function finding(code, message, route = 'session_builder', activity = null, detail = {}) {
  return { code, source: 'deterministic', route, message,
    activityIds: activity ? [activity.activityId] : [], componentKeys: activity ? [activity.componentKey] : [], ...detail }
}

function executionFinding(issue, message, activities, route = 'session_builder') {
  const result = finding(issue.code, message, route, activities.find((entry) => entry.activityId === issue.activityId), { evidence: issue })
  if (issue.componentKey) result.componentKeys = [issue.componentKey]
  return result
}

/** A model's PASS cannot replace source quality gates and stop rules. */
function sourceQualityFindings(activity) {
  const issues = []
  const { method, dose } = activity
  if (!dose.qualityGate || !dose.stopRules.length || (method.quality_standards ?? []).some((rule) => !rule.standard)) {
    issues.push(finding('missing_quality_controls', 'A complete source-backed quality gate and stop rules are required.', 'programming_librarian', activity))
  }
  return issues
}

/** Internal service: sessionIntent must be loaded from server-owned state, never accepted as client authorization. */
export async function validateWorkoutProgrammingDraft({ pool, context, sessionIntent, draft: rawDraft, signal }) {
  const canceled = () => { if (signal?.aborted) throw new ProgrammingStaffError('canceled', 'Programming validation was canceled') }
  canceled()
  const draft = parseProgrammingContract(shape, rawDraft, 'Programming draft')
  const { assumptions: _assumptions, ...coachInput } = sessionIntent.request ?? {}
  const request = normalizeCoachWorkoutRequest(coachInput)
  if (!same(request, sessionIntent.request) || programmingValueHash(request) !== sessionIntent.requestHash
    || !same(draft.request, request) || draft.requestHash !== sessionIntent.requestHash || draft.intentId !== sessionIntent.intentId) {
    throw new ProgrammingStaffError('stale_request', 'Draft does not match server-owned coach intent')
  }
  if (request.mode === 'modify_existing') throw new ProgrammingStaffError('source_workout_adapter_required', 'Modify Existing requires a verified persisted source workout')
  const componentPlan = programmingComponentPlan(request)
  if (!same(componentPlan, draft.componentPlan) || !same(componentPlan, sessionIntent.componentPlan)) throw new ProgrammingStaffError('constraint_override', 'Draft changed immutable component controls')
  // Selected references survive shortlist limits, but pins never waive eligibility or scope.
  const searches = programmingResourceRequests(request, 100).map((search) => {
    const selected = draft.activities.filter((activity) => activity.componentKey === search.componentKey)
    return { ...search, pinnedExercises: [...search.pinnedExercises, ...selected.map(ref)],
      pinnedProgrammingMethodIds: [...new Set([...search.pinnedProgrammingMethodIds, ...selected.map((entry) => entry.method.id)])] }
  })
  const materials = await loadWorkoutProgrammingMaterials(pool, context, searches, { athleteRequest: request })
  canceled()
  const release = materials.resources[0]?.libraryRelease
  const findings = []
  const athleteEvidence = materials.athleteEvidence
  for (const issue of athleteEvidence.findings) findings.push(finding(issue.code, issue.detail, 'athlete_development', null, { evidence: issue }))
  if (athleteEvidence.contentHash !== sessionIntent.athleteEvidence?.contentHash) findings.push(finding('stale_athlete_evidence',
    'Roster or source observations changed after Athlete Development advice; refresh the session intent.', 'athlete_development'))
  if (!release || !same(release, draft.libraryRelease) || sessionIntent.resources.some((entry) => !same(entry.libraryRelease, release))) {
    findings.push(finding('stale_library_release', 'Refresh intent and draft against the current facility release.', 'director'))
  }
  if (!materials.programmingSearchComplete) findings.push(finding('incomplete_programming_search', 'Complete the published method search before final validation.', 'programming_librarian'))
  const groups = programmingCandidateMaterials(materials)
  try { validateProgrammingDirectorProposal(request, materials.resources, sessionIntent.proposal) } catch {
    findings.push(finding('stale_director_proposal', 'Director selections no longer satisfy current resources and coach controls.', 'director'))
  }
  let builderProposal = null
  try { builderProposal = builderCapabilityContract(request, groups.filter((group) => group.key !== 'prepare_and_access')).parseOutput(draft.builderProposal) } catch {
    findings.push(finding('invalid_builder_proposal', 'Builder selections no longer satisfy their canonical contract.', 'session_builder'))
  }
  const activities = []
  for (const submitted of draft.activities) {
    const candidate = groups.find((group) => group.key === submitted.componentKey)?.candidates.find((entry) => same(ref(submitted),
      { exerciseCardId: entry.card.id, variantId: entry.card.variantId, deliveryProfileId: entry.profile.id, cardVersion: entry.card.cardVersion }))
    const method = materials.methods.find((entry) => String(entry.id) === submitted.method.id)
    if (!candidate || !method || !candidate.methodIds.includes(submitted.method.id)) {
      findings.push(finding('unavailable_canonical_pair', 'Selected exercise/method is no longer eligible in this facility and component.', 'session_builder', submitted)); continue
    }
    const { card, profile } = candidate
    const sourceHash = programmingValueHash({ card, profile, method })
    if (sourceHash !== submitted.sourceHash || sourceHash !== programmingValueHash({ card: submitted.card, profile: submitted.profile, method: submitted.method })) {
      findings.push(finding('stale_source_metadata', 'Canonical source content changed or the draft embeds altered source metadata.', 'session_builder', submitted))
    }
    try {
      const { sets, reps, workSeconds, restSeconds } = submitted.dose
      const dose = resolveCanonicalProgrammingDose({ card, profile, method, request, componentKey: submitted.componentKey,
        proposal: { sets, ...(reps == null ? {} : { reps }), workSeconds, restSeconds } })
      if (!same(dose, submitted.dose)) findings.push(finding('stale_or_forged_dose', 'Stored dose differs from its current canonical prescription.', 'session_builder', submitted))
      const activity = { activityId: submitted.activityId, componentKey: submitted.componentKey, rationale: submitted.rationale, card, profile, method, dose, sourceHash }
      activities.push(activity)
      findings.push(...sourceQualityFindings(activity))
    } catch (error) { findings.push(finding(error.code ?? 'invalid_prescription', 'Selected dose no longer satisfies its canonical source bounds.', 'session_builder', submitted)) }
  }
  const demand = deriveProgrammingPreparationDemand(activities)
  if (!same(demand, draft.preparationDemand)) findings.push(finding('stale_preparation_demand', 'Preparation must be regenerated for the current downstream prescriptions and metadata.', 'prepare_access'))
  let preparationProposal = null
  try {
    preparationProposal = preparationCapabilityContract({ request, demand,
      candidates: groups.find((group) => group.key === 'prepare_and_access').candidates }).parseOutput(draft.preparationProposal)
  } catch { findings.push(finding('invalid_preparation_proposal', 'Preparation no longer satisfies the Vortex framework and current downstream demand.', 'prepare_access')) }
  for (const components of [builderProposal?.components, preparationProposal ? [{ key: 'prepare_and_access', selections: preparationProposal.selections }] : null]) {
    if (!components) continue
    const expected = components.flatMap((component) => component.selections.map((choice) => ({ componentKey: component.key, profileId: choice.deliveryProfileId, methodId: choice.programmingMethodId })))
    const actual = activities.filter((entry) => components.some((component) => component.key === entry.componentKey))
      .map((entry) => ({ componentKey: entry.componentKey, profileId: entry.profile.id, methodId: String(entry.method.id) }))
    if (!same(expected, actual)) findings.push(finding('proposal_activity_mismatch', 'Execution order and selected pairs must exactly match validated staff proposals.'))
  }
  const coverage = validateProgrammingCoverage(request, activities)
  const load = evaluateProgrammingLoadSequence({ request, activities })
  let schedule = null
  try {
    schedule = scheduleProgrammingDraft({ request, componentPlan, activities, builderProposal: builderProposal ?? { components: [] }, preparationProposal })
    if (schedule.status !== 'SCHEDULED') findings.push(finding('schedule_requires_composition', 'The reconstructed session does not completely allocate its booked windows.'))
    for (const issue of schedule.resourceValidation.issues) findings.push(executionFinding(issue, 'Reconstructed resource schedule requires correction.', activities))
  } catch (error) { findings.push(finding(error.code ?? 'invalid_schedule', 'Reviewed work and resources cannot reconstruct the stored schedule.')) }
  const exerciseRules = activities.map((activity) => evaluateCanonicalProgrammingRules({ activity, request, activities, athleteEvidence }))
  for (const result of exerciseRules) for (const issue of result.findings) findings.push(finding(issue.code, issue.message, issue.route,
    activities.find((entry) => entry.activityId === result.activityId), { evidence: issue }))
  const methodRules = activities.map((activity) => evaluateProgrammingMethodRules({ activity, request, activities,
    readinessFacts: exerciseRules.find((entry) => entry.activityId === activity.activityId).facts,
    schedule: schedule?.components.flatMap((component) => component.activities).find((entry) => entry.activityId === activity.activityId) ?? null }))
  for (const result of methodRules) for (const issue of result.findings.filter((entry) => entry.severity !== 'info')) {
    findings.push(finding(issue.code, issue.message, 'programming_librarian', activities.find((entry) => entry.activityId === result.activityId), { evidence: issue }))
  }
  for (const [key, rebuilt] of [['schedule', schedule], ['load', load], ['coverage', coverage]]) {
    if (!same(draft[key], rebuilt)) findings.push(finding(`stale_${key}`, `Stored ${key} differs from independent reconstruction.`))
  }
  for (const issue of [...coverage.issues, ...load.issues]) findings.push(executionFinding(issue, 'Reconstructed coverage or cumulative load requires correction.', activities))
  for (const issue of [...(sessionIntent.issues ?? []), ...draft.issues]) findings.push(executionFinding(issue, 'An earlier staff or deterministic finding is still unresolved.', activities, 'director'))
  if (draft.status !== 'READY_FOR_CRITIC' || draft.builderSource !== 'session_builder') findings.push(finding('incomplete_staff_draft', 'A complete staff composition is required before Critic review.', 'director'))
  canceled()
  const target = { qaVersion: PROGRAMMING_QA_VERSION, draftId: draft.draftId, intentId: sessionIntent.intentId, request, componentPlan, release,
    director: sessionIntent.proposal, athleteAdvice: sessionIntent.athleteAdvice, consultantAdvice: sessionIntent.consultantAdvice,
    activities, builderProposal, preparationProposal, demand, schedule, load, coverage, methodRules, exerciseRules, athleteEvidence }
  return immutableProgrammingValue({ schemaVersion: PROGRAMMING_QA_VERSION, draftId: draft.draftId,
    reviewHash: programmingValueHash(target), status: findings.length ? 'REVISE' : 'PASS', findings, reconstructed: target })
}

const jsonObject = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties })
const jsonText = (maxLength) => ({ type: 'string', minLength: 1, maxLength })
export function programmingCriticContract(validation) {
  const { draftId, reviewHash, reconstructed } = validation
  const activityIds = reconstructed.activities.map((entry) => entry.activityId)
  const componentKeys = reconstructed.componentPlan.components.map((entry) => entry.key)
  const assessmentSchema = Joi.object({ area: Joi.string().valid(...PROGRAMMING_QA_AREAS).required(), status: Joi.string().valid('PASS', 'REVISE').required(), summary: text(800) })
  const schema = Joi.object({ draftId: Joi.string().valid(draftId).required(), reviewHash: Joi.string().valid(reviewHash).required(),
    status: Joi.string().valid('PASS', 'REVISE').required(), summary: text(1500),
    assessments: Joi.array().length(PROGRAMMING_QA_AREAS.length).unique('area').items(assessmentSchema).required(),
    findings: Joi.array().max(40).items(Joi.object({ area: Joi.string().valid(...PROGRAMMING_QA_AREAS).required(),
      route: Joi.string().valid(...PROGRAMMING_QA_ROUTES).required(), message: text(800), recommendedAction: text(1000),
      activityIds: Joi.array().max(52).unique().items(Joi.string().valid(...activityIds)).required(),
      componentKeys: Joi.array().max(5).unique().items(Joi.string().valid(...componentKeys)).required(),
    })).required(),
  })
  return { outputSchema: jsonObject({ draftId: { type: 'string', enum: [draftId] }, reviewHash: { type: 'string', enum: [reviewHash] },
    status: { type: 'string', enum: ['PASS', 'REVISE'] }, summary: jsonText(1500),
    assessments: { type: 'array', minItems: PROGRAMMING_QA_AREAS.length, maxItems: PROGRAMMING_QA_AREAS.length,
      items: jsonObject({ area: { type: 'string', enum: PROGRAMMING_QA_AREAS }, status: { type: 'string', enum: ['PASS', 'REVISE'] }, summary: jsonText(800) }) },
    findings: { type: 'array', maxItems: 40, items: jsonObject({ area: { type: 'string', enum: PROGRAMMING_QA_AREAS },
      route: { type: 'string', enum: PROGRAMMING_QA_ROUTES }, message: jsonText(800), recommendedAction: jsonText(1000),
      activityIds: { type: 'array', maxItems: 52, items: { type: 'string', enum: activityIds } },
      componentKeys: { type: 'array', maxItems: 5, items: { type: 'string', enum: componentKeys } },
    }) },
  }), parseOutput(raw) {
    const result = parseProgrammingContract(schema, raw, 'Programming Critic result')
    const failedAreas = result.assessments.filter((entry) => entry.status === 'REVISE').map((entry) => entry.area)
    if (result.status === 'PASS' && (validation.status !== 'PASS' || failedAreas.length || result.findings.length)) throw new RangeError('Critic PASS cannot waive findings or failed assessments')
    if (result.status === 'REVISE' && (!failedAreas.length || !result.findings.length)) throw new RangeError('Critic REVISE requires failed areas and actionable findings')
    if (failedAreas.some((area) => !result.findings.some((entry) => entry.area === area))
      || result.findings.some((entry) => !failedAreas.includes(entry.area))) throw new RangeError('Critic findings must correspond to failed assessments')
    for (const item of result.findings) if (item.activityIds.some((id) => !item.componentKeys.includes(reconstructed.activities.find((entry) => entry.activityId === id).componentKey))) {
      throw new RangeError('Critic finding component references do not match its activities')
    }
    return result
  } }
}

function criticInput(validation) {
  const state = validation.reconstructed
  return { draftId: validation.draftId, reviewHash: validation.reviewHash, reviewAreas: PROGRAMMING_QA_AREAS,
    allowedRoutes: PROGRAMMING_QA_ROUTES, request: state.request, director: state.director,
    athleteAdvice: state.athleteAdvice, consultantAdvice: state.consultantAdvice, athleteEvidence: state.athleteEvidence, framework: VORTEX_PREPARATION_CAPABILITY_CONTEXT,
    preparationProposal: state.preparationProposal, preparationDemand: state.demand, builderProposal: state.builderProposal,
    componentPlan: state.componentPlan, coverage: state.coverage, load: state.load, methodRules: state.methodRules, exerciseRules: state.exerciseRules,
    components: state.schedule.components.map((component) => ({ ...component,
      activities: component.activities.map(({ events, ...schedule }) => ({ ...schedule, eventCount: events.length })),
    })), activities: state.activities.map(({ activityId, componentKey, rationale, card, profile, method, dose }) => ({
      activityId, componentKey, rationale, exercise: { name: card.displayName ?? card.canonicalName, familyId: card.familyId,
        population: card.population, difficulty: card.difficulty, movementPatterns: card.movementPatterns, taskDemands: card.taskDemands,
        stressProfile: card.stressProfile, compositionProfile: card.compositionProfile, programming: card.programming },
      profile: { purpose: profile.purpose, coachInstructions: profile.coachInstructions, athleteInstructions: profile.athleteInstructions },
      method: { id: String(method.id), name: method.name, type: method.programming_type, summary: method.coach_summary,
        fatigue: method.fatigue_profile, rules: method.workout_builder_rules, workRestStructure: method.work_rest_structure, qualityStandards: method.quality_standards }, dose,
    })),
  }
}

/** Bounded independent QA. Revision routes are recommendations; this service cannot mutate or publish a workout. */
export async function reviewWorkoutProgrammingDraft({ pool, context, sessionIntent, draft, registry,
  criticCapabilityId = 'vortex/programming-critic', runOptions = {}, staffRun = null }) {
  const run = staffRun ?? createProgrammingStaffRun(registry, { maxCalls: 1, maxOutputTokens: 5000, perCallOutputTokens: 5000, ...runOptions })
  run.assertActive()
  const validation = await validateWorkoutProgrammingDraft({ pool, context, sessionIntent, draft, signal: runOptions.signal })
  run.assertActive()
  const findings = [...validation.findings]
  let critic = null
  let finalValidation = null
  if (validation.status === 'PASS') {
    try {
      critic = await run.call({ capabilityId: criticCapabilityId, role: 'programming_critic', input: criticInput(validation), ...programmingCriticContract(validation) })
    } catch (error) {
      if (error.code === 'canceled') throw error
      findings.push(finding(error.code ?? 'critic_failed', 'Independent Critic review is unavailable or invalid.', 'coach'))
    }
    if (critic?.status === 'PASS') {
      // A model may take seconds to answer. A fresh read must still describe exactly the reviewed session.
      finalValidation = await validateWorkoutProgrammingDraft({ pool, context, sessionIntent, draft, signal: runOptions.signal })
      run.assertActive()
      findings.push(...finalValidation.findings)
      if (validation.reviewHash !== finalValidation.reviewHash) findings.push(finding('review_target_changed', 'Canonical or session inputs changed during Critic review; review the new draft.', 'director'))
    }
  }
  for (const item of critic?.findings ?? []) findings.push({ ...item, source: 'critic', code: `critic_${item.area}` })
  const passed = critic?.status === 'PASS' && finalValidation?.status === 'PASS' && !findings.length
  return immutableProgrammingValue({ schemaVersion: PROGRAMMING_QA_VERSION, qaId: randomUUID(), draftId: draft.draftId,
    reviewHash: validation.reviewHash, status: passed ? 'QA_PASSED' : 'NEEDS_COACH_REVIEW', validation, critic, finalValidation,
    findings, revisionRoutes: [...new Set(findings.map((entry) => entry.route))], trace: run.telemetry(),
    // A read-only review is not persistence authorization, exercise approval, or clinical readiness certification.
    validatedWorkout: false, creatorAuthorized: false, libraryApprovalGranted: false,
  })
}
