-- Source 86 duplicates the unaudited Wall Walk / Wall Walk to Controlled Hold
-- family (legacy 805/703).  Its "appropriate height" and "clean line" wording
-- does not resolve the contact, height, count, or handstand threshold.
DO $source_86_collision$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=86 AND slug='wall-walk-handstand-line';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 86 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-86', display_name='Wall Walk-Up Legacy Collision Quarantine — Source 86', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'sourceIdentityDuplicate',true,'unresolvedContract','wall_walk_height_contact_line_hold_count_and_handstand_threshold_overlap_sources_703_and_805'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_collision_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'relatedLegacySources',jsonb_build_array(703,805),'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only') WHERE id=definition_id_value;
END;
$source_86_collision$;
