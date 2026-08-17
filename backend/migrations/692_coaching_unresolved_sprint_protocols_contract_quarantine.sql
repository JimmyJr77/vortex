-- These legacy labels expressly retain unresolved sequence dimensions and
-- structurallySelectable=false.  They cannot be represented as exact workout
-- exercises until a human specifies one protocol, so archive their exercise
-- cards while retaining traceability and unapproved research/media history.
DO $unresolved_sprint_protocols_quarantine$
DECLARE
  source_record RECORD;
  definition_id_value UUID;
  variant_id_value UUID;
BEGIN
  FOR source_record IN
    SELECT * FROM (VALUES
      (1117, 'a-march-to-projection', 'A-March to Projection Contract Quarantine — Source 1117', 'march_transition_wall_projection_or_long_jump_approach_intent_lane_direction_distance_start_finish_contact_sequence_and_dosage_are_unresolved'),
      (339, 'fast-leg-cycle-drill', 'Fast Leg Cycle Contract Quarantine — Source 339', 'stationary_or_traveling_state_support_leg_action_cycle_contact_sequence_side_change_rule_dose_unit_and_finish_are_unresolved'),
      (1636, 'high-knee-a-march-ladder', 'High-Knee A-March Ladder Contract Quarantine — Source 1636', 'flight_state_cells_per_pass_contact_pattern_ladder_direction_start_finish_dosage_load_fatigue_and_stop_rules_are_unresolved')
    ) AS source_data(legacy_id, slug_value, display_value, unresolved_value)
  LOOP
    SELECT d.id, v.id INTO definition_id_value, variant_id_value
    FROM coaching.exercise_definition_v1 d
    JOIN coaching.exercise_variant_v1 v ON v.definition_id=d.id
    WHERE d.facility_id=1
      AND d.legacy_exercise_id=source_record.legacy_id
      AND d.slug=source_record.slug_value
      AND v.variant_key='baseline';

    IF definition_id_value IS NULL OR variant_id_value IS NULL THEN
      RAISE EXCEPTION '692_coaching_unresolved_sprint_protocols_contract_quarantine prerequisite missing for source %', source_record.legacy_id;
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
      RAISE EXCEPTION '692_coaching_unresolved_sprint_protocols_contract_quarantine refuses human-reviewed source %', source_record.legacy_id;
    END IF;

    UPDATE coaching.exercise_delivery_profile_v1
    SET status='archived', updated_at=now()
    WHERE variant_id=variant_id_value AND status IN ('draft','review');

    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_record.legacy_id,
        display_name=source_record.display_value,
        status='archived',
        requirements_json=jsonb_build_object(
          'selectable',false,
          'identityQuarantine',true,
          'exerciseCardDoesNotClassifyParticipants',true,
          'unresolvedContract',source_record.unresolved_value
        ),
        difficulty_json='{}'::JSONB,
        load_profile_json='{}'::JSONB,
        fatigue_profile_json='{}'::JSONB,
        programming_profile_json=jsonb_build_object(
          'selectable',false,
          'humanReviewRequired',true,
          'publicationQuarantined',true,
          'requiresExactProtocolBeforeCandidateCreation',true
        ),
        updated_at=now()
    WHERE id=variant_id_value;

    UPDATE coaching.exercise_definition_v1
    SET status='archived',
        card_version=card_version+1,
        provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
          'sourceDisposition','identity_quarantine',
          'humanReviewRequired',true,
          'approvalsCreated',false,
          'publicationQuarantined',true,
          'exerciseCardDoesNotClassifyParticipants',true,
          'legacyMediaDisposition','retained_unverified_or_unapproved_candidates_only',
          'unresolvedContract',source_record.unresolved_value
        ),
        updated_at=now()
    WHERE id=definition_id_value;
  END LOOP;
END;
$unresolved_sprint_protocols_quarantine$;
