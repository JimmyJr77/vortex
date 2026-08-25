-- Carry candidate-only evidence and alternate assessments across the prior
-- support-only card-version update. Their review status remains candidate;
-- no reviewer, evidence approval, or alternate approval is created here.
DO $planned_180_turn_candidate_evidence_card_version_refresh$
DECLARE
  migration_key CONSTANT TEXT := '723_coaching_180_turn_candidate_evidence_card_version_refresh';
  definition_id_value UUID;
  card_version_value INTEGER;
BEGIN
  SELECT id, card_version INTO definition_id_value, card_version_value
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='180-degree-turn-shuttle-cut' AND status='review';

  IF definition_id_value IS NULL OR card_version_value < 4 THEN
    RAISE EXCEPTION '% requires the support-complete review card at version 4 or later', migration_key;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET reviewed_card_version=card_version_value,
      updated_at=now()
  WHERE definition_id=definition_id_value
    AND reviewed_card_version<card_version_value
    AND review_status='candidate'
    AND reviewer_user_id IS NULL;

  UPDATE coaching.exercise_alternate_assessment_v1
  SET reviewed_card_version=card_version_value,
      updated_at=now()
  WHERE definition_id=definition_id_value
    AND reviewed_card_version<card_version_value
    AND review_status='candidate'
    AND reviewer_user_id IS NULL;

  IF (SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=definition_id_value
        AND reviewed_card_version=card_version_value
        AND review_status='candidate'
        AND reviewer_user_id IS NULL) < 16 THEN
    RAISE EXCEPTION '% requires all 16 candidate evidence sections at the active card version', migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=definition_id_value
        AND reviewed_card_version=card_version_value
        AND review_status='candidate'
        AND reviewer_user_id IS NULL) < 5 THEN
    RAISE EXCEPTION '% requires all five candidate alternate assessments at the active card version', migration_key;
  END IF;
END;
$planned_180_turn_candidate_evidence_card_version_refresh$;
