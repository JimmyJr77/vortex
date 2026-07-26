-- Exercise-card difficulty is assessed through technical complexity and
-- physical difficulty. Overall difficulty is derived, never calibrated as an
-- independent skill classification.
--
-- Keep baseOverallDifficulty in the database constraint for historical audit
-- rows, but application code no longer creates new proposals for that derived
-- dimension. Add absoluteLoadDemand so physical-difficulty anchors can be
-- proposed and independently reviewed.
-- IDEMPOTENT.

DO $$
BEGIN
  IF to_regclass('coaching.exercise_score_calibration_v1') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE coaching.exercise_score_calibration_v1
    DROP CONSTRAINT IF EXISTS exercise_score_calibration_v1_dimension_check;

  ALTER TABLE coaching.exercise_score_calibration_v1
    ADD CONSTRAINT exercise_score_calibration_v1_dimension_check
    CHECK (dimension IN (
      'baseOverallDifficulty', 'technicalComplexity', 'absoluteLoadDemand',
      'supervisionDemand', 'failureConsequence', 'impact',
      'workCapacityDemand', 'gripDemand', 'spinalLoading',
      'eccentricStress', 'localMuscleFatigue', 'gripFatigue',
      'technicalFatigueSensitivity', 'impactAccumulation'
    ));
END
$$;
