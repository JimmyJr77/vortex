-- Source 173's active Step-Up baseline lacks platform height/stability,
-- lead-leg and return policy, implement/load position, pickup/set-down,
-- terminal posture, side dose, dosage, load, fatigue, and stop rules.
DO $source_173_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=173 AND slug='step-up';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 173 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-173',display_name='Step-Up Contract Quarantine — Source 173',status='archived',requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','platform_height_stability_lead_leg_return_policy_implement_load_position_pickup_set_down_terminal_posture_side_dose_dosage_load_fatigue_and_stop_rules_are_unspecified'),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true) WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only') WHERE id=definition_id_value;
END;
$source_173_quarantine$;
