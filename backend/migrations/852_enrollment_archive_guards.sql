-- Historical enrollments must not prevent archiving. Paused students still
-- belong to their class; ended enrollments, waitlists and holds do not.
CREATE OR REPLACE FUNCTION class_has_active_students(class_id bigint)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM scheduling_signup s
    JOIN scheduling_form f ON f.id = s.form_id
    WHERE f.program_id = class_id
      AND s.status IN ('confirmed', 'active', 'paused')
      AND s.archived_at IS NULL AND s.orphaned_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION guard_class_archive() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.archived = TRUE AND OLD.archived IS DISTINCT FROM TRUE
     AND class_has_active_students(NEW.id) THEN
    RAISE EXCEPTION 'Disenroll active students before archiving this class.' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS class_archive_guard ON program;
CREATE TRIGGER class_archive_guard BEFORE UPDATE OF archived ON program
  FOR EACH ROW EXECUTE FUNCTION guard_class_archive();

CREATE OR REPLACE FUNCTION guard_program_archive() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.archived = TRUE AND OLD.archived IS DISTINCT FROM TRUE THEN
    IF EXISTS (
      SELECT 1 FROM program p
      WHERE p.programs_id = NEW.id AND p.facility_id = NEW.facility_id
        AND class_has_active_students(p.id)
    ) THEN
      RAISE EXCEPTION 'Disenroll active students before archiving this program.' USING ERRCODE='P0001';
    END IF;
    -- Close empty child classes together with their parent, retaining history.
    UPDATE program SET archived = TRUE, is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE programs_id = NEW.id AND facility_id = NEW.facility_id AND archived IS NOT TRUE;
  END IF;
  RETURN NEW;
END $$;
