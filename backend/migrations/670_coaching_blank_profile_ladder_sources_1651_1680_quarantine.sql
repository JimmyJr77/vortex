-- Names alone cannot safely describe a ladder drill's exact path, contacts, exit, cueing,
-- load, fatigue, or quality contract. Retain any independently authored variants.
DO $blank_profile_ladder_sources_1651_1680$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[
    1651, 1652, 1653, 1656, 1657, 1658, 1659, 1660, 1661, 1662, 1663, 1664,
    1665, 1666, 1667, 1671, 1672, 1673, 1674, 1675, 1676, 1677, 1678, 1679,
    1680
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
             'unresolvedContract', 'Legacy ladder label does not establish exact path, contact sequence, travel or exit, coach cue, dose, fatigue, quality, or stop rules.'
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
$blank_profile_ladder_sources_1651_1680$;
