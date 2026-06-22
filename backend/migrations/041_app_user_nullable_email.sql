-- Username-only portal accounts (e.g. minors using parent contact email) may omit app_user.email.
-- member.email stays NULL for the same case; guardian contact is via parent_guardian_ids.

ALTER TABLE app_user ALTER COLUMN email DROP NOT NULL;

-- Replace table-level UNIQUE (facility_id, email) with a partial index so multiple NULL emails are allowed.
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_facility_id_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS app_user_facility_email_unique
  ON app_user (facility_id, email)
  WHERE email IS NOT NULL;
