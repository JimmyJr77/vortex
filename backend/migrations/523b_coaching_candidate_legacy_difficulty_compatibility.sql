-- Compatibility patch for legacy candidate-card migrations generated before
-- the canonical difficulty vocabulary was constrained. Keep the candidate
-- materializer immutable: previously applied environments may have recorded
-- its checksum. The legacy table is only a compatibility mirror; canonical
-- task scores remain in the versioned candidate payload and require review.

CREATE OR REPLACE FUNCTION coaching.normalize_legacy_exercise_difficulty_profile_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $normalize_legacy_exercise_difficulty_profile$
BEGIN
  -- The historical profile accepts only whole 1–10 values. Candidate payloads
  -- from the early generator can contain fractional source mirrors, so keep
  -- that old table safe without changing the canonical task scores.
  NEW.technical := greatest(1, least(10, coalesce(NEW.technical, 1)));
  NEW.load := greatest(1, least(10, coalesce(NEW.load, 1)));
  NEW.complexity := greatest(1, least(10, coalesce(NEW.complexity, 1)));
  NEW.overall := greatest(1, least(10, coalesce(NEW.overall, 1)));

  -- Normalize only the two known legacy interval labels. An unfamiliar value
  -- must fail closed instead of silently widening the controlled vocabulary.
  NEW.attention_demand := CASE lower(btrim(coalesce(NEW.attention_demand, '')))
    WHEN 'low' THEN 'low'
    WHEN 'moderate' THEN 'moderate'
    WHEN 'high' THEN 'high'
    WHEN 'low_to_moderate' THEN 'moderate'
    WHEN 'moderate_to_high' THEN 'high'
    ELSE NULL
  END;
  IF NEW.attention_demand IS NULL THEN
    RAISE EXCEPTION 'unsupported legacy attention_demand value';
  END IF;
  RETURN NEW;
END;
$normalize_legacy_exercise_difficulty_profile$;

DROP TRIGGER IF EXISTS normalize_legacy_exercise_difficulty_profile_v1
  ON coaching.exercise_difficulty_profile;

CREATE TRIGGER normalize_legacy_exercise_difficulty_profile_v1
  BEFORE INSERT OR UPDATE OF technical, load, complexity, overall, attention_demand
  ON coaching.exercise_difficulty_profile
  FOR EACH ROW
  EXECUTE FUNCTION coaching.normalize_legacy_exercise_difficulty_profile_v1();
