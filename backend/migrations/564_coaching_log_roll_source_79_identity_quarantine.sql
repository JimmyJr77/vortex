-- Source 79 names a lateral long-body roll but leaves the start surface,
-- terminal surface, arm path, direction assignment, and repetition unit open.
-- Keep its lineage and direct legacy media candidates; do not fabricate an exact
-- selectable exercise, a participant-skill classification, or a media approval.
DO $source_79_quarantine$
DECLARE
  definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=79 AND slug='log-roll';

  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION 'Source 79 canonical definition missing';
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key='identity-quarantine-source-79',
      display_name='Log Roll / Pencil Roll Identity Quarantine — Source 79',
      status='archived',
      requirements_json=jsonb_build_object(
        'selectable',false,
        'identityQuarantine',true,
        'unresolvedContract','start_surface_terminal_surface_arm_path_direction_and_count_unit_are_unspecified'
      ),
      difficulty_json='{}'::JSONB,
      load_profile_json='{}'::JSONB,
      fatigue_profile_json='{}'::JSONB,
      programming_profile_json=jsonb_build_object(
        'selectable',false,
        'humanReviewRequired',true,
        'publicationQuarantined',true
      )
  WHERE definition_id=definition_id_value AND variant_key='baseline';

  UPDATE coaching.exercise_definition_v1
  SET status='archived',
      card_version=card_version+1,
      provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
        'sourceDisposition','identity_quarantine',
        'humanReviewRequired',true,
        'approvalsCreated',false,
        'publicationQuarantined',true,
        'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only',
        'unresolvedIdentity',jsonb_build_array(
          'start_surface',
          'terminal_surface',
          'arm_path',
          'roll_direction_assignment',
          'repetition_unit_and_side_balance'
        )
      )
  WHERE id=definition_id_value;
END;
$source_79_quarantine$;
