import Joi from 'joi'
import { parseProgrammingContract, programmingValueHash, immutableProgrammingValue } from './workoutProgrammingRequest.js'
import { programmingCriticContract } from './workoutProgrammingQA.js'
import { ProgrammingStaffError } from './programmingStaffRuntime.js'

export const PROGRAMMING_SESSION_MODEL = 'vortex_components_v1'
export const PROGRAMMING_STORAGE_VERSION = '1.0.0'
export const MAX_PROGRAMMING_SNAPSHOT_BYTES = 32 * 1024 * 1024
const uuid = () => Joi.string().guid().required()
const object = () => Joi.object().unknown(true).required()
const nonnegative = () => Joi.number().integer().min(0).required()
const trace = Joi.object({ elapsedMs: nonnegative(), outputTokensReserved: nonnegative(), calls: Joi.array().max(100).items(Joi.object({
  capabilityId: Joi.string().max(200).required(), role: Joi.string().max(80).required(), capabilityVersion: Joi.string().max(120).required(),
  status: Joi.string().valid('validated', 'failed').required(), startedAt: Joi.string().isoDate().required(), latencyMs: nonnegative(),
  modelVersion: Joi.string().max(200).allow(null).required(), errorCode: Joi.string().max(200).allow(null).required(),
  usage: Joi.object({ inputTokens: nonnegative(), outputTokens: nonnegative() }).allow(null).required(),
})).required() }).required()
const schema = Joi.object({ schemaVersion: Joi.string().valid('1.0.0').required(), runId: uuid(), sessionIntent: object(), draft: object(), qa: object(),
  status: Joi.string().valid('QA_PASSED', 'NEEDS_COACH_REVIEW').required(), stopReason: Joi.string().valid('qa_passed', 'repair_limit_reached',
    'run_budget_exhausted', 'no_automatic_repair_route', 'repair_did_not_change_session', 'repair_cycle_detected', 'repair_failed_validation', 'repair_failed').required(),
  repairPasses: Joi.number().integer().min(0).max(3).required(), maxRepairPasses: Joi.number().integer().min(0).max(3).required(),
  compositionAttempts: nonnegative(), history: Joi.array().min(1).max(4).items(object()).required(),
  workflowIssues: Joi.array().max(10).items(object().optional()).required(), trace,
  validatedWorkout: Joi.boolean().valid(false).required(), creatorAuthorized: Joi.boolean().valid(false).required(), libraryApprovalGranted: Joi.boolean().valid(false).required(),
})
const same = (left, right) => programmingValueHash(left) === programmingValueHash(right)
const invalid = (message) => { throw new ProgrammingStaffError('invalid_programming_snapshot', message) }

/** Accept only the internal completed workflow artifact, never an HTTP body or model decision. */
export function parseProgrammingWorkflowSnapshot(raw) {
  if (Buffer.byteLength(JSON.stringify(raw), 'utf8') > MAX_PROGRAMMING_SNAPSHOT_BYTES) invalid('Programming snapshot exceeds its storage limit')
  const value = parseProgrammingContract(schema, raw, 'Programming workflow snapshot')
  const { sessionIntent, draft, qa } = value
  if (!sessionIntent.scope || draft.intentId !== sessionIntent.intentId || qa.draftId !== draft.draftId
    || draft.requestHash !== sessionIntent.requestHash || !same(draft.request, sessionIntent.request)
    || programmingValueHash(draft.request) !== draft.requestHash || value.repairPasses > value.maxRepairPasses) invalid('Snapshot identities or immutable coach request disagree')
  if (draft.request.mode === 'modify_existing') {
    const parent = sessionIntent.modification
    if (!parent || parent.requestHash !== draft.requestHash || parent.sourceWorkoutId !== draft.request.modification.workoutId
      || parent.sourceRevision !== draft.request.modification.expectedRevision || parent.sourceRevision === draft.request.revision) invalid('Modification lineage is not bound to the coach request')
  } else if (sessionIntent.modification != null) invalid('A new session cannot claim modification lineage')
  for (const validation of [qa.validation, qa.finalValidation].filter(Boolean)) {
    if (validation.draftId !== draft.draftId || validation.reviewHash !== programmingValueHash(validation.reconstructed)
      || validation.reconstructed.intentId !== sessionIntent.intentId || !same(validation.reconstructed.scope, sessionIntent.scope)
      || !same(validation.reconstructed.request, draft.request)
      || !same(validation.reconstructed.modification ?? null, sessionIntent.modification ?? null)) invalid('QA evidence is not bound to this session and facility')
  }
  if (qa.reviewHash !== qa.validation?.reviewHash) invalid('QA review hash differs from its deterministic evidence')
  if (qa.critic) programmingCriticContract(qa.validation).parseOutput(qa.critic)
  if (qa.status === 'QA_PASSED' && (qa.validation.status !== 'PASS' || qa.critic?.status !== 'PASS' || qa.finalValidation?.status !== 'PASS'
    || qa.finalValidation.reviewHash !== qa.reviewHash || qa.findings.length || qa.validation.findings.length || qa.finalValidation.findings.length)) invalid('QA PASS lacks complete matching reviews')
  if (value.status === 'QA_PASSED' && (qa.status !== 'QA_PASSED' || value.workflowIssues.length || value.stopReason !== 'qa_passed')) invalid('Workflow PASS lacks complete QA')
  return immutableProgrammingValue(value)
}

