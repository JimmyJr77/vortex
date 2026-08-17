-- Source 91's consolidated Wall Drive ISO Hold lacks exact side, wall angle,
-- contact, hold, exit, fatigue, and media-review contracts.  Its broad record
-- cannot remain selectable while these task-defining facts are absent.
DO $source_91_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=91 AND slug='wall-drill-split-shin-hold';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 91 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-91', display_name='Wall Drive ISO Hold Contract Quarantine — Source 91', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','lead_side_wall_angle_hand_contact_hold_exit_fatigue_and_media_variant_assignment_are_unspecified'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('lead_side','wall_angle_and_hand_contact','hold_and_exit','load_fatigue','media_variant_assignment')) WHERE id=definition_id_value;
END;
$source_91_quarantine$;
