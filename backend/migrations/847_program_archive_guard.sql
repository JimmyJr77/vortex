-- Serialize program closure and class activation on the same parent row.
CREATE OR REPLACE FUNCTION guard_program_archive() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.archived=TRUE AND OLD.archived IS DISTINCT FROM TRUE AND EXISTS(
    SELECT 1 FROM program WHERE programs_id=NEW.id AND facility_id=NEW.facility_id AND is_active=TRUE AND archived IS NOT TRUE
  ) THEN RAISE EXCEPTION 'Close or archive all active classes before archiving this program.' USING ERRCODE='P0001'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS programs_archive_guard ON programs;
CREATE TRIGGER programs_archive_guard BEFORE UPDATE OF archived ON programs FOR EACH ROW EXECUTE FUNCTION guard_program_archive();
CREATE OR REPLACE FUNCTION guard_class_parent_active() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_archived BOOLEAN;
BEGIN
  IF NEW.programs_id IS NULL OR NEW.is_active IS DISTINCT FROM TRUE OR NEW.archived=TRUE THEN RETURN NEW; END IF;
  SELECT archived INTO parent_archived FROM programs WHERE id=NEW.programs_id AND facility_id=NEW.facility_id FOR UPDATE;
  IF parent_archived=TRUE THEN RAISE EXCEPTION 'Restore the program before activating a class.' USING ERRCODE='P0001'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS program_parent_active_guard ON program;
CREATE TRIGGER program_parent_active_guard BEFORE INSERT OR UPDATE OF programs_id,is_active,archived ON program FOR EACH ROW EXECUTE FUNCTION guard_class_parent_active();
