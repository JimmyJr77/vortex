-- Source 89 conflates an isolated final-lunge drill with a low cartwheel plus
-- lunge freeze.  Entry, inversion, hand contact, flight, fatigue, and count
-- differ, so it cannot safely become one selectable exercise.
DO $source_89_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=89 AND slug='cartwheel-finish-lunge';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 89 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-89', display_name='Cartwheel Finish Lunge Identity Quarantine — Source 89', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','isolated_final_lunge_drill_vs_low_cartwheel_entry_hand_contact_inversion_and_count_are_conflated'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('finish_only_vs_low_cartwheel_entry','hand_contact_and_inversion','entry','repetition_unit')) WHERE id=definition_id_value;
END;
$source_89_quarantine$;
