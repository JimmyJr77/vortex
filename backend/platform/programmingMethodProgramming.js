import { normalizePhaseKey } from './sessionPhaseKeys.js'

function parseJson(val, fallback = {}) {
  if (val == null) return fallback
  if (typeof val === 'object') return val
  try {
    return JSON.parse(val)
  } catch {
    return fallback
  }
}

export const PROGRAMMING_CATEGORIES = [
  'timed_work_capacity',
  'interval_training',
  'hiit',
  'emom_amrap_density',
  'circuit_training',
  'density_blocks',
  'tempo_conditioning',
  'repeat_sprint_shuttle',
  'aerobic_base',
  'mixed_modal',
  'partner_team_relay',
  'game_based',
  'recovery_restoration',
]

export const EXERCISE_COMPATIBILITY_TYPES = [
  'locomotion', 'shuttle', 'sprint', 'low_amplitude_elastic', 'jump_rope',
  'bodyweight_strength', 'loaded_strength', 'carry', 'crawl', 'grip_hang',
  'med_ball', 'low_skill_calisthenics', 'machine_cardio', 'mobility_flow',
  'partner_drill', 'game', 'tumbling', 'advanced_skill', 'high_impact_plyometrics',
]

export async function loadProgrammingMethodBundle(pool, ids) {
  const empty = {
    phaseProfiles: new Map(),
    prescriptions: new Map(),
    compat: new Map(),
    qualityStandards: new Map(),
    stopRules: new Map(),
    validatorRules: new Map(),
    examples: new Map(),
  }
  if (!ids?.length) return empty
  const [phaseProfiles, prescriptions, compat, qualityStandards, stopRules, validatorRules, examples] = await Promise.all([
    pool.query(`SELECT * FROM coaching.programming_method_phase_profile WHERE programming_method_id = ANY($1::bigint[]) ORDER BY fit_weight DESC`, [ids]),
    pool.query(`SELECT * FROM coaching.programming_method_prescription_profile WHERE programming_method_id = ANY($1::bigint[])`, [ids]),
    pool.query(`SELECT * FROM coaching.programming_method_exercise_compatibility WHERE programming_method_id = ANY($1::bigint[])`, [ids]),
    pool.query(`SELECT * FROM coaching.programming_method_quality_standard WHERE programming_method_id = ANY($1::bigint[])`, [ids]),
    pool.query(`SELECT * FROM coaching.programming_method_stop_rule WHERE programming_method_id = ANY($1::bigint[])`, [ids]),
    pool.query(`SELECT * FROM coaching.programming_method_validator_rule WHERE programming_method_id = ANY($1::bigint[])`, [ids]),
    pool.query(`SELECT * FROM coaching.programming_method_example WHERE programming_method_id = ANY($1::bigint[])`, [ids]),
  ])
  const toMap = (rows, multi = true) => {
    const map = new Map()
    for (const row of rows) {
      const key = String(row.programming_method_id)
      if (multi) {
        const list = map.get(key) ?? []
        list.push(row)
        map.set(key, list)
      } else {
        map.set(key, row)
      }
    }
    return map
  }
  return {
    phaseProfiles: toMap(phaseProfiles.rows),
    prescriptions: toMap(prescriptions.rows),
    compat: toMap(compat.rows),
    qualityStandards: toMap(qualityStandards.rows),
    stopRules: toMap(stopRules.rows),
    validatorRules: toMap(validatorRules.rows),
    examples: toMap(examples.rows),
  }
}

