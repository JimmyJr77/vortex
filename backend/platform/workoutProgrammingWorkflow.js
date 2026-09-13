import { randomUUID } from 'node:crypto'
import { directWorkoutProgramming } from './workoutProgrammingDirector.js'
import { buildWorkoutProgrammingDraft } from './workoutProgrammingBuilder.js'
import { reviewWorkoutProgrammingDraft } from './workoutProgrammingQA.js'
import { createProgrammingStaffRun, ProgrammingStaffError } from './programmingStaffRuntime.js'
import { programmingValueHash, immutableProgrammingValue } from './workoutProgrammingRequest.js'
import { evaluateCanonicalProgrammingRules } from './canonicalProgrammingRules.js'
import { compositionTargetMatches } from './canonicalExerciseSelection.js'

export const PROGRAMMING_WORKFLOW_VERSION = '1.0.0'

/** Content identity excludes generated IDs, traces and previous review outcomes. */
export function programmingDraftContentHash(draft) {
  return programmingValueHash({ requestHash: draft.requestHash, release: draft.libraryRelease, componentPlan: draft.componentPlan,
    activities: draft.activities.map(({ activityId: _id, ...activity }) => activity),
    builderProposal: draft.builderProposal, preparationProposal: draft.preparationProposal })
}

function executionRepairFeedback(qa) {
  const state = qa.validation.reconstructed
  if (qa.validation.status !== 'REVISE' || qa.critic !== null || !qa.findings.length || qa.findings.length > 40
    || qa.reviewHash !== qa.validation.reviewHash || qa.reviewHash !== programmingValueHash(state)
    || programmingValueHash(qa.findings) !== programmingValueHash(qa.validation.findings)) return null
  const feedback = []
  for (const entry of qa.findings) {
    if (entry.source !== 'deterministic' || entry.code !== 'exercise_execution_rule' || entry.route !== 'session_builder'
      || entry.activityIds.length !== 1 || entry.evidence?.status !== 'VIOLATED') return null
    const activity = state.activities.find((item) => item.activityId === entry.activityIds[0])
    if (!activity || programmingValueHash(entry.componentKeys) !== programmingValueHash([activity.componentKey])) return null
    const result = evaluateCanonicalProgrammingRules({ activity, activities: state.activities, request: state.request, athleteEvidence: state.athleteEvidence })
    if (programmingValueHash(result) !== programmingValueHash(state.exerciseRules.find((item) => item.activityId === activity.activityId))) return null
    const finding = result.findings.find((item) => item.ruleId === entry.evidence.ruleId && item.status === 'VIOLATED')
    const rule = result.contract?.rules.find((item) => item.id === entry.evidence.ruleId)
    if (!finding || programmingValueHash(finding) !== programmingValueHash(entry.evidence)
      || !['sequence', 'dose_limit_after'].includes(rule?.type)) return null
    // Include both ends of an interaction, then all later work. Preparation is always regenerated.
    const affected = state.activities.filter((item) => item.activityId === activity.activityId
      || compositionTargetMatches(rule.target, item.card, item.profile, { exactReferences: true }))
    const componentKeys = [...new Set(affected.map((item) => item.componentKey))]
    feedback.push({ area: rule.type === 'sequence' ? 'sequencing' : 'cumulative_fatigue',
      route: componentKeys.every((key) => key === 'prepare_and_access') ? 'prepare_access' : 'session_builder',
      message: `Reviewed rule ${rule.id} is violated: ${JSON.stringify(finding.outcomes).slice(0, 600)}`,
      recommendedAction: `Choose or order canonical work to satisfy this unchanged reviewed rule: ${JSON.stringify(rule).slice(0, 800)}`,
      activityIds: affected.map((item) => item.activityId), componentKeys })
  }
  return feedback
}

