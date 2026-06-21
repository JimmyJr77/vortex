-- ============================================================
-- 033: Remove scheduling categories from classes
-- ------------------------------------------------------------
-- Classes no longer use "category" as a distinction. This drops
-- the entire scheduling-category concept:
--   - scheduling_category / scheduling_form_category / scheduling_category_field
--   - category_id on scheduling_offering / scheduling_slot_group /
--     scheduling_time_slot / scheduling_signup
--   - program.scheduling_category_id
--   - coach_class_assignment.scheduling_category_id (drill-down level)
--   - the 'category' scope on pricing_benefit_selection
--   - the 'category' target on coaching.plan_assignment
--
-- category_id was already nullable everywhere (a global "No Category"
-- row backed every class), so collapsing to none and dropping the
-- objects is non-destructive to real scheduling data.
--
-- IDEMPOTENT and guarded. Runs inside the migration runner's own
-- transaction, so it must not contain BEGIN/COMMIT.
-- ============================================================

-- 1) Coach assignment drill-down: drop the category level.
ALTER TABLE coach_class_assignment
  DROP CONSTRAINT IF EXISTS coach_class_assignment_target_check;
ALTER TABLE coach_class_assignment
  DROP CONSTRAINT IF EXISTS coach_class_assignment_check;

DROP INDEX IF EXISTS ux_coach_assignment_category;
DROP INDEX IF EXISTS idx_coach_assignment_category;
DROP INDEX IF EXISTS ux_coach_assignment_programs_top;
DROP INDEX IF EXISTS ux_coach_assignment_class_event;
DROP INDEX IF EXISTS ux_coach_assignment_scheduling_form;
DROP INDEX IF EXISTS ux_coach_assignment_offering;

ALTER TABLE coach_class_assignment
  DROP COLUMN IF EXISTS scheduling_category_id;

ALTER TABLE coach_class_assignment
  ADD CONSTRAINT coach_class_assignment_target_check
  CHECK (
    programs_id IS NOT NULL
    OR program_id IS NOT NULL
    OR scheduling_form_id IS NOT NULL
    OR class_iteration_id IS NOT NULL
    OR scheduling_offering_id IS NOT NULL
    OR scheduling_time_slot_id IS NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_programs_top
  ON coach_class_assignment (coach_user_id, programs_id)
  WHERE programs_id IS NOT NULL
    AND program_id IS NULL
    AND scheduling_form_id IS NULL
    AND scheduling_offering_id IS NULL
    AND scheduling_time_slot_id IS NULL
    AND class_iteration_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_class_event
  ON coach_class_assignment (coach_user_id, program_id)
  WHERE program_id IS NOT NULL
    AND programs_id IS NULL
    AND scheduling_form_id IS NULL
    AND scheduling_offering_id IS NULL
    AND scheduling_time_slot_id IS NULL
    AND class_iteration_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_scheduling_form
  ON coach_class_assignment (coach_user_id, scheduling_form_id)
  WHERE scheduling_form_id IS NOT NULL
    AND scheduling_offering_id IS NULL
    AND scheduling_time_slot_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_offering
  ON coach_class_assignment (coach_user_id, scheduling_offering_id)
  WHERE scheduling_offering_id IS NOT NULL
    AND scheduling_time_slot_id IS NULL;

-- 2) Pricing benefit selections: drop the 'category' scope.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pricing_benefit_selection'
  ) THEN
    DELETE FROM pricing_benefit_selection WHERE scope_level = 'category';
    ALTER TABLE pricing_benefit_selection
      DROP CONSTRAINT IF EXISTS pricing_benefit_selection_scope_level_check;
    ALTER TABLE pricing_benefit_selection
      ADD CONSTRAINT pricing_benefit_selection_scope_level_check
      CHECK (scope_level IN ('sport', 'program', 'class'));
  END IF;
END $$;

-- 3) Coaching plan assignments: drop the 'category' target type.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'coaching' AND table_name = 'plan_assignment'
  ) THEN
    DELETE FROM coaching.plan_assignment WHERE target_type = 'category';
    ALTER TABLE coaching.plan_assignment
      DROP CONSTRAINT IF EXISTS plan_assignment_target_type_check;
    ALTER TABLE coaching.plan_assignment
      ADD CONSTRAINT plan_assignment_target_type_check
      CHECK (target_type IN (
        'member', 'class', 'family',
        'program', 'offering', 'scheduling_class', 'primary_sport'
      ));
  END IF;
END $$;

-- 4) Offerings: replace category-scoped selected uniqueness with per-form.
DROP INDEX IF EXISTS idx_scheduling_offering_selected;
DROP INDEX IF EXISTS idx_scheduling_offering_selected_no_cat;
DROP INDEX IF EXISTS idx_scheduling_offering_category;
ALTER TABLE scheduling_offering DROP COLUMN IF EXISTS category_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduling_offering_selected
  ON scheduling_offering(form_id) WHERE is_selected = TRUE;

-- 5) Drop category_id from the remaining scheduling data tables.
DROP INDEX IF EXISTS idx_scheduling_slot_category;
ALTER TABLE scheduling_time_slot DROP COLUMN IF EXISTS category_id;

DROP INDEX IF EXISTS idx_scheduling_slot_group_category;
ALTER TABLE scheduling_slot_group DROP COLUMN IF EXISTS category_id;

ALTER TABLE scheduling_signup DROP COLUMN IF EXISTS category_id;

-- 6) Drop the program -> scheduling category mapping.
DROP INDEX IF EXISTS idx_program_scheduling_category;
ALTER TABLE program DROP COLUMN IF EXISTS scheduling_category_id;

-- 7) Drop the category tables themselves (children first).
DROP TABLE IF EXISTS scheduling_category_field;
DROP TABLE IF EXISTS scheduling_form_category;
DROP TABLE IF EXISTS scheduling_category;
