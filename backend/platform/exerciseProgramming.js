import { loadEducationForExercise, upsertExerciseEducation, educationToWhyResponse } from './educationContent.js'

export async function loadPhaseProfiles(pool, exerciseIds) {
  if (exerciseIds.length === 0) return new Map()
  const result = await pool.query(
    `
      SELECT p.*, sp.key AS phase_key, sp.name AS phase_name, sp.order_index AS phase_order_index
      FROM coaching.exercise_phase_profile p
      JOIN coaching.session_phase sp ON sp.id = p.phase_id
      WHERE p.exercise_id = ANY($1::bigint[])
      ORDER BY sp.order_index, p.fit_weight DESC
    `,
    [exerciseIds],
  )
  const map = new Map()
  for (const row of result.rows) {
    const list = map.get(String(row.exercise_id)) ?? []
    list.push({
      phaseId: Number(row.phase_id),
      phaseKey: row.phase_key,
      phaseName: row.phase_name,
      fitWeight: Number(row.fit_weight),
      role: row.role,
      orderSlot: row.order_slot,
      orderIndex: Number(row.order_index),
      freshnessRequired: row.freshness_required,
      fatigueSensitivity: Number(row.fatigue_sensitivity),
      fatigueCost: Number(row.fatigue_cost),
      technicalComplexity: Number(row.technical_complexity),
      impactLevel: Number(row.impact_level),
      intensityCeiling: row.intensity_ceiling,
      notes: row.notes,
    })
    map.set(String(row.exercise_id), list)
  }
  return map
}

async function loadSingleProfile(pool, table, exerciseIds, multiple = false) {
  if (exerciseIds.length === 0) return new Map()
  const result = await pool.query(`SELECT * FROM coaching.${table} WHERE exercise_id = ANY($1::bigint[])`, [exerciseIds])
  const map = new Map()
  for (const row of result.rows) {
    if (multiple) {
      const list = map.get(String(row.exercise_id)) ?? []
      list.push(row)
      map.set(String(row.exercise_id), list)
    } else {
      map.set(String(row.exercise_id), row)
    }
  }
  return map
}

export async function loadExerciseProgrammingBundle(pool, exerciseIds) {
  const [phaseProfiles, dosageProfiles, scalingProfiles, safetyProfiles, regimenRules] = await Promise.all([
    loadPhaseProfiles(pool, exerciseIds),
    loadSingleProfile(pool, 'exercise_dosage_profile', exerciseIds, true),
    loadSingleProfile(pool, 'exercise_scaling_profile', exerciseIds, true),
    loadSingleProfile(pool, 'exercise_safety_profile', exerciseIds, false),
    loadSingleProfile(pool, 'exercise_regimen_rule', exerciseIds, false),
  ])
  return { phaseProfiles, dosageProfiles, scalingProfiles, safetyProfiles, regimenRules }
}

export function attachProgrammingToExercise(row, bundle, education = null) {
  const id = String(row.id)
  const phaseProfiles = bundle.phaseProfiles.get(id) ?? []
  const primaryPhase = phaseProfiles.find((p) => p.role === 'primary') ?? phaseProfiles[0] ?? null
  return {
    ...row,
    card_summary: row.card_summary,
    coach_language: row.coach_language,
    athlete_language: row.athlete_language,
    programming_logic: row.programming_logic ?? {},
    scalable_variables: row.scalable_variables ?? [],
    why_publish_ready: row.why_publish_ready,
    phase_profiles: phaseProfiles,
    primary_phase: primaryPhase,
    dosage_profiles: bundle.dosageProfiles.get(id) ?? [],
    scaling_profiles: bundle.scalingProfiles.get(id) ?? [],
    safety_profile: bundle.safetyProfiles.get(id) ?? null,
    regimen_rule: bundle.regimenRules.get(id) ?? null,
    why: educationToWhyResponse(education),
  }
}

