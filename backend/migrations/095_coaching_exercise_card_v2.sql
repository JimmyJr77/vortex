-- Exercise card v2: movement identity, requirements, structured execution, cohort scaling, pairing, media library.
-- IDEMPOTENT.

ALTER TABLE coaching.exercise ADD COLUMN IF NOT EXISTS movement_family TEXT;
ALTER TABLE coaching.exercise ADD COLUMN IF NOT EXISTS primary_phase_key TEXT;
ALTER TABLE coaching.exercise ADD COLUMN IF NOT EXISTS phase_subrole TEXT;
ALTER TABLE coaching.exercise ADD COLUMN IF NOT EXISTS primary_order_slot TEXT;
ALTER TABLE coaching.exercise ADD COLUMN IF NOT EXISTS movement_requirements JSONB NOT NULL DEFAULT '{}';
ALTER TABLE coaching.exercise ADD COLUMN IF NOT EXISTS coaching_execution JSONB NOT NULL DEFAULT '{}';
ALTER TABLE coaching.exercise ADD COLUMN IF NOT EXISTS pairing_logic JSONB NOT NULL DEFAULT '{}';
ALTER TABLE coaching.exercise ADD COLUMN IF NOT EXISTS media_library JSONB NOT NULL DEFAULT '{}';

DO $$ BEGIN
  ALTER TABLE coaching.exercise ADD CONSTRAINT exercise_phase_subrole_check
    CHECK (phase_subrole IS NULL OR phase_subrole IN ('raise', 'mobilize', 'activate', 'integrate', 'potentiate_bridge'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE coaching.exercise ADD CONSTRAINT exercise_primary_phase_key_check
    CHECK (primary_phase_key IS NULL OR primary_phase_key IN (
      'prepare_and_access', 'movement_intelligence', 'output', 'capacity',
      'resilience', 'sustained_capacity', 'restore'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_coaching_exercise_primary_phase ON coaching.exercise(primary_phase_key);
CREATE INDEX IF NOT EXISTS idx_coaching_exercise_movement_family ON coaching.exercise(movement_family);

ALTER TABLE coaching.education_content ADD COLUMN IF NOT EXISTS why_it_works TEXT;
ALTER TABLE coaching.education_content ADD COLUMN IF NOT EXISTS physiological_rationale TEXT;

ALTER TABLE coaching.exercise_safety_profile ADD COLUMN IF NOT EXISTS contraindications TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE coaching.exercise_scaling_profile ADD COLUMN IF NOT EXISTS cohort_key TEXT;
ALTER TABLE coaching.exercise_scaling_profile ADD COLUMN IF NOT EXISTS requires_medical_clearance BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE coaching.exercise_scaling_profile ADD COLUMN IF NOT EXISTS gender_specific_notes TEXT;

DO $$ BEGIN
  ALTER TABLE coaching.exercise_scaling_profile ADD CONSTRAINT exercise_scaling_cohort_key_check
    CHECK (cohort_key IS NULL OR cohort_key IN (
      'youth_beginner', 'youth_intermediate', 'teen', 'adult_beginner',
      'adult_advanced', 'older_adult', 'pregnancy_postpartum'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_exercise_scaling_cohort
  ON coaching.exercise_scaling_profile(exercise_id, cohort_key)
  WHERE cohort_key IS NOT NULL;

-- Add 'breaths' to dosage volume_unit (drop/recreate check).
DO $$ BEGIN
  ALTER TABLE coaching.exercise_dosage_profile DROP CONSTRAINT IF EXISTS exercise_dosage_profile_volume_unit_check;
  ALTER TABLE coaching.exercise_dosage_profile ADD CONSTRAINT exercise_dosage_profile_volume_unit_check
    CHECK (volume_unit IN ('reps', 'seconds', 'distance', 'contacts', 'rounds', 'attempts', 'intervals', 'breaths'));
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Backfill primary phase identity from existing phase profiles.
UPDATE coaching.exercise e SET
  primary_phase_key = CASE sub.phase_key
    WHEN 'prepare_access' THEN 'prepare_and_access'
    WHEN 'skill_movement_intelligence' THEN 'movement_intelligence'
    WHEN 'control_resilience' THEN 'resilience'
    WHEN 'fitness_repeatability' THEN 'sustained_capacity'
    ELSE sub.phase_key
  END,
  primary_order_slot = sub.order_slot,
  movement_requirements = CASE
    WHEN e.movement_requirements = '{}'::jsonb OR e.movement_requirements IS NULL
    THEN jsonb_build_object('impact_level', sub.impact_level)
    ELSE e.movement_requirements || jsonb_build_object('impact_level', COALESCE((e.movement_requirements->>'impact_level')::int, sub.impact_level))
  END
FROM (
  SELECT DISTINCT ON (p.exercise_id)
    p.exercise_id, sp.key AS phase_key, p.order_slot, p.impact_level
  FROM coaching.exercise_phase_profile p
  JOIN coaching.session_phase sp ON sp.id = p.phase_id
  WHERE p.role != 'avoid'
  ORDER BY p.exercise_id,
    CASE p.role WHEN 'primary' THEN 0 WHEN 'secondary' THEN 1 ELSE 2 END,
    p.fit_weight DESC
) sub
WHERE e.id = sub.exercise_id AND e.primary_phase_key IS NULL;

-- Map legacy programming_logic pairing fields into pairing_logic JSONB.
UPDATE coaching.exercise e SET pairing_logic = jsonb_strip_nulls(jsonb_build_object(
  'pairs_well_before', COALESCE(e.programming_logic->'recommended_preceded_by', '[]'::jsonb),
  'pairs_well_after', COALESCE(e.programming_logic->'recommended_followed_by', '[]'::jsonb),
  'do_not_use_when', COALESCE(e.programming_logic->'avoid_when', '[]'::jsonb),
  'good_for_sessions', COALESCE(e.programming_logic->'best_used_for', '[]'::jsonb)
))
WHERE (e.pairing_logic IS NULL OR e.pairing_logic = '{}'::jsonb)
  AND e.programming_logic IS NOT NULL
  AND e.programming_logic != '{}'::jsonb;
