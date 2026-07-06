import { loadEducationForExercise, upsertExerciseEducation, educationToWhyResponse } from './educationContent.js'
import { deriveExerciseSubrole, resolveSubroleFromOrderSlot } from './phaseSubrole.js'

export const SCALING_COHORT_KEYS = [
  'youth_beginner', 'youth_intermediate', 'teen', 'adult_beginner',
  'adult_advanced', 'older_adult', 'pregnancy_postpartum',
]

export const REQUIRED_SCALING_COHORTS = [
  'youth_beginner', 'youth_intermediate', 'teen', 'adult_beginner', 'adult_advanced', 'older_adult',
]

function parseJson(val, fallback = {}) {
  if (val == null) return fallback
  if (typeof val === 'object' && !Array.isArray(val)) return val
  try {
    return JSON.parse(val)
  } catch {
    return fallback
  }
}

function asStringArray(val) {
  if (!Array.isArray(val)) return []
  return val.map((v) => String(v).trim()).filter(Boolean)
}

function pickPrimaryPhaseProfile(phaseProfiles) {
  if (!Array.isArray(phaseProfiles) || phaseProfiles.length === 0) return null
  return phaseProfiles.find((p) => p.role === 'primary')
    ?? phaseProfiles.find((p) => p.role !== 'avoid')
    ?? phaseProfiles[0]
}

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
  const empty = {
    phaseProfiles: new Map(),
    dosageProfiles: new Map(),
    scalingProfiles: new Map(),
    safetyProfiles: new Map(),
    regimenRules: new Map(),
  }
  if (exerciseIds.length === 0) return empty
  try {
    const [phaseProfiles, dosageProfiles, scalingProfiles, safetyProfiles, regimenRules] = await Promise.all([
      loadPhaseProfiles(pool, exerciseIds),
      loadSingleProfile(pool, 'exercise_dosage_profile', exerciseIds, true),
      loadSingleProfile(pool, 'exercise_scaling_profile', exerciseIds, true),
      loadSingleProfile(pool, 'exercise_safety_profile', exerciseIds, false),
      loadSingleProfile(pool, 'exercise_regimen_rule', exerciseIds, false),
    ])
    return { phaseProfiles, dosageProfiles, scalingProfiles, safetyProfiles, regimenRules }
  } catch (err) {
    if (/does not exist|undefined column/i.test(String(err.message))) {
      console.warn('[exerciseProgramming] programming tables/columns missing:', err.message)
      return empty
    }
    throw err
  }
}

function mapScalingRow(row) {
  return {
    id: row.id,
    cohort_key: row.cohort_key,
    label: row.label,
    age_min: row.age_min,
    age_max: row.age_max,
    skill_level: row.skill_level,
    scale_direction: row.scale_direction,
    sets_min: row.sets_min,
    sets_max: row.sets_max,
    reps_min: row.reps_min,
    reps_max: row.reps_max,
    work_seconds_min: row.work_seconds_min,
    work_seconds_max: row.work_seconds_max,
    rest_seconds_min: row.rest_seconds_min,
    rest_seconds_max: row.rest_seconds_max,
    load_guidance: row.load_guidance,
    height_guidance: row.height_guidance,
    distance_guidance: row.distance_guidance,
    tempo_guidance: row.tempo_guidance,
    rom_guidance: row.rom_guidance,
    complexity_guidance: row.complexity_guidance,
    impact_guidance: row.impact_guidance,
    coach_notes: row.coach_notes,
    athlete_notes: row.athlete_notes,
    contraindication_notes: row.contraindication_notes,
    requires_medical_clearance: row.requires_medical_clearance,
    gender_specific_notes: row.gender_specific_notes,
  }
}

function mapDosageRow(row) {
  return {
    profile_name: row.profile_name,
    volume_unit: row.volume_unit,
    default_sets: row.default_sets,
    default_reps: row.default_reps,
    default_work_seconds: row.default_work_seconds,
    default_rest_seconds: row.default_rest_seconds,
    est_seconds_per_set: row.est_seconds_per_set,
    session_volume_min: row.session_volume_min,
    session_volume_max: row.session_volume_max,
    weekly_volume_max: row.weekly_volume_max,
    default_rpe_min: row.default_rpe_min,
    default_rpe_max: row.default_rpe_max,
  }
}

