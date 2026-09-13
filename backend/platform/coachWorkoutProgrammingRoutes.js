import { configuredProgrammingStaffRegistry } from './aiService.js'
import { canonicalFacilityFeatureAccess } from './canonicalFeatureFlags.js'
import { normalizeCoachWorkoutRequest } from './workoutProgrammingRequest.js'
import { generateAndPersistWorkoutProgramming } from './workoutProgrammingService.js'
import { loadWorkoutProgrammingRun, listWorkoutProgrammingRuns, revalidateWorkoutProgrammingRun } from './workoutProgrammingRepository.js'
import { loadWorkoutProgrammingChoices } from './workoutProgrammingChoices.js'
import { loadWorkoutAthleteEvidenceChoices } from './workoutAthleteEvidence.js'
import { withCoachingLibrarySnapshot } from './coachingLibraryContext.js'

/** Existing coach permissions and facility rollout gates remain authoritative. No endpoint accepts a model/QA artifact. */
export function registerWorkoutProgrammingRoutes(app, pool, { can, ok, bad,
  featureAccess = canonicalFacilityFeatureAccess, registryFactory = configuredProgrammingStaffRegistry,
  generate = generateAndPersistWorkoutProgramming, load = loadWorkoutProgrammingRun, list = listWorkoutProgrammingRuns, revalidate = revalidateWorkoutProgrammingRun,
  choices = loadWorkoutProgrammingChoices }) {
  const context = (req) => ({ facilityId: req.platformAuth.user.facility_id, userId: req.platformAuth.user.id })
  const allowed = async (req, res, ai = false) => {
    for (const feature of ['canonical_generator_coach_opt_in', ...(ai ? ['canonical_ai_intent'] : [])]) {
      const access = await featureAccess(pool, context(req).facilityId, feature)
      if (!access.enabled) { bad(res, 'Workout programming is not enabled for this facility.', 404, { reason: access.reason }); return false }
    }
    return true
  }
  const failure = (res, error) => {
    const status = error.code === 'programming_snapshot_forbidden' ? 403
      : ['programming_snapshot_conflict', 'foreign_session_intent', 'stale_library_release', 'source_workout_adapter_required'].includes(error.code) ? 409
      : ['canceled', 'deadline_exceeded'].includes(error.code) ? 408
      : error instanceof TypeError || error instanceof RangeError ? 400 : 500
    bad(res, status === 500 ? 'Workout programming could not be completed.' : error.message, status, { code: error.code ?? 'programming_failed' })
  }
  app.post('/api/coach/workout-programming', ...can('workouts.manage'), async (req, res) => {
    const controller = new AbortController()
    const abort = () => controller.abort()
    const close = () => { if (!res.writableEnded) abort() }
    req.on('aborted', abort); res.on('close', close)
    try {
      if (!await allowed(req, res, true)) return
      normalizeCoachWorkoutRequest(req.body)
      const registry = registryFactory()
      if (!registry.list().length) return bad(res, 'Configure the application AI provider before generating a programming session.', 503, { code: 'programming_model_unavailable' })
      const saved = await generate({ pool, context: context(req), registry, rawRequest: req.body, maxRepairPasses: 2,
        runOptions: { signal: controller.signal, maxCalls: 18, timeoutMs: 180000, perCallTimeoutMs: 20000, maxOutputTokens: 90000, perCallOutputTokens: 5000 } })
      if (!controller.signal.aborted) ok(res, saved)
    } catch (error) { if (!controller.signal.aborted) failure(res, error) }
    finally { req.off('aborted', abort); res.off('close', close) }
  })
  app.post('/api/coach/workout-programming/resources', ...can('workouts.manage'), async (req, res) => {
    try {
      if (!await allowed(req, res)) return
      ok(res, await choices(pool, context(req), req.body))
    } catch (error) { failure(res, error) }
  })
  app.get('/api/coach/workout-programming/evidence/:memberId', ...can('workouts.manage'), async (req, res) => {
    try {
      if (!await allowed(req, res)) return
      if (Object.keys(req.query).some((key) => !['kind', 'asOfDate'].includes(key))) throw new TypeError('Choose an observation source and session date')
      ok(res, await withCoachingLibrarySnapshot(pool, context(req), (client, scope) => loadWorkoutAthleteEvidenceChoices(client, scope,
        { memberId: req.params.memberId, kind: req.query.kind, asOfDate: req.query.asOfDate })))
    } catch (error) { failure(res, error) }
  })
  app.get('/api/coach/workout-programming', ...can('workouts.manage'), async (req, res) => {
    try {
      if (!await allowed(req, res)) return
      const { limit, beforeCreatedAt, beforeId, ...unknown } = req.query
      if (Object.keys(unknown).length || (beforeCreatedAt == null) !== (beforeId == null)
        || limit !== undefined && (typeof limit !== 'string' || !/^[1-9][0-9]{0,2}$/.test(limit))) throw new TypeError('Use a valid limit and complete saved-session cursor')
      ok(res, await list(pool, context(req), { limit: limit === undefined ? 25 : Number(limit),
        before: beforeId === undefined ? null : { createdAt: beforeCreatedAt, id: beforeId } }))
    } catch (error) { failure(res, error) }
  })
  app.get('/api/coach/workout-programming/:id', ...can('workouts.manage'), async (req, res) => {
    try {
      if (!await allowed(req, res)) return
      const saved = await load(pool, context(req), req.params.id)
      if (!saved) return bad(res, 'Saved programming session not found.', 404)
      ok(res, saved)
    } catch (error) { failure(res, error) }
  })
  app.post('/api/coach/workout-programming/:id/revalidate', ...can('workouts.manage'), async (req, res) => {
    try {
      if (!await allowed(req, res)) return
      if (req.body && Object.keys(req.body).length) throw new TypeError('Revalidation accepts the saved session ID only')
      const checked = await revalidate(pool, context(req), req.params.id)
      if (!checked) return bad(res, 'Saved programming session not found.', 404)
      ok(res, checked)
    } catch (error) { failure(res, error) }
  })
}
