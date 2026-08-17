-- Source 82 conflates a forward roll returning to seated tuck with a forward
-- roll returning to feet.  Those terminal positions have different recovery,
-- balance, dose, and relationship contracts.  Do not silently merge it with
-- legacy Source 808 or fabricate an exact selectable roll.
DO $source_82_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=82 AND slug='forward-roll-progression';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 82 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1
  SET variant_key='identity-quarantine-source-82', display_name='Forward Roll Progression Identity Quarantine — Source 82', status='archived',
      requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','terminal_position_seated_tuck_or_feet_and_exact_hand_assistance_surface_and_count_are_unspecified'),
      difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB,
      programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1
  SET status='archived', card_version=card_version+1,
      provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('terminal_position_seated_tuck_or_feet','hand_assistance','surface','repetition_unit'))
  WHERE id=definition_id_value;
END;
$source_82_quarantine$;
