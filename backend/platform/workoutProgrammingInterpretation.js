import Joi from 'joi'
import { normalizeCoachWorkoutRequest, parseProgrammingContract, immutableProgrammingValue, programmingValueHash } from './workoutProgrammingRequest.js'
import { createProgrammingStaffRun, ProgrammingStaffError } from './programmingStaffRuntime.js'
import { loadWorkoutProgrammingModification, modificationCapabilityContext } from './workoutProgrammingModification.js'
import { loadWorkoutProgrammingChoices } from './workoutProgrammingChoices.js'
import { SESSION_COMPONENT_ORDER, SESSION_COMPONENT_LABELS } from './sessionComponentContract.js'
import { EQUIPMENT_V2_KEYS, TAXONOMY_V2_FACETS } from './taxonomyV2.js'
import { CANONICAL_WORKOUT_LEGACY_EQUIPMENT_KEYS } from './canonicalWorkoutContract.js'
import { loadTaxonomyV2Catalog } from './taxonomyV2Repository.js'
import { withCoachingLibrarySnapshot } from './coachingLibraryContext.js'

const text = (max = 600) => ({ joi: Joi.string().trim().min(1).max(max), json: { type: 'string', minLength: 1, maxLength: max } })
const integer = (min, max, nullable = false) => ({ joi: nullable ? Joi.number().integer().min(min).max(max).allow(null) : Joi.number().integer().min(min).max(max),
  json: { type: nullable ? ['integer', 'null'] : 'integer', minimum: min, maximum: max } })
const enumeration = (values) => ({ joi: Joi.string().valid(...values), json: { type: 'string', enum: values } })
const array = (item, max, min = 0) => ({ joi: Joi.array().items(item.joi).min(min).max(max).unique(), json: { type: 'array', minItems: min, maxItems: max, uniqueItems: true, items: item.json } })
const object = (fields) => ({ joi: Joi.object(Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.joi.required()]))),
  json: { type: 'object', additionalProperties: false, required: Object.keys(fields), properties: Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.json])) } })
const unique = (values) => [...new Set(values)]
const equipmentKeys = unique([...EQUIPMENT_V2_KEYS, ...CANONICAL_WORKOUT_LEGACY_EQUIPMENT_KEYS]).filter((key) => !['none', 'bodyweight'].includes(key))
const same = (left, right) => left === undefined || right === undefined ? left === right : programmingValueHash(left) === programmingValueHash(right)
const fail = (message) => { throw new TypeError(message) }

async function activeTaxonomy(pool, context) {
  return withCoachingLibrarySnapshot(pool, context, async (client) => {
    const catalog = await loadTaxonomyV2Catalog(client)
    return Object.fromEntries(Object.entries(TAXONOMY_V2_FACETS).map(([facet, known]) => [facet, (catalog.facets[facet] ?? [])
      .filter((term) => term.status === 'active' && known.some((entry) => entry.key === term.key)).map(({ key, name }) => ({ key, name }))]))
  })
}

