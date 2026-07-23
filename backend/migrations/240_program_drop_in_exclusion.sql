-- Program-level control: all child classes inherit drop-in eligibility.
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS exclude_from_drop_ins BOOLEAN NOT NULL DEFAULT FALSE;

