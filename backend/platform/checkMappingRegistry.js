/**
 * Maps requirement keys to evaluator check_ids.
 * Used by requirementsContract and evaluatorVerdict.
 */

export const REQUIREMENT_CHECK_MAP = {
  durationMinutes: [
    'phase_plan_minute_sum_mos',
    'session_minutes_sum',
    'phase_minutes_exact',
    'session_est_minutes_delta',
  ],
  phasePlan: [
    'phase_count_match',
    'phase_key_set_equality',
    'canonical_phase_order',
    'phase_label_parity',
    'phase_minutes_exact',
    'block_index_order',
    'phase_plan_keys_canonical',
  ],
  focusTargets: [
    'focus_targets_count_parity',
    'focus_targets_field_parity',
    'focus_weight_sum_sanity',
    'focus_targets_dropped',
    'focus_weight_ignored',
    'category15_mos_focus_resolvable',
    'category15_mos_focus_weight_range',
    'category15_mop_focus_transform_preserved',
  ],
  workMode: [
    'work_mode_echo',
    'work_mode_valid_enum',
    'exercise_kind_purity',
    'programming_kind_matches_work_mode',
  ],
  sportId: [
    'sport_id_preflight',
    'sport_id_alignment',
    'wrong_sport_id_output_top5',
    'football_baseball_slug_zero',
  ],
  audience: [
    'audience_age_range',
    'audience_inputs_valid',
    'audience_cap_overall',
    'audience_cap_technical_load',
    'audience_implied_skill_level',
    'audience_scaling_cohort',
    'audience_recommended_age_overlap',
    'audience_max_complexity_cap',
    'primary_over_cap_count',
  ],
  audienceSplits: [
    'audience_split_count_parity',
    'split_label_parity',
    'split_age_band_parity',
    'split_cap_parity',
    'per_split_completeness',
    'split_missing_variant_count',
    'split1_cap_adherence',
    'split2_cap_adherence',
    'split_age_coverage',
    'per_split_label_valid',
    'per_split_difficulty_cap_echo',
    'audience_splits_mos_valid',
    'split_missing_high_intent',
  ],
  equipmentUse: [
    'equipment_use_coverage',
    'equipment_use_ids_present',
    'equipment_use_mode_enforcement',
    'equipment_items_per_key',
    'equipment_phase_distribution',
    'equipment_variant_use_filter',
    'equipment_high_intent_share',
    'equipment_use_ids_resolvable',
    'equipment_use_feasible',
    'equipment_use_avoid_overlap',
    'equipment_token_use_guard',
  ],
  equipmentAvoid: [
    'prescription_equipment_avoid_clean',
    'equipment_avoid_id_expansion',
    'equipment_avoid_exclusions_logged',
    'equipment_avoid_id_parity',
    'restore_equipment_avoid_clean',
    'semantic_avoid_false_negative',
    'equipment_avoid_phase_pool_empty',
    'equipment_avoid_ids_resolvable',
    'equipment_avoid_restore_feasible',
    'equipment_avoid_use_overlap',
  ],
  exerciseAvoid: [
    'exercise_avoid_ids_honored',
    'exercise_avoid_slugs_honored',
    'body_region_exclusion_honored',
    'body_region_avoid_count_plausible',
    'per_split_avoid_consistency',
    'avoid_exercise_slugs_resolvable',
    'body_region_exclude_id_valid',
    'body_region_pool_feasibility',
    'exercise_avoid_leak',
    'body_region_over_prune_mor',
    'diversity_family_mor_guard',
    'avoid_use_joint_feasibility',
  ],
  phaseIntent: [
    'output_speed_tenet_match',
    'output_focus_score_honored',
    'sustained_hiit_methodology_share',
    'sustained_strict_hiit_gate',
    'hiit_not_leaked_other_phases',
    'category15_mop_phase_profile_role',
    'output_speed_tenet_frequency',
    'category15_mop_methodology_key_resolution',
    'focus_targets_dropped',
    'hiit_in_low_intent_phases',
    'focus_weight_ignored',
  ],
  phaseRole: [
    'no_progression_prepare_and_access',
    'no_progression_movement_intelligence',
    'no_progression_sustained_capacity',
    'no_progression_restore',
    'phase_profile_role_not_avoid',
    'phase_primary_role_alignment',
    'restore_no_output_primary',
    'sustained_primary_containment',
    'prepare_impact_ceiling',
    'prepare_methodology_gate',
    'mi_heavy_load_youth',
    'programming_kind_matches_work_mode',
    'low_intent_difficulty_ceiling',
    'capacity_primary_low_intent_leak',
    'resilience_primary_containment',
    'youth_output_primary_low_intent',
  ],
  youthSafety: [
    'mi_no_handstand_youth',
    'youth_mi_pool_filter',
    'youth_recommended_age_min',
    'youth_recommended_age_max',
    'mi_attention_demand_ceiling',
    'youth_beginner_excluded_slugs',
    'youth_scaling_cohort',
    'youth_mi_technical_share',
    'youth_inversion_non_mi',
    'youth_prepare_mi_impact_ceiling',
    'youth_medical_clearance',
    'youth_mi_load_ceiling',
    'split1_cap_adherence',
    'youth_advanced_skill_level',
    'youth_high_intent_minutes',
    'youth_split1_output_plyo_density',
    'youth_unsupervised_high_risk',
  ],
  warnings: [
    'session_age_fit_warnings',
    'split_variant_warnings',
    'age_fit_warning_dimensions',
    'warnings_split_scaling_required',
    'warnings_split_missing_variant',
    'age_fit_warnings_consistency',
    'age_fit_false_session_cap_warnings',
    'warnings_no_duplicate_strings',
    'warnings_taxonomy_complete',
    'warnings_missing_high_intent_mor',
    'warnings_fatigue_classes',
  ],
  feasibility: [
    'feasibility_prescribe_success',
    'feasibility_no_unsatisfiable_equipment',
    'feasibility_no_equipment_avoid_violation',
    'feasibility_no_crash',
    'all_blocks_nonempty',
    'constraint_report_present',
    'feasibility_critical_phases_filled',
    'feasibility_requirements_parseable',
    'feasibility_equipment_use_ids_resolvable',
    'feasibility_equipment_avoid_ids_resolvable',
    'feasibility_output_nonempty',
  ],
  constraintReport: [
    'no_empty_phases',
    'all_blocks_nonempty',
    'constraint_no_severe_underfill',
    'constraint_phase_fill_complete',
    'constraint_pool_size_floor',
    'constraint_pool_empty_mislabel',
    'constraint_equipment_avoid_report',
    'constraint_exercise_avoid_report',
    'constraint_body_region_avoid_report',
    'constraint_report_schema',
    'constraint_fill_pct_reconcile',
    'constraint_pool_empty_iff_zero',
    'constraint_filtered_when_pool_positive',
    'constraint_silent_pool_empty_mor',
    'constraint_mislabeled_pool_empty_mor',
    'category20_kpi',
  ],
  doseProgramming: [
    'item_sets_present',
    'item_rest_present',
    'format_time_reconciliation',
    'format_rest_zero_honored',
    'format_work_seconds_timed',
    'selection_rationale_coverage',
    'placement_rationale_coverage',
    'item_score_populated',
    'item_phase_fit_present',
    'format_dose_reconciliation_mor',
    'format_item_dominance_mor',
  ],
  sessionObjective: ['session_objective_echo'],
  skillLevel: ['audience_implied_skill_level', 'audience_inputs_valid'],
  restore: ['restore_non_empty', 'restore_no_pool_empty', 'restore_fill_band', 'category1_moe_restore_last'],
  capsOverride: ['audience_cap_overall', 'audience_cap_technical_load'],
  pinnedPrepare: ['pinned_prepare_first', 'phase_minutes_exact', 'block_index_order'],
  splitCaps: ['split1_cap_adherence', 'split2_cap_adherence', 'per_split_difficulty_cap_echo', 'split_cap_parity'],
  avoidTokens: ['avoid_use_joint_feasibility', 'exercise_avoid_leak'],
  equipmentUsePolicy: ['equipment_use_mode_enforcement', 'equipment_use_coverage'],
  overCapExclusion: ['primary_over_cap_count', 'audience_cap_overall', 'split1_cap_adherence', 'split2_cap_adherence'],
  stretchRestriction: [
    'stretch_primaries_prepare_and_access',
    'stretch_primaries_movement_intelligence',
    'stretch_primaries_output',
    'stretch_primaries_capacity',
    'stretch_primaries_resilience',
  ],
  highArousalRestore: ['restore_high_arousal_after_sustained_conditioning', 'restore_no_output_primary', 'category3_moe_arousal_downshift'],
  emptyPhase: ['no_empty_phases', 'all_blocks_nonempty', 'restore_non_empty', 'feasibility_critical_phases_filled'],
  silentPartialFailure: ['category20_moe_underfill_masking', 'no_underfill_reasons', 'constraint_no_severe_underfill'],
  phaseIntentPolicy: ['output_speed_tenet_match', 'sustained_strict_hiit_gate', 'hiit_not_leaked_other_phases'],
}

