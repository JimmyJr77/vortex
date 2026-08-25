-- Source 152 and two consolidated legacy baselines name an overhead slam but
-- omit ball mass, start/base, target or floor interface, release route,
-- retrieval, reset, dose, load, fatigue, and stop contract.
DO $source_152_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=152 AND slug='medicine-ball-overhead-slam';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 152 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','ball_mass_start_base_target_or_floor_interface_release_route_retrieval_reset_dosage_load_fatigue_and_stop_rules_are_unspecified'),
    difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,
    programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key IN ('baseline','baseline-source-1161','baseline-source-1167');
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
  WHERE id=definition_id_value;
END;
$source_152_quarantine$;
