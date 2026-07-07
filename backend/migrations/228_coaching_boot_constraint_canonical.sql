-- Canonical boot constraint repair: permissive checks that do not block library seeds.
-- Runs before the migration loop so legacy infrastructure migrations cannot shrink constraints.
-- IDEMPOTENT.

-- Subroles evolve per library; enum CHECK caused boot failures when later seeds added new keys.
ALTER TABLE coaching.exercise DROP CONSTRAINT IF EXISTS exercise_phase_subrole_check;
ALTER TABLE coaching.exercise ADD CONSTRAINT exercise_phase_subrole_check
  CHECK (phase_subrole IS NULL OR phase_subrole ~ '^[a-z][a-z0-9_]*$');

ALTER TABLE coaching.exercise_phase_profile DROP CONSTRAINT IF EXISTS exercise_phase_profile_intensity_ceiling_check;
ALTER TABLE coaching.exercise_phase_profile ADD CONSTRAINT exercise_phase_profile_intensity_ceiling_check
  CHECK (intensity_ceiling IS NULL OR intensity_ceiling ~ '^[a-z][a-z0-9_-]*$');

ALTER TABLE coaching.exercise_dosage_profile DROP CONSTRAINT IF EXISTS exercise_dosage_profile_volume_unit_check;
ALTER TABLE coaching.exercise_dosage_profile ADD CONSTRAINT exercise_dosage_profile_volume_unit_check
  CHECK (volume_unit IN (
    'reps', 'seconds', 'distance', 'contacts', 'rounds', 'attempts', 'intervals', 'breaths',
    'sprints', 'runs', 'decelerations', 'bounds', 'cuts', 'turns', 'reps_or_seconds',
    'reps_each_side', 'contacts_each_side', 'descents', 'drives', 'eccentric_reps', 'holds',
    'landings', 'passes_or_freezes', 'pulls_or_attempts', 'reaches', 'rotations', 'taps',
    'cues', 'steps', 'throws', 'catches', 'jumps', 'hops', 'skips', 'tags', 'games'
  ));

ALTER TABLE coaching.exercise_safety_profile DROP CONSTRAINT IF EXISTS exercise_safety_profile_requires_coach_supervision_check;
ALTER TABLE coaching.exercise_safety_profile ADD CONSTRAINT exercise_safety_profile_requires_coach_supervision_check
  CHECK (requires_coach_supervision IN (
    'none', 'optional', 'recommended', 'required', 'optional_to_recommended'
  ));
