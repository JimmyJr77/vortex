-- Source 189's generic Bench Press baseline does not define implement,
-- quantity, grip, rack/safety/spotter plan, bench geometry, setup, range,
-- leg-drive policy, pickup/set-down, load, tempo, dosage, or fatigue.
DO $source_189_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT d.id INTO definition_id_value
  FROM coaching.exercise_definition_v1 d
  JOIN coaching.exercise_definition_source_v1 source ON source.definition_id=d.id
  WHERE d.facility_id=1 AND d.slug='barbell-bench-press' AND source.legacy_exercise_id=189;
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 189 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-189',display_name='Bench Press Contract Quarantine — Source 189',status='archived',requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','implement_quantity_grip_rack_safety_spotter_plan_bench_geometry_setup_range_leg_drive_pickup_set_down_load_tempo_dosage_and_fatigue_are_unspecified'),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true) WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only') WHERE id=definition_id_value;
END;
$source_189_quarantine$;