export function buildExerciseCard(row, attached, tags = []) {
  const primary = attached.primary_phase ?? null
  const regimen = attached.regimen_rule
  const dosage = (attached.dosage_profiles ?? [])[0] ?? null
  const safety = attached.safety_profile
  const why = attached.why
  const movementReq = parseJson(row.movement_requirements)
  const coachingExec = parseJson(row.coaching_execution)
  const pairing = parseJson(row.pairing_logic)
  const mediaLib = parseJson(row.media_library)
  const scalingRows = attached.scaling_profiles ?? []
  const cohortScaling = {}
  let genderSpecificNotes = null
  for (const key of SCALING_COHORT_KEYS) {
    const found = scalingRows.find((s) => s.cohort_key === key)
    if (found) cohortScaling[key] = mapScalingRow(found)
  }
  const legacyScaling = scalingRows.filter((s) => !s.cohort_key)
  const notesRow = scalingRows.find((s) => s.gender_specific_notes)
  if (notesRow) genderSpecificNotes = notesRow.gender_specific_notes

  const taxonomy = {
    tenets: tags.filter((t) => t.facetType === 'tenet'),
    methodologies: tags.filter((t) => t.facetType === 'methodology'),
    physiology: tags.filter((t) => t.facetType === 'physiology'),
    patterns: tags.filter((t) => t.facetType === 'pattern'),
    equipment: tags.filter((t) => t.facetType === 'equipment'),
    body_regions: tags.filter((t) => t.facetType === 'body_region'),
  }

  return {
    movement_identity: {
      name: row.name,
      slug: row.slug,
      card_summary: row.card_summary,
      coach_language: row.coach_language,
      athlete_language: row.athlete_language,
      movement_family: row.movement_family,
      phase_key: row.primary_phase_key ?? primary?.phaseKey ?? null,
      phase_subrole: row.phase_subrole,
      order_slot: row.primary_order_slot ?? primary?.orderSlot ?? null,
      sport_id: row.sport_id,
      sport_name: row.sport_name,
      skill_level: row.skill_level,
      visibility: row.visibility,
    },
    movement_requirements: {
      primary_joint_actions: asStringArray(movementReq.primary_joint_actions),
      primary_tissues: asStringArray(movementReq.primary_tissues),
      primary_motor_control_demands: asStringArray(movementReq.primary_motor_control_demands),
      postural_shape: movementReq.postural_shape ?? null,
      breathing_demand: movementReq.breathing_demand ?? null,
      balance_demand: movementReq.balance_demand ?? null,
      coordination_demand: movementReq.coordination_demand ?? null,
      impact_level: movementReq.impact_level ?? primary?.impactLevel ?? safety?.impact_level ?? null,
    },
    taxonomy,
    phase_profile: primary ? {
      role: primary.role,
      fit_weight: primary.fitWeight,
      freshness_required: primary.freshnessRequired,
      fatigue_sensitivity: primary.fatigueSensitivity,
      fatigue_cost: primary.fatigueCost,
      technical_complexity: primary.technicalComplexity,
      intensity_ceiling: primary.intensityCeiling,
      daily_ok: Boolean(regimen?.can_be_daily),
      notes: primary.notes,
    } : null,
    phase_profiles: attached.phase_profiles ?? [],
    why_layer: why ? {
      training_purpose: why.training_purpose,
      why_it_works: why.why_it_works,
      phase_rationale: why.phase_rationale,
      physiological_rationale: why.physiological_rationale,
      tenet_rationale: why.tenet_rationale,
      methodology_rationale: why.methodology_rationale,
      order_rationale: why.order_rationale,
      fatigue_rationale: why.fatigue_rationale,
      scaling_rationale: why.scaling_rationale,
      common_misuse: why.common_misuse,
    } : null,
    coaching_execution: {
      movement_description: coachingExec.movement_description ?? row.description ?? null,
      setup: asStringArray(coachingExec.setup),
      execution_steps: asStringArray(coachingExec.execution_steps),
      breathing_cues: asStringArray(coachingExec.breathing_cues),
      coach_cues: asStringArray(coachingExec.coach_cues),
      athlete_cues: asStringArray(coachingExec.athlete_cues),
      quality_gate: asStringArray(coachingExec.quality_gate),
      common_faults: asStringArray(coachingExec.common_faults),
      stop_signs: asStringArray(coachingExec.stop_signs),
    },
    dosage: dosage ? {
      default_sets: dosage.default_sets ?? row.default_sets,
      default_reps: dosage.default_reps ?? row.default_reps,
      default_work_seconds: dosage.default_work_seconds ?? row.default_work_seconds,
      default_rest_seconds: dosage.default_rest_seconds ?? row.default_rest_seconds,
      volume_unit: dosage.volume_unit ?? 'reps',
      est_seconds_per_set: dosage.est_seconds_per_set ?? row.est_seconds_per_set,
      rpe_range: dosage.default_rpe_min != null || dosage.default_rpe_max != null
        ? `${dosage.default_rpe_min ?? '—'}-${dosage.default_rpe_max ?? '—'}`
        : null,
      session_volume_min: dosage.session_volume_min,
      session_volume_max: dosage.session_volume_max,
    } : {
      default_sets: row.default_sets,
      default_reps: row.default_reps,
      default_work_seconds: row.default_work_seconds,
      default_rest_seconds: row.default_rest_seconds,
      volume_unit: 'reps',
      est_seconds_per_set: row.est_seconds_per_set,
      rpe_range: null,
      session_volume_min: null,
      session_volume_max: null,
    },
    scaling: {
      scalable_variables: row.scalable_variables ?? [],
      gender_specific_notes: genderSpecificNotes,
      cohorts: cohortScaling,
      legacy_profiles: legacyScaling.map(mapScalingRow),
    },
    pairing_logic: {
      pairs_well_before: asStringArray(pairing.pairs_well_before ?? row.programming_logic?.recommended_preceded_by),
      pairs_well_after: asStringArray(pairing.pairs_well_after ?? row.programming_logic?.recommended_followed_by),
      good_for_sessions: asStringArray(pairing.good_for_sessions ?? row.programming_logic?.best_used_for),
      avoid_before: asStringArray(pairing.avoid_before),
      avoid_after: asStringArray(pairing.avoid_after),
      do_not_use_when: asStringArray(pairing.do_not_use_when ?? row.programming_logic?.avoid_when),
    },
    safety_profile: safety ? {
      risk_level: safety.risk_level,
      impact_level: safety.impact_level,
      requires_spotting: safety.requires_spotting,
      requires_supervision: safety.requires_coach_supervision,
      readiness_checks: safety.readiness_checks ?? [],
      contraindications: safety.contraindications ?? [],
      substitutions: safety.common_substitutions ?? [],
    } : null,
    media_and_document_library: {
      demo_video_sources: asStringArray(mediaLib.demo_video_sources),
      coaching_articles: asStringArray(mediaLib.coaching_articles),
      clinical_or_sport_science_references: asStringArray(mediaLib.clinical_or_sport_science_references),
      internal_notes: asStringArray(mediaLib.internal_notes),
      media: attached.media ?? [],
    },
  }
}

