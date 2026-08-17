-- Source 115 explicitly combines partner tag and shadow-tag roles.  Pursuit,
-- evasion, contact policy, boundary geometry, scoring, work/rest, and role
-- rotation are not one exercise-card variant.  Retain it for skill-library
-- review only; do not classify participants by skill on an exercise card.
DO $source_115_skill_library_boundary$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1
    AND legacy_exercise_id=115
    AND slug='partner-shadow-tag';

  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION 'Source 115 canonical definition missing';
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key='skill-library-boundary-source-115',
      display_name='Partner Tag / Shadow Tag Skill-Library Boundary — Source 115',
      status='archived',
      requirements_json=jsonb_build_object(
        'selectable',false,
        'skillLibraryBoundary',true,
        'exerciseCardDoesNotClassifyParticipants',true,
        'unresolvedContract','pursuit_vs_evasion_roles_contact_policy_boundary_geometry_scoring_work_rest_role_rotation_load_and_fatigue_are_conflated'
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
          'pursuit_vs_evasion_roles',
          'contact_policy_boundary_geometry_and_scoring',
          'work_rest_role_rotation_load_and_fatigue'
        )
      )
  WHERE id=definition_id_value;
END;
$source_115_skill_library_boundary$;