/** Review all actual control changes, including derived clocks and normalized equipment, rather than trusting a model's change list. */
function controlChanges(before, after, modification) {
  const changes = []
  const labels = { ageMin: 'Youngest age', ageMax: 'Oldest age', athleteCount: 'Athletes', trainingExperience: 'Training experience',
    athleticMinutes: 'Athletic minutes', tumblingMinutes: 'Tumbling minutes', totalBookedMinutes: 'Total booked minutes',
    coachCount: 'Coaches', laneCount: 'Lanes', stationCount: 'Stations', budgetSeconds: 'Budget seconds', regenerateComponentKeys: 'Components to regenerate',
    blockEdits: 'Block edits', instruction: 'Coaching instruction', programmingMethodId: 'Programming method', workSeconds: 'Work seconds', restSeconds: 'Rest seconds' }
  const walk = (left, right, path, label) => {
    if (same(left, right)) return
    const collectionKey = ['athletes', 'components'].includes(path.at(-1)) ? 'key' : path.at(-1) === 'blockEdits' ? 'blockId' : null
    if (collectionKey && Array.isArray(left) && Array.isArray(right)) {
      for (const key of unique([...left, ...right].map((entry) => entry[collectionKey]))) {
        const name = path.at(-1) === 'athletes' ? `Athlete group ${before.athletes.findIndex((entry) => entry.key === key) + 1}`
          : SESSION_COMPONENT_LABELS[key] ?? modification.blocks.find((entry) => entry.blockId === key)?.name ?? 'Block prescription'
        walk(left.find((entry) => entry[collectionKey] === key), right.find((entry) => entry[collectionKey] === key), [...path, key], name)
      }
    } else if (left && right && typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
      for (const key of unique([...Object.keys(left), ...Object.keys(right)])) if (key !== 'assumptions') {
        const name = labels[key] ?? key.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
        walk(left[key], right[key], [...path, key], label ? `${label}: ${name}` : name)
      }
    } else changes.push({ path: path.join('.'), label, before: left ?? null, after: right ?? null })
  }
  walk(before, after, [], '')
  return changes
}

export function normalizeProgrammingInterpretationInput(raw) {
  const input = parseProgrammingContract(Joi.object({ request: Joi.object().required(), instruction: Joi.string().trim().min(3).max(4000).required() }), raw, 'revision interpretation input')
  const request = normalizeCoachWorkoutRequest(input.request)
  if (request.mode !== 'modify_existing') fail('Interpretation requires a saved-session revision request')
  return immutableProgrammingValue({ request, instruction: input.instruction })
}

/** A small edit vocabulary, not arbitrary JSON patch or authority-bearing agent output. */
export function programmingInterpretationContract(request, modification, choices, instruction, taxonomy = {}) {
  const cohortKey = enumeration(request.athletes.map((entry) => entry.key))
  const componentKey = enumeration(SESSION_COMPONENT_ORDER)
  const definitions = {
    age_range: { cohortKey, ageMin: integer(5, 99), ageMax: integer(5, 99) },
    group_size: { cohortKey, athleteCount: integer(1, 100) },
    training_experience: { cohortKey, trainingExperience: enumeration(['beginner', 'intermediate', 'advanced']) },
    session_time: { athleticMinutes: integer(15, 240), tumblingMinutes: integer(0, 120) },
    logistics: { field: enumeration(['coachCount', 'laneCount', 'stationCount']), value: integer(0, 100) },
    component_budget: { componentKey, budgetSeconds: integer(0, 14400, true) },
    equipment_availability: { equipmentKey: enumeration(equipmentKeys), available: { joi: Joi.boolean(), json: { type: 'boolean' } }, quantity: integer(0, 1000, true) },
    component_equipment: { componentKey, allowed: array(enumeration(['none', ...equipmentKeys]), 100, 1) },
    priority: { componentKey: { joi: componentKey.joi.allow(null), json: { type: ['string', 'null'], enum: [...SESSION_COMPONENT_ORDER, null] } },
      facet: enumeration(Object.keys(TAXONOMY_V2_FACETS)), value: text(120), strength: enumeration(['required', 'preferred', 'exclude']), weight: integer(1, 100) },
    regenerate_components: { componentKeys: array(componentKey, 5, 1) },
  }
  const blocks = modification.blocks.map((entry) => entry.blockId)
  const profiles = unique(choices.components.flatMap((entry) => entry.exercises.map((exercise) => exercise.ref.deliveryProfileId)))
  const cards = unique(choices.components.flatMap((entry) => entry.exercises.map((exercise) => exercise.ref.exerciseCardId)))
  const methods = unique(choices.components.flatMap((entry) => entry.methods.map((method) => method.id)))
  if (cards.length) definitions.exclude_exercise = { exerciseCardId: enumeration(cards) }
  if (blocks.length) {
    const blockId = enumeration(blocks)
    if (profiles.length) definitions.replace_exercise = { blockId, deliveryProfileId: enumeration(profiles) }
    if (methods.length) definitions.block_method = { blockId, programmingMethodId: enumeration(methods) }
    definitions.block_dose = { blockId, field: enumeration(['sets', 'reps', 'workSeconds', 'restSeconds']), value: integer(0, 3600, true) }
  }
  const variants = Object.entries(definitions).map(([kind, fields]) => object({ kind: enumeration([kind]), ...fields, instructionQuote: text(500) }))
  const schema = object({ requestRevision: enumeration([request.revision]), summary: text(1500), questions: array(text(600), 5),
    operations: { joi: Joi.array().items(Joi.alternatives().try(...variants.map((entry) => entry.joi))).max(30).required(),
      json: { type: 'array', maxItems: 30, items: { anyOf: variants.map((entry) => entry.json) } } } })
  return { outputSchema: schema.json, parseOutput(raw) {
    const result = parseProgrammingContract(schema.joi, raw, 'Director control interpretation')
    for (const operation of result.operations) if (operation.kind === 'priority' && !taxonomy[operation.facet]?.some((entry) => entry.key === operation.value)) {
      fail('A proposed priority must be an active term in the current database taxonomy')
    }
    for (const operation of result.operations) if (operation.instructionQuote.length < 3 || !instruction.includes(operation.instructionQuote)) {
      fail('Every proposed edit must quote the coaching instruction it interprets')
    }
    return immutableProgrammingValue(result)
  } }
}

