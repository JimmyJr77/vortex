-- Submitter role and page source for inquiry submissions.
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS submitter_role VARCHAR(50);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS inquiry_source VARCHAR(500);
