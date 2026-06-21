-- Slot groups: multi-day/time builder submissions = one bookable unit with shared capacity

CREATE TABLE IF NOT EXISTS scheduling_slot_group (
  id               BIGSERIAL PRIMARY KEY,
  form_id          BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
  schedule_mode    VARCHAR(10) NOT NULL DEFAULT 'day',
  max_participants INTEGER NOT NULL DEFAULT 10,
  active_start     DATE,
  active_end       DATE,
  dates_tbd        BOOLEAN NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE scheduling_time_slot
  ADD COLUMN IF NOT EXISTS slot_group_id BIGINT REFERENCES scheduling_slot_group(id) ON DELETE CASCADE;

ALTER TABLE scheduling_signup
  ADD COLUMN IF NOT EXISTS slot_group_id BIGINT REFERENCES scheduling_slot_group(id);

CREATE INDEX IF NOT EXISTS idx_scheduling_slot_group_form ON scheduling_slot_group(form_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_time_slot_group ON scheduling_time_slot(slot_group_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_signup_group ON scheduling_signup(slot_group_id);

-- Backfill: each existing time slot becomes its own group of one
INSERT INTO scheduling_slot_group (form_id, schedule_mode, max_participants, active_start, active_end, dates_tbd, is_active)
SELECT ts.form_id, COALESCE(ts.schedule_mode, 'day'), ts.max_participants,
       ts.active_start, ts.active_end, COALESCE(ts.dates_tbd, FALSE), COALESCE(ts.is_active, TRUE)
FROM scheduling_time_slot ts
WHERE ts.slot_group_id IS NULL;

UPDATE scheduling_time_slot ts
SET slot_group_id = sg.id
FROM scheduling_slot_group sg
WHERE ts.slot_group_id IS NULL
  AND sg.form_id = ts.form_id
  AND sg.schedule_mode = COALESCE(ts.schedule_mode, 'day')
  AND sg.max_participants = ts.max_participants
  AND sg.active_start IS NOT DISTINCT FROM ts.active_start
  AND sg.active_end IS NOT DISTINCT FROM ts.active_end
  AND sg.dates_tbd = COALESCE(ts.dates_tbd, FALSE)
  AND sg.is_active = COALESCE(ts.is_active, TRUE)
  AND NOT EXISTS (
    SELECT 1 FROM scheduling_time_slot other
    WHERE other.slot_group_id = sg.id AND other.id <> ts.id
  );

UPDATE scheduling_signup s
SET slot_group_id = ts.slot_group_id
FROM scheduling_time_slot ts
WHERE s.time_slot_id = ts.id AND s.slot_group_id IS NULL;
