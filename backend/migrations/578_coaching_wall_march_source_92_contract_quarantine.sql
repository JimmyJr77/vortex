-- Source 92's consolidated wall march lacks exact wall contact, lean, side
-- order, exchange cadence, count, exit, fatigue, and media-review contracts.
DO $source_92_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=92 AND slug='wall-drill-march';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 92 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-92', display_name='Wall Drill March Contract Quarantine — Source 92', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','wall_contact_lean_side_order_exchange_cadence_count_exit_fatigue_and_media_variant_assignment_are_unspecified'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('wall_contact_and_lean','side_order','exchange_cadence_and_count','exit','load_fatigue','media_variant_assignment')) WHERE id=definition_id_value;
END;
$source_92_quarantine$;
