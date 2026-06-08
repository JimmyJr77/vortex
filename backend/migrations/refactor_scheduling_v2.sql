-- Scheduling v2: form-level signup fields, flexible slots

ALTER TABLE scheduling_form
  ADD COLUMN IF NOT EXISTS signup_fields JSONB NOT NULL DEFAULT '["first_name","last_name","email"]'::jsonb;

ALTER TABLE scheduling_time_slot
  ADD COLUMN IF NOT EXISTS schedule_mode VARCHAR(10) DEFAULT 'day',
  ADD COLUMN IF NOT EXISTS week_letter VARCHAR(2),
  ADD COLUMN IF NOT EXISTS specific_date DATE,
  ADD COLUMN IF NOT EXISTS active_start DATE,
  ADD COLUMN IF NOT EXISTS active_end DATE,
  ADD COLUMN IF NOT EXISTS dates_tbd BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE scheduling_time_slot
SET active_start = start_date, active_end = end_date
WHERE active_start IS NULL AND start_date IS NOT NULL;

ALTER TABLE scheduling_time_slot ALTER COLUMN day_of_week DROP NOT NULL;

ALTER TABLE scheduling_signup
  ADD COLUMN IF NOT EXISTS responses JSONB NOT NULL DEFAULT '{}'::jsonb;
