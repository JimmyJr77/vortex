-- Source 106 has an empty active contract and omits travel direction, distance,
-- side dose, stance width, start/finish, cadence, and count.  It cannot be a
-- generic substitute for distinct shuffle-to-stick and cutting cards.
DO $source_106_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=106 AND slug='lateral-shuffle-walkthrough';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 106 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-106', display_name='Lateral Shuffle Mechanics Contract Quarantine — Source 106', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','travel_direction_distance_side_dose_stance_width_start_finish_cadence_count_load_and_fatigue_are_unspecified'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('travel_direction_and_distance','side_dose_and_stance_width','start_finish_cadence_and_count','load_fatigue')) WHERE id=definition_id_value;
END;
$source_106_quarantine$;