const REVERSE_INDEX = new Map()
for (const [reqKey, checkIds] of Object.entries(REQUIREMENT_CHECK_MAP)) {
  for (const checkId of checkIds) {
    const list = REVERSE_INDEX.get(checkId) ?? []
    list.push(reqKey)
    REVERSE_INDEX.set(checkId, list)
  }
}

export function getChecksForRequirement(requirementKey) {
  return [...(REQUIREMENT_CHECK_MAP[requirementKey] ?? [])]
}

export function getRequirementKeysForCheck(checkId) {
  return [...(REVERSE_INDEX.get(checkId) ?? [])]
}

/**
 * @param {string} requirementKey
 * @param {object} [metricsCatalog]
 */
export function resolveCheckIdsForRequirement(requirementKey, metricsCatalog = null) {
  const ids = getChecksForRequirement(requirementKey)
  if (!metricsCatalog?.all_metrics) return ids
  const known = new Set()
  for (const m of metricsCatalog.all_metrics) {
    const cid = String(m.check_id ?? '').trim()
    if (cid) known.add(cid)
    if (Array.isArray(m.check_ids)) m.check_ids.forEach((id) => known.add(id))
    if (cid.includes(',')) cid.split(',').map((s) => s.trim()).forEach((id) => known.add(id))
  }
  return ids.filter((id) => known.has(id) || !metricsCatalog)
}