/** A pass describes this stored snapshot, not future athlete readiness or a human library approval. */
export function createProgrammingWorkoutEnvelope(workflow, freshValidation) {
  const source = parseProgrammingWorkflowSnapshot(workflow)
  if (freshValidation.draftId !== source.draft.draftId || freshValidation.reviewHash !== programmingValueHash(freshValidation.reconstructed)
    || !same(freshValidation.reconstructed.scope, source.sessionIntent.scope) || !same(freshValidation.reconstructed.request, source.draft.request)
    || !same(freshValidation.reconstructed.modification ?? null, source.sessionIntent.modification ?? null)
    || !['PASS', 'REVISE'].includes(freshValidation.status) || (freshValidation.status === 'PASS') !== (freshValidation.findings.length === 0)) {
    invalid('Fresh validation is not bound to the saved session evidence')
  }
  const unchanged = freshValidation.reviewHash === source.qa.reviewHash
  const passed = source.status === 'QA_PASSED' && freshValidation.status === 'PASS' && unchanged
  const findings = [...new Map([...source.qa.findings, ...freshValidation.findings,
    ...(!unchanged ? [{ code: 'review_target_changed_before_save', source: 'deterministic', route: 'director',
      message: 'Source evidence changed before saving; the saved session requires a new review.', activityIds: [], componentKeys: [] }] : []),
  ].map((entry) => [programmingValueHash(entry), entry])).values()]
  const models = [...new Set(source.trace.calls.map((entry) => entry.modelVersion).filter(Boolean))]
  const envelope = { schemaVersion: PROGRAMMING_STORAGE_VERSION, sessionModel: PROGRAMMING_SESSION_MODEL,
    generatorVersion: 'vortex-programming-staff/1.0.0', ruleVersion: source.draft.libraryRelease.ruleVersion,
    modelVersion: models.length ? models.join(', ') : null, mode: 'ai_assisted', randomSeed: source.draft.request.randomSeed,
    runId: source.runId, revision: source.draft.request.revision, workflowHash: programmingValueHash(source),
    intent: source.sessionIntent.request, status: passed ? 'QA_PASSED' : 'NEEDS_COACH_REVIEW',
    validatedWorkout: passed, creatorAuthorized: false, libraryApprovalGranted: false,
    validation: { schemaVersion: PROGRAMMING_STORAGE_VERSION, scope: 'saved_session_snapshot', status: passed ? 'PASS' : 'REVISE',
      qaId: source.qa.qaId, reviewHash: freshValidation.reviewHash, findings, freshValidation },
    explanation: { session: source.draft.builderProposal.summary, preparation: source.draft.preparationProposal?.summary ?? null,
      activities: source.draft.activities.map((activity) => ({ activityId: activity.activityId, componentKey: activity.componentKey,
        exerciseCardId: activity.card.id, variantId: activity.card.variantId, deliveryProfileId: activity.profile.id,
        programmingMethodId: activity.method.id, rationale: activity.rationale })) },
    workflow: source,
  }
  const output = { ...envelope, contentHash: programmingValueHash(envelope) }
  const serialized = JSON.stringify(output)
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PROGRAMMING_SNAPSHOT_BYTES) invalid('Programming snapshot exceeds its storage limit')
  // Optional undefined source fields do not exist in JSONB. Return exactly the representation that can be reopened.
  return immutableProgrammingValue(JSON.parse(serialized))
}

export function readProgrammingWorkoutEnvelope(raw) {
  if (raw?.sessionModel !== PROGRAMMING_SESSION_MODEL || raw.schemaVersion !== PROGRAMMING_STORAGE_VERSION) invalid('Unsupported saved session model or version')
  const { contentHash, ...content } = raw
  if (contentHash !== programmingValueHash(content)) invalid('Saved session content does not match its evidence hash')
  const rebuilt = createProgrammingWorkoutEnvelope(raw.workflow, raw.validation.freshValidation)
  if (!same(rebuilt, raw)) invalid('Saved session claims differ from its workflow evidence')
  return rebuilt
}
