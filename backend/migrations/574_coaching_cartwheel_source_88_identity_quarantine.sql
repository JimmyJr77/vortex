-- Source 88 conflates a floor cartwheel step-over with clearance over a panel
-- mat/obstacle.  Equipment, height, clearance, entry, exit, and landing path
-- change the task contract and cannot be silently represented as one exercise.
DO $source_88_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=88 AND slug='cartwheel-step-over';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 88 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-88', display_name='Cartwheel Step-Over / Panel-Mat Identity Quarantine — Source 88', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','floor_step_over_vs_panel_mat_clearance_equipment_height_entry_exit_landing_and_count_are_conflated'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('floor_step_over_vs_panel_mat_clearance','equipment_and_height','entry','exit','landing_path','repetition_unit')) WHERE id=definition_id_value;
END;
$source_88_quarantine$;