/** Changes only the declared coach controls. Roster, source observations, limitations and block locks are never writable. */
export function applyProgrammingInterpretation(request, modification, choices, interpretation, instruction, taxonomy = {}) {
  interpretation = programmingInterpretationContract(request, modification, choices, instruction, taxonomy).parseOutput(interpretation)
  const { assumptions: _assumptions, ...input } = structuredClone(request)
  const changed = { ...input, instruction }
  const touched = new Set()
  const record = (path, label) => {
    if (touched.has(path)) fail(`The interpretation repeats or contradicts ${label}`)
    touched.add(path)
  }
  const component = (key) => {
    let entry = changed.components.find((item) => item.key === key)
    if (!entry) { entry = { key }; changed.components.push(entry) }
    return entry
  }
  const blockEdit = (id) => {
    let edit = changed.modification.blockEdits.find((entry) => entry.blockId === id)
    if (!edit) { edit = { blockId: id }; changed.modification.blockEdits.push(edit) }
    return edit
  }
  for (const operation of interpretation.operations) {
    const cohort = changed.athletes.find((entry) => entry.key === operation.cohortKey)
    const block = modification.blocks.find((entry) => entry.blockId === operation.blockId)
    const groupLabel = `Athlete group ${changed.athletes.indexOf(cohort) + 1}`
    const set = (target, key, value, path, label) => { record(path, label); target[key] = value }
    switch (operation.kind) {
      case 'age_range':
        set(cohort, 'ageMin', operation.ageMin, `${cohort.key}.ageMin`, `${groupLabel}: youngest age`)
        set(cohort, 'ageMax', operation.ageMax, `${cohort.key}.ageMax`, `${groupLabel}: oldest age`)
        break
      case 'group_size': set(cohort, 'athleteCount', operation.athleteCount, `${cohort.key}.athleteCount`, `${groupLabel}: athletes`); break
      case 'training_experience': set(cohort, 'trainingExperience', operation.trainingExperience, `${cohort.key}.trainingExperience`, `${groupLabel}: training experience`); break
      case 'session_time':
        for (const field of ['athleticMinutes', 'tumblingMinutes']) set(changed.logistics, field, operation[field], `logistics.${field}`, field === 'athleticMinutes' ? 'Athletic minutes' : 'Tumbling minutes')
        set(changed.logistics, 'totalBookedMinutes', operation.athleticMinutes + operation.tumblingMinutes, 'logistics.totalBookedMinutes', 'Total booked minutes')
        if (operation.tumblingMinutes > 0) set(component('body_control'), 'budgetSeconds', operation.tumblingMinutes * 60, 'body_control.budgetSeconds', 'Body Control: budget seconds')
        break
      case 'logistics': set(changed.logistics, operation.field, operation.value, `logistics.${operation.field}`, ({ coachCount: 'Coaches', laneCount: 'Lanes', stationCount: 'Stations' })[operation.field]); break
      case 'component_budget': set(component(operation.componentKey), 'budgetSeconds', operation.budgetSeconds, `${operation.componentKey}.budgetSeconds`, `${SESSION_COMPONENT_LABELS[operation.componentKey]}: budget seconds`); break
      case 'equipment_availability': {
        const key = operation.equipmentKey
        record(`equipment.${key}`, `Available ${key.replaceAll('_', ' ')}`)
        changed.equipment.available = operation.available ? unique([...changed.equipment.available, key]) : changed.equipment.available.filter((entry) => entry !== key)
        if (operation.available) {
          changed.equipment.excluded = changed.equipment.excluded.filter((entry) => entry !== key)
          changed.equipment.quantities[key] = operation.quantity
        } else {
          delete changed.equipment.quantities[key]
          changed.equipment.excluded = unique([...changed.equipment.excluded, key])
          // A conflicting requirement remains visible and must be resolved by the coach; no lock is silently dropped.
        }
        break
      }
      case 'component_equipment': set(component(operation.componentKey), 'equipment', { ...component(operation.componentKey).equipment, allowed: operation.allowed },
        `${operation.componentKey}.equipment`, `${SESSION_COMPONENT_LABELS[operation.componentKey]}: equipment`); break
      case 'priority': {
        const target = operation.componentKey === null ? changed : component(operation.componentKey)
        const values = target.priorities ?? []
        const previous = values.find((entry) => entry.facet === operation.facet && entry.value === operation.value)
        const next = { facet: operation.facet, value: operation.value, strength: operation.strength, weight: operation.weight }
        record(`${operation.componentKey ?? 'session'}.priority.${operation.facet}.${operation.value}`, `${operation.componentKey ? SESSION_COMPONENT_LABELS[operation.componentKey] : 'Overall'} priority`)
        target.priorities = previous ? values.map((entry) => entry === previous ? next : entry) : [...values, next]
        break
      }
      case 'regenerate_components': set(changed.modification, 'regenerateComponentKeys', operation.componentKeys, 'modification.regenerateComponentKeys', 'Components to regenerate'); break
      case 'exclude_exercise': set(changed, 'excludedExerciseCardIds', unique([...changed.excludedExerciseCardIds, operation.exerciseCardId]),
        `exclude.${operation.exerciseCardId}`, 'Excluded exercises'); break
      case 'replace_exercise': {
        const replacement = choices.components.find((entry) => entry.key === block.componentKey)?.exercises.find((entry) => entry.ref.deliveryProfileId === operation.deliveryProfileId)
        if (!replacement) fail('A replacement must be a canonical choice for its source component')
        set(blockEdit(block.blockId), 'exercise', replacement.ref, `${block.blockId}.exercise`, `${block.name}: replacement exercise`)
        break
      }
      case 'block_method': {
        if (!choices.components.find((entry) => entry.key === block.componentKey)?.methods.some((entry) => entry.id === operation.programmingMethodId)) fail('A method must be a canonical choice for its source component')
        set(blockEdit(block.blockId), 'programmingMethodId', operation.programmingMethodId, `${block.blockId}.method`, `${block.name}: programming method`)
        break
      }
      case 'block_dose': {
        const edit = blockEdit(block.blockId)
        edit.dose ??= {}
        record(`${block.blockId}.dose.${operation.field}`, `${block.name}: ${operation.field}`)
        edit.dose[operation.field] = operation.value
        break
      }
      default: fail('Unsupported Director edit')
    }
  }
  const scheduled = (key) => (key !== 'body_control' || changed.logistics.tumblingMinutes > 0)
    && (key !== 'capacity_competition' || changed.components.find((entry) => entry.key === key)?.budgetSeconds !== 0)
  for (const operation of interpretation.operations) {
    const targets = operation.kind === 'regenerate_components' ? operation.componentKeys : operation.componentKey ? [operation.componentKey] : []
    if (targets.some((key) => !scheduled(key)) && !(operation.kind === 'component_budget' && operation.budgetSeconds === 0)) {
      fail('An interpreted component change requires that component to be included in the revised booking')
    }
  }
  // Omitted components may retain no locks or edits; the normalizer/parent adapter rejects conflicts.
  if (!changed.logistics.tumblingMinutes) changed.components = changed.components.filter((entry) => entry.key !== 'body_control' || entry.lockedBlocks?.length || entry.lockedExercises?.length || entry.lockedProgrammingMethodIds?.length)
  changed.modification.regenerateComponentKeys = changed.modification.regenerateComponentKeys?.filter(scheduled) ?? null
  if (changed.modification.regenerateComponentKeys?.length === 0) changed.modification.regenerateComponentKeys = null
  const proposedRequest = normalizeCoachWorkoutRequest(changed)
  return immutableProgrammingValue({ proposedRequest, changes: controlChanges(request, proposedRequest, modification) })
}

