-- Compatibility patch for the candidate card materializer.
-- Keep 523 immutable because environments may have recorded it already. This
-- migration runs before any materialized card and normalizes the legacy table
-- contract that the materializer needs on both fresh and upgraded databases.

ALTER TABLE coaching.exercise_safety_profile
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION coaching.preserve_exercise_est_seconds_per_set_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $preserve_exercise_estimate$
BEGIN
  -- Candidate cards may intentionally omit a legacy per-set estimate because
  -- the exact candidate has contextual delivery profiles. The old legacy
  -- column is NOT NULL, so retain its value instead of rejecting the whole
  -- candidate-card transaction.
  IF NEW.est_seconds_per_set IS NULL AND OLD.est_seconds_per_set IS NOT NULL THEN
    NEW.est_seconds_per_set := OLD.est_seconds_per_set;
  END IF;
  RETURN NEW;
END;
$preserve_exercise_estimate$;

DROP TRIGGER IF EXISTS preserve_exercise_est_seconds_per_set_v1
  ON coaching.exercise;

CREATE TRIGGER preserve_exercise_est_seconds_per_set_v1
  BEFORE UPDATE OF est_seconds_per_set ON coaching.exercise
  FOR EACH ROW
  EXECUTE FUNCTION coaching.preserve_exercise_est_seconds_per_set_v1();
