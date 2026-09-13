import { immutableProgrammingValue, programmingValueHash, programmingComponentPlan } from './workoutProgrammingRequest.js'
import { ProgrammingStaffError } from './programmingStaffRuntime.js'

const same = (a, b) => programmingValueHash(a) === programmingValueHash(b)
const ref = (activity) => ({ exerciseCardId: activity.card.id, variantId: activity.card.variantId,
  deliveryProfileId: activity.profile.id, cardVersion: activity.card.cardVersion })
const doseKeys = ['sets', 'reps', 'workSeconds', 'restSeconds', 'restBetweenRoundsSeconds', 'tempo', 'rpe', 'loadMethod', 'loadTarget']
const select = (value, keys) => Object.fromEntries(keys.map((key) => [key, value[key] ?? null]))
const fail = (message, code = 'invalid_modification_controls') => { throw new ProgrammingStaffError(code, message) }
const globalControls = ({ requestId, revision, mode, instruction, components, modification, randomSeed, assumptions, ...controls }) => controls
const componentControls = ({ lockedBlocks, ...controls }) => controls
const timing = (schedule) => schedule ? { ...select(schedule, ['startSeconds', 'endSeconds', 'recoveryCompleteSeconds', 'clockKind', 'clockIntervalSeconds', 'timing']),
  events: schedule.events.map((event) => select(event, ['set', 'wave', 'batch', 'startSeconds', 'endSeconds', 'resourceReleaseSeconds'])) } : null

