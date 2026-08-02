-- Support querying classes/slots by Active dates, day-of-week, specific date, and capacity
-- without relying on offerings as a parent UI concept.

CREATE INDEX IF NOT EXISTS idx_scheduling_slot_group_active_dates
  ON scheduling_slot_group (form_id, active_start, active_end);

CREATE INDEX IF NOT EXISTS idx_scheduling_slot_group_capacity
  ON scheduling_slot_group (form_id, max_participants);

CREATE INDEX IF NOT EXISTS idx_scheduling_time_slot_day
  ON scheduling_time_slot (form_id, day_of_week)
  WHERE schedule_mode = 'day' AND day_of_week IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_time_slot_specific_date
  ON scheduling_time_slot (form_id, specific_date)
  WHERE schedule_mode = 'date' AND specific_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_form_active_dates
  ON scheduling_form (start_date, end_date)
  WHERE deleted_at IS NULL;
