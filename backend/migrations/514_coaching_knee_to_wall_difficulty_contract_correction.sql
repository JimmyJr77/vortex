-- Complete Source 40's normalized task-difficulty vector after migration 513.
-- These remain unapproved candidate scores for the exercise task; they do not
-- classify participant skill, readiness, age, or proficiency.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '514_coaching_knee_to_wall_difficulty_contract_correction';
  prerequisite_migration CONSTANT TEXT :=
    '513_coaching_knee_to_wall_normalized_score_floor_correction.sql';
  canonical_definition UUID;
  exact_variant UUID;
BEGIN
  SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=40;
  SELECT id INTO exact_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition
    AND variant_key='standing-knee-to-wall-forward-return-cycle';
  IF NOT EXISTS(
      SELECT 1 FROM schema_migrations
      WHERE filename=prerequisite_migration)
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND card_version=2
        AND schema_version='2.0.0' AND status='review')
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id=canonical_definition
        AND status='review'
        AND (difficulty_json->>'technicalComplexity')::INTEGER=18
        AND (difficulty_json->>'absoluteLoadDemand')::INTEGER=12
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=12
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=18
        AND (load_profile_json->>'gripDemand')::INTEGER=1
        AND (fatigue_profile_json->>'gripFatigue')::INTEGER=1
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1)
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=40 AND technical_complexity=18
        AND absolute_load_demand=12 AND coordination_demand=16
        AND impact=1 AND supervision_demand=12
        AND base_overall_difficulty=18 AND human_review_status='queued'
        AND reviewed_by IS NULL AND reviewed_at IS NULL) THEN
    RAISE EXCEPTION
      '% prerequisite migration or Source 40 difficulty state is missing or drifted',
      migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL
          OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_card_review_v1
      WHERE definition_id=canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_card_revision_v1
      WHERE definition_id=canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=exact_variant OR to_variant_id=exact_variant)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status='approved'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=exact_variant
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL
          OR status='approved')) THEN
    RAISE EXCEPTION
      '% refuses to alter human-reviewed or published Source 40 state',
      migration_key;
  END IF;

  UPDATE coaching.exercise_variant_v1 SET
    difficulty_json=difficulty_json||jsonb_build_object(
      'technicalComplexity',18,
      'absoluteLoadDemand',12,
      'physicalDifficulty',12,
      'coordinationDemand',16,
      'supervisionDemand',12,
      'failureConsequence',12,
      'impact',1,
      'workCapacityDemand',12,
      'baseOverallDifficulty',greatest(18,12),
      'overallFormula','max_exercise_complexity_physical_difficulty',
      'scoreState','review_only_requires_independent_calibration',
      'taskDifficultyContractCorrection',migration_key,
      'exerciseScoresDescribeTaskOnly',TRUE,
      'participantClassificationAbsent',TRUE,
      'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=exact_variant AND definition_id=canonical_definition
    AND status='review';

  UPDATE coaching.exercise_definition_v1 SET
    provenance_json=provenance_json||jsonb_build_object(
      'taskDifficultyContractCorrection',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseScoresDescribeTaskOnly',TRUE,
      'participantClassificationAbsent',TRUE,
      'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=canonical_definition AND status='review'
    AND reviewed_by IS NULL AND approved_by IS NULL
    AND last_reviewed_at IS NULL AND approved_video_url IS NULL;

  UPDATE coaching.exercise_card_test_packet_v1 SET
    audit_version=migration_key,
    checks_json=CASE jsonb_typeof(checks_json)
      WHEN 'array' THEN checks_json||jsonb_build_array(jsonb_build_object(
        'id','CARD-DIFFICULTY-CONTRACT-514',
        'status','passed',
        'category','difficulty',
        'message','Required normalized task-difficulty dimensions are complete and overall is derived from complexity and physical difficulty.',
        'evidence',jsonb_build_object(
          'technicalComplexity',18,
          'physicalDifficulty',12,
          'baseOverallDifficulty',18,
          'derivedOverall',TRUE,
          'requiredNormalizedDimensionsComplete',TRUE,
          'exerciseScoresDescribeTaskOnly',TRUE,
          'participantClassificationAbsent',TRUE,
          'independentCalibrationRequired',TRUE,
          'humanReviewRequired',TRUE,
          'approvalsCreated',FALSE)))
      ELSE checks_json||jsonb_build_object(
        'difficultyContractCorrection',jsonb_build_object(
          'passed',TRUE,
          'technicalComplexity',18,
          'physicalDifficulty',12,
          'baseOverallDifficulty',18,
          'derivedOverall',TRUE,
          'requiredNormalizedDimensionsComplete',TRUE,
          'exerciseScoresDescribeTaskOnly',TRUE,
          'participantClassificationAbsent',TRUE,
          'independentCalibrationRequired',TRUE,
          'humanReviewRequired',TRUE,
          'approvalsCreated',FALSE))
      END,
    blocking_issues_json=jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','category','media',
        'message','Exact-match candidate media must be watched in full and approved for card version 2 by an authorized human reviewer.'),
      jsonb_build_object('code','CARD-GRAPH-03','category','relationship_graph',
        'message','Candidate progression, regression, and substitution relationships require authorized human review.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','category','calibration',
        'message','Candidate difficulty scores require independent calibration and authorized human review.'),
      jsonb_build_object('code','CARD-PUBLISH-01','category','publication',
        'message','Publication remains blocked until all human evidence, media, relationship, calibration, and content gates pass.')),
    status='quarantined',human_review_required=TRUE,checked_at=now()
  WHERE definition_id=canonical_definition AND card_version=2;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id=canonical_definition
        AND status='review'
        AND (difficulty_json->>'technicalComplexity')::INTEGER=18
        AND (difficulty_json->>'absoluteLoadDemand')::INTEGER=12
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=12
        AND (difficulty_json->>'coordinationDemand')::INTEGER=16
        AND (difficulty_json->>'supervisionDemand')::INTEGER=12
        AND (difficulty_json->>'failureConsequence')::INTEGER=12
        AND (difficulty_json->>'impact')::INTEGER=1
        AND (difficulty_json->>'workCapacityDemand')::INTEGER=12
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=
          greatest(
            (difficulty_json->>'technicalComplexity')::INTEGER,
            (difficulty_json->>'absoluteLoadDemand')::INTEGER)
        AND difficulty_json->>'taskDifficultyContractCorrection'=migration_key
        AND difficulty_json->>'participantClassificationAbsent'='true'
        AND difficulty_json->>'approvalsCreated'='false') THEN
    RAISE EXCEPTION '% failed exact task-difficulty vector correction',
      migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND status='review'
        AND provenance_json->>'taskDifficultyContractCorrection'=migration_key
        AND provenance_json->>'participantClassificationAbsent'='true'
        AND provenance_json->>'approvalsCreated'='false'
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL AND approved_video_url IS NULL) THEN
    RAISE EXCEPTION '% failed definition provenance or quarantine preservation',
      migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND audit_version=migration_key AND status='quarantined'
        AND human_review_required
        AND (
          (jsonb_typeof(checks_json)='object'
            AND checks_json#>>'{difficultyContractCorrection,passed}'='true'
            AND checks_json#>>'{difficultyContractCorrection,participantClassificationAbsent}'='true'
            AND checks_json#>>'{difficultyContractCorrection,approvalsCreated}'='false')
          OR
          (jsonb_typeof(checks_json)='array'
            AND EXISTS(
              SELECT 1 FROM jsonb_array_elements(checks_json) item
              WHERE item->>'id'='CARD-DIFFICULTY-CONTRACT-514'
                AND item->>'status'='passed'
                AND item#>>'{evidence,participantClassificationAbsent}'='true'
                AND item#>>'{evidence,approvalsCreated}'='false')))
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% failed test-packet correction or quarantine preservation',
      migration_key;
  END IF;

  IF coaching.exercise_json_has_level_classification(
      (SELECT difficulty_json FROM coaching.exercise_variant_v1
       WHERE id=exact_variant)) THEN
    RAISE EXCEPTION
      '% introduced a participant skill or proficiency classification',
      migration_key;
  END IF;
END;
$$;
