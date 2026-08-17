-- Complete the missing physical-difficulty field on three already-researched
-- A-series cards. These remain review-only candidate cards; this migration does
-- not approve media, change exact-match status, or classify participants.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '552_coaching_a_series_physical_difficulty_contract_corrections';
  spec RECORD;
  canonical_definition UUID;
  active_variant UUID;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('a-march-to-projection'::TEXT,1117,18,55,ARRAY['am3v2I1LxaM','IvXNw4B3lqI','m0E3sqM4lcg','xjxaIFVLqco','zeQ_vRyB35Q']::TEXT[]),
      ('a-skip'::TEXT,95,16,52,ARRAY['0fz4tO3IDzU','A7r6yCpmSrA','qwcDGGB392g','Vu3eqv9lSZw','xiYTMBLqp8c']::TEXT[]),
      ('high-knee-a-march-ladder'::TEXT,1636,16,59,ARRAY['0uNKUw3LnQY','K0gwRQQ_uMk','knZBLBIBsak','M2Cwt3Z-_ok','v_TxtFHT2DU']::TEXT[])
    ) AS values_set(slug,legacy_exercise_id,physical_difficulty,overall_difficulty,video_ids)
  LOOP
    SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1
    WHERE facility_id=1 AND legacy_exercise_id=spec.legacy_exercise_id
      AND slug=spec.slug AND status='review' AND card_version=2;
    SELECT id INTO active_variant FROM coaching.exercise_variant_v1
    WHERE definition_id=canonical_definition AND variant_key='baseline' AND status='review';
    IF canonical_definition IS NULL OR active_variant IS NULL THEN
      RAISE EXCEPTION '% requires active version-2 review candidate for %',migration_key,spec.slug;
    END IF;
    IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_definition
        AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL))
      OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
        WHERE definition_id=canonical_definition AND reviewed_card_version=2
          AND (review_status='approved' OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL)) THEN
      RAISE EXCEPTION '% refuses to overwrite human-reviewed state for %',migration_key,spec.slug;
    END IF;
    UPDATE coaching.exercise_variant_v1 SET
      difficulty_json=jsonb_set(
        jsonb_set(coalesce(difficulty_json,'{}'::JSONB),'{physicalDifficulty}',to_jsonb(spec.physical_difficulty),TRUE),
        '{baseOverallDifficulty}',to_jsonb(spec.overall_difficulty),TRUE),
      updated_at=now()
    WHERE id=active_variant;
    UPDATE coaching.exercise_definition_v1 SET
      provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
        'physicalDifficultyCorrection',migration_key,
        'difficultyEvidence','411_coaching_a_series_sprint_drills_research_completion',
        'exerciseScoresDescribeTaskOnly',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      updated_at=now()
    WHERE id=canonical_definition;
    IF NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=active_variant
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=spec.physical_difficulty
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=spec.overall_difficulty
        AND (difficulty_json->>'absoluteLoadDemand')::INTEGER=spec.physical_difficulty)
      OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
          WHERE definition_id=canonical_definition AND reviewed_card_version=2
            AND review_status='candidate' AND video_id=ANY(spec.video_ids)
            AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>5
      OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
          WHERE definition_id=canonical_definition AND reviewed_card_version=2 AND review_status='approved') THEN
      RAISE EXCEPTION '% physical-difficulty or candidate-media assertions failed for %',migration_key,spec.slug;
    END IF;
  END LOOP;
END
$migration$;
