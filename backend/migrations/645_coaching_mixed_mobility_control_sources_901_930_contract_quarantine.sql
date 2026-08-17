-- These legacy mobility, crawl, and rhythm baselines omit the concrete start,
-- support, limb sequence, travel distance, tempo, dosage, fatigue, and stop
-- rules needed for a production exercise card. Existing exact family variants
-- are intentionally left available for review.
DO $mixed_mobility_control_sources_901_930_quarantine$
DECLARE source_id_value INTEGER; definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[901,902,903,904,905,906,907,908,909,911,913,914,915,916,918,921,922,923,925,926,929,930]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-'||source_id_value,display_name='Movement Contract Quarantine — Source '||source_id_value,status='archived',requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','exact_start_support_limb_sequence_travel_or_range_tempo_dose_fatigue_and_stop_rule_are_unspecified'),difficulty_json='{}'::jsonb,load_profile_json='{}'::jsonb,fatigue_profile_json='{}'::jsonb,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true) WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::jsonb)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only') WHERE id=definition_id_value;
  END LOOP;
END;
$mixed_mobility_control_sources_901_930_quarantine$;
