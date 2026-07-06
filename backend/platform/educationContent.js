/** Load coach-facing education / "Why Layer" content. */

export async function loadEducationByEntity(pool, entityType, entityKey, entityId = null) {
  const params = [entityType, entityKey ?? '']
  let sql = `SELECT * FROM coaching.education_content WHERE entity_type = $1 AND entity_key = $2`
  if (entityId != null) {
    params.push(entityId)
    sql += ` AND entity_id = $3`
  } else {
    sql += ` AND entity_id IS NULL`
  }
  sql += ` AND is_published = TRUE LIMIT 1`
  const result = await pool.query(sql, params)
  return result.rows[0] ?? null
}

export async function loadEducationMap(pool, entityType, keys = []) {
  if (keys.length === 0) {
    const result = await pool.query(
      `SELECT * FROM coaching.education_content WHERE entity_type = $1 AND is_published = TRUE ORDER BY sort_order, id`,
      [entityType],
    )
    return result.rows
  }
  const result = await pool.query(
    `SELECT * FROM coaching.education_content WHERE entity_type = $1 AND entity_key = ANY($2::text[]) AND is_published = TRUE`,
    [entityType, keys],
  )
  return result.rows
}

export async function loadEducationForExercise(pool, exerciseId, slug = null) {
  const byId = await pool.query(
    `SELECT * FROM coaching.education_content WHERE entity_type = 'exercise' AND entity_id = $1 LIMIT 1`,
    [exerciseId],
  )
  if (byId.rows.length > 0) return byId.rows[0]
  if (slug) {
    const byKey = await pool.query(
      `SELECT * FROM coaching.education_content WHERE entity_type = 'exercise' AND entity_key = $1 AND entity_id IS NULL LIMIT 1`,
      [slug],
    )
    if (byKey.rows.length > 0) return byKey.rows[0]
  }
  return null
}

export async function upsertExerciseEducation(pool, exerciseId, slug, fields) {
  await pool.query(
    `
      INSERT INTO coaching.education_content (
        entity_type, entity_key, entity_id, title, short_summary,
        what_it_is, why_it_matters, why_it_goes_here, why_this_order,
        fatigue_logic, programming_guidance, common_misuse, scaling_guidance,
        age_skill_considerations, safety_considerations, daily_or_weekly_guidance, coach_cues,
        why_it_works, physiological_rationale
      ) VALUES (
        'exercise', $2, $1, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
      ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
        entity_id = EXCLUDED.entity_id,
        title = EXCLUDED.title,
        short_summary = EXCLUDED.short_summary,
        what_it_is = EXCLUDED.what_it_is,
        why_it_matters = EXCLUDED.why_it_matters,
        why_it_goes_here = EXCLUDED.why_it_goes_here,
        why_this_order = EXCLUDED.why_this_order,
        fatigue_logic = EXCLUDED.fatigue_logic,
        programming_guidance = EXCLUDED.programming_guidance,
        common_misuse = EXCLUDED.common_misuse,
        scaling_guidance = EXCLUDED.scaling_guidance,
        age_skill_considerations = EXCLUDED.age_skill_considerations,
        safety_considerations = EXCLUDED.safety_considerations,
        daily_or_weekly_guidance = EXCLUDED.daily_or_weekly_guidance,
        coach_cues = EXCLUDED.coach_cues,
        why_it_works = COALESCE(EXCLUDED.why_it_works, coaching.education_content.why_it_works),
        physiological_rationale = COALESCE(EXCLUDED.physiological_rationale, coaching.education_content.physiological_rationale),
        updated_at = now()
    `,
    [
      exerciseId,
      slug || String(exerciseId),
      fields.title ?? null,
      fields.short_summary ?? null,
      fields.what_it_is ?? fields.training_purpose ?? null,
      fields.why_it_matters ?? fields.tenet_rationale ?? null,
      fields.why_it_goes_here ?? fields.phase_rationale ?? null,
      fields.why_this_order ?? fields.order_rationale ?? null,
      fields.fatigue_logic ?? fields.fatigue_rationale ?? null,
      fields.programming_guidance ?? fields.methodology_rationale ?? null,
      fields.common_misuse ?? null,
      fields.scaling_guidance ?? fields.scaling_rationale ?? null,
      fields.age_skill_considerations ?? null,
      fields.safety_considerations ?? null,
      fields.daily_or_weekly_guidance ?? fields.regimen_rationale ?? null,
      fields.coach_cues ?? null,
      fields.why_it_works ?? null,
      fields.physiological_rationale ?? null,
    ],
  )
}

export function educationToWhyResponse(row) {
  if (!row) return null
  return {
    training_purpose: row.what_it_is,
    why_it_works: row.why_it_works,
    tenet_rationale: row.why_it_matters,
    methodology_rationale: row.programming_guidance,
    physiological_rationale: row.physiological_rationale ?? row.programming_guidance,
    phase_rationale: row.why_it_goes_here,
    order_rationale: row.why_this_order,
    fatigue_rationale: row.fatigue_logic,
    scaling_rationale: row.scaling_guidance,
    regimen_rationale: row.daily_or_weekly_guidance,
    common_misuse: row.common_misuse,
    short_summary: row.short_summary,
    coach_cues: row.coach_cues,
  }
}
