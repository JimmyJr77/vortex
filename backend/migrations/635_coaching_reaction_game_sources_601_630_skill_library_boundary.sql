-- Source 601 needs an exact lever/support contract. Sources 606-626 and
-- 628-630 are multi-stimulus reaction games: their cueing, partner roles,
-- ball behavior, routes, and decision rules belong to skill-library review,
-- not automatic exercise selection.
DO $reaction_game_sources_601_630_boundary$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=601 LIMIT 1;
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 601 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-601',display_name='Tuck Front Lever Contract Quarantine — Source 601',status='archived',requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','bar_or_ring_interface_grip_tuck_geometry_hold_duration_assistance_dose_and_safe_exit_are_unspecified'),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true) WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only') WHERE id=definition_id_value;

  FOREACH source_id_value IN ARRAY ARRAY[606,607,608,609,610,611,612,613,614,615,616,617,618,619,620,621,622,623,624,625,626,628,629,630]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1 SET variant_key='skill-library-boundary-source-' || source_id_value,display_name='Reaction Game — Skill-Library Review Required — Source ' || source_id_value,status='archived',requirements_json=jsonb_build_object('selectable',false,'skillLibraryBoundary',true,'requiresSkillLibraryReview',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','multi_stimulus_cue_partner_or_ball_behavior_station_action_sequence_decision_rule_dose_fatigue_and_safety_require_skill_library_review'),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true) WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','skill_library_boundary','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only') WHERE id=definition_id_value;
  END LOOP;
END;
$reaction_game_sources_601_630_boundary$;
