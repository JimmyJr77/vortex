-- Migration 037: waiver types, required flag, acceptance comments

ALTER TABLE waiver_template
  ADD COLUMN IF NOT EXISTS waiver_type TEXT,
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE member_waiver_acceptance
  ADD COLUMN IF NOT EXISTS comments TEXT,
  ADD COLUMN IF NOT EXISTS payment_policy_acknowledged BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_waiver_template_type
  ON waiver_template(facility_id, waiver_type)
  WHERE active_to IS NULL;

COMMENT ON COLUMN waiver_template.waiver_type IS
  'Stable code: ASSUMPTION_OF_RISK, RELEASE_OF_LIABILITY, MEDICAL_EMERGENCY, PAYMENT_POLICY, or custom.';

COMMENT ON COLUMN member_waiver_acceptance.comments IS
  'Optional signer comments captured at attestation.';