export function attachProgrammingToExercise(row, bundle, education = null) {
  const id = String(row.id)
  const phaseProfiles = bundle.phaseProfiles.get(id) ?? []
  const primaryPhase = pickPrimaryPhaseProfile(phaseProfiles)
  const scalingRaw = bundle.scalingProfiles.get(id) ?? []
  const dosageRaw = bundle.dosageProfiles.get(id) ?? []
  const why = educationToWhyResponse(education)

  return {
    ...row,
    card_summary: row.card_summary,
    coach_language: row.coach_language,
    athlete_language: row.athlete_language,
    movement_family: row.movement_family,
    primary_phase_key: row.primary_phase_key,
    phase_subrole: row.phase_subrole,
    primary_order_slot: row.primary_order_slot,
    movement_requirements: parseJson(row.movement_requirements),
    coaching_execution: parseJson(row.coaching_execution),
    pairing_logic: parseJson(row.pairing_logic),
    media_library: parseJson(row.media_library),
    programming_logic: row.programming_logic ?? {},
    scalable_variables: row.scalable_variables ?? [],
    why_publish_ready: row.why_publish_ready,
    phase_profiles: phaseProfiles,
    primary_phase: primaryPhase,
    dosage_profiles: dosageRaw.map(mapDosageRow),
    scaling_profiles: scalingRaw.map(mapScalingRow),
    safety_profile: bundle.safetyProfiles.get(id) ?? null,
    regimen_rule: bundle.regimenRules.get(id) ?? null,
    why,
  }
}

