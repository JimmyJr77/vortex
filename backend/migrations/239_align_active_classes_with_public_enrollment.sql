-- Align stale production scheduling-form visibility with the authoritative
-- Class Master status. Only assigned, active classes with an actual active
-- schedule are made public; inactive, archived, unassigned, and zero-slot rows
-- remain unavailable.

UPDATE scheduling_form sf
SET programs_id = class_event.programs_id,
    is_active = TRUE,
    enroll_sites = CASE
      WHEN cardinality(sf.enroll_sites) > 0 THEN sf.enroll_sites
      WHEN cardinality(parent.scheduling_enroll_sites) > 0
        THEN parent.scheduling_enroll_sites
      ELSE ARRAY['athletics', 'gymnastics', 'basketball']::TEXT[]
    END,
    updated_at = CURRENT_TIMESTAMP
FROM program class_event
JOIN programs parent ON parent.id = class_event.programs_id
WHERE sf.program_id = class_event.id
  AND sf.deleted_at IS NULL
  AND COALESCE(class_event.archived, FALSE) = FALSE
  AND COALESCE(class_event.is_active, TRUE) = TRUE
  AND COALESCE(parent.archived, FALSE) = FALSE
  AND COALESCE(parent.is_active, TRUE) = TRUE
  AND EXISTS (
    SELECT 1
    FROM scheduling_slot_group sg
    WHERE sg.form_id = sf.id
      AND COALESCE(sg.is_active, TRUE) = TRUE
  );
