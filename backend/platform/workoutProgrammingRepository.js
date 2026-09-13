import { libraryScopeId, withCoachingLibrarySnapshot } from './coachingLibraryContext.js'
import { persistCanonicalWorkout } from './canonicalLibraryRepository.js'
import { validateWorkoutProgrammingDraft } from './workoutProgrammingQA.js'
import { ProgrammingStaffError } from './programmingStaffRuntime.js'
import { immutableProgrammingValue, programmingValueHash } from './workoutProgrammingRequest.js'
import { PROGRAMMING_SESSION_MODEL, parseProgrammingWorkflowSnapshot, createProgrammingWorkoutEnvelope, readProgrammingWorkoutEnvelope } from './workoutProgrammingStorageContract.js'

const scopeFor = (context) => ({ facilityId: libraryScopeId(context.facilityId, 'facilityId'), userId: libraryScopeId(context.userId, 'userId') })
const snapshotId = (value) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) throw new TypeError('A saved programming workout ID must be a UUID')
  return value
}
async function authorize(client, scope) {
  const result = await client.query('/* programming_snapshot_actor */ SELECT id FROM public.app_user WHERE id=$1 AND facility_id=$2', [scope.userId, scope.facilityId])
  if (!result.rows.length) throw new ProgrammingStaffError('programming_snapshot_forbidden', 'The authenticated actor is not in this facility')
}
async function loadRow(client, scope, id) {
  const result = await client.query(`/* programming_snapshot_read */
    SELECT id, facility_id, created_by, created_at, library_release_id, intent_json, output_json, validation_json
    FROM coaching.generated_workout_v1 WHERE id=$1 AND facility_id=$2 AND output_json->>'sessionModel'=$3`, [id, scope.facilityId, PROGRAMMING_SESSION_MODEL])
  return result.rows[0] ?? null
}
function savedRecord(row, { fresh = false } = {}) {
  const workout = readProgrammingWorkoutEnvelope(row.output_json)
  if (workout.runId !== row.id || workout.workflow.sessionIntent.scope.facilityId !== String(row.facility_id)
    || workout.workflow.draft.libraryRelease.id !== row.library_release_id
    || programmingValueHash(workout.intent) !== programmingValueHash(row.intent_json)
    || programmingValueHash(workout.validation) !== programmingValueHash(row.validation_json)) {
    throw new ProgrammingStaffError('invalid_programming_snapshot', 'Saved workout metadata disagrees with its session evidence')
  }
  return immutableProgrammingValue({ persistedWorkoutId: String(row.id), createdBy: row.created_by == null ? null : String(row.created_by),
    createdAt: new Date(row.created_at).toISOString(), workout,
    validationFreshness: fresh ? 'at_save' : 'historical_snapshot', requiresRevalidation: !fresh || !workout.validatedWorkout })
}

/** Persist a completed internal run, including review stops, in the existing immutable workout snapshot table. */
export async function persistWorkoutProgrammingRun({ pool, context, workflow: rawWorkflow, signal }) {
  const scope = scopeFor(context)
  const workflow = parseProgrammingWorkflowSnapshot(rawWorkflow)
  if (programmingValueHash(workflow.sessionIntent.scope) !== programmingValueHash(scope)) throw new ProgrammingStaffError('programming_snapshot_forbidden', 'Only the originating facility and actor may save this run')
  const canceled = () => { if (signal?.aborted) throw new ProgrammingStaffError('canceled', 'Programming save was canceled') }
  // A concurrent retry may commit after our repeatable-read snapshot began. Retry storage only, never generation.
  for (let attempt = 0; attempt < 2; attempt++) {
    canceled()
    const client = await pool.connect()
    let discardError
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
      await authorize(client, scope)
      const existing = await loadRow(client, scope, workflow.runId)
      if (existing) {
        const saved = savedRecord(existing)
        if (saved.createdBy !== scope.userId || saved.workout.workflowHash !== programmingValueHash(workflow)) {
          throw new ProgrammingStaffError('programming_snapshot_conflict', 'This run ID already has a different immutable snapshot')
        }
        canceled()
        await client.query('COMMIT')
        return saved
      }
      const release = await client.query(`/* programming_snapshot_release */
        SELECT id FROM coaching.workout_library_release_v1 WHERE id=$1 AND facility_id=$2`, [workflow.draft.libraryRelease.id, scope.facilityId])
      if (!release.rows.length) throw new ProgrammingStaffError('programming_snapshot_forbidden', 'The source release does not belong to this facility')
      const freshValidation = await validateWorkoutProgrammingDraft({ pool, context: scope, sessionIntent: workflow.sessionIntent,
        draft: workflow.draft, signal, snapshotClient: client })
      const output = createProgrammingWorkoutEnvelope(workflow, freshValidation)
      canceled()
      await persistCanonicalWorkout(client, scope.facilityId, scope.userId, release.rows[0], output, { snapshotId: workflow.runId })
      const saved = savedRecord(await loadRow(client, scope, workflow.runId), { fresh: true })
      canceled()
      await client.query('COMMIT')
      return saved
    } catch (error) {
      try { await client.query('ROLLBACK') } catch (rollbackError) { discardError = rollbackError }
      if (attempt === 0 && ['40001', '23505'].includes(error.code)) continue
      throw error
    } finally { client.release(discardError) }
  }
}

