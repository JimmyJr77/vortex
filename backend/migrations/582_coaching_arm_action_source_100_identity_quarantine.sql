-- Source 100 conflates seated and standing arm-action bases.  Base/support,
-- trunk and lower-limb demand, balance, duration, and application differ.
DO $source_100_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=100 AND slug='arm-action-drill';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 100 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-100', display_name='Arm Action Drill Seated / Standing Identity Quarantine — Source 100', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','seated_vs_standing_base_arm_action_range_cadence_duration_side_order_and_count_are_conflated'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('seated_vs_standing_base','arm_range_and_cadence','duration','side_order_and_count')) WHERE id=definition_id_value;
END;
$source_100_quarantine$;
