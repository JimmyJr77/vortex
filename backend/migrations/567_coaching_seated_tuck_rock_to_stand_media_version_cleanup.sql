-- Source 81 retains only its current-card-version candidate links.
DELETE FROM coaching.exercise_media_candidate_v1 AS candidate
USING coaching.exercise_definition_v1 AS definition
WHERE candidate.definition_id=definition.id
  AND definition.facility_id=1
  AND definition.legacy_exercise_id=81
  AND (
    candidate.reviewed_card_version<>definition.card_version
    OR candidate.url <> ALL (ARRAY[
      'https://www.youtube.com/watch?v=rxgMUlvMXxs',
      'https://www.youtube.com/watch?v=sCBswDE9WKw',
      'https://www.youtube.com/watch?v=IB4t9ughOFk'
    ]::TEXT[])
  );
