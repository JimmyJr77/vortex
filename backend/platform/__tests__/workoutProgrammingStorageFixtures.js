import { compositionFixtures, compositionRegistry } from './workoutProgrammingBuilderFixtures.js'
import { generateWorkoutProgramming } from '../workoutProgrammingWorkflow.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'

export async function storageFixtures() {
  const fixtures = compositionFixtures()
  const registry = compositionRegistry([{ id: 'vortex/programming-critic', role: 'programming_critic', version: 'test-storage', async invoke(input) {
    return { modelVersion: 'synthetic-storage-model', usage: { inputTokens: 100, outputTokens: 100 }, output: { draftId: input.draftId, reviewHash: input.reviewHash,
      status: 'PASS', summary: 'Synthetic fixture session passes independent review.', findings: [],
      assessments: input.reviewAreas.map((area) => ({ area, status: 'PASS', summary: 'Reviewed synthetic source, dose, order and evidence.' })) } }
  } }])
  const { assumptions, ...rawRequest } = fixtures.request
  const workflow = await generateWorkoutProgramming({ pool: fixtures.pool(), context: SCOPE, registry, rawRequest })
  return { ...fixtures, registry, rawRequest, workflow }
}

/** Canonical source queries use existing fixtures; persistence, scope and transaction statements use the supplied database. */
export function storageSourcePool(database, fixtures) {
  const calls = []
  return { calls, async connect() {
    const client = await database.connect()
    const library = fixtures.pool().client
    return { async query(sql, values = []) {
      calls.push({ sql, values })
      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql) || sql.includes('programming_snapshot_') || sql.includes('INSERT INTO coaching.generated_workout_v1')) return client.query(sql, values)
      return library.query(sql, values)
    }, release(error) { client.release(error) } }
  } }
}

export function memoryStorageDatabase({ actorAllowed = true, releaseAllowed = true, failInsert = false } = {}) {
  const rows = new Map()
  const calls = []
  return { rows, calls, async connect() {
    let staged = null
    return { async query(sql, values = []) {
      calls.push({ sql, values })
      if (sql === 'COMMIT' && staged) rows.set(staged.id, staged)
      if (sql === 'ROLLBACK') staged = null
      if (sql.includes('programming_snapshot_actor')) return { rows: actorAllowed ? [{ id: values[0] }] : [] }
      if (sql.includes('programming_snapshot_release')) return { rows: releaseAllowed ? [{ id: values[0] }] : [] }
      if (sql.includes('INSERT INTO coaching.generated_workout_v1')) {
        if (failInsert) throw Object.assign(new Error('Synthetic write failure'), { code: 'test_write_failed' })
        const [facility_id, library_release_id, , , , , , , intent, output, validation, created_by, id] = values
        staged = { id, facility_id, library_release_id, created_by, created_at: '2026-09-13T12:00:00Z',
          intent_json: JSON.parse(intent), output_json: JSON.parse(output), validation_json: JSON.parse(validation) }
        return { rows: [{ id }] }
      }
      if (sql.includes('programming_snapshot_read')) {
        const row = staged?.id === values[0] ? staged : rows.get(values[0])
        return { rows: row && String(row.facility_id) === values[1] && row.output_json.sessionModel === values[2] ? [structuredClone(row)] : [] }
      }
      if (sql.includes('programming_snapshot_list')) {
        return { rows: [...rows.values()].filter((row) => String(row.facility_id) === values[0] && row.output_json.sessionModel === values[1]
          && (values[2] == null || Date.parse(row.created_at) < Date.parse(values[2]) || Date.parse(row.created_at) === Date.parse(values[2]) && row.id < values[3]))
          .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at) || right.id.localeCompare(left.id)).slice(0, values[4])
          .map((row) => ({ ...row, status: row.output_json.status, revision: row.output_json.revision,
            objective: row.intent_json.objective, logistics: row.intent_json.logistics, summary: row.output_json.explanation.session })) }
      }
      return { rows: [] }
    }, release(error) { calls.push({ sql: 'RELEASE', error }) } }
  } }
}
