-- Correct migration 479's Back Bridge variant score shape without changing
-- identity, exercise difficulty, human-review state, or publication state.
-- Canonical score fields are 1-100; a no-planned-impact exercise therefore
-- uses the minimum score of 1 while retaining zero planned landing contacts.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '480_coaching_back_bridge_score_contract_correction';
  prerequisite_migration CONSTANT TEXT := '479_coaching_back_bridge_hold_family_audit_hardening.sql';
  prerequisite_checksum CONSTANT TEXT := '4176817151';
  canonical_definition CONSTANT UUID := '154614aa-67be-4b1c-8e9f-cb9a30620239';
  active_variant_ids CONSTANT UUID[] := ARRAY[
    'e5ce6d88-46e0-458c-bf77-58e75c3e8208'::UUID,
    '9a05f917-cdaf-4243-ab3c-5eb4d7af15be'::UUID,
    '3df0bd43-31db-4961-a8b7-f1944322f650'::UUID];
  corrected_count INTEGER;
BEGIN
  IF NOT EXISTS(
      SELECT 1 FROM schema_migrations
      WHERE filename=prerequisite_migration AND checksum=prerequisite_checksum)
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND card_version=2 AND status='review')
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(active_variant_ids) AND definition_id=canonical_definition
          AND status='review')<>3 THEN
    RAISE EXCEPTION '% prerequisite migration or Back Bridge state is missing or drifted',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids)
        AND (status='approved' OR reviewed_by IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=16
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% refuses to overwrite human-reviewed or published state',migration_key;
  END IF;

  UPDATE coaching.exercise_variant_v1 variant SET
    difficulty_json=jsonb_build_object(
      'technicalComplexity',score.complexity,
      'absoluteLoadDemand',score.physical,
      'physicalDifficulty',score.physical,
      'relativeStrengthDemand',score.relative_strength,
      'mobilityDemand',score.mobility,
      'balanceDemand',score.balance,
      'stabilityDemand',score.stability,
      'coordinationDemand',score.coordination,
      'speedDemand',score.speed,
      'decisionDemand',score.decision,
      'workCapacityDemand',score.work_capacity,
      'impact',1,
      'eccentricTissueStress',score.eccentric,
      'jointStress',score.joint_stress,
      'spinalLoading',score.spinal_loading,
      'gripDemand',score.grip,
      'inversionDemand',score.inversion,
      'fearConfidenceBarrier',score.fear,
      'supervisionDemand',score.supervision,
      'spottingDemand',score.spotting,
      'failureConsequence',score.failure,
      'baseOverallDifficulty',greatest(score.complexity,score.physical),
      'technicalMeaning','exercise_complexity',
      'loadMeaning','physical_difficulty',
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'scoreState','review_only_requires_independent_calibration',
      'impactMeaning','minimum_contract_score_no_planned_flight_or_landing'),
    fatigue_profile_json=jsonb_set(
      variant.fatigue_profile_json,
      '{impactAccumulation}',
      '1'::JSONB,
      TRUE),
    updated_at=now()
  FROM (VALUES
    ('e5ce6d88-46e0-458c-bf77-58e75c3e8208'::UUID,68,72,60,92,54,72,58,12,48,54,30,86,88,62,62,48,76,64,80),
    ('9a05f917-cdaf-4243-ab3c-5eb4d7af15be'::UUID,64,70,58,88,50,68,54,12,48,48,28,84,78,62,60,44,74,62,76),
    ('3df0bd43-31db-4961-a8b7-f1944322f650'::UUID,76,78,68,92,76,82,72,14,56,60,32,88,88,66,66,58,82,70,84)
  ) score(id,complexity,physical,relative_strength,mobility,balance,stability,
      coordination,speed,decision,work_capacity,eccentric,joint_stress,
      spinal_loading,grip,inversion,fear,supervision,spotting,failure)
  WHERE variant.id=score.id AND variant.definition_id=canonical_definition
    AND variant.status='review';
  GET DIAGNOSTICS corrected_count = ROW_COUNT;
  IF corrected_count<>3 THEN
    RAISE EXCEPTION '% corrected % variants instead of 3',migration_key,corrected_count;
  END IF;

  INSERT INTO coaching.exercise_score_v1(
    exercise_id,technical_complexity,absolute_load_demand,coordination_demand,
    impact,supervision_demand,base_overall_difficulty,legacy_scores,
    migration_confidence,human_review_status,reviewed_by,reviewed_at,
    review_notes)
  VALUES(
    16,68,72,58,1,76,72,jsonb_build_object(
      'scoreContractCorrection',migration_key,
      'impactScore',1,
      'plannedLandingContacts',0,
      'difficultyChanged',FALSE,
      'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),62,'queued',NULL,NULL,
    'Candidate exercise complexity and physical difficulty only. The impact score of 1 is the normalized minimum for zero planned flight or landing contacts; independent calibration remains required.')
  ON CONFLICT(exercise_id) DO UPDATE SET
    technical_complexity=EXCLUDED.technical_complexity,
    absolute_load_demand=EXCLUDED.absolute_load_demand,
    coordination_demand=EXCLUDED.coordination_demand,
    impact=EXCLUDED.impact,
    supervision_demand=EXCLUDED.supervision_demand,
    base_overall_difficulty=EXCLUDED.base_overall_difficulty,
    legacy_scores=coalesce(coaching.exercise_score_v1.legacy_scores,'{}'::JSONB)
      ||EXCLUDED.legacy_scores,
    migration_confidence=EXCLUDED.migration_confidence,
    human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes=EXCLUDED.review_notes,updated_at=now()
  WHERE coaching.exercise_score_v1.human_review_status='queued'
    AND coaching.exercise_score_v1.reviewed_by IS NULL
    AND coaching.exercise_score_v1.reviewed_at IS NULL;

  UPDATE coaching.exercise_card_test_packet_v1 SET
    audit_version=migration_key,
    checks_json=jsonb_set(
      jsonb_set(checks_json,'{difficulty,scoreContractCorrected}','true'::JSONB,TRUE),
      '{loadFatigueRecovery,impactAccumulationMinimum}','1'::JSONB,TRUE),
    checked_at=now()
  WHERE definition_id=canonical_definition AND card_version=2
    AND audit_version='479_coaching_back_bridge_hold_family_audit_hardening'
    AND status='quarantined' AND human_review_required;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_definition
        AND status='review'
        AND (difficulty_json->>'technicalComplexity')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'absoluteLoadDemand')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=(difficulty_json->>'absoluteLoadDemand')::INTEGER
        AND (difficulty_json->>'workCapacityDemand')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'impact')::INTEGER=1
        AND (difficulty_json->>'supervisionDemand')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'failureConsequence')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'absoluteLoadDemand')::INTEGER)
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (load_profile_json->>'plannedImpactContacts')::INTEGER=0)<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=16 AND impact=1 AND human_review_status='queued'
        AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition
        AND (status<>'review' OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL)) THEN
    RAISE EXCEPTION '% did not restore the normalized score contract or preserve quarantine',migration_key;
  END IF;
END;
$$;
