-- Source 80 conflates at least two independently taught movements: a kneeling
-- sideways egg-roll return and a supine tuck side-to-side rock.  Its wording
-- also leaves start/finish, contact route, arm hold, direction, and count open.
-- Preserve lineage and its legacy candidates, but do not invent one selectable
-- task, participant classification, or media approval.
DO $source_80_quarantine$
DECLARE
  definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=80 AND slug='egg-roll';

  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION 'Source 80 canonical definition missing';
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key='identity-quarantine-source-80',
      display_name='Egg Roll / Tuck Roll Identity Quarantine — Source 80',
      status='archived',
      requirements_json=jsonb_build_object(
        'selectable',false,
        'identityQuarantine',true,
        'unresolvedContract','entry_exit_contact_path_arm_hold_direction_and_count_unit_conflate_egg_roll_and_supine_tuck_rock'
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
          'kneeling_egg_roll_return_vs_supine_tuck_side_rock',
          'entry_and_terminal_surface',
          'contact_path',
          'arm_hold',
          'roll_direction_assignment',
          'repetition_unit_and_side_balance'
        )
      )
  WHERE id=definition_id_value;
END;
$source_80_quarantine$;
