-- 179: Participant structure for exercises.
-- Adds coaching.exercise.participant_structure ('individual' | 'pairs' | 'group').
-- Default is 'individual' for everything; backfill flips exercises whose existing
-- card content already expresses that the movement requires more than one athlete.
-- Spotters and coach-delivered stimulus ("coach or partner") do NOT count as pairs.
--
-- IDEMPOTENT + ONE-SHOT: the whole block is guarded on the column not existing yet,
-- so the heuristic backfill runs exactly once per database and never overwrites
-- later coach edits when migrations re-run at boot.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'coaching' AND table_name = 'exercise' AND column_name = 'participant_structure'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE coaching.exercise
    ADD COLUMN participant_structure TEXT NOT NULL DEFAULT 'individual'
    CONSTRAINT coaching_exercise_participant_structure_check
    CHECK (participant_structure IN ('individual', 'pairs', 'group'));

  -- Rule 1: exercises explicitly named as partner drills require a second athlete.
  UPDATE coaching.exercise
  SET participant_structure = 'pairs', updated_at = now()
  WHERE participant_structure = 'individual'
    AND name ~* '\mpartners?\M';

  -- Rule 2: drills built around two partners plus the athlete are small-group work.
  UPDATE coaching.exercise
  SET participant_structure = 'group', updated_at = now()
  WHERE name ~* 'two[- ]partner';

  -- Rule 3: setup/execution steps require a partner with no coach/wall/equipment
  -- alternative offered, and the partner is not merely spotting.
  UPDATE coaching.exercise
  SET participant_structure = 'pairs', updated_at = now()
  WHERE participant_structure = 'individual'
    AND (
      COALESCE((coaching_execution->'setup')::text, '') ~* '\mpartners?\M'
      OR COALESCE((coaching_execution->'execution_steps')::text, '') ~* '\mpartners?\M'
    )
    AND NOT (
      COALESCE((coaching_execution->'setup')::text, '') || ' ' || COALESCE((coaching_execution->'execution_steps')::text, '')
    ) ~* '((coach|wall|pad|equipment|anchor|machine|band|cone)[a-z ]{0,16}\mor\M[a-z ,]{0,24}partner)|(partner[a-z ]{0,16}\mor\M[a-z ,]{0,24}(coach|wall|pad|equipment|anchor|machine|band|cone))|(partners?\s+(spot|spots|spotting))';
END $$;
