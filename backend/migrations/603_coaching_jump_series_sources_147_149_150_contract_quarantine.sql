-- These names omit defining contact and workload contracts.  A rebound broad
-- jump, continuous skater bound, and split/scissor jump each require explicit
-- takeoff/landing, direction, continuity, arm, reset, impact, and dose rules.
DO $jump_series_quarantine$
DECLARE source_record RECORD;
BEGIN
  FOR source_record IN
    SELECT * FROM (VALUES
      (147, 'single-broad-jump-to-rebound', 'Single Broad Jump to Rebound Contract Quarantine — Source 147', 'takeoff_laterality_rebound_direction_amplitude_contact_target_landing_reset_impact_cap_dosage_load_and_fatigue_are_unspecified'),
      (149, 'skater-bound-continuous', 'Skater Bound Continuous Contract Quarantine — Source 149', 'takeoff_and_landing_leg_sequence_projection_distance_direction_arm_policy_continuity_reset_impact_cap_dosage_load_and_fatigue_are_unspecified'),
      (150, 'split-jump-scissor-jump', 'Split Jump / Scissor Jump Identity Quarantine — Source 150', 'split_jump_vs_scissor_jump_start_stance_leg_switch_height_direction_landing_reset_impact_cap_dosage_load_and_fatigue_are_conflated')
    ) AS source_data(legacy_id, slug_value, display_value, unresolved_value)
  LOOP
    UPDATE coaching.exercise_variant_v1 v
    SET variant_key='identity-quarantine-source-' || source_record.legacy_id,
        display_name=source_record.display_value,status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',source_record.unresolved_value),
        difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,
        programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    FROM coaching.exercise_definition_v1 d
    WHERE v.definition_id=d.id AND d.facility_id=1 AND d.legacy_exercise_id=source_record.legacy_id AND d.slug=source_record.slug_value AND v.variant_key='baseline';
    UPDATE coaching.exercise_definition_v1 d
    SET status='archived',card_version=card_version+1,
        provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE d.facility_id=1 AND d.legacy_exercise_id=source_record.legacy_id AND d.slug=source_record.slug_value;
  END LOOP;
END;
$jump_series_quarantine$;
