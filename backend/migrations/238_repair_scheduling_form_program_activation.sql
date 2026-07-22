-- Repair scheduling forms whose cached top-level program link drifted from the
-- authoritative Class Master relationship. The admin program activation route
-- historically updated by scheduling_form.programs_id, so drifted rows were
-- silently skipped and stayed hidden from /enroll.

UPDATE scheduling_form sf
SET programs_id = class_event.programs_id,
    updated_at = CURRENT_TIMESTAMP
FROM program class_event
WHERE sf.program_id = class_event.id
  AND sf.programs_id IS DISTINCT FROM class_event.programs_id;

-- Reapply the stored program-level scheduling activation after repairing the
-- links. This matches the bulk activation behavior in the admin UI.
UPDATE scheduling_form sf
SET is_active = TRUE,
    enroll_sites = CASE
      WHEN cardinality(parent.scheduling_enroll_sites) > 0
        THEN parent.scheduling_enroll_sites
      ELSE ARRAY['athletics', 'gymnastics', 'basketball']::TEXT[]
    END,
    updated_at = CURRENT_TIMESTAMP
FROM programs parent
WHERE sf.programs_id = parent.id
  AND sf.deleted_at IS NULL
  AND COALESCE(parent.scheduling_active, FALSE) = TRUE;
