import Joi from 'joi'
import { randomUUID } from 'node:crypto'
import { normalizeWorkoutExerciseGapResearchInput, researchWorkoutExerciseGap } from './workoutExerciseGapResearch.js'
import { immutableProgrammingValue, programmingValueHash, parseProgrammingContract } from './workoutProgrammingRequest.js'
import { createProgrammingStaffRun, ProgrammingStaffError } from './programmingStaffRuntime.js'
import { programmingResourceRequests } from './workoutProgrammingDirector.js'
import { normalizeSessionComponentPlan } from './sessionComponentContract.js'

const DISPOSITIONS = ['different_movement', 'reusable', 'missing_delivery_profile', 'existing_content_needs_review', 'context_conflict', 'insufficient_evidence']
const text = (max) => ({ joi: Joi.string().min(1).max(max), json: { type: 'string', minLength: 1, maxLength: max } })
const enumeration = (values) => ({ joi: Joi.string().valid(...values), json: { type: 'string', enum: values } })
const nullableId = (values) => ({ joi: values.length ? Joi.string().valid(...values).allow(null) : Joi.valid(null),
  json: { enum: [...values, null] } })
const array = (item, max) => ({ joi: Joi.array().items(item.joi).max(max), json: { type: 'array', maxItems: max, items: item.json } })
const object = (fields) => ({ joi: Joi.object(Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.joi.required()]))),
  json: { type: 'object', additionalProperties: false, required: Object.keys(fields), properties: Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.json])) } })

/** Every considered definition gets a disposition; the model cannot omit inconvenient alternatives. */
export function workoutExerciseGapAssessmentContract(research) {
  const cards = research.relatedDefinitions
  const methods = research.resources.programming.candidates
  const alternative = object({ definitionId: cards.length ? enumeration(cards.map((card) => card.id)) : text(36),
    cardVersion: { joi: Joi.number().integer().min(1), json: { type: 'integer', minimum: 1 } },
    disposition: enumeration(DISPOSITIONS), rationale: text(500) })
  const alternatives = array(alternative, cards.length)
  alternatives.joi = alternatives.joi.length(cards.length).unique('definitionId')
  alternatives.json.minItems = cards.length
  const schema = object({ requestRevision: enumeration([research.requestRevision]), researchHash: enumeration([research.researchHash]),
    summary: text(1000), needAssessment: enumeration(['supported', 'needs_coach_review']), needRationale: text(1000), questions: array(text(500), 8),
    alternatives, proposedKind: enumeration(['none', 'missing_movement', 'missing_delivery_profile']),
    targetDefinitionId: nullableId(cards.map((card) => card.id)), targetVariantId: nullableId(cards.flatMap((card) => card.variants.map((variant) => variant.id))),
    phaseKey: nullableId([...new Set(methods.map((method) => method.phaseKey))]),
    programmingMethodId: nullableId([...new Set(methods.map((method) => method.programmingMethodId))]),
  })
  return { outputSchema: schema.json, parseOutput(raw) {
    const judgment = parseProgrammingContract(schema.joi, raw, 'Exercise gap content judgment')
    for (const alternative of judgment.alternatives) {
      const card = cards.find((entry) => entry.id === alternative.definitionId)
      if (!card || card.cardVersion !== alternative.cardVersion) throw new TypeError('Alternative evidence must name the exact researched card version')
    }
    return immutableProgrammingValue(judgment)
  } }
}

