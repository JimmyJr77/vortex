import { reviewExerciseDifficulty } from './exerciseDifficultyReview.js'
import { classifyProgrammingKind } from './exerciseProgrammingKind.js'

function parseJson(val) {
  if (val == null) return {}
  if (typeof val === 'object' && !Array.isArray(val)) return val
  try {
    return JSON.parse(val)
  } catch {
    return {}
  }
}

function pickPrimaryPhaseRow(phaseProfiles) {
  if (!Array.isArray(phaseProfiles) || phaseProfiles.length === 0) return null
  return phaseProfiles.find((p) => p.role === 'primary')
    ?? phaseProfiles.find((p) => p.role !== 'avoid')
    ?? phaseProfiles[0]
}

/** Derive load + technical when no authored profile exists (mirrors review scoring). */
export function deriveExerciseDifficulty(exerciseRow, primaryPhase, regimen, safety, movementRequirements) {
  const row = {
    ...exerciseRow,
    movement_requirements: typeof movementRequirements === 'object' && movementRequirements != null
      ? movementRequirements
      : parseJson(movementRequirements ?? exerciseRow?.movement_requirements),
    programming_kind: exerciseRow?.programming_kind ?? classifyProgrammingKind(exerciseRow),
  }
  const result = reviewExerciseDifficulty(row)
  return {
    ...result,
    source: 'derived',
    notes: `derived (${result.programming_kind ?? 'exercise'})`,
  }
}

export async function ensureDerivedDifficultyProfiles(pool, { facilityId = null, exerciseIds = null } = {}) {
  const params = []
  const where = ['e.archived = FALSE']
  if (facilityId != null) {
    params.push(facilityId)
    where.push(`e.facility_id = $${params.length}`)
  }
  if (Array.isArray(exerciseIds) && exerciseIds.length > 0) {
    params.push(exerciseIds)
    where.push(`e.id = ANY($${params.length}::bigint[])`)
  }
  where.push(`NOT EXISTS (
    SELECT 1 FROM coaching.exercise_difficulty_profile d
    WHERE d.exercise_id = e.id
  )`)

  let missing
  try {
    missing = await pool.query(
      `
        SELECT e.id, e.slug, e.name, e.skill_level, e.age_min, e.age_max,
               e.participant_structure, e.movement_requirements, e.movement_family,
               e.load_note, e.primary_phase_key, e.phase_subrole, e.programming_kind
        FROM coaching.exercise e
        WHERE ${where.join(' AND ')}
        ORDER BY e.id
      `,
      params,
    )
  } catch (err) {
    if (/does not exist/i.test(String(err.message))) return 0
    throw err
  }

  if (missing.rows.length === 0) return 0

  let upserted = 0
  for (const row of missing.rows) {
    const diff = deriveExerciseDifficulty(row, null, null, null, row.movement_requirements)
    await pool.query(
      `
        INSERT INTO coaching.exercise_difficulty_profile (
          exercise_id, technical, load, overall,
          recommended_age_min, recommended_age_max, attention_demand, notes, source, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
        ON CONFLICT (exercise_id) DO NOTHING
      `,
      [
        row.id,
        diff.technical,
        diff.load,
        diff.overall,
        diff.recommended_age_min,
        diff.recommended_age_max,
        diff.attention_demand,
        diff.notes,
        diff.source,
      ],
    )
    upserted++
  }

  return upserted
}

export { pickPrimaryPhaseRow, parseJson as parseExerciseJson }
