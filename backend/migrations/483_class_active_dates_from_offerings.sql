-- Promote offering date windows onto class (scheduling_form) Active dates and
-- materialize them onto slot groups. Clear offering labels (no longer used).
-- scheduling_offering rows remain for FK/pricing scopes; UI treats form dates
-- as the class Active dates source of truth.

-- 1) Form Active dates ← selected offering, else latest by start_date
UPDATE scheduling_form f
SET
  start_date = src.start_date,
  end_date = src.end_date,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (form_id)
    form_id,
    start_date,
    end_date
  FROM scheduling_offering
  ORDER BY form_id, is_selected DESC NULLS LAST, start_date DESC NULLS LAST, id DESC
) src
WHERE f.id = src.form_id
  AND f.deleted_at IS NULL
  AND (
    f.start_date IS DISTINCT FROM src.start_date
    OR f.end_date IS DISTINCT FROM src.end_date
  );

-- 2) Slot groups inheriting (or missing) dates ← linked offering dates
UPDATE scheduling_slot_group sg
SET
  active_start = o.start_date,
  active_end = o.end_date,
  dates_tbd = FALSE,
  updated_at = now()
FROM scheduling_offering o
WHERE sg.offering_id = o.id
  AND sg.dates_tbd IS NOT TRUE
  AND (
    sg.inherits_offering_dates IS TRUE
    OR sg.active_start IS NULL
  )
  AND (
    sg.active_start IS DISTINCT FROM o.start_date
    OR sg.active_end IS DISTINCT FROM o.end_date
  );

-- 3) Time slots under those groups that still mirror old/null dates
UPDATE scheduling_time_slot ts
SET
  active_start = sg.active_start,
  active_end = sg.active_end,
  dates_tbd = FALSE,
  updated_at = now()
FROM scheduling_slot_group sg
WHERE ts.slot_group_id = sg.id
  AND ts.dates_tbd IS NOT TRUE
  AND (
    (ts.active_start IS NULL AND ts.active_end IS NULL)
    OR ts.active_start IS DISTINCT FROM sg.active_start
    OR ts.active_end IS DISTINCT FROM sg.active_end
  )
  AND sg.active_start IS NOT NULL;

-- 4) Drop legacy offering descriptions/labels
UPDATE scheduling_offering
SET label = NULL, updated_at = now()
WHERE label IS NOT NULL;
