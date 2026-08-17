-- Source 121 combines a prone start with a push-up start.  The support
-- position, release action, contact sequence, cue, distance, and run-out are
-- defining movement dimensions; they cannot be silently merged into one
-- selectable acceleration exercise.
DO $source_121_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1
    AND legacy_exercise_id=121
    AND slug='push-up-prone-start-sprint';

  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION 'Source 121 canonical definition missing';
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET status='archived',
      requirements_json=jsonb_build_object(
        'selectable',false,
        'identityQuarantine',true,
        'exerciseCardDoesNotClassifyParticipants',true,
        'unresolvedContract','prone_vs_push_up_support_position_release_action_contact_sequence_cue_distance_run_out_dosage_load_and_fatigue_are_conflated'
      ),
      difficulty_json='{}'::JSONB,
      load_profile_json='{}'::JSONB,
      fatigue_profile_json='{}'::JSONB,
      programming_profile_json=jsonb_build_object(
        'selectable',false,
        'humanReviewRequired',true,
        'publicationQuarantined',true
      )
  WHERE definition_id=definition_id_value
    AND variant_key IN ('baseline','baseline-source-709');

  UPDATE coaching.exercise_definition_v1
  SET status='archived',
      card_version=card_version+1,
      provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
        'sourceDisposition','identity_quarantine',
        'humanReviewRequired',true,
        'approvalsCreated',false,
        'publicationQuarantined',true,
        'exerciseCardDoesNotClassifyParticipants',true,
        'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only',
        'unresolvedIdentity',jsonb_build_array(
          'prone_vs_push_up_start_position',
          'release_action_and_contact_sequence',
          'cue_distance_run_out_dosage_load_and_fatigue'
        )
      )
  WHERE id=definition_id_value;
END;
$source_121_quarantine$;
