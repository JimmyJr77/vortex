-- Keep Skipping Rhythm readiness contextual and retain exactly three
-- current-version unverified/non-embedded candidate links.
DO $source_104_cleanup$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=104 AND slug='skipping-rhythm-drill';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 104 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET requirements_json=(coalesce(requirements_json,'{}'::JSONB)-'readiness'-'population')||jsonb_build_object(
    'readiness',jsonb_build_array('safe_lane_and_finish_zone','can_follow_declared_alternating_step_hop_contact_sequence','can_stop_on_declared_signal','current_symptoms_surface_and_contact_budget_fit'),
    'selectionContext','workout inputs determine readiness; the exercise card does not classify participants by skill or proficiency'
  ) WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET population_json=(coalesce(population_json,'{}'::JSONB)-'readinessChecks')||jsonb_build_object(
    'exerciseCardDoesNotClassifyParticipants',true,'readinessIsWorkoutInput',true,
    'readinessChecks',jsonb_build_array('safe lane and finish zone','can follow declared alternating step-hop contact sequence','can stop on declared signal','current symptoms, surface, and contact budget fit')
  ),provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('readinessLanguageCorrected',true,'mediaCandidateLimit',3,'mediaApprovalCreated',false) WHERE id=definition_id_value;
  DELETE FROM coaching.exercise_media_candidate_v1 AS candidate WHERE candidate.definition_id=definition_id_value
    AND (candidate.reviewed_card_version<>(SELECT card_version FROM coaching.exercise_definition_v1 WHERE id=definition_id_value)
      OR candidate.url <> ALL (ARRAY['https://www.youtube.com/watch?v=IepUawhaZ8Q','https://www.youtube.com/watch?v=TDn2opUAFp0','https://www.youtube.com/watch?v=vbslo_3aXoo']::TEXT[]));
END;
$source_104_cleanup$;