export async function saveExerciseProgramming(client, exerciseId, slug, body) {
  if (Array.isArray(body.phase_profiles)) {
    await client.query(`DELETE FROM coaching.exercise_phase_profile WHERE exercise_id = $1`, [exerciseId])
    for (const p of body.phase_profiles) {
      const phaseId = Number(p.phaseId ?? p.phase_id)
      if (!phaseId) continue
      await client.query(
        `
          INSERT INTO coaching.exercise_phase_profile (
            exercise_id, phase_id, fit_weight, role, order_slot, order_index,
            freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity,
            impact_level, intensity_ceiling, notes
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (exercise_id, phase_id) DO UPDATE SET
            fit_weight = EXCLUDED.fit_weight, role = EXCLUDED.role, order_slot = EXCLUDED.order_slot,
            order_index = EXCLUDED.order_index, freshness_required = EXCLUDED.freshness_required,
            fatigue_sensitivity = EXCLUDED.fatigue_sensitivity, fatigue_cost = EXCLUDED.fatigue_cost,
            technical_complexity = EXCLUDED.technical_complexity, impact_level = EXCLUDED.impact_level,
            intensity_ceiling = EXCLUDED.intensity_ceiling, notes = EXCLUDED.notes
        `,
        [
          exerciseId, phaseId, Math.min(Math.max(Number(p.fitWeight ?? p.fit_weight) || 3, 1), 5),
          p.role || 'secondary', p.orderSlot ?? p.order_slot ?? null, Number(p.orderIndex ?? p.order_index) || 0,
          Boolean(p.freshnessRequired ?? p.freshness_required),
          Math.min(Math.max(Number(p.fatigueSensitivity ?? p.fatigue_sensitivity) || 3, 1), 5),
          Math.min(Math.max(Number(p.fatigueCost ?? p.fatigue_cost) || 3, 1), 5),
          Math.min(Math.max(Number(p.technicalComplexity ?? p.technical_complexity) || 3, 1), 5),
          Math.min(Math.max(Number(p.impactLevel ?? p.impact_level) || 1, 0), 5),
          p.intensityCeiling ?? p.intensity_ceiling ?? null, p.notes ?? null,
        ],
      )
    }
  }

  if (body.dosage_profiles?.[0] || body.dosage_profile) {
    const d = body.dosage_profiles?.[0] ?? body.dosage_profile
    await client.query(
      `
        INSERT INTO coaching.exercise_dosage_profile (
          exercise_id, profile_name, is_default, volume_unit, default_sets, default_reps,
          default_work_seconds, default_rest_seconds, est_seconds_per_set,
          session_volume_min, session_volume_max, weekly_volume_max, default_rpe_min, default_rpe_max
        ) VALUES ($1,'Default',TRUE,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (exercise_id, profile_name) DO UPDATE SET
          volume_unit = EXCLUDED.volume_unit, default_sets = EXCLUDED.default_sets,
          default_reps = EXCLUDED.default_reps, default_work_seconds = EXCLUDED.default_work_seconds,
          default_rest_seconds = EXCLUDED.default_rest_seconds, est_seconds_per_set = EXCLUDED.est_seconds_per_set,
          session_volume_min = EXCLUDED.session_volume_min, session_volume_max = EXCLUDED.session_volume_max,
          weekly_volume_max = EXCLUDED.weekly_volume_max
      `,
      [
        exerciseId, d.volume_unit ?? d.volumeUnit ?? 'reps', d.default_sets ?? d.defaultSets,
        d.default_reps ?? d.defaultReps, d.default_work_seconds ?? d.defaultWorkSeconds,
        d.default_rest_seconds ?? d.defaultRestSeconds, d.est_seconds_per_set ?? d.estSecondsPerSet,
        d.session_volume_min ?? d.sessionVolumeMin, d.session_volume_max ?? d.sessionVolumeMax,
        d.weekly_volume_max ?? d.weeklyVolumeMax, d.default_rpe_min ?? d.defaultRpeMin, d.default_rpe_max ?? d.defaultRpeMax,
      ],
    )
  }

  if (body.safety_profile) {
    const s = body.safety_profile
    await client.query(
      `
        INSERT INTO coaching.exercise_safety_profile (
          exercise_id, risk_level, impact_level, requires_spotting, requires_coach_supervision,
          minimum_age_recommended, minimum_skill_level, readiness_checks, stop_signs, common_substitutions
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (exercise_id) DO UPDATE SET
          risk_level = EXCLUDED.risk_level, impact_level = EXCLUDED.impact_level,
          requires_spotting = EXCLUDED.requires_spotting,
          requires_coach_supervision = EXCLUDED.requires_coach_supervision,
          minimum_age_recommended = EXCLUDED.minimum_age_recommended,
          minimum_skill_level = EXCLUDED.minimum_skill_level,
          readiness_checks = EXCLUDED.readiness_checks,
          stop_signs = EXCLUDED.stop_signs,
          common_substitutions = EXCLUDED.common_substitutions
      `,
      [
        exerciseId,
        s.risk_level ?? s.riskLevel ?? 2,
        s.impact_level ?? s.impactLevel ?? 1,
        Boolean(s.requires_spotting ?? s.requiresSpotting),
        s.requires_coach_supervision ?? s.requiresCoachSupervision ?? 'recommended',
        s.minimum_age_recommended ?? s.minimumAgeRecommended,
        s.minimum_skill_level ?? s.minimumSkillLevel,
        s.readiness_checks ?? s.readinessChecks ?? [],
        s.stop_signs ?? s.stopSigns ?? [],
        s.common_substitutions ?? s.commonSubstitutions ?? [],
      ],
    )
  }

  if (body.regimen_rule) {
    const r = body.regimen_rule
    await client.query(
      `
        INSERT INTO coaching.exercise_regimen_rule (
          exercise_id, can_be_daily, weekly_max_frequency, minimum_hours_between_hard_exposures,
          counts_as_high_intensity, counts_as_high_impact, counts_as_neural,
          counts_as_tissue_stress, counts_as_conditioning, recovery_notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (exercise_id) DO UPDATE SET
          can_be_daily = EXCLUDED.can_be_daily,
          weekly_max_frequency = EXCLUDED.weekly_max_frequency,
          minimum_hours_between_hard_exposures = EXCLUDED.minimum_hours_between_hard_exposures,
          counts_as_high_intensity = EXCLUDED.counts_as_high_intensity,
          counts_as_high_impact = EXCLUDED.counts_as_high_impact,
          counts_as_neural = EXCLUDED.counts_as_neural,
          counts_as_tissue_stress = EXCLUDED.counts_as_tissue_stress,
          counts_as_conditioning = EXCLUDED.counts_as_conditioning,
          recovery_notes = EXCLUDED.recovery_notes
      `,
      [
        exerciseId,
        Boolean(r.can_be_daily ?? r.canBeDaily),
        r.weekly_max_frequency ?? r.weeklyMaxFrequency ?? 3,
        r.minimum_hours_between_hard_exposures ?? r.minimumHoursBetweenHardExposures ?? 24,
        Boolean(r.counts_as_high_intensity ?? r.countsAsHighIntensity),
        Boolean(r.counts_as_high_impact ?? r.countsAsHighImpact),
        Boolean(r.counts_as_neural ?? r.countsAsNeural),
        Boolean(r.counts_as_tissue_stress ?? r.countsAsTissueStress),
        Boolean(r.counts_as_conditioning ?? r.countsAsConditioning),
        r.recovery_notes ?? r.recoveryNotes ?? null,
      ],
    )
  }

  const scalingRows = body.scaling_profiles ?? (body.scaling_profile ? [body.scaling_profile] : null)
  if (Array.isArray(scalingRows) && scalingRows.length > 0) {
    await client.query(`DELETE FROM coaching.exercise_scaling_profile WHERE exercise_id = $1`, [exerciseId])
    for (const s of scalingRows) {
      if (!s.label && !s.load_guidance && !s.complexity_guidance) continue
      await client.query(
        `
          INSERT INTO coaching.exercise_scaling_profile (
            exercise_id, label, age_min, age_max, skill_level, scale_direction,
            sets_min, sets_max, reps_min, reps_max, work_seconds_min, work_seconds_max,
            rest_seconds_min, rest_seconds_max, load_guidance, height_guidance, distance_guidance,
            tempo_guidance, rom_guidance, complexity_guidance, impact_guidance,
            coach_notes, athlete_notes, contraindication_notes
          ) VALUES ($1,$2,$3,$4,$5::public.skill_level,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
        `,
        [
          exerciseId,
          s.label || 'Baseline',
          s.age_min ?? s.ageMin ?? null,
          s.age_max ?? s.ageMax ?? null,
          s.skill_level ?? s.skillLevel ?? null,
          s.scale_direction ?? s.scaleDirection ?? 'baseline',
          s.sets_min ?? s.setsMin ?? null,
          s.sets_max ?? s.setsMax ?? null,
          s.reps_min ?? s.repsMin ?? null,
          s.reps_max ?? s.repsMax ?? null,
          s.work_seconds_min ?? s.workSecondsMin ?? null,
          s.work_seconds_max ?? s.workSecondsMax ?? null,
          s.rest_seconds_min ?? s.restSecondsMin ?? null,
          s.rest_seconds_max ?? s.restSecondsMax ?? null,
          s.load_guidance ?? s.loadGuidance ?? null,
          s.height_guidance ?? s.heightGuidance ?? null,
          s.distance_guidance ?? s.distanceGuidance ?? null,
          s.tempo_guidance ?? s.tempoGuidance ?? null,
          s.rom_guidance ?? s.romGuidance ?? null,
          s.complexity_guidance ?? s.complexityGuidance ?? null,
          s.impact_guidance ?? s.impactGuidance ?? null,
          s.coach_notes ?? s.coachNotes ?? null,
          s.athlete_notes ?? s.athleteNotes ?? null,
          s.contraindication_notes ?? s.contraindicationNotes ?? null,
        ],
      )
    }
  }

  if (body.why || body.education) {
    await upsertExerciseEducation(client, exerciseId, slug, body.why ?? body.education)
  }
}

