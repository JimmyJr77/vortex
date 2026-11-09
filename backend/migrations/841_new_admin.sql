-- Additive New Admin metadata. Existing inquiry, member, household, enrollment,
-- and Stripe identities are preserved. Ownership is assigned by the audited CLI,
-- never by choosing an arbitrary facility during migration or a request.
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS facility_id BIGINT REFERENCES facility(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS converted_member_id BIGINT REFERENCES member(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_by_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_registrations_facility_created
  ON registrations (facility_id, created_at DESC, id DESC)
  WHERE archived IS NOT TRUE;

CREATE TABLE IF NOT EXISTS new_admin_lead_ownership_audit (
  id BIGSERIAL PRIMARY KEY,
  batch_id UUID NOT NULL,
  registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE RESTRICT,
  old_facility_id BIGINT,
  new_facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
  record_updated_at TIMESTAMP,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rolled_back_at TIMESTAMPTZ,
  UNIQUE (batch_id, registration_id)
);
ALTER TABLE new_admin_lead_ownership_audit ADD COLUMN IF NOT EXISTS record_updated_at TIMESTAMP;

-- One explicit routing choice for the existing public inquiry form. No choice
-- is seeded automatically; unassigned inquiries remain quarantined.
CREATE TABLE IF NOT EXISTS new_admin_public_lead_facility (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton=TRUE),
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
  configured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION guard_new_admin_lead_conversion()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.facility_id IS NULL THEN
    SELECT facility_id INTO NEW.facility_id FROM new_admin_public_lead_facility WHERE singleton=TRUE;
  END IF;
  IF NEW.converted_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM member m
     WHERE m.id = NEW.converted_member_id AND m.facility_id = NEW.facility_id
  ) THEN
    RAISE EXCEPTION 'Converted lead and member must belong to the same facility'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.converted_member_id IS NOT NULL THEN NEW.lead_status='converted'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_new_admin_lead_conversion ON registrations;
CREATE TRIGGER trg_new_admin_lead_conversion
BEFORE INSERT OR UPDATE OF facility_id, converted_member_id, lead_status ON registrations
FOR EACH ROW EXECUTE FUNCTION guard_new_admin_lead_conversion();
