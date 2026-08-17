-- Source 125 conflates sled and band resistance.  Attachment, resistance
-- direction, release behavior, load calibration, lane logistics, and failure
-- modes differ and require separate reviewed variants.
DO $source_125_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=125 AND slug='light-sled-sprint-band-resisted-acceleration';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 125 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-125',display_name='Sled / Band Resisted Acceleration Identity Quarantine — Source 125',status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','sled_vs_band_attachment_resistance_direction_release_behavior_load_calibration_lane_logistics_distance_dosage_and_fatigue_are_conflated'),
    difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,
    programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('sled_vs_band_implement_and_attachment','resistance_release_and_load_calibration','lane_logistics_distance_dosage_and_fatigue')) WHERE id=definition_id_value;
END;
$source_125_quarantine$;
