-- Sync exercise.primary_phase_key CHECK with canonical phase keys used by library seeds (095/137).
-- Repairs DBs where initTables filename drift blocked 096+ boot migrations and left a legacy
-- constraint allowing prepare_access / skill_movement_intelligence / control_resilience only.
-- IDEMPOTENT.

ALTER TABLE coaching.exercise DROP CONSTRAINT IF EXISTS exercise_primary_phase_key_check;

UPDATE coaching.exercise SET primary_phase_key = 'prepare_and_access', updated_at = now()
WHERE primary_phase_key = 'prepare_access';

UPDATE coaching.exercise SET primary_phase_key = 'movement_intelligence', updated_at = now()
WHERE primary_phase_key = 'skill_movement_intelligence';

UPDATE coaching.exercise SET primary_phase_key = 'resilience', updated_at = now()
WHERE primary_phase_key = 'control_resilience';

UPDATE coaching.exercise SET primary_phase_key = 'sustained_capacity', updated_at = now()
WHERE primary_phase_key = 'fitness_repeatability';

ALTER TABLE coaching.exercise ADD CONSTRAINT exercise_primary_phase_key_check
  CHECK (primary_phase_key IS NULL OR primary_phase_key IN (
    'prepare_and_access', 'movement_intelligence', 'output', 'capacity',
    'resilience', 'sustained_capacity', 'restore'
  ));