export function attachProgrammingMethod(row, bundle) {
  const id = String(row.id)
  const phaseProfiles = (bundle.phaseProfiles.get(id) ?? []).map((p) => ({
    phaseKey: normalizePhaseKey(p.phase_key) ?? p.phase_key,
    role: p.role,
    fitWeight: Number(p.fit_weight),
    phaseRationale: p.phase_rationale,
    fatigueRationale: p.fatigue_rationale,
    orderRationale: p.order_rationale,
    riskNote: p.risk_note,
  }))
  return {
    ...row,
    secondary_development_goals: row.secondary_development_goals ?? [],
    compatible_session_phases: row.compatible_session_phases ?? [],
    incompatible_phases: row.incompatible_phases ?? [],
    energy_system_focus: row.energy_system_focus ?? [],
    common_misuse: row.common_misuse ?? [],
    fatigue_profile: parseJson(row.fatigue_profile),
    work_rest_structure: parseJson(row.work_rest_structure),
    exercise_compatibility: parseJson(row.exercise_compatibility),
    scaling: parseJson(row.scaling),
    progression_logic: parseJson(row.progression_logic),
    regression_logic: parseJson(row.regression_logic),
    workout_builder_rules: parseJson(row.workout_builder_rules),
    phase_profiles: phaseProfiles,
    prescriptions: bundle.prescriptions.get(id) ?? [],
    exercise_compat_rows: bundle.compat.get(id) ?? [],
    quality_standards: (bundle.qualityStandards.get(id) ?? []).map((q) => ({
      standard: q.standard,
      severity: q.severity,
      appliesToExerciseType: q.applies_to_exercise_type,
    })),
    stop_rules: (bundle.stopRules.get(id) ?? []).map((s) => ({
      stopRule: s.stop_rule,
      severity: s.severity,
      appliesTo: s.applies_to,
    })),
    validator_rules: (bundle.validatorRules.get(id) ?? []).map((v) => ({
      ruleKey: v.rule_key,
      conditionJson: parseJson(v.condition_json),
      message: v.message,
      severity: v.severity,
      recommendedAction: v.recommended_action,
    })),
    example_implementations: (bundle.examples.get(id) ?? []).map((e) => ({
      label: e.label,
      audience: e.audience,
      exampleJson: parseJson(e.example_json),
      coachingNotes: e.coaching_notes,
      disclaimer: e.disclaimer,
    })),
  }
}

export function buildProgrammingCard(row, attached) {
  const fp = attached.fatigue_profile ?? {}
  return {
    identity: {
      name: row.name,
      slug: row.slug,
      category: row.category,
      definition: row.definition,
      coachSummary: row.coach_summary,
      athleteSummary: row.athlete_summary,
      primaryDevelopmentGoal: row.primary_development_goal,
      secondaryDevelopmentGoals: attached.secondary_development_goals,
    },
    classification: {
      programmingType: row.programming_type,
      bestSessionPhase: normalizePhaseKey(row.best_session_phase) ?? row.best_session_phase,
      compatibleSessionPhases: (attached.compatible_session_phases ?? []).map((k) => normalizePhaseKey(k) ?? k),
      incompatibleOrHighRiskPhases: (attached.incompatible_phases ?? []).map((k) => normalizePhaseKey(k) ?? k),
      primaryDevelopmentGoal: row.primary_development_goal,
      secondaryDevelopmentGoals: attached.secondary_development_goals,
      energySystemFocus: attached.energy_system_focus,
      fatigueProfile: fp,
      supervisionLevel: row.supervision_level,
    },
    education: {
      whatItIs: row.what_it_is,
      whyItMatters: row.why_it_matters,
      whenToUse: row.when_to_use,
      whenNotToUse: row.when_not_to_use,
      commonMisuse: attached.common_misuse,
    },
    workRestStructure: attached.work_rest_structure,
    exerciseCompatibility: attached.exercise_compatibility,
    scaling: attached.scaling,
    progressionLogic: attached.progression_logic,
    regressionLogic: attached.regression_logic,
    qualityStandards: attached.quality_standards,
    stopRules: attached.stop_rules,
    validatorRules: attached.validator_rules,
    exampleImplementations: attached.example_implementations,
    phaseProfiles: attached.phase_profiles,
    prescriptions: attached.prescriptions,
    workoutBuilderRules: attached.workout_builder_rules,
  }
}

