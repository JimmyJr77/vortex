-- Source 112 is a skill-library visual-reaction concept, not one fully
-- specified exercise-card variant.  Its point/signal, direction count, target
-- layout, travel distance, stop, and return actions remain delivery choices.
-- Keep the legacy record out of exercise selection without introducing a
-- participant skill-level gate on an exercise card.
DO $source_112_skill_library_boundary$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1
    AND legacy_exercise_id=112
    AND slug='coach-point-and-go';

  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION 'Source 112 canonical definition missing';
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key='skill-library-boundary-source-112',
      display_name='Coach Point-and-Go Skill-Library Boundary — Source 112',
      status='archived',
      requirements_json=jsonb_build_object(
        'selectable',false,
        'skillLibraryBoundary',true,
        'exerciseCardDoesNotClassifyParticipants',true,
        'unresolvedContract','signal_type_direction_count_target_layout_travel_distance_stop_return_dosage_load_and_fatigue_are_not_one_exercise_variant'
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
          'signal_type_and_direction_count',
          'target_layout_travel_distance_and_stop_return',
          'dosage_load_and_fatigue'
        )
      )
  WHERE id=definition_id_value;
END;
$source_112_skill_library_boundary$;
