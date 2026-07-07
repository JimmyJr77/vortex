/**
 * Idempotent repair for Needs Engine template/requirements tables.
 * Runs after initPlatformTables so production recovers when 218/224 failed on boot.
 */

let needsEngineSchemaPromise = null

async function tableExists(pool, schema, table) {
  const result = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1`,
    [schema, table],
  )
  return result.rows.length > 0
}

export async function getNeedsEngineSchemaStatus(pool) {
  const coachPhaseTemplate = await tableExists(pool, 'coaching', 'coach_phase_template')
  const coachNeedsEngineRequirements = await tableExists(pool, 'coaching', 'coach_needs_engine_requirements')
  return {
    coach_phase_template: coachPhaseTemplate,
    coach_needs_engine_requirements: coachNeedsEngineRequirements,
    ready: coachPhaseTemplate && coachNeedsEngineRequirements,
  }
}

async function applyCoachingNeedsEngineSchema(pool) {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS coaching`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.coach_phase_template (
      id BIGSERIAL PRIMARY KEY,
      facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
      coach_user_id BIGINT NOT NULL,
      name TEXT NOT NULL,
      phase_plan_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      archived BOOLEAN NOT NULL DEFAULT FALSE
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_coach_phase_template_facility_coach
      ON coaching.coach_phase_template (facility_id, coach_user_id)
      WHERE archived = FALSE
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaching.coach_needs_engine_requirements (
      id BIGSERIAL PRIMARY KEY,
      facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
      coach_user_id BIGINT NOT NULL,
      name TEXT NOT NULL,
      requirements_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      archived BOOLEAN NOT NULL DEFAULT FALSE
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_coach_needs_engine_requirements_facility_coach
      ON coaching.coach_needs_engine_requirements (facility_id, coach_user_id)
      WHERE archived = FALSE
  `)

  await pool.query(`
    ALTER TABLE coaching.workout
      ADD COLUMN IF NOT EXISTS audience_splits_json JSONB
  `)

  await pool.query(`
    ALTER TABLE coaching.workout_item
      ADD COLUMN IF NOT EXISTS split_alternates_json JSONB
  `)

  const status = await getNeedsEngineSchemaStatus(pool)
  if (!status.ready) {
    throw new Error(`Needs Engine schema incomplete: ${JSON.stringify(status)}`)
  }

  console.log('[ensureCoachingNeedsEngineSchema] Needs Engine template schema ready')
  return status
}

export async function ensureCoachingNeedsEngineSchema(pool) {
  if (!needsEngineSchemaPromise) {
    needsEngineSchemaPromise = applyCoachingNeedsEngineSchema(pool).catch((err) => {
      needsEngineSchemaPromise = null
      throw err
    })
  }
  return needsEngineSchemaPromise
}