export async function validateProgrammingMethodPublishReady(pool, id) {
  const issues = []
  const row = await pool.query(`SELECT * FROM coaching.programming_method WHERE id = $1 AND archived = FALSE`, [id])
  if (row.rows.length === 0) return { ready: false, issues: ['Programming method not found.'] }
  const method = row.rows[0]
  if (!method.name?.trim()) issues.push('Name is required.')
  if (!method.category?.trim()) issues.push('Category is required.')
  if (!method.best_session_phase) issues.push('Best session phase is required.')
  const [qs, sr, rx] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS c FROM coaching.programming_method_quality_standard WHERE programming_method_id = $1`, [id]),
    pool.query(`SELECT COUNT(*)::int AS c FROM coaching.programming_method_stop_rule WHERE programming_method_id = $1`, [id]),
    pool.query(`SELECT COUNT(*)::int AS c FROM coaching.programming_method_prescription_profile WHERE programming_method_id = $1`, [id]),
  ])
  if (qs.rows[0].c < 3) issues.push('At least 3 quality standards required.')
  if (sr.rows[0].c < 3) issues.push('At least 3 stop rules required.')
  if (rx.rows[0].c < 1) issues.push('At least 1 prescription profile required.')
  return { ready: issues.length === 0, issues }
}

async function replaceChildRows(client, table, methodId, rows, columns, mapRow) {
  await client.query(`DELETE FROM coaching.${table} WHERE programming_method_id = $1`, [methodId])
  for (const row of rows ?? []) {
    const mapped = mapRow(row)
    const vals = columns.map((c) => mapped[c])
    const placeholders = columns.map((_, i) => `$${i + 2}`).join(', ')
    await client.query(
      `INSERT INTO coaching.${table} (programming_method_id, ${columns.join(', ')}) VALUES ($1, ${placeholders})`,
      [methodId, ...vals],
    )
  }
}

export async function saveProgrammingMethod(client, id, body) {
  const fatigueProfile = body.fatigue_profile ?? body.classification?.fatigueProfile ?? {}
  const workRest = body.work_rest_structure ?? body.workRestStructure ?? {}
  const exerciseCompat = body.exercise_compatibility ?? body.exerciseCompatibility ?? {}
  const wbr = body.workout_builder_rules ?? body.workoutBuilderRules ?? {}

  await client.query(
    `
      UPDATE coaching.programming_method SET
        name = COALESCE($2, name),
        category = COALESCE($3, category),
        definition = COALESCE($4, definition),
        coach_summary = COALESCE($5, coach_summary),
        athlete_summary = COALESCE($6, athlete_summary),
        primary_development_goal = COALESCE($7, primary_development_goal),
        secondary_development_goals = COALESCE($8, secondary_development_goals),
        programming_type = COALESCE($9, programming_type),
        best_session_phase = COALESCE($10, best_session_phase),
        compatible_session_phases = COALESCE($11, compatible_session_phases),
        incompatible_phases = COALESCE($12, incompatible_phases),
        energy_system_focus = COALESCE($13, energy_system_focus),
        fatigue_profile = COALESCE($14::jsonb, fatigue_profile),
        supervision_level = COALESCE($15, supervision_level),
        what_it_is = COALESCE($16, what_it_is),
        why_it_matters = COALESCE($17, why_it_matters),
        when_to_use = COALESCE($18, when_to_use),
        when_not_to_use = COALESCE($19, when_not_to_use),
        common_misuse = COALESCE($20, common_misuse),
        work_rest_structure = COALESCE($21::jsonb, work_rest_structure),
        exercise_compatibility = COALESCE($22::jsonb, exercise_compatibility),
        scaling = COALESCE($23::jsonb, scaling),
        progression_logic = COALESCE($24::jsonb, progression_logic),
        regression_logic = COALESCE($25::jsonb, regression_logic),
        workout_builder_rules = COALESCE($26::jsonb, workout_builder_rules),
        updated_at = now()
      WHERE id = $1
    `,
    [
      id,
      body.name,
      body.category,
      body.definition,
      body.coach_summary ?? body.coachSummary,
      body.athlete_summary ?? body.athleteSummary,
      body.primary_development_goal ?? body.primaryDevelopmentGoal,
      body.secondary_development_goals ?? body.secondaryDevelopmentGoals,
      body.programming_type ?? body.programmingType,
      normalizePhaseKey(body.best_session_phase ?? body.bestSessionPhase),
      body.compatible_session_phases ?? body.compatibleSessionPhases,
      body.incompatible_phases ?? body.incompatiblePhases,
      body.energy_system_focus ?? body.energySystemFocus,
      JSON.stringify(fatigueProfile),
      body.supervision_level ?? body.supervisionLevel,
      body.what_it_is ?? body.whatItIs,
      body.why_it_matters ?? body.whyItMatters,
      body.when_to_use ?? body.whenToUse,
      body.when_not_to_use ?? body.whenNotToUse,
      body.common_misuse ?? body.commonMisuse,
      JSON.stringify(workRest),
      JSON.stringify(exerciseCompat),
      JSON.stringify(body.scaling ?? {}),
      JSON.stringify(body.progression_logic ?? body.progressionLogic ?? {}),
      JSON.stringify(body.regression_logic ?? body.regressionLogic ?? {}),
      JSON.stringify(wbr),
    ],
  )

  await replaceChildRows(client, 'programming_method_phase_profile', id, body.phase_profiles ?? body.phaseProfiles, [
    'phase_key', 'role', 'fit_weight', 'phase_rationale', 'fatigue_rationale', 'order_rationale', 'risk_note',
  ], (p) => ({
    phase_key: normalizePhaseKey(p.phase_key ?? p.phaseKey),
    role: p.role ?? 'conditional',
    fit_weight: p.fit_weight ?? p.fitWeight ?? 3,
    phase_rationale: p.phase_rationale ?? p.phaseRationale ?? null,
    fatigue_rationale: p.fatigue_rationale ?? p.fatigueRationale ?? null,
    order_rationale: p.order_rationale ?? p.orderRationale ?? null,
    risk_note: p.risk_note ?? p.riskNote ?? null,
  }))

  await replaceChildRows(client, 'programming_method_prescription_profile', id, body.prescriptions, [
    'profile_name', 'age_min', 'age_max', 'skill_level', 'default_total_minutes', 'default_rounds',
    'default_work_seconds', 'default_rest_seconds', 'default_rest_between_rounds_seconds',
    'default_station_seconds', 'default_cap_minutes', 'default_rpe_min', 'default_rpe_max',
    'default_heart_rate_zone', 'notes',
  ], (p) => ({
    profile_name: p.profile_name ?? p.profileName,
    age_min: p.age_min ?? p.ageMin ?? null,
    age_max: p.age_max ?? p.ageMax ?? null,
    skill_level: p.skill_level ?? p.skillLevel ?? null,
    default_total_minutes: p.default_total_minutes ?? p.defaultTotalMinutes ?? null,
    default_rounds: p.default_rounds ?? p.defaultRounds ?? null,
    default_work_seconds: p.default_work_seconds ?? p.defaultWorkSeconds ?? null,
    default_rest_seconds: p.default_rest_seconds ?? p.defaultRestSeconds ?? null,
    default_rest_between_rounds_seconds: p.default_rest_between_rounds_seconds ?? p.defaultRestBetweenRoundsSeconds ?? null,
    default_station_seconds: p.default_station_seconds ?? p.defaultStationSeconds ?? null,
    default_cap_minutes: p.default_cap_minutes ?? p.defaultCapMinutes ?? null,
    default_rpe_min: p.default_rpe_min ?? p.defaultRpeMin ?? null,
    default_rpe_max: p.default_rpe_max ?? p.defaultRpeMax ?? null,
    default_heart_rate_zone: p.default_heart_rate_zone ?? p.defaultHeartRateZone ?? null,
    notes: p.notes ?? null,
  }))
}

export function programmingMethodSummary(row, attached) {
  const wbr = attached?.workout_builder_rules ?? parseJson(row.workout_builder_rules)
  const wr = attached?.work_rest_structure ?? parseJson(row.work_rest_structure)
  const fp = attached?.fatigue_profile ?? parseJson(row.fatigue_profile)
  const rx = attached?.prescriptions?.find?.((p) => p.profile_name === 'intermediate')
    ?? attached?.prescriptions?.[0]
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    definition: row.definition,
    coach_summary: row.coach_summary,
    best_session_phase: normalizePhaseKey(row.best_session_phase) ?? row.best_session_phase,
    compatible_session_phases: row.compatible_session_phases ?? [],
    energy_system_focus: row.energy_system_focus ?? [],
    fatigue_level: fp.fatigue_level ?? 'moderate',
    technical_risk_under_fatigue: fp.technical_risk_under_fatigue ?? 'moderate',
    group_friendly: wbr.group_friendly ?? false,
    requires_timer: wbr.requires_timer ?? true,
    sample_work_rest: rx
      ? `${rx.default_work_seconds ?? '—'}s work / ${rx.default_rest_seconds ?? '—'}s rest`
      : wr.recommended_density ?? null,
    why_preview: row.why_it_matters?.slice(0, 120) ?? row.coach_summary?.slice(0, 120),
  }
}