async function syncPrimaryIdentityFromPhases(client, exerciseId, phaseProfiles, movementRequirements, options = {}) {
  const primary = pickPrimaryPhaseProfile(phaseProfiles)
  if (!primary) return
  const req = parseJson(movementRequirements)
  if (req.impact_level == null && primary.impactLevel != null) {
    req.impact_level = primary.impactLevel
  }
  const phaseKey = primary.phaseKey ?? primary.phase_key
  const orderSlot = primary.orderSlot ?? primary.order_slot
  const subroleOverride = Boolean(options.subrole_override ?? options.subroleOverride)
  const explicitSubrole = options.phase_subrole ?? options.phaseSubrole ?? null
  const derivedSubrole = await deriveExerciseSubrole(client, primary, subroleOverride, explicitSubrole)

  await client.query(
    `UPDATE coaching.exercise SET
      primary_phase_key = $2,
      primary_order_slot = $3,
      phase_subrole = $4,
      movement_requirements = $5::jsonb,
      updated_at = now()
     WHERE id = $1`,
    [exerciseId, phaseKey ?? null, orderSlot ?? null, derivedSubrole, JSON.stringify(req)],
  )
}

async function saveExerciseCardColumns(client, exerciseId, body) {
  const identity = body.movement_identity ?? {}
  const requirements = body.movement_requirements ?? body.movement_requirements_json
  const coachingExec = body.coaching_execution
  const pairing = body.pairing_logic
  const mediaLib = body.media_library ?? body.media_and_document_library

  const updates = []
  const params = [exerciseId]
  const add = (col, val) => {
    if (val === undefined) return
    params.push(val)
    updates.push(`${col} = $${params.length}`)
  }

  add('movement_family', identity.movement_family ?? body.movement_family)
  add('primary_phase_key', identity.phase_key ?? body.primary_phase_key)
  if (body.subrole_override || identity.subrole_override) {
    add('phase_subrole', identity.phase_subrole ?? body.phase_subrole)
  }
  add('primary_order_slot', identity.order_slot ?? body.primary_order_slot)
  if (requirements != null) add('movement_requirements', JSON.stringify(requirements))
  if (coachingExec != null) add('coaching_execution', JSON.stringify(coachingExec))
  if (pairing != null) add('pairing_logic', JSON.stringify(pairing))
  if (mediaLib != null) {
    const ml = { ...mediaLib }
    delete ml.media
    add('media_library', JSON.stringify(ml))
  }
  if (body.scalable_variables != null) add('scalable_variables', body.scalable_variables)

  if (updates.length === 0) return
  updates.push('updated_at = now()')
  await client.query(`UPDATE coaching.exercise SET ${updates.join(', ')} WHERE id = $1`, params)
}

function normalizeCohortScalingRows(body) {
  const rows = []
  const scaling = body.scaling
  if (scaling && typeof scaling === 'object' && !Array.isArray(scaling)) {
    const genderNotes = scaling.gender_specific_notes ?? null
    for (const key of SCALING_COHORT_KEYS) {
      const cohort = scaling[key] ?? scaling.cohorts?.[key]
      if (!cohort || typeof cohort !== 'object') continue
      rows.push({
        cohort_key: key,
        label: cohort.label ?? key.replace(/_/g, ' '),
        ...cohort,
        gender_specific_notes: key === 'pregnancy_postpartum' ? (cohort.gender_specific_notes ?? genderNotes) : cohort.gender_specific_notes,
        requires_medical_clearance: key === 'pregnancy_postpartum'
          ? Boolean(cohort.requires_medical_clearance)
          : Boolean(cohort.requires_medical_clearance),
      })
    }
    if (genderNotes && rows.length > 0 && !rows.some((r) => r.gender_specific_notes)) {
      rows[0].gender_specific_notes = genderNotes
    }
    return rows
  }
  if (Array.isArray(body.scaling_profiles)) {
    return body.scaling_profiles.filter((s) => s.cohort_key || s.label || s.load_guidance || s.complexity_guidance)
  }
  return null
}

