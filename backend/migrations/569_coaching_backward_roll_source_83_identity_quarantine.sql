-- Source 83 conflates a backward rocker returning forward with a completed
-- backward roll using an arm push.  Their terminal path, hand loading, risk,
-- fatigue, and coaching contracts are different.
DO $source_83_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=83 AND slug='backward-roll-progression';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 83 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-83', display_name='Backward Roll Progression Identity Quarantine — Source 83', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','rocker_return_vs_completed_arm_push_roll_terminal_path_hand_loading_surface_and_count_are_conflated'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB,
    programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived', card_version=card_version+1,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('rocker_return_vs_completed_backward_roll','arm_push_and_hand_loading','terminal_position','surface_and_repetition_unit'))
  WHERE id=definition_id_value;
END;
$source_83_quarantine$;
