-- Each form submission is its own inquiry, including from returning contacts.
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_email_key;

CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(email);
CREATE INDEX IF NOT EXISTS idx_member_inquiry_contact_email
  ON member(facility_id, lower(btrim(email)))
  WHERE is_active IS TRUE AND email IS NOT NULL;