export async function validateExercisePublishReady(pool, exerciseId) {
  const issues = []
  const ex = await pool.query(`SELECT id, name, description, est_seconds_per_set FROM coaching.exercise WHERE id = $1`, [exerciseId])
  if (ex.rows.length === 0) return { ready: false, issues: ['Exercise not found'] }
  const row = ex.rows[0]
  if (!row.name) issues.push('Name required')
  if (!row.description) issues.push('Description required')
  if (!row.est_seconds_per_set) issues.push('Est seconds per set required')

  const tags = await pool.query(`SELECT facet_type FROM coaching.exercise_tag WHERE exercise_id = $1`, [exerciseId])
  const types = new Set(tags.rows.map((t) => t.facet_type))
  for (const req of ['tenet', 'methodology', 'physiology', 'pattern', 'equipment']) {
    if (!types.has(req)) issues.push(`Missing ${req} tag`)
  }

  const phases = await pool.query(`SELECT 1 FROM coaching.exercise_phase_profile WHERE exercise_id = $1 LIMIT 1`, [exerciseId])
  if (phases.rows.length === 0) issues.push('At least one phase profile required')

  const safety = await pool.query(`SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id = $1`, [exerciseId])
  if (safety.rows.length === 0) issues.push('Safety profile required')

  const scaling = await pool.query(`SELECT 1 FROM coaching.exercise_scaling_profile WHERE exercise_id = $1 LIMIT 1`, [exerciseId])
  if (scaling.rows.length === 0) issues.push('Scaling profile required')

  const edu = await loadEducationForExercise(pool, exerciseId)
  if (!edu?.what_it_is) issues.push('Training purpose (why) required')
  if (!edu?.why_it_goes_here) issues.push('Phase rationale required')
  if (!edu?.fatigue_logic) issues.push('Fatigue rationale required')
  if (!edu?.common_misuse) issues.push('Common misuse required')

  return { ready: issues.length === 0, issues }
}

export { loadEducationForExercise, educationToWhyResponse }
