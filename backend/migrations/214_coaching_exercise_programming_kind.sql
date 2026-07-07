-- Exercise vs skill-drill split + drop complexity from difficulty profile.
-- Exercises: age-gated workouts (load = external weight, technical = movement pattern).
-- Skill drills: skill-acquisition work; difficulty gates on athlete/class level, not age.
-- IDEMPOTENT.

ALTER TABLE coaching.exercise
  ADD COLUMN IF NOT EXISTS programming_kind TEXT NOT NULL DEFAULT 'exercise';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'exercise_programming_kind_check'
      AND conrelid = 'coaching.exercise'::regclass
  ) THEN
    ALTER TABLE coaching.exercise
      ADD CONSTRAINT exercise_programming_kind_check
      CHECK (programming_kind IN ('exercise', 'skill_drill'));
  END IF;
END $$;

ALTER TABLE coaching.exercise
  ADD COLUMN IF NOT EXISTS linked_skill_id BIGINT REFERENCES coaching.skill(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coaching_exercise_programming_kind
  ON coaching.exercise(programming_kind);

CREATE INDEX IF NOT EXISTS idx_coaching_exercise_linked_skill
  ON coaching.exercise(linked_skill_id)
  WHERE linked_skill_id IS NOT NULL;

-- Skill-acquisition drills (movement intelligence shape/tumbling subroles).
UPDATE coaching.exercise
SET programming_kind = 'skill_drill', updated_at = now()
WHERE archived = FALSE
  AND programming_kind = 'exercise'
  AND phase_subrole IN ('skill_tumbling_shape', 'gymnastics_shape_form');

-- Name/slug heuristics for gymnastics skill drills vs athletic exercises.
UPDATE coaching.exercise
SET programming_kind = 'skill_drill', updated_at = now()
WHERE archived = FALSE
  AND programming_kind = 'exercise'
  AND (
    slug ~ '(hand-placement|line-drill|shape-drill|entry-drill|finish-drill|wall-handstand|spotting-drill|progression-drill|drill-for-|pullover|glide-|cast-handstand|tap-swing|beam-mount|bars-mount|hollow-drill|arch-drill|lever-drill|support-hold-on)'
    OR (name ILIKE '%drill%' AND primary_phase_key = 'movement_intelligence'
        AND slug !~ '(sprint|bear-crawl|bear crawl|jump|hop|shuffle|agility|reactive|cone|locomotion|acceleration|deceleration|broad-jump|vertical|pogo|snap-down|skater|ladder-run|conditioning)')
    OR slug ~ '^(cartwheel|round-off|back-handspring|front-handspring|handstand-|aerial-|layout-|muscle-up|front-tuck|back-tuck|walkover)'
  );

DROP INDEX IF EXISTS coaching.idx_exercise_difficulty_complexity;
ALTER TABLE coaching.exercise_difficulty_profile DROP COLUMN IF EXISTS complexity;
