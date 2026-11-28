-- Preserve each note's contact classification without changing historical dates.
ALTER TABLE note ADD COLUMN IF NOT EXISTS non_contact BOOLEAN NOT NULL DEFAULT FALSE;
