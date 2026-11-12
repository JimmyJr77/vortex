-- Class active dates may have either, both, or neither boundary.
-- Enrollment dates and existing data remain unchanged.
ALTER TABLE scheduling_offering
  ALTER COLUMN start_date DROP NOT NULL,
  ALTER COLUMN end_date DROP NOT NULL;
