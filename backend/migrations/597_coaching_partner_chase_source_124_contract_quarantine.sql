-- Source 124 omits pursuer/escapee role order, starting stagger, lane policy,
-- no-contact rule, finish, deceleration, dose, and fatigue contract.
DO $source_124_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=124 AND slug='partner-chase-acceleration';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 124 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-124',display_name='Partner Chase Acceleration Contract Quarantine — Source 124',status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','pursuer_escapee_role_order_start_stagger_lane_no_contact_finish_deceleration_dosage_load_and_fatigue_are_unspecified'),
    difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,
    programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('role_order_start_stagger_and_lane_policy','contact_finish_and_deceleration','dosage_load_and_fatigue')) WHERE id=definition_id_value;
END;
$source_124_quarantine$;
