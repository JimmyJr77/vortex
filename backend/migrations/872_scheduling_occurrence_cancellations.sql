CREATE TABLE IF NOT EXISTS scheduling_occurrence_cancellation (
  time_slot_id BIGINT NOT NULL REFERENCES scheduling_time_slot(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  PRIMARY KEY (time_slot_id, occurrence_date)
);
