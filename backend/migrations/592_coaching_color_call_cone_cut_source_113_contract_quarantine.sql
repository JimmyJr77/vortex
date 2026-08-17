-- Source 113 and its consolidated duplicate source 942 do not declare an
-- exact target layout, cue type, travel distance, response action, return,
-- dosage, load, or fatigue contract.  "Color-Call Cone Cut" therefore cannot
-- be offered as a single selectable exercise until a human defines one.
DO $source_113_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1
    AND slug='color-call-cone-cut';

  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION 'Source 113 canonical definition missing';
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET status='archived',
      requirements_json=jsonb_build_object(
        'selectable',false,
        'identityQuarantine',true,
        'exerciseCardDoesNotClassifyParticipants',true,
        'unresolvedContract','cue_type_target_layout_travel_distance_response_action_return_dosage_load_and_fatigue_are_unspecified'
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
    AND variant_key IN ('baseline','baseline-source-942');

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
          'cue_type_and_target_layout',
          'travel_distance_response_action_and_return',
          'dosage_load_and_fatigue'
        )
      )
  WHERE id=definition_id_value;
END;
$source_113_quarantine$;