/** One bounded Director call proposes controls. This service cannot generate, persist, approve or publish a workout. */
export async function interpretWorkoutProgrammingRevision({ pool, context, rawInput, registry, runOptions = {} }) {
  const { request, instruction } = normalizeProgrammingInterpretationInput(rawInput)
  const run = createProgrammingStaffRun(registry, { maxCalls: 1, timeoutMs: 60000, perCallTimeoutMs: 20000, maxOutputTokens: 6000, perCallOutputTokens: 6000, ...runOptions })
  run.assertActive()
  const modification = await loadWorkoutProgrammingModification({ pool, context, request })
  const { assumptions: _assumptions, ...coachInput } = request
  const choices = await loadWorkoutProgrammingChoices(pool, context, coachInput)
  run.assertActive()
  const taxonomy = await activeTaxonomy(pool, context)
  run.assertActive()
  const baseRequestHash = programmingValueHash(request)
  const base = { schemaVersion: '1.0.0', baseRequestHash, instruction, sourceWorkoutId: modification.context.sourceWorkoutId,
    sourceRevision: modification.context.sourceRevision, sourceContentHash: modification.context.sourceContentHash, sourceTaxonomyHash: programmingValueHash(taxonomy),
    workoutGenerated: false, libraryApprovalGranted: false }
  const output = (data) => immutableProgrammingValue({ ...base, ...data, trace: run.telemetry() })
  let interpretation
  try {
    interpretation = await run.call({ capabilityId: 'vortex/director', role: 'director',
      input: { task: 'interpret_revision_controls', request, instruction, sourceBlocks: modificationCapabilityContext(modification).sourceBlocks, choices,
        taxonomy, equipmentKeys,
        boundaries: ['Return proposed edits for coach review; do not execute a session.', 'Preserve all roster, evidence, limitations and block locks.',
          'Use only provided canonical choices. Unknown intent or unsupported changes need a question; do not guess.',
          'Quote the exact coaching instruction for each edit. Fields not mentioned should remain unchanged.'] },
      ...programmingInterpretationContract(request, modification, choices, instruction, taxonomy) })
  } catch (error) {
    if (['canceled', 'deadline_exceeded'].includes(error.code)) throw error
    return output({ status: 'NEEDS_COACH_INPUT', summary: 'The requested changes could not be interpreted reliably.', questions: [], proposedRequest: null, changes: [],
      issues: [{ code: error.code ?? 'interpretation_failed', detail: 'Update the controls manually or retry the interpretation.' }] })
  }
  // A source may disappear or be replaced during the model call. Reject its stale interpretation even when clarification is needed.
  await loadWorkoutProgrammingModification({ pool, context, request, expectedContext: modification.context })
  run.assertActive()
  if (!same(taxonomy, await activeTaxonomy(pool, context))) throw new ProgrammingStaffError('interpretation_sources_changed', 'The active taxonomy changed during interpretation. Review the current controls and interpret again.')
  run.assertActive()
  if (interpretation.questions.length) return output({ status: 'NEEDS_COACH_INPUT', summary: interpretation.summary, questions: interpretation.questions,
    proposedRequest: null, changes: [], issues: [] })
  let applied
  let currentChoices
  try {
    applied = applyProgrammingInterpretation(request, modification, choices, interpretation, instruction, taxonomy)
    const current = await loadWorkoutProgrammingModification({ pool, context, request: applied.proposedRequest })
    if (current.context.sourceContentHash !== modification.context.sourceContentHash) throw new ProgrammingStaffError('source_workout_revision_conflict', 'The source session changed during interpretation')
    run.assertActive()
    const { assumptions, ...proposedInput } = applied.proposedRequest
    currentChoices = await loadWorkoutProgrammingChoices(pool, context, proposedInput)
    for (const edit of applied.proposedRequest.modification.blockEdits) {
      if (!edit.exercise && !edit.programmingMethodId) continue
      const block = current.blocks.find((entry) => entry.blockId === edit.blockId)
      const chosen = currentChoices.components.find((entry) => entry.key === block.componentKey)?.exercises.find((entry) => entry.ref.deliveryProfileId === (edit.exercise ?? block.ref).deliveryProfileId)
      if (!chosen || chosen.eligibility !== 'ELIGIBLE' || edit.exercise && !same(chosen.ref, edit.exercise)) fail('A selected canonical exercise is no longer eligible under the proposed controls; review its current evidence and constraints')
      if (edit.programmingMethodId && !chosen.methodIds.includes(edit.programmingMethodId)) fail('The selected programming method is not compatible with the proposed canonical exercise')
    }
  } catch (error) {
    if (!(error instanceof TypeError || error instanceof RangeError) && error.code !== 'invalid_modification_controls') throw error
    return output({ status: 'NEEDS_COACH_INPUT', summary: interpretation.summary, questions: [], proposedRequest: null, changes: [],
      issues: [{ code: error.code ?? 'inconsistent_control_changes', detail: error.message.slice(0, 1000) }] })
  }
  run.assertActive()
  const issues = [...currentChoices.findings,
    ...(!currentChoices.searchComplete ? [{ code: 'incomplete_programming_search', detail: 'Canonical search is incomplete; this proposal does not establish an exercise gap.' }] : []),
    ...currentChoices.components.filter((entry) => !entry.exercises.some((exercise) => exercise.eligibility === 'ELIGIBLE')).map((entry) => ({
      code: 'candidate_eligibility_review_required', detail: `${SESSION_COMPONENT_LABELS[entry.key]} needs eligible canonical choices under the proposed controls.` }))]
  const strings = new Set()
  const collect = (value) => { if (typeof value === 'string') strings.add(value); else if (value && typeof value === 'object') Object.values(value).forEach(collect) }
  collect(applied.changes)
  const reviewReferences = {
    exercises: [...new Map([...choices.components, ...currentChoices.components].flatMap((entry) => entry.exercises)
      .filter((entry) => strings.has(entry.ref.deliveryProfileId) || strings.has(entry.ref.exerciseCardId))
      .map(({ ref, name, purpose }) => [JSON.stringify(ref), { ref, name, purpose }])).values()],
    methods: [...new Map([...choices.components, ...currentChoices.components].flatMap((entry) => entry.methods)
      .filter((entry) => strings.has(entry.id)).map(({ id, name }) => [id, { id, name }])).values()],
  }
  return output({ status: 'READY_FOR_REVIEW', summary: interpretation.summary, questions: [], issues, operations: interpretation.operations, ...applied,
    reviewReferences,
    proposalHash: programmingValueHash({ baseRequestHash, sourceContentHash: base.sourceContentHash, sourceTaxonomyHash: base.sourceTaxonomyHash, proposedRequest: applied.proposedRequest }) })
}
