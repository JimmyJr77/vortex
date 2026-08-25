-- Source 143 lacks one exact hurdle-hop contract.  Also replace legacy
-- proficiency-like readiness language in reviewed jump cards with contextual
-- task, logistics, symptom, and cumulative-budget checks.
DO $source_143_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT d.id INTO definition_id_value
  FROM coaching.exercise_definition_v1 d
  JOIN coaching.exercise_definition_source_v1 source ON source.definition_id=d.id
  WHERE d.facility_id=1 AND d.slug='low-hurdle-hops' AND source.legacy_exercise_id=143;
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 143 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-143',display_name='Low-Hurdle Hops Contract Quarantine — Source 143',status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','hurdle_count_height_spacing_takeoff_stance_direction_cadence_arm_policy_reset_rule_impact_cap_dosage_load_and_fatigue_are_unspecified'),
    difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only') WHERE id=definition_id_value;
END;
$source_143_quarantine$;

UPDATE coaching.exercise_variant_v1 v
SET requirements_json=jsonb_set(
      coalesce(v.requirements_json,'{}'::JSONB),
      '{readiness}',
      jsonb_build_array('safe_declared_platform_or_start_surface_and_clear_landing_run_out','can_follow_the_exact_declared_entry_contact_and_exit_sequence','current_symptoms_surface_contact_and_cumulative_impact_budgets_fit'),
      true
    ) || jsonb_build_object('exerciseCardDoesNotClassifyParticipants',true)
FROM coaching.exercise_definition_v1 d
WHERE v.definition_id=d.id
  AND d.facility_id=1
  AND d.slug='drop-jump'
  AND v.variant_key='baseline';

UPDATE coaching.exercise_variant_v1 v
SET requirements_json=jsonb_set(
      coalesce(v.requirements_json,'{}'::JSONB),
      '{readiness}',
      jsonb_build_array('safe_declared_floor_landing_surface_and_clearance','can_follow_the_exact_static_start_vertical_takeoff_and_controlled_landing_sequence','current_symptoms_surface_contact_and_cumulative_impact_budgets_fit'),
      true
    ) || jsonb_build_object('exerciseCardDoesNotClassifyParticipants',true)
FROM coaching.exercise_definition_v1 d
WHERE v.definition_id=d.id
  AND d.facility_id=1
  AND d.slug='squat-jump'
  AND v.variant_key='baseline';
