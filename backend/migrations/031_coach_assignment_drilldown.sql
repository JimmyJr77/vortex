-- Coach assignments: top-level program through scheduling timeslot granularity.

ALTER TABLE coach_class_assignment
  ADD COLUMN IF NOT EXISTS programs_id BIGINT;

ALTER TABLE coach_class_assignment
  ADD COLUMN IF NOT EXISTS scheduling_category_id BIGINT REFERENCES scheduling_category(id) ON DELETE CASCADE;

ALTER TABLE coach_class_assignment
  ADD COLUMN IF NOT EXISTS scheduling_offering_id BIGINT REFERENCES scheduling_offering(id) ON DELETE CASCADE;

ALTER TABLE coach_class_assignment
  ADD COLUMN IF NOT EXISTS scheduling_time_slot_id BIGINT REFERENCES scheduling_time_slot(id) ON DELETE CASCADE;

ALTER TABLE coach_class_assignment
  DROP CONSTRAINT IF EXISTS coach_class_assignment_target_check;

ALTER TABLE coach_class_assignment
  ADD CONSTRAINT coach_class_assignment_target_check
  CHECK (
    programs_id IS NOT NULL
    OR program_id IS NOT NULL
    OR scheduling_form_id IS NOT NULL
    OR class_iteration_id IS NOT NULL
    OR scheduling_category_id IS NOT NULL
    OR scheduling_offering_id IS NOT NULL
    OR scheduling_time_slot_id IS NOT NULL
  );

ALTER TABLE coach_class_assignment
  DROP CONSTRAINT IF EXISTS coach_class_assignment_check;

DROP INDEX IF EXISTS ux_coach_class_assignment_program_only;
DROP INDEX IF EXISTS ux_coach_class_assignment_scheduling_form;

CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_programs_top
  ON coach_class_assignment (coach_user_id, programs_id)
  WHERE programs_id IS NOT NULL
    AND program_id IS NULL
    AND scheduling_form_id IS NULL
    AND scheduling_category_id IS NULL
    AND scheduling_offering_id IS NULL
    AND scheduling_time_slot_id IS NULL
    AND class_iteration_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_class_event
  ON coach_class_assignment (coach_user_id, program_id)
  WHERE program_id IS NOT NULL
    AND programs_id IS NULL
    AND scheduling_form_id IS NULL
    AND scheduling_category_id IS NULL
    AND scheduling_offering_id IS NULL
    AND scheduling_time_slot_id IS NULL
    AND class_iteration_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_scheduling_form
  ON coach_class_assignment (coach_user_id, scheduling_form_id)
  WHERE scheduling_form_id IS NOT NULL
    AND scheduling_category_id IS NULL
    AND scheduling_offering_id IS NULL
    AND scheduling_time_slot_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_category
  ON coach_class_assignment (coach_user_id, scheduling_category_id)
  WHERE scheduling_category_id IS NOT NULL
    AND scheduling_offering_id IS NULL
    AND scheduling_time_slot_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_offering
  ON coach_class_assignment (coach_user_id, scheduling_offering_id)
  WHERE scheduling_offering_id IS NOT NULL
    AND scheduling_time_slot_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_time_slot
  ON coach_class_assignment (coach_user_id, scheduling_time_slot_id)
  WHERE scheduling_time_slot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coach_assignment_programs_id ON coach_class_assignment (programs_id);
CREATE INDEX IF NOT EXISTS idx_coach_assignment_category ON coach_class_assignment (scheduling_category_id);
CREATE INDEX IF NOT EXISTS idx_coach_assignment_offering ON coach_class_assignment (scheduling_offering_id);
CREATE INDEX IF NOT EXISTS idx_coach_assignment_time_slot ON coach_class_assignment (scheduling_time_slot_id);