function researchBlockers(research, request) {
  // An exact identity can have a missing delivery context, but never permits a duplicate movement card.
  const issues = research.issues.filter((issue) => issue.code !== 'existing_canonical_identity')
  const control = request.components.find((entry) => entry.key === research.componentKey)
  const resourceRequest = programmingResourceRequests(request).find((entry) => entry.componentKey === research.componentKey)
  const equipment = normalizeSessionComponentPlan({ durationMinutes: request.logistics.totalBookedMinutes,
    equipment: { available: request.equipment.available, quantities: request.equipment.quantities, excluded: request.equipment.excluded },
    components: [{ key: control.key, budgetSeconds: 1, equipment: control.equipment }] }).components[0].equipment
  const canonicalEquipment = (key) => key === 'bodyweight' ? 'none' : key
  const allowed = new Set(equipment.allowed.map(canonicalEquipment))
  const unavailable = research.need.requiredEquipment.map(canonicalEquipment).filter((key) => key !== 'none' && !allowed.has(key))
  if (unavailable.length) issues.push({ code: 'gap_equipment_unavailable', detail: `The proposed demand requires unavailable component equipment: ${unavailable.join(', ')}.` })
  const unknownQuantities = research.need.requiredEquipment.map(canonicalEquipment).filter((key) => key !== 'none' && !(equipment.quantities[key] > 0))
  if (unknownQuantities.length) issues.push({ code: 'gap_equipment_quantity_unknown', detail: 'Confirm positive quantities for the proposed equipment before using a content gap to request new material.' })
  if (control.lockedExercises.length || control.lockedBlocks.length) {
    issues.push({ code: 'gap_locked_component', detail: 'Resolve the locked component choices before requesting new exercise content for it.' })
  }
  if (!resourceRequest) issues.push({ code: 'gap_component_not_scheduled', detail: 'The target component must be scheduled.' })
  if (research.athleteFindings.length) {
    issues.push({ code: 'gap_athlete_evidence_review', detail: 'Resolve the current athlete-source findings before requesting new content.' })
  }
  return issues
}

function realizeJudgment(research, judgment, request) {
  const review = (code, detail) => ({ status: 'NEEDS_COACH_REVIEW', exerciseGap: null, reusableDefinitionIds: [], issues: [{ code, detail }] })
  if (judgment.questions.length || judgment.needAssessment !== 'supported') return review('gap_need_review', 'The proposed demand needs coaching clarification or developmental review.')
  const cards = research.relatedDefinitions
  for (const alternative of judgment.alternatives) {
    const card = cards.find((entry) => entry.id === alternative.definitionId)
    if (alternative.disposition === 'different_movement' && card.matches.exactIdentity) return review('gap_existing_identity', 'An exact canonical name or alias cannot be discarded as an unrelated movement.')
    if (alternative.disposition === 'reusable' && !card.eligibleProfileIds.length) return review('gap_unapproved_reuse', 'The proposed existing alternative has no currently eligible delivery profile; review its library or contextual evidence.')
  }
  const reuse = judgment.alternatives.filter((entry) => entry.disposition === 'reusable').map((entry) => entry.definitionId)
  if (reuse.length) return { status: 'REUSE_EXISTING', exerciseGap: null, reusableDefinitionIds: reuse, issues: [] }
  if (judgment.alternatives.some((entry) => ['existing_content_needs_review', 'context_conflict', 'insufficient_evidence'].includes(entry.disposition))) {
    return review('gap_existing_content_review', 'Existing content, contextual constraints or incomplete evidence needs review before new content can be proposed.')
  }
  if (judgment.proposedKind === 'none') return review('gap_not_established', 'The content review did not establish a missing movement or delivery profile.')
  const method = research.resources.programming.candidates.find((entry) => entry.programmingMethodId === judgment.programmingMethodId && entry.phaseKey === judgment.phaseKey)
  if (!method) return review('gap_programming_context_missing', 'A proposed gap must have an existing published programming method for its exact delivery phase.')
  const control = request.components.find((entry) => entry.key === research.componentKey)
  if (control.lockedProgrammingMethodIds.length && !control.lockedProgrammingMethodIds.includes(method.programmingMethodId)) {
    return review('gap_programming_lock_conflict', 'The proposed gap cannot change a locked programming method.')
  }
  let target = null
  if (judgment.proposedKind === 'missing_movement') {
    if (judgment.targetDefinitionId || judgment.targetVariantId || judgment.alternatives.some((entry) => entry.disposition !== 'different_movement')) {
      return review('gap_movement_conflict', 'A new movement cannot replace an existing movement or an existing-card delivery-profile need.')
    }
  } else {
    const card = cards.find((entry) => entry.id === judgment.targetDefinitionId)
    const variant = card?.variants.find((entry) => entry.id === judgment.targetVariantId)
    const matches = judgment.alternatives.filter((entry) => entry.disposition === 'missing_delivery_profile')
    if (!card || !variant || matches.length !== 1 || matches[0].definitionId !== card.id
      || ['archived', 'deprecated'].includes(card.status) || ['archived', 'deprecated'].includes(variant.status)) {
      return review('gap_profile_target_invalid', 'A missing delivery profile requires one current exact existing variant, reviewed as the intended movement.')
    }
    if (card.status !== 'published' || variant.status !== 'published' || !card.inCurrentRelease || !card.releasedVariantIds.includes(variant.id)) {
      return review('gap_profile_target_needs_review', 'The target variant must already pass the existing published release loader. Complete its current library review before requesting another delivery context.')
    }
    if ([...request.excludedExerciseCardIds, ...control.excludedExerciseCardIds].includes(card.id)) return review('gap_excluded_profile_target', 'An excluded exercise cannot become a new delivery-profile target for this request.')
    if (card.profiles.some((profile) => profile.variantId === variant.id && profile.phaseKey === judgment.phaseKey)) {
      return review('gap_existing_delivery_profile', 'That variant already has a delivery profile for this phase. Draft, archived or avoid profiles require existing-content review, not a duplicate profile.')
    }
    target = { exerciseCardId: card.id, cardVersion: card.cardVersion, variantId: variant.id }
  }
  const content = { schemaVersion: '1.0.0', scope: research.scope, requestRevision: research.requestRevision, requestHash: research.requestHash,
    researchHash: research.researchHash, sourceHash: research.sourceHash, libraryRelease: research.sources.release,
    componentKey: research.componentKey, unmetDemand: research.need, reason: judgment.proposedKind,
    target, phaseKey: judgment.phaseKey, programmingMethodId: judgment.programmingMethodId,
    alternativesConsidered: judgment.alternatives, needRationale: judgment.needRationale, summary: judgment.summary }
  return { status: 'GAP_CONFIRMED', reusableDefinitionIds: [], issues: [],
    exerciseGap: { id: randomUUID(), ...content, contentHash: programmingValueHash(content),
      humanReviewRequired: true, authorizesLibraryInclusion: false } }
}

