-- The preceding support-only completion advanced the card version without
-- changing the movement identity, video URLs, or candidate status. Carry the
-- unreviewed candidate records to that version so a fresh oEmbed check can
-- assess current embeddability. This is explicitly not a human media review.
DO $planned_180_turn_candidate_media_card_version_refresh$
DECLARE
  migration_key CONSTANT TEXT := '722_coaching_180_turn_candidate_media_card_version_refresh';
  definition_id_value UUID;
  card_version_value INTEGER;
BEGIN
  SELECT id, card_version INTO definition_id_value, card_version_value
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='180-degree-turn-shuttle-cut' AND status='review';

  IF definition_id_value IS NULL OR card_version_value < 4 THEN
    RAISE EXCEPTION '% requires the support-complete review card at version 4 or later', migration_key;
  END IF;

  UPDATE coaching.exercise_media_candidate_v1
  SET reviewed_card_version=card_version_value,
      notes=concat_ws(' ', notes,
        'Candidate metadata carried forward by ', migration_key,
        'after a support-only card-version update; no exact-match or human quality approval is implied.'),
      updated_at=now()
  WHERE definition_id=definition_id_value
    AND reviewed_card_version<card_version_value
    AND review_status='candidate'
    AND reviewer_user_id IS NULL
    AND exact_variant_match IS NOT TRUE;

  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_media_candidate_v1
    WHERE definition_id=definition_id_value
      AND reviewed_card_version=card_version_value
      AND review_status='candidate'
      AND reviewer_user_id IS NULL
      AND exact_variant_match IS NOT TRUE
  ) THEN
    RAISE EXCEPTION '% found no unreviewed media candidates to carry forward', migration_key;
  END IF;
END;
$planned_180_turn_candidate_media_card_version_refresh$;