/** Pure compilation from an already authenticated, integrity-checked saved snapshot. No approval or model authority is created. */
export function compileWorkoutProgrammingModification(request, saved) {
  const modification = request.modification
  if (request.mode !== 'modify_existing' || !modification || !saved) fail('Modify Existing requires an available saved programming session', 'source_workout_unavailable')
  if (saved.persistedWorkoutId !== modification.workoutId || saved.workout.revision !== modification.expectedRevision) {
    fail('The selected source revision no longer matches. Reopen it before making changes.', 'source_workout_revision_conflict')
  }
  const source = saved.workout.workflow.draft
  if (request.revision === saved.workout.revision || request.requestId === source.request.requestId) fail('A modified session requires a new request and revision identity')
  const keys = programmingComponentPlan(request).components.map((component) => component.key)
  const requested = modification.regenerateComponentKeys ?? keys
  if (requested.some((key) => !keys.includes(key))) fail('Only components scheduled in the revised session can be regenerated')
  const globalControlsChanged = !same(globalControls(request), globalControls(source.request))
  const changed = request.components.filter((component) => !same(componentControls(component),
    source.request.components.find((entry) => entry.key === component.key) ? componentControls(source.request.components.find((entry) => entry.key === component.key)) : null)).map((entry) => entry.key)
  const sourceActivities = source.activities
  const edits = modification.blockEdits ?? []
  for (const edit of edits) if (!sourceActivities.some((entry) => entry.activityId === edit.blockId && keys.includes(entry.componentKey))) fail('A block edit must identify an existing block in a scheduled component')
  const downstream = keys.filter((key) => key !== 'prepare_and_access')
  const affected = new Set([...requested, ...changed, ...edits.map((edit) => sourceActivities.find((entry) => entry.activityId === edit.blockId).componentKey)])
  const first = globalControlsChanged ? 0 : downstream.findIndex((key) => affected.has(key))
  const mutableComponentKeys = first < 0 ? [] : downstream.slice(first)
  const preservedComponentKeys = downstream.filter((key) => !mutableComponentKeys.includes(key))
  const locks = request.components.flatMap((component) => component.lockedBlocks.map((lock) => ({ ...lock, componentKey: component.key })))
  for (const lock of locks) if (!sourceActivities.some((entry) => entry.activityId === lock.blockId && entry.componentKey === lock.componentKey)
    || !keys.includes(lock.componentKey)) fail('A block lock must identify a source block in its scheduled component')
  const blocks = sourceActivities.filter((activity) => keys.includes(activity.componentKey)).map((activity) => {
    const explicit = locks.find((lock) => lock.blockId === activity.activityId)?.fields ?? []
    const fields = preservedComponentKeys.includes(activity.componentKey) ? ['exercises', 'method', 'dose', 'timing'] : explicit
    const edit = edits.find((entry) => entry.blockId === activity.activityId) ?? null
    const originalRef = ref(activity)
    if (edit?.exercise && fields.includes('exercises') && !same(edit.exercise, originalRef)) fail('An exercise replacement contradicts its block lock')
    if (edit?.programmingMethodId && fields.includes('method') && edit.programmingMethodId !== String(activity.method.id)) fail('A method change contradicts its block lock')
    if (edit?.dose && fields.includes('dose') && Object.entries(edit.dose).some(([key, value]) => !same(value, activity.dose[key]))) fail('A dose change contradicts its block lock')
    return { blockId: activity.activityId, componentKey: activity.componentKey, name: activity.card.displayName ?? activity.card.canonicalName,
      ref: originalRef, programmingMethodId: String(activity.method.id), dose: select(activity.dose, doseKeys),
      doseProposal: select(activity.dose, ['sets', 'reps', 'workSeconds', 'restSeconds']),
      timing: timing(source.schedule.components.find((entry) => entry.key === activity.componentKey)?.activities.find((entry) => entry.activityId === activity.activityId)),
      lockedFields: fields, edit, required: fields.length > 0 || edit !== null }
  })
  const previousProposal = { ...source.builderProposal, requestRevision: request.revision,
    components: source.builderProposal.components.filter((entry) => keys.includes(entry.key)).map((component) => ({ ...component,
      selections: component.selections.map((choice) => ({ ...choice, sourceBlockId: sourceActivities.find((activity) => activity.componentKey === component.key
        && activity.profile.id === choice.deliveryProfileId)?.activityId ?? null })) })) }
  for (const key of preservedComponentKeys) if (!previousProposal.components.find((component) => component.key === key)?.selections.length) {
    fail('An incomplete source component must be included in regeneration', 'source_workout_incomplete')
  }
  const context = { schemaVersion: '1.0.0', sourceWorkoutId: saved.persistedWorkoutId, sourceRevision: saved.workout.revision,
    sourceContentHash: saved.workout.contentHash, sourceRequestHash: source.requestHash, sourceDraftId: source.draftId,
    sourceBuilderReviewed: source.builderSource === 'session_builder',
    requestHash: programmingValueHash(request), requestedComponentKeys: requested, mutableComponentKeys, preservedComponentKeys, globalControlsChanged,
    constraintsHash: programmingValueHash({ blocks, previousProposal }) }
  return immutableProgrammingValue({ context, blocks, previousProposal })
}

/** Reload the parent from the database at each authority boundary; the client cannot submit its contents. */
export async function loadWorkoutProgrammingModification({ pool, context, request, expectedContext, snapshotClient = null }) {
  if (request.mode !== 'modify_existing') {
    if (expectedContext != null) fail('A new session cannot carry modification authority')
    return null
  }
  // Defer this import: repository validation calls this adapter inside its transaction.
  const { loadWorkoutProgrammingRun, loadWorkoutProgrammingRunInSnapshot } = await import('./workoutProgrammingRepository.js')
  const saved = snapshotClient ? await loadWorkoutProgrammingRunInSnapshot(snapshotClient, context, request.modification.workoutId)
    : await loadWorkoutProgrammingRun(pool, context, request.modification.workoutId)
  if (!saved) fail('The source programming session is unavailable in this facility', 'source_workout_unavailable')
  const plan = compileWorkoutProgrammingModification(request, saved)
  if (expectedContext !== undefined && !same(expectedContext, plan.context)) fail('The modification parent or constraints changed; reopen the source session', 'source_workout_revision_conflict')
  return plan
}

