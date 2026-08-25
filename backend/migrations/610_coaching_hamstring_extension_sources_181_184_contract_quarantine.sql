-- These active legacy baselines lack exact operational contracts.  Back
-- extension and hip extension differ in support geometry and primary action.
DO $hamstring_extension_quarantine$
DECLARE source_record RECORD;
BEGIN
  FOR source_record IN
    SELECT * FROM (VALUES
      (181, 'good-morning-light-technical', 'Good Morning Contract Quarantine — Source 181', 'implement_load_position_stance_range_tempo_pickup_set_down_trunk_policy_dosage_load_and_fatigue_are_unspecified'),
      (183, 'nordic-hamstring-eccentric', 'Nordic Hamstring Eccentric Contract Quarantine — Source 183', 'anchor_geometry_assistance_range_lowering_duration_return_strategy_surface_dosage_load_and_fatigue_are_unspecified'),
      (184, 'back-extension-hip-extension', 'Back Extension / Hip Extension Identity Quarantine — Source 184', 'back_extension_vs_hip_extension_support_geometry_spinal_motion_range_implement_terminal_action_dosage_load_and_fatigue_are_conflated')
    ) AS source_data(legacy_id, slug_value, display_value, unresolved_value)
  LOOP
    UPDATE coaching.exercise_variant_v1 v
    SET status='archived',requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',source_record.unresolved_value),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    FROM coaching.exercise_definition_v1 d
    WHERE v.definition_id=d.id AND d.facility_id=1 AND d.legacy_exercise_id=source_record.legacy_id AND d.slug=source_record.slug_value AND v.variant_key IN ('baseline','baseline-source-1152');
    UPDATE coaching.exercise_definition_v1 d
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE d.facility_id=1 AND d.legacy_exercise_id=source_record.legacy_id AND d.slug=source_record.slug_value;
  END LOOP;
END;
$hamstring_extension_quarantine$;