/** Closed repair routes consume internal QA evidence; they cannot waive a rule or supply missing evidence. */
export function planProgrammingRepair(qa) {
  const criticRepair = qa.validation.status === 'PASS' && qa.critic?.status === 'REVISE' && qa.findings.length > 0 && qa.findings.length <= 40
    && qa.findings.every((entry) => entry.source === 'critic' && ['prepare_access', 'session_builder'].includes(entry.route))
  const feedback = criticRepair ? qa.findings.map(({ area, route, message, recommendedAction, activityIds, componentKeys }) =>
    ({ area, route, message, recommendedAction, activityIds, componentKeys })) : executionRepairFeedback(qa)
  if (!feedback) return immutableProgrammingValue({ status: 'REQUIRES_COACH', sourceQaId: qa.qaId,
    reason: 'These findings require source/rule evidence, another staff decision, or coach input before automatic composition can continue.' })
  const downstream = qa.validation.reconstructed.componentPlan.components.map((entry) => entry.key).filter((key) => key !== 'prepare_and_access')
  const builderFindings = feedback.filter((entry) => entry.route === 'session_builder')
  let mutableComponentKeys = []
  if (builderFindings.length) {
    const indices = builderFindings.flatMap((entry) => {
      const keys = entry.componentKeys.filter((key) => downstream.includes(key))
      return keys.length ? keys.map((key) => downstream.indexOf(key)) : [0]
    })
    mutableComponentKeys = downstream.slice(Math.min(...indices))
  }
  return immutableProgrammingValue({ status: 'AUTOMATIC', sourceQaId: qa.qaId, reviewHash: qa.reviewHash,
    scope: mutableComponentKeys.length ? 'downstream' : 'prepare_access', mutableComponentKeys,
    requiredRoles: mutableComponentKeys.length ? ['session_builder', 'prepare_access', 'programming_critic'] : ['prepare_access', 'programming_critic'],
    feedback,
  })
}

function componentChanges(previous, candidate) {
  return candidate.componentPlan.components.map(({ key }) => {
    const values = (draft) => draft.activities.filter((entry) => entry.componentKey === key).map((entry) => ({
      exerciseCardId: entry.card.id, variantId: entry.card.variantId, deliveryProfileId: entry.profile.id, cardVersion: entry.card.cardVersion,
      programmingMethodId: String(entry.method.id), sourceHash: entry.sourceHash, doseHash: programmingValueHash(entry.dose),
    }))
    const before = values(previous)
    const after = values(candidate)
    return { componentKey: key, changed: programmingValueHash(before) !== programmingValueHash(after), before, after }
  })
}