export async function loadWorkoutProgrammingRun(pool, context, id) {
  snapshotId(id)
  return withCoachingLibrarySnapshot(pool, context, async (client, scope) => {
    await authorize(client, scope)
    const row = await loadRow(client, scope, id)
    return row ? savedRecord(row) : null
  })
}

/** Reopening can verify unchanged evidence without another model call or changing the historical snapshot. */
export async function revalidateWorkoutProgrammingRun(pool, context, id, { signal } = {}) {
  snapshotId(id)
  return withCoachingLibrarySnapshot(pool, context, async (client, scope) => {
    await authorize(client, scope)
    const row = await loadRow(client, scope, id)
    if (!row) return null
    const saved = savedRecord(row)
    const workflow = saved.workout.workflow
    const freshValidation = await validateWorkoutProgrammingDraft({ pool, context: scope, sessionIntent: workflow.sessionIntent,
      draft: workflow.draft, signal, snapshotClient: client })
    const current = createProgrammingWorkoutEnvelope(workflow, freshValidation)
    return immutableProgrammingValue({ persistedWorkoutId: id, savedContentHash: saved.workout.contentHash, checkedAt: new Date().toISOString(),
      status: current.status, validatedWorkout: current.validatedWorkout, requiresRevalidation: !current.validatedWorkout,
      validation: current.validation, creatorAuthorized: false, libraryApprovalGranted: false })
  })
}

export async function listWorkoutProgrammingRuns(pool, context, { limit = 25, before = null } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('Saved session list limit must be from one to 100')
  if (before && (Object.keys(before).some((key) => !['createdAt', 'id'].includes(key)) || !Number.isFinite(Date.parse(before.createdAt)))) throw new TypeError('A valid saved-session cursor is required')
  if (before) snapshotId(before.id)
  return withCoachingLibrarySnapshot(pool, context, async (client, scope) => {
    await authorize(client, scope)
    const result = await client.query(`/* programming_snapshot_list */
      SELECT id, created_at, created_by, output_json->>'status' AS status, output_json->>'revision' AS revision,
        intent_json->>'objective' AS objective, intent_json->'logistics' AS logistics,
        output_json->'explanation'->>'session' AS summary
      FROM coaching.generated_workout_v1 WHERE facility_id=$1 AND output_json->>'sessionModel'=$2
        AND ($3::timestamptz IS NULL OR (created_at, id) < ($3::timestamptz, $4::uuid))
      ORDER BY created_at DESC, id DESC LIMIT $5`, [scope.facilityId, PROGRAMMING_SESSION_MODEL, before?.createdAt ?? null, before?.id ?? null, limit])
    const items = result.rows.map((row) => ({ persistedWorkoutId: row.id, createdAt: new Date(row.created_at).toISOString(),
      createdBy: row.created_by == null ? null : String(row.created_by), status: row.status, revision: row.revision,
      objective: row.objective, logistics: row.logistics, summary: row.summary, requiresRevalidation: true }))
    const last = items.at(-1)
    return immutableProgrammingValue({ items, nextCursor: items.length === limit ? { createdAt: last.createdAt, id: last.persistedWorkoutId } : null })
  })
}
