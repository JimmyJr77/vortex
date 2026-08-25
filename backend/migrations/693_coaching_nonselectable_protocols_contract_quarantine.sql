-- These review definitions have no selectable active variant.  Their source
-- records explicitly leave an ordered task protocol unresolved, so retaining
-- them as review exercises would invite accidental selection.  Preserve the
-- lineage and candidate history, but require an exact human protocol before a
-- new review card can be created.
DO $nonselectable_protocols_quarantine$
DECLARE
  source_record RECORD;
  definition_id_value UUID;
  variant_id_value UUID;
BEGIN
  FOR source_record IN
    SELECT * FROM (VALUES
      (1282, 'cossack-shift-to-wall-ball-toss', 'Cossack Shift to Wall-Ball Toss Contract Quarantine — Source 1282', 'throw_target_ball_mass_start_finish_shift_depth_release_catch_or_retrieval_policy_dosage_load_fatigue_and_stop_rules_are_unresolved'),
      (1284, '180-turn-wall-ball-catch-and-throw', '180 Turn Wall-Ball Catch-and-Throw Contract Quarantine — Source 1284', 'turn_direction_entry_footwork_ball_path_target_release_catch_or_retrieval_policy_dosage_load_fatigue_and_stop_rules_are_unresolved'),
      (1589, 'cone-skip-rhythm-build', 'Cone Skip Rhythm Contract Quarantine — Source 1589', 'contact_to_marker_rule_marker_spacing_travel_direction_start_finish_and_dosage_are_unresolved'),
      (1590, 'a-skip-through-cone-gates', 'A-Skip Through Cone Gates Contract Quarantine — Source 1590', 'gate_geometry_contact_pattern_travel_direction_start_finish_and_dosage_are_unresolved'),
      (1637, 'a-skip-through-ladder', 'A-Skip Through Ladder Contract Quarantine — Source 1637', 'cell_sequence_contact_pattern_travel_direction_start_finish_and_dosage_are_unresolved'),
      (1638, 'straight-leg-ankling-ladder', 'Straight-Leg Ankling Ladder Contract Quarantine — Source 1638', 'cell_sequence_contact_pattern_travel_direction_start_finish_and_dosage_are_unresolved')
    ) AS source_data(legacy_id, slug_value, display_value, unresolved_value)
  LOOP
    SELECT d.id, v.id INTO definition_id_value, variant_id_value
    FROM coaching.exercise_definition_v1 d
    JOIN coaching.exercise_variant_v1 v ON v.definition_id=d.id
    WHERE d.facility_id=1
      AND d.legacy_exercise_id=source_record.legacy_id
      AND d.slug=source_record.slug_value
      AND v.status='review';

    IF definition_id_value IS NULL OR variant_id_value IS NULL THEN
      RAISE EXCEPTION '693_coaching_nonselectable_protocols_contract_quarantine prerequisite missing for source %', source_record.legacy_id;
    END IF;
    IF EXISTS (
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=definition_id_value
        AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    ) OR EXISTS (
      SELECT 1 FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=definition_id_value
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN ('candidate','superseded'))
    ) OR EXISTS (
      SELECT 1 FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=definition_id_value
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN ('candidate','superseded'))
    ) OR EXISTS (
      SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=definition_id_value
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL OR review_status NOT IN ('candidate','superseded'))
    ) THEN
      RAISE EXCEPTION '693_coaching_nonselectable_protocols_contract_quarantine refuses human-reviewed source %', source_record.legacy_id;
    END IF;

    UPDATE coaching.exercise_delivery_profile_v1
    SET status='archived', updated_at=now()
    WHERE variant_id=variant_id_value AND status IN ('draft','review');

    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_record.legacy_id,
        display_name=source_record.display_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',source_record.unresolved_value),
        difficulty_json='{}'::JSONB,
        load_profile_json='{}'::JSONB,
        fatigue_profile_json='{}'::JSONB,
        programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true,'requiresExactProtocolBeforeCandidateCreation',true),
        updated_at=now()
    WHERE id=variant_id_value;

    UPDATE coaching.exercise_definition_v1
    SET status='archived', card_version=card_version+1,
        provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_or_unapproved_candidates_only','unresolvedContract',source_record.unresolved_value),
        updated_at=now()
    WHERE id=definition_id_value;
  END LOOP;
END;
$nonselectable_protocols_quarantine$;