/** Fresh research -> one bounded Director judgment -> fresh source comparison. No card creation or approval. */
export async function assessWorkoutExerciseGap({ pool, context, rawInput, registry, runOptions = {}, staffRun = null }) {
  const { request } = normalizeWorkoutExerciseGapResearchInput(rawInput)
  const run = staffRun ?? createProgrammingStaffRun(registry, { maxCalls: 1, timeoutMs: 60000, perCallTimeoutMs: 20000,
    maxOutputTokens: 8000, perCallOutputTokens: 8000, ...runOptions })
  run.assertActive()
  const research = await researchWorkoutExerciseGap(pool, context, rawInput)
  run.assertActive()
  const output = (value) => immutableProgrammingValue({ schemaVersion: '1.0.0', research, judgment: null,
    ...value, creatorAuthorized: false, libraryApprovalGranted: false, trace: run.telemetry() })
  const blockers = researchBlockers(research, request)
  if (blockers.length) return output({ status: 'NEEDS_COACH_REVIEW', exerciseGap: null, reusableDefinitionIds: [], issues: blockers })
  let judgment
  try {
    judgment = await run.call({ capabilityId: 'vortex/director', role: 'director',
      input: { task: 'assess_exercise_gap', request, research,
        boundaries: ['Account for every researched definition and its exact version.',
          'Different movement means different content or stimulus, never missing approval, readiness, inventory, time or preferred equipment.',
          'Prefer an existing eligible alternative. Do not turn a missing delivery context into a duplicate exercise card.',
          'Assess whether the requested demand is appropriate and achievable for these athletes and controls. Ask for clarification when it is not established.',
          'Your content judgment does not authorize library inclusion, readiness, prescriptions or a validated workout.'] },
      ...workoutExerciseGapAssessmentContract(research) })
  } catch (error) {
    if (['canceled', 'deadline_exceeded'].includes(error.code)) throw error
    return output({ status: 'NEEDS_COACH_REVIEW', exerciseGap: null, reusableDefinitionIds: [],
      issues: [{ code: error.code ?? 'gap_assessment_failed', detail: 'The content assessment did not produce complete, validated evidence.' }] })
  }
  const current = await researchWorkoutExerciseGap(pool, context, rawInput)
  run.assertActive()
  if (current.researchHash !== research.researchHash) throw new ProgrammingStaffError('exercise_gap_sources_changed', 'Canonical content, programming, athlete evidence or the source session changed. Research the gap again.')
  return output({ judgment, ...realizeJudgment(current, judgment, request) })
}
