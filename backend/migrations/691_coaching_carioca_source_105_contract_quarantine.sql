-- Source 105 names a carioca/grapevine walkthrough but does not establish an
-- exact lane, direction, distance, start/finish, foot-contact/count rule,
-- cadence, arm policy, dose, load/fatigue, or substitution contract.  Keep
-- its lineage and unreviewed candidate media for research, but make the
-- exercise record explicitly nonselectable rather than inventing a protocol.
DO $carioca_quarantine$
DECLARE
  definition_id_value UUID;
  variant_id_value UUID;
BEGIN
  SELECT d.id, v.id INTO definition_id_value, variant_id_value
  FROM coaching.exercise_definition_v1 d
  JOIN coaching.exercise_variant_v1 v ON v.definition_id=d.id
  WHERE d.facility_id=1
    AND d.legacy_exercise_id=105
    AND d.slug='carioca-walkthrough'
    AND v.variant_key='baseline';

  IF definition_id_value IS NULL OR variant_id_value IS NULL THEN
    RAISE EXCEPTION '691_coaching_carioca_source_105_contract_quarantine prerequisite rows are missing';
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
    RAISE EXCEPTION '691_coaching_carioca_source_105_contract_quarantine refuses to alter human-reviewed content';
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived', updated_at=now()
  WHERE variant_id=variant_id_value AND status IN ('draft','review');

  UPDATE coaching.exercise_variant_v1
  SET variant_key='identity-quarantine-source-105',
      display_name='Carioca / Grapevine Contract Quarantine — Source 105',
      status='archived',
      requirements_json=jsonb_build_object(
        'selectable',false,
        'identityQuarantine',true,
        'exerciseCardDoesNotClassifyParticipants',true,
        'unresolvedContract','lane_direction_distance_start_finish_cross_step_contact_count_cadence_arm_policy_reset_dosage_load_fatigue_stop_rules_and_substitution_policy_are_unspecified'
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
        'unresolvedContract','lane_direction_distance_start_finish_cross_step_contact_count_cadence_arm_policy_reset_dosage_load_fatigue_stop_rules_and_substitution_policy_are_unspecified'
      ),
      updated_at=now()
  WHERE id=definition_id_value;
END;
$carioca_quarantine$;
