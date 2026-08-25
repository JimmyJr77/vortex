-- Complete the non-primary task-difficulty dimensions for two exact
-- floor-support variants using their existing candidate legacy scores,
-- fatigue/safety context, and nearby review-only floor-support comparators.
-- These are review proposals only: they never classify participant skill or
-- create calibration approval.
DO $floor_support_difficulty_completion$
DECLARE
  target RECORD;
  target_variant UUID;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('bear-crawl-rock-back', 'stationary-bear-hover-rock-back', 20, 18, 1, 24,
        'Existing candidate legacy supervision and impact values, stationary four-contact knee-hover scope, risk level 2, local fatigue 24, and nearby straight-arm floor-support comparators.'),
      ('down-dog-to-plank-wave', 'fixed-support-plank-to-down-dog-cycle', 20, 20, 1, 28,
        'Existing candidate legacy supervision and impact values, fixed four-contact plank-to-inverted-V scope including head-below-heart transition, risk level 2, local fatigue 28, and nearby straight-arm floor-support comparators.')
    ) AS target_data(slug_value, variant_key_value, supervision_score, consequence_score, impact_score, work_capacity_score, basis)
  LOOP
    SELECT v.id INTO target_variant
    FROM coaching.exercise_definition_v1 d
    JOIN coaching.exercise_variant_v1 v ON v.definition_id=d.id
    WHERE d.facility_id=1 AND d.slug=target.slug_value
      AND d.status='review' AND v.variant_key=target.variant_key_value AND v.status='review';
    IF target_variant IS NULL THEN
      RAISE EXCEPTION '702_coaching_floor_support_candidate_difficulty_dimension_completion prerequisite missing for %.%', target.slug_value, target.variant_key_value;
    END IF;
    IF EXISTS (
      SELECT 1 FROM coaching.exercise_definition_v1 d
      WHERE d.id=(SELECT definition_id FROM coaching.exercise_variant_v1 WHERE id=target_variant)
        AND (d.reviewed_by IS NOT NULL OR d.approved_by IS NOT NULL OR d.last_reviewed_at IS NOT NULL)
    ) THEN
      RAISE EXCEPTION '702_coaching_floor_support_candidate_difficulty_dimension_completion refuses human-reviewed %.%', target.slug_value, target.variant_key_value;
    END IF;

    UPDATE coaching.exercise_variant_v1
    SET difficulty_json=difficulty_json || jsonb_build_object(
          'supervisionDemand', target.supervision_score,
          'failureConsequence', target.consequence_score,
          'impact', target.impact_score,
          'workCapacityDemand', target.work_capacity_score,
          'candidateDimensionBasis', target.basis,
          'independentCalibrationRequired', true,
          'exerciseScoresDescribeTaskOnly', true
        ),
        updated_at=now()
    WHERE id=target_variant;

    INSERT INTO coaching.exercise_score_calibration_v1(
      facility_id, variant_id, dimension, proposed_score, anchor_tier, rationale,
      status, version, created_by, reviewed_by, review_notes, reviewed_at
    )
    SELECT 1, target_variant, dimension_data.dimension, dimension_data.score,
      20,
      target.basis || ' This is a review-only candidate task score, not participant proficiency, readiness, age, or skill classification.',
      'review', 1, NULL, NULL,
      'Independent qualified calibration remains required; no approval is created by this migration.', NULL
    FROM (VALUES
      ('supervisionDemand', target.supervision_score),
      ('failureConsequence', target.consequence_score),
      ('impact', target.impact_score),
      ('workCapacityDemand', target.work_capacity_score)
    ) AS dimension_data(dimension, score)
    ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
      proposed_score=EXCLUDED.proposed_score,
      anchor_tier=EXCLUDED.anchor_tier,
      rationale=EXCLUDED.rationale,
      status='review', created_by=NULL, reviewed_by=NULL,
      review_notes=EXCLUDED.review_notes, reviewed_at=NULL, updated_at=now();
  END LOOP;
END;
$floor_support_difficulty_completion$;
