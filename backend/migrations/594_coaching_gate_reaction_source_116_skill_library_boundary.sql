-- Source 116 is a cue-driven reaction concept.  Gate arrangement, cue mode,
-- response direction, acceleration distance, stop/run-out, return, and dose
-- are delivery dimensions rather than one exact exercise-card identity.
DO $source_116_skill_library_boundary$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1
    AND legacy_exercise_id=116
    AND slug='gate-reaction-drill';

  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION 'Source 116 canonical definition missing';
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key='skill-library-boundary-source-116',
      display_name='Gate Reaction Skill-Library Boundary — Source 116',
      status='archived',
      requirements_json=jsonb_build_object(
        'selectable',false,
        'skillLibraryBoundary',true,
        'exerciseCardDoesNotClassifyParticipants',true,
        'unresolvedContract','gate_arrangement_cue_mode_response_direction_acceleration_distance_stop_run_out_return_dosage_load_and_fatigue_are_unspecified'
      ),
      difficulty_json='{}'::JSONB,
      load_profile_json='{}'::JSONB,
      fatigue_profile_json='{}'::JSONB,
      programming_profile_json=jsonb_build_object(
        'selectable',false,
        'humanReviewRequired',true,
        'publicationQuarantined',true,
        'requiresSkillLibraryReview',true
      )
  WHERE definition_id=definition_id_value
    AND variant_key='baseline';

  UPDATE coaching.exercise_definition_v1
  SET status='archived',
      card_version=card_version+1,
      provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
        'sourceDisposition','skill_library_boundary_quarantine',
        'humanReviewRequired',true,
        'approvalsCreated',false,
        'publicationQuarantined',true,
        'requiresSkillLibraryReview',true,
        'exerciseCardDoesNotClassifyParticipants',true,
        'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only',
        'unresolvedIdentity',jsonb_build_array(
          'gate_arrangement_cue_mode_and_response_direction',
          'acceleration_distance_stop_run_out_and_return',
          'dosage_load_and_fatigue'
        )
      )
  WHERE id=definition_id_value;
END;
$source_116_skill_library_boundary$;
