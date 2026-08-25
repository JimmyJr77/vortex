-- The legacy labels below do not establish a safe, exact programming contract.
-- Keep any separately authored variants intact, but quarantine only the blank baseline.
DO $blank_profile_ladder_sources_1621_1650$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[
    1621, 1622, 1623, 1625, 1626, 1627, 1628, 1629, 1630, 1631, 1632, 1633,
    1634, 1635, 1639, 1640, 1641, 1642, 1643, 1644, 1645, 1646, 1647, 1648,
    1649, 1650
  ]
  LOOP
    SELECT source.definition_id
      INTO definition_id_value
      FROM coaching.exercise_definition_source_v1 AS source
     WHERE source.legacy_exercise_id = source_id_value
     LIMIT 1;

    IF definition_id_value IS NULL THEN
      RAISE EXCEPTION 'Source % canonical definition missing', source_id_value;
    END IF;

    UPDATE coaching.exercise_variant_v1
       SET variant_key = 'identity-quarantine-source-' || source_id_value,
           display_name = 'Blank-Profile Contract Quarantine — Source ' || source_id_value,
           status = 'archived',
           requirements_json = jsonb_build_object(
             'selectable', false,
             'identityQuarantine', true,
             'exerciseCardDoesNotClassifyParticipants', true,
             'unresolvedContract', 'Legacy cone, shuttle, quick-feet, or ladder label does not establish exact layout, lane, cue or role, foot sequence, contact count, pace, dose, fatigue, quality, or stop rules.'
           ),
           difficulty_json = '{}'::jsonb,
           load_profile_json = '{}'::jsonb,
           fatigue_profile_json = '{}'::jsonb,
           programming_profile_json = jsonb_build_object(
             'selectable', false,
             'humanReviewRequired', true,
             'publicationQuarantined', true
           )
     WHERE definition_id = definition_id_value
       AND variant_key = 'baseline';

    UPDATE coaching.exercise_definition_v1
       SET status = 'archived',
           card_version = card_version + 1,
           provenance_json = COALESCE(provenance_json, '{}'::jsonb) || jsonb_build_object(
             'sourceDisposition', 'identity_quarantine',
             'humanReviewRequired', true,
             'approvalsCreated', false,
             'publicationQuarantined', true,
             'exerciseCardDoesNotClassifyParticipants', true,
             'legacyMediaDisposition', 'retained_unverified_non_embedded_candidates_only'
           )
     WHERE id = definition_id_value;
  END LOOP;
END;
$blank_profile_ladder_sources_1621_1650$;