/** Read-only lifecycle. The request or existing SessionIntent comes from the application, never a model. */
export async function generateWorkoutProgramming({ pool, context, registry, rawRequest, sessionIntent,
  maxRepairPasses = 2, runOptions = {}, directorCapabilityId = 'vortex/director', athleteCapabilityId = 'vortex/athlete-development',
  builderCapabilityId = 'vortex/session-builder', prepareCapabilityId = 'vortex/prepare-access', criticCapabilityId = 'vortex/programming-critic' }) {
  if ((rawRequest === undefined) === (sessionIntent === undefined)) throw new TypeError('Supply exactly one coach request or server-owned SessionIntent')
  if (!Number.isInteger(maxRepairPasses) || maxRepairPasses < 0 || maxRepairPasses > 3) throw new RangeError('maxRepairPasses must be an integer from zero to three')
  const limits = { maxCalls: 18, timeoutMs: 180000, perCallTimeoutMs: 20000, maxOutputTokens: 90000, perCallOutputTokens: 5000, ...runOptions }
  const run = createProgrammingStaffRun(registry, limits)
  const stageOptions = { signal: runOptions.signal }
  const canceled = () => { run.assertActive(); if (runOptions.signal?.aborted) throw new ProgrammingStaffError('canceled', 'Programming workflow was canceled') }
  canceled()
  const intent = sessionIntent ?? await directWorkoutProgramming({ pool, context, rawRequest, registry, directorCapabilityId, athleteCapabilityId,
    staffRun: run, runOptions: stageOptions })
  const common = { pool, context, registry, sessionIntent: intent, staffRun: run, runOptions: stageOptions }
  const build = (revision = null) => buildWorkoutProgrammingDraft({ ...common, builderCapabilityId, prepareCapabilityId, revision })
  const review = (draft) => reviewWorkoutProgrammingDraft({ ...common, draft, criticCapabilityId })
  let draft = await build()
  let qa = await review(draft)
  const history = [{ pass: 0, status: 'reviewed', draftId: draft.draftId, qaId: qa.qaId, qaStatus: qa.status,
    contentHash: programmingDraftContentHash(draft), callStart: 0, callEnd: run.telemetry().calls.length, findings: qa.findings }]
  const seen = new Set([history[0].contentHash])
  const workflowIssues = []
  let repairPasses = 0
  let compositionAttempts = draft.compositionAttempts
  let stopReason = qa.status === 'QA_PASSED' ? 'qa_passed' : 'repair_limit_reached'
  while (qa.status !== 'QA_PASSED' && repairPasses < maxRepairPasses) {
    canceled()
    const telemetry = run.telemetry()
    if (telemetry.calls.length >= limits.maxCalls || telemetry.outputTokensReserved >= limits.maxOutputTokens || telemetry.elapsedMs >= limits.timeoutMs) {
      stopReason = 'run_budget_exhausted'; break
    }
    const plan = planProgrammingRepair(qa)
    if (plan.status !== 'AUTOMATIC') { stopReason = 'no_automatic_repair_route'; break }
    repairPasses += 1
    const entry = { pass: repairPasses, sourceDraftId: draft.draftId, sourceQaId: qa.qaId, plan, callStart: run.telemetry().calls.length }
    try {
      // Recheck coach truth and current candidates in the Builder. Existing doses outside this scope are retained exactly.
      const candidate = await build({ previousDraft: draft, mutableComponentKeys: plan.mutableComponentKeys, feedback: plan.feedback })
      compositionAttempts += candidate.compositionAttempts
      const contentHash = programmingDraftContentHash(candidate)
      Object.assign(entry, { draftId: candidate.draftId, contentHash, changes: componentChanges(draft, candidate),
        preparationDemandChanged: draft.preparationDemand.downstreamHash !== candidate.preparationDemand.downstreamHash })
      if (candidate.status === 'READY_FOR_CRITIC' && seen.has(contentHash)) {
        stopReason = contentHash === programmingDraftContentHash(draft) ? 'repair_did_not_change_session' : 'repair_cycle_detected'
        Object.assign(entry, { status: 'rejected', reason: stopReason, findings: [] })
        history.push({ ...entry, callEnd: run.telemetry().calls.length })
        break
      }
      const candidateQA = await review(candidate)
      Object.assign(entry, { qaId: candidateQA.qaId, qaStatus: candidateQA.status, findings: candidateQA.findings })
      if (candidate.status !== 'READY_FOR_CRITIC') {
        // Keep the last complete draft paired with its actual QA; expose failed attempt evidence in history.
        stopReason = 'repair_failed_validation'
        history.push({ ...entry, status: 'rejected', reason: stopReason, callEnd: run.telemetry().calls.length })
        workflowIssues.push({ code: stopReason, attemptedDraftId: candidate.draftId, message: 'The attempted repair was incomplete. The previous complete draft and its unresolved QA are retained.' })
        break
      }
      draft = candidate
      qa = candidateQA
      seen.add(contentHash)
      history.push({ ...entry, status: 'reviewed', callEnd: run.telemetry().calls.length })
      stopReason = qa.status === 'QA_PASSED' ? 'qa_passed' : 'repair_limit_reached'
    } catch (error) {
      if (error.code === 'canceled') throw error
      stopReason = 'repair_failed'
      history.push({ ...entry, status: 'failed', errorCode: error.code ?? 'repair_failed', callEnd: run.telemetry().calls.length, findings: [] })
      workflowIssues.push({ code: error.code ?? 'repair_failed', message: 'The repair could not be completed; the previous draft and its unresolved QA are retained.' })
      break
    }
  }
  canceled()
  return immutableProgrammingValue({ schemaVersion: PROGRAMMING_WORKFLOW_VERSION, runId: randomUUID(), sessionIntent: intent, draft, qa,
    status: qa.status === 'QA_PASSED' && !workflowIssues.length ? 'QA_PASSED' : 'NEEDS_COACH_REVIEW', stopReason,
    repairPasses, maxRepairPasses, compositionAttempts, history, workflowIssues, trace: run.telemetry(),
    validatedWorkout: false, creatorAuthorized: false, libraryApprovalGranted: false })
}
