-- Source 122 allows side-facing or lateral-stance starts and leaves the cue,
-- direction, breakout distance, stop/run-out, dose, and fatigue undefined.
DO $source_122_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=122 AND slug='lateral-start-to-sprint-breakout';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 122 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-122',display_name='Lateral Start to Sprint Breakout Contract Quarantine — Source 122',status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','side_facing_vs_lateral_stance_cue_direction_breakout_distance_stop_run_out_dosage_load_and_fatigue_are_unspecified'),
    difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,
    programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('start_geometry_cue_and_direction','breakout_distance_stop_and_run_out','dosage_load_and_fatigue')) WHERE id=definition_id_value;
END;
$source_122_quarantine$;
