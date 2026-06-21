-- Link coach assignments to scheduling classes (scheduling_form), not legacy class_iteration.

ALTER TABLE coach_class_assignment
  ADD COLUMN IF NOT EXISTS scheduling_form_id BIGINT REFERENCES scheduling_form(id) ON DELETE CASCADE;

ALTER TABLE coach_class_assignment
  DROP CONSTRAINT IF EXISTS coach_class_assignment_check;

ALTER TABLE coach_class_assignment
  ADD CONSTRAINT coach_class_assignment_target_check
  CHECK (
    program_id IS NOT NULL
    OR scheduling_form_id IS NOT NULL
    OR class_iteration_id IS NOT NULL
  );

ALTER TABLE coach_class_assignment
  DROP CONSTRAINT IF EXISTS coach_class_assignment_coach_user_id_program_id_class_iteration_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_class_assignment_program_only
  ON coach_class_assignment (coach_user_id, program_id)
  WHERE scheduling_form_id IS NULL AND class_iteration_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_class_assignment_scheduling_form
  ON coach_class_assignment (coach_user_id, scheduling_form_id)
  WHERE scheduling_form_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coach_class_assignment_scheduling_form
  ON coach_class_assignment (scheduling_form_id);
