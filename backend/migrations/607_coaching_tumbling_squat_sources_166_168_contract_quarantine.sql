-- Source 166 conflates round-off rebound and snap-down terminal actions.  The
-- Box Squat baseline omits implement, load position, box geometry/contact,
-- pause, range, tempo, pickup/set-down, dosage, and fatigue.
DO $source_166_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=166 AND slug='round-off-rebound-snap-down-to-stick';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 166 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-166',display_name='Round-Off Rebound / Snap-Down Identity Quarantine — Source 166',status='archived',requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','round_off_rebound_vs_snap_down_terminal_action_entry_hand_placement_landing_rebound_stick_surface_spotting_dosage_load_and_fatigue_are_conflated'),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true) WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only') WHERE id=definition_id_value;
END;
$source_166_quarantine$;

DO $source_168_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=168 AND slug='box-squat';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 168 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-168',display_name='Box Squat Contract Quarantine — Source 168',status='archived',requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','implement_load_position_box_height_contact_policy_pause_range_tempo_pickup_set_down_dosage_load_and_fatigue_are_unspecified'),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true) WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only') WHERE id=definition_id_value;
END;
$source_168_quarantine$;