export async function saveExerciseProgramming(client, exerciseId, slug, body) {
  await saveExerciseCardColumns(client, exerciseId, body)

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
    await syncPrimaryIdentityFromPhases(
      client,
      exerciseId,
      body.phase_profiles,
      body.movement_requirements ?? {},
      {
        subrole_override: Boolean(body.subrole_override ?? body.movement_identity?.subrole_override),
        phase_subrole: body.movement_identity?.phase_subrole ?? body.phase_subrole,
      },
    )
  } else if (body.movement_identity?.order_slot || body.primary_order_slot) {
    const orderSlot = body.movement_identity?.order_slot ?? body.primary_order_slot
    const phaseKey = body.movement_identity?.phase_key ?? body.primary_phase_key ?? 'prepare_access'
    const subroleOverride = Boolean(body.subrole_override ?? body.movement_identity?.subrole_override)
    if (!subroleOverride && phaseKey === 'prepare_access' && orderSlot) {
      const derived = await resolveSubroleFromOrderSlot(client, phaseKey, orderSlot)
      if (derived) {
        await client.query(
          `UPDATE coaching.exercise SET phase_subrole = $2, updated_at = now() WHERE id = $1`,
          [exerciseId, derived],
        )
      }
    }
  }

  if (body.dosage_profiles?.[0] || body.dosage_profile || body.dosage) {
    const d = body.dosage_profiles?.[0] ?? body.dosage_profile ?? body.dosage
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
          weekly_volume_max = EXCLUDED.weekly_volume_max,
          default_rpe_min = EXCLUDED.default_rpe_min, default_rpe_max = EXCLUDED.default_rpe_max
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
          minimum_age_recommended, minimum_skill_level, readiness_checks, stop_signs,
          common_substitutions, contraindications
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (exercise_id) DO UPDATE SET
          risk_level = EXCLUDED.risk_level, impact_level = EXCLUDED.impact_level,
          requires_spotting = EXCLUDED.requires_spotting,
          requires_coach_supervision = EXCLUDED.requires_coach_supervision,
          minimum_age_recommended = EXCLUDED.minimum_age_recommended,
          minimum_skill_level = EXCLUDED.minimum_skill_level,
          readiness_checks = EXCLUDED.readiness_checks,
          stop_signs = EXCLUDED.stop_signs,
          common_substitutions = EXCLUDED.common_substitutions,
          contraindications = EXCLUDED.contraindications
      `,
      [
        exerciseId,
        s.risk_level ?? s.riskLevel ?? 2,
        s.impact_level ?? s.impactLevel ?? 1,
        Boolean(s.requires_spotting ?? s.requiresSpotting),
        s.requires_coach_supervision ?? s.requiresCoachSupervision ?? s.requires_supervision ?? 'recommended',
        s.minimum_age_recommended ?? s.minimumAgeRecommended,
        s.minimum_skill_level ?? s.minimumSkillLevel,
        s.readiness_checks ?? s.readinessChecks ?? [],
        s.stop_signs ?? s.stopSigns ?? [],
        s.common_substitutions ?? s.commonSubstitutions ?? s.substitutions ?? [],
        s.contraindications ?? [],
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

  const scalingRows = normalizeCohortScalingRows(body)
  if (scalingRows) {
    await client.query(`DELETE FROM coaching.exercise_scaling_profile WHERE exercise_id = $1`, [exerciseId])
    for (const s of scalingRows) {
      if (!s.cohort_key && !s.label && !s.load_guidance && !s.complexity_guidance) continue
      await client.query(
        `
          INSERT INTO coaching.exercise_scaling_profile (
            exercise_id, cohort_key, label, age_min, age_max, skill_level, scale_direction,
            sets_min, sets_max, reps_min, reps_max, work_seconds_min, work_seconds_max,
            rest_seconds_min, rest_seconds_max, load_guidance, height_guidance, distance_guidance,
            tempo_guidance, rom_guidance, complexity_guidance, impact_guidance,
            coach_notes, athlete_notes, contraindication_notes,
            requires_medical_clearance, gender_specific_notes
          ) VALUES ($1,$2,$3,$4,$5,$6::public.skill_level,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
        `,
        [
          exerciseId,
          s.cohort_key ?? null,
          s.label || s.cohort_key?.replace(/_/g, ' ') || 'Baseline',
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
          Boolean(s.requires_medical_clearance),
          s.gender_specific_notes ?? s.genderSpecificNotes ?? null,
        ],
      )
    }
  }

  if (body.why || body.education || body.why_layer) {
    const w = { ...(body.why ?? {}), ...(body.why_layer ?? {}), ...(body.education ?? {}) }
    await upsertExerciseEducation(client, exerciseId, slug, w)
  }
}

export async function validateExercisePublishReady(pool, exerciseId) {
  const issues = []
  const ex = await pool.query(
    `SELECT id, name, slug, description, est_seconds_per_set, card_summary, primary_phase_key,
            movement_requirements, coaching_execution
     FROM coaching.exercise WHERE id = $1`,
    [exerciseId],
  )
  if (ex.rows.length === 0) return { ready: false, issues: ['Exercise not found'] }
  const row = ex.rows[0]
  if (!row.name) issues.push('Name required')
  if (!row.slug) issues.push('Slug required')
  if (!row.card_summary) issues.push('Card summary required')
  if (!row.primary_phase_key) issues.push('Primary session phase required')
  if (!row.est_seconds_per_set) issues.push('Est seconds per set required')

  const req = parseJson(row.movement_requirements)
  const joints = asStringArray(req.primary_joint_actions)
  const tissues = asStringArray(req.primary_tissues)
  if (joints.length === 0 && tissues.length === 0) {
    issues.push('At least one joint action or tissue in movement requirements')
  }

  const exec = parseJson(row.coaching_execution)
  if (asStringArray(exec.setup).length === 0) issues.push('Coaching execution: setup steps required')
  if (asStringArray(exec.execution_steps).length === 0) issues.push('Coaching execution: execution steps required')

  const tags = await pool.query(`SELECT facet_type FROM coaching.exercise_tag WHERE exercise_id = $1`, [exerciseId])
  const types = new Set(tags.rows.map((t) => t.facet_type))
  for (const reqFacet of ['tenet', 'methodology', 'physiology', 'pattern', 'equipment']) {
    if (!types.has(reqFacet)) issues.push(`Missing ${reqFacet} tag`)
  }

  const phases = await pool.query(`SELECT 1 FROM coaching.exercise_phase_profile WHERE exercise_id = $1 LIMIT 1`, [exerciseId])
  if (phases.rows.length === 0) issues.push('At least one phase profile required')

  const dosage = await pool.query(
    `SELECT volume_unit, est_seconds_per_set FROM coaching.exercise_dosage_profile WHERE exercise_id = $1 AND profile_name = 'Default' LIMIT 1`,
    [exerciseId],
  )
  if (dosage.rows.length === 0 || !dosage.rows[0].est_seconds_per_set) {
    issues.push('Default dosage profile with est seconds per set required')
  }

  const scaling = await pool.query(
    `SELECT cohort_key FROM coaching.exercise_scaling_profile WHERE exercise_id = $1 AND cohort_key IS NOT NULL`,
    [exerciseId],
  )
  const cohorts = new Set(scaling.rows.map((r) => r.cohort_key))
  for (const key of REQUIRED_SCALING_COHORTS) {
    if (!cohorts.has(key)) issues.push(`Missing scaling cohort: ${key.replace(/_/g, ' ')}`)
  }

  const safety = await pool.query(
    `SELECT risk_level, readiness_checks FROM coaching.exercise_safety_profile WHERE exercise_id = $1`,
    [exerciseId],
  )
  if (safety.rows.length === 0) {
    issues.push('Safety profile required')
  } else {
    if (safety.rows[0].risk_level == null) issues.push('Safety risk level required')
    const checks = safety.rows[0].readiness_checks ?? []
    if (!Array.isArray(checks) || checks.length === 0) issues.push('Safety readiness checks required')
  }

  const edu = await loadEducationForExercise(pool, exerciseId)
  if (!edu?.what_it_is) issues.push('Why layer: training purpose required')
  if (!edu?.why_it_goes_here) issues.push('Why layer: phase rationale required')
  if (!edu?.common_misuse) issues.push('Why layer: common misuse required')

  return { ready: issues.length === 0, issues }
}

export { loadEducationForExercise, educationToWhyResponse, buildExerciseCard as exerciseToCardJson }
