-- Skill evaluation model: link to exercises, measure by execution quality, duration, or reps.
-- IDEMPOTENT.

ALTER TABLE coaching.skill ADD COLUMN IF NOT EXISTS exercise_id BIGINT REFERENCES coaching.exercise(id) ON DELETE SET NULL;
ALTER TABLE coaching.skill ADD COLUMN IF NOT EXISTS evaluation_mode TEXT NOT NULL DEFAULT 'execution';
ALTER TABLE coaching.skill ADD COLUMN IF NOT EXISTS min_reps INTEGER;
ALTER TABLE coaching.skill ADD COLUMN IF NOT EXISTS default_reps INTEGER;
ALTER TABLE coaching.skill ADD COLUMN IF NOT EXISTS target_reps INTEGER;
ALTER TABLE coaching.skill ADD COLUMN IF NOT EXISTS execution_max_score NUMERIC;

DO $$ BEGIN
  ALTER TABLE coaching.skill ADD CONSTRAINT skill_evaluation_mode_check
    CHECK (evaluation_mode IN ('execution', 'duration', 'repetitions'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Retire skill_kind = 'hold'; holds are skills evaluated by duration.
UPDATE coaching.skill SET evaluation_mode = 'duration', skill_kind = 'skill' WHERE skill_kind = 'hold';

DO $$ BEGIN
  ALTER TABLE coaching.skill DROP CONSTRAINT IF EXISTS skill_skill_kind_check;
  ALTER TABLE coaching.skill ADD CONSTRAINT skill_skill_kind_check CHECK (skill_kind IN ('skill', 'combo'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_coaching_skill_exercise ON coaching.skill(exercise_id);
CREATE INDEX IF NOT EXISTS idx_coaching_skill_evaluation ON coaching.skill(evaluation_mode);

-- Link seeded skills to matching exercises where slugs align.
UPDATE coaching.skill sk SET exercise_id = e.id
FROM coaching.exercise e
WHERE sk.exercise_id IS NULL AND e.facility_id = sk.facility_id AND (
  (sk.slug = 'plank-hold-skill' AND e.slug = 'plank-hold')
  OR (sk.slug = 'handstand' AND e.slug = 'handstand-hold')
  OR (sk.slug = 'round-off' AND e.slug = 'round-off')
);

UPDATE coaching.skill SET evaluation_mode = 'repetitions', min_reps = 1, default_reps = 3, target_reps = 5
WHERE slug IN ('handstand-push-up-wall', 'muscle-up') AND evaluation_mode = 'execution';
