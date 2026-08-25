-- Source 90 allows a skip or hurdle entry and does not define lead side,
-- travel, takeoff/landing contacts, lunge depth, exit, or count.
DO $source_90_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=90 AND slug='hurdle-step-lunge';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 90 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-90', display_name='Hurdle Step to Lunge Identity Quarantine — Source 90', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','skip_vs_hurdle_entry_lead_side_travel_takeoff_landing_lunge_depth_exit_and_count_are_unspecified'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('skip_vs_hurdle_entry','lead_side','travel_takeoff_and_landing','lunge_depth','exit','repetition_unit')) WHERE id=definition_id_value;
END;
$source_90_quarantine$;
