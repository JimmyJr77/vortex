-- Source 101 conflates floor-line/tape walking with low-beam and unspecified
-- narrow-surface walking.  Surface height, width, equipment, fall consequence,
-- direction, turn, entry, exit, and count are task-defining.
DO $source_101_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=101 AND slug='beam-walk';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 101 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-101', display_name='Beam / Line Walk Identity Quarantine — Source 101', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','floor_line_tape_low_beam_and_narrow_surface_height_width_direction_turn_entry_exit_and_count_are_conflated'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('floor_line_tape_vs_low_beam','surface_height_and_width','direction_and_turn','entry_exit_and_count')) WHERE id=definition_id_value;
END;
$source_101_quarantine$;