/** Pins retain exact locked/edited references; a pin never waives current eligibility. */
export function modificationResourceSearches(searches, plan) {
  if (!plan) return searches
  return searches.map((search) => {
    const blocks = plan.blocks.filter((block) => block.componentKey === search.componentKey)
    const pinned = blocks.filter((block) => block.lockedFields.includes('exercises') || block.edit?.exercise).map((block) => block.edit?.exercise ?? block.ref)
    const methods = blocks.filter((block) => block.lockedFields.includes('method') || block.edit?.programmingMethodId).map((block) => block.edit?.programmingMethodId ?? block.programmingMethodId)
    return { ...search, preferredExercises: [...search.preferredExercises, ...blocks.map((block) => block.edit?.exercise ?? block.ref)],
      pinnedExercises: [...search.pinnedExercises, ...pinned],
      preferredProgrammingMethodIds: [...new Set([...search.preferredProgrammingMethodIds, ...blocks.map((block) => block.edit?.programmingMethodId ?? block.programmingMethodId)])],
      pinnedProgrammingMethodIds: [...new Set([...search.pinnedProgrammingMethodIds, ...methods])] }
  })
}

export function modificationCapabilityContext(plan) {
  if (!plan) return null
  return { ...plan.context, previousProposal: plan.previousProposal,
    sourceBlocks: plan.blocks.map(({ timing: times, ...block }) => ({ ...block, timing: times ? select(times, ['startSeconds', 'endSeconds', 'recoveryCompleteSeconds']) : null })),
    preparation: 'Rebuild demand attribution and review Prepare & Access against the revised downstream session, retaining every explicit coach lock.',
    scope: 'Keep preserved components unchanged. Consider all later components after the earliest requested change. Hard coach controls and source rules remain authoritative.' }
}

/** Add source block identity to existing specialist schemas; judgments still pass their original contracts. */
export function modificationProposalContract(base, plan, { preparation = false } = {}) {
  if (!plan) return base
  const outputSchema = structuredClone(base.outputSchema)
  const selection = preparation ? outputSchema.properties.selections.items : outputSchema.properties.components.items.properties.selections.items
  const ids = plan.blocks.filter((block) => preparation === (block.componentKey === 'prepare_and_access')).map((block) => block.blockId)
  selection.properties.sourceBlockId = { type: ['string', 'null'], enum: [...ids, null] }
  selection.required.push('sourceBlockId')
  return { outputSchema, parseOutput(raw) {
    const input = structuredClone(raw)
    const rawComponents = preparation ? [{ key: 'prepare_and_access', selections: input?.selections }] : input?.components
    if (!Array.isArray(rawComponents)) fail('Modified proposals require component selections')
    const identities = new Map()
    for (const component of rawComponents) {
      if (!Array.isArray(component.selections)) fail('Modified proposals require block identities')
      const used = new Set()
      for (const [index, choice] of component.selections.entries()) {
        const blockId = choice.sourceBlockId
        if (blockId !== null && (typeof blockId !== 'string' || !plan.blocks.some((block) => block.blockId === blockId && block.componentKey === component.key))) fail('A selection must name its existing source block or explicitly use null for new work')
        if (blockId !== null && used.has(blockId)) fail('A source block cannot be duplicated')
        used.add(blockId)
        identities.set(`${component.key}:${index}`, blockId)
        delete choice.sourceBlockId
      }
    }
    const parsed = structuredClone(base.parseOutput(input))
    const components = preparation ? [{ key: 'prepare_and_access', selections: parsed.selections }] : parsed.components
    for (const component of components) {
      component.selections.forEach((choice, index) => { choice.sourceBlockId = identities.get(`${component.key}:${index}`) })
      for (const block of plan.blocks.filter((entry) => entry.componentKey === component.key && entry.required)) {
        const choice = component.selections.find((entry) => entry.sourceBlockId === block.blockId)
        if (!choice) fail('A modified proposal removed a locked or explicitly edited block')
        if ((block.lockedFields.includes('exercises') || block.edit?.exercise) && choice.deliveryProfileId !== (block.edit?.exercise ?? block.ref).deliveryProfileId) fail('A proposal changed a locked or explicitly replaced exercise')
        if ((block.lockedFields.includes('method') || block.edit?.programmingMethodId) && choice.programmingMethodId !== (block.edit?.programmingMethodId ?? block.programmingMethodId)) fail('A proposal changed a locked or explicitly chosen method')
      }
      if (plan.context.preservedComponentKeys.includes(component.key) && !same(component, plan.previousProposal.components.find((entry) => entry.key === component.key))) fail('A modified proposal changed a preserved earlier component')
    }
    return immutableProgrammingValue(parsed)
  } }
}

