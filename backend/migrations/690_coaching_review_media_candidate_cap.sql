-- Keep the active review packet at the documented three-to-five candidate
-- videos. Surplus discovery records remain recoverable as superseded; this is
-- availability curation only and does not create a media approval.
DO $review_media_candidate_cap$
DECLARE
  migration_key CONSTANT TEXT := '690_coaching_review_media_candidate_cap';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_media_candidate_v1 m
    JOIN coaching.exercise_definition_v1 d ON d.id = m.definition_id
    WHERE d.facility_id = 1
      AND d.status = 'review'
      AND m.reviewed_card_version = d.card_version
      AND m.review_status = 'candidate'
      AND (m.reviewer_user_id IS NOT NULL OR m.reviewed_at IS NOT NULL
        OR m.exact_variant_match IS TRUE OR m.demonstration_quality_score IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refuses to recurate human-reviewed candidate media', migration_key;
  END IF;

  WITH ranked AS (
    SELECT m.id,
      row_number() OVER (
        PARTITION BY m.definition_id
        ORDER BY
          CASE WHEN m.link_status = 'healthy' AND m.embedding_allowed IS TRUE THEN 0 ELSE 1 END,
          m.updated_at DESC,
          m.video_id
      ) AS candidate_rank
    FROM coaching.exercise_media_candidate_v1 m
    JOIN coaching.exercise_definition_v1 d ON d.id = m.definition_id
    WHERE d.facility_id = 1
      AND d.status = 'review'
      AND m.reviewed_card_version = d.card_version
      AND m.review_status = 'candidate'
  )
  UPDATE coaching.exercise_media_candidate_v1 m
  SET review_status = 'superseded',
      notes = concat_ws(E'\n', m.notes,
        'Retained as surplus discovery evidence by ' || migration_key
          || '; the current review packet presents no more than five candidates. '
          || 'This is not an exact-match, quality, or approval decision.'),
      updated_at = now()
  FROM ranked
  WHERE m.id = ranked.id AND ranked.candidate_rank > 5;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 d
    WHERE d.facility_id = 1 AND d.status = 'review'
      AND (
        SELECT count(DISTINCT m.video_id)
        FROM coaching.exercise_media_candidate_v1 m
        WHERE m.definition_id = d.id
          AND m.reviewed_card_version = d.card_version
          AND m.review_status IN ('candidate', 'shortlisted', 'approved')
      ) NOT BETWEEN 3 AND 5
  ) THEN
    RAISE EXCEPTION '% requires every active review card to retain three to five media candidates', migration_key;
  END IF;
END;
$review_media_candidate_cap$;
