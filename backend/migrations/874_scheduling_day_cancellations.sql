CREATE TABLE IF NOT EXISTS scheduling_day_cancellation (
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  PRIMARY KEY (facility_id, occurrence_date)
);