export function modificationDoseProposal(plan, sourceBlockId) {
  const block = plan?.blocks.find((entry) => entry.blockId === sourceBlockId)
  return block ? { ...(block.lockedFields.includes('dose') ? block.doseProposal : {}), ...(block.edit?.dose ?? {}) } : {}
}

export function modificationActivityId(plan, componentKey, index, sourceBlockId) {
  return sourceBlockId ?? `${componentKey}:new:${plan.context.requestHash}:${index + 1}`
}

export function validateModificationDose(plan, sourceBlockId, dose) {
  const block = plan?.blocks.find((entry) => entry.blockId === sourceBlockId)
  if (block?.lockedFields.includes('dose') && !same(select(dose, doseKeys), block.dose)) fail('The revised prescription changes a locked dose', 'locked_block_dose_conflict')
  if (block?.edit?.dose && Object.entries(block.edit.dose).some(([key, value]) => !same(value, dose[key]))) fail('The revised prescription does not implement the coach dose edit', 'coach_dose_edit_conflict')
}

/** Independent reconstruction checks block identity, explicit edits, preservation and the exact locked timetable. */
export function validateWorkoutProgrammingModification(plan, { activities, schedule, builderProposal, preparationProposal }) {
  if (!plan) return []
  const issues = []
  const add = (block, code, detail) => issues.push({ code, componentKey: block.componentKey, activityId: block.blockId, detail })
  const components = [...builderProposal.components, ...(preparationProposal ? [{ key: 'prepare_and_access', selections: preparationProposal.selections }] : [])]
  for (const component of components) for (const [index, choice] of component.selections.entries()) {
    const activity = activities.find((entry) => entry.componentKey === component.key && entry.profile.id === choice.deliveryProfileId)
    const expectedId = modificationActivityId(plan, component.key, index, choice.sourceBlockId)
    if (!activity || activity.activityId !== expectedId) add({ blockId: expectedId, componentKey: component.key }, 'source_block_identity_changed', 'A revised block does not match its retained or newly assigned identity')
  }
  for (const block of plan.blocks.filter((entry) => entry.required)) {
    const activity = activities.find((entry) => entry.activityId === block.blockId && entry.componentKey === block.componentKey)
    if (!activity) { add(block, 'required_source_block_missing', 'A locked or explicitly edited source block is missing'); continue }
    if ((block.lockedFields.includes('exercises') || block.edit?.exercise) && !same(ref(activity), block.edit?.exercise ?? block.ref)) add(block, 'locked_block_exercise_conflict', 'The selected exercise differs from the coach lock or explicit replacement')
    if ((block.lockedFields.includes('method') || block.edit?.programmingMethodId) && String(activity.method.id) !== (block.edit?.programmingMethodId ?? block.programmingMethodId)) add(block, 'locked_block_method_conflict', 'The selected method differs from the coach lock or explicit edit')
    try { validateModificationDose(plan, block.blockId, activity.dose) } catch (error) { add(block, error.code, error.message) }
    if (block.lockedFields.includes('timing')) {
      const revised = schedule?.components.find((component) => component.key === block.componentKey)?.activities.find((entry) => entry.activityId === block.blockId)
      if (!block.timing || !same(timing(revised), block.timing)) add(block, 'locked_block_timing_conflict', 'The revised group rotations or clock cannot preserve the locked start, work and recovery times')
    }
  }
  return immutableProgrammingValue(issues)
}
