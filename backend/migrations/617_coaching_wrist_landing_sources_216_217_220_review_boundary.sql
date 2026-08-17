-- Source 216 is a coach-selected multi-drill menu, not one exercise identity;
-- route it to skill-library review.  Sources 217 and 220 have insufficient
-- landing, amplitude, dose, and stop-rule contracts for automatic selection.
DO $wrist_landing_sources_216_217_220_review_boundary$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[216, 217, 220]
  LOOP
    SELECT source.definition_id INTO definition_id_value
    FROM coaching.exercise_definition_source_v1 source
    WHERE source.legacy_exercise_id=source_id_value
    LIMIT 1;
    IF definition_id_value IS NULL THEN
      RAISE EXCEPTION 'Source % canonical definition missing', source_id_value;
    END IF;

    UPDATE coaching.exercise_variant_v1
    SET variant_key=CASE WHEN source_id_value=216 THEN 'skill-library-boundary-source-216' ELSE 'identity-quarantine-source-' || source_id_value END,
        display_name=CASE WHEN source_id_value=216 THEN 'Wrist / Forearm Capacity Series — Skill-Library Review Required' ELSE 'Landing Contract Quarantine — Source ' || source_id_value END,
        status='archived',
        requirements_json=jsonb_build_object(
          'selectable',false,
          'identityQuarantine',source_id_value<>216,
          'skillLibraryBoundary',source_id_value=216,
          'requiresSkillLibraryReview',source_id_value=216,
          'exerciseCardDoesNotClassifyParticipants',true,
          'unresolvedContract',CASE source_id_value
            WHEN 216 THEN 'multi_drill_menu_selection_symptom_context_individual_exercise_identity_dose_load_fatigue_and_progression_are_coach_selected'
            WHEN 217 THEN 'drop_height_foot_start_position_descent_speed_depth_hold_standard_dose_stop_rule_and_cumulative_impact_budget_are_unspecified'
            WHEN 220 THEN 'hop_amplitude_start_distance_arm_policy_landing_standard_hold_dose_stop_rule_and_cumulative_impact_budget_are_unspecified'
          END),
        difficulty_json='{}'::JSONB,
        load_profile_json='{}'::JSONB,
        fatigue_profile_json='{}'::JSONB,
        programming_profile_json=jsonb_build_object(
          'selectable',false,
          'humanReviewRequired',true,
          'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';

    UPDATE coaching.exercise_definition_v1
    SET status='archived',
        card_version=card_version+1,
        provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
          'sourceDisposition',CASE WHEN source_id_value=216 THEN 'skill_library_boundary' ELSE 'identity_quarantine' END,
          'humanReviewRequired',true,
          'approvalsCreated',false,
          'publicationQuarantined',true,
          'exerciseCardDoesNotClassifyParticipants',true,
          'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$wrist_landing_sources_216_217_220_review_boundary$;
