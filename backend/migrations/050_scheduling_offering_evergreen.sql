-- Allow offerings with no end date (evergreen / ongoing classes).

ALTER TABLE scheduling_offering
  ALTER COLUMN end_date DROP NOT NULL;
