-- Optional camper details for summer camp inquiry submissions (JSON array).
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS campers JSONB;
