-- Final blank legacy baselines: recovery, interval, and reactive-jump labels are not
-- complete exercise prescriptions. Preserve exact authored variants and quarantine only
-- the selectable-looking baselines until human review supplies the missing contract.
DO $blank_profile_final_sources_1682_1701$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[
    1682, 1684, 1685, 1686, 1687, 1688, 1691, 1692, 1693, 1694, 1695, 1696,
    1697, 1701
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
             'unresolvedContract', 'Legacy recovery, interval, or reactive-jump label does not establish exact setup, execution, dose, load, fatigue, quality, or stop rules.'
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
$blank_profile_final_sources_1682_1701$;
