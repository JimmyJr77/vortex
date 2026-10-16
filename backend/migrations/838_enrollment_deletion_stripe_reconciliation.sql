CREATE TABLE IF NOT EXISTS billing_enrollment_deletion (
  signup_id bigint PRIMARY KEY,
  family_billing_account_id bigint NOT NULL REFERENCES family_billing_account(id),
  facility_id bigint NOT NULL,
  actor_user_id bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('reconciling','deleted','complete')),
  plan jsonb NOT NULL DEFAULT '[]',
  completed_steps jsonb NOT NULL DEFAULT '[]',
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enrollment_deletion_pending ON billing_enrollment_deletion(updated_at) WHERE status <> 'complete';
ALTER TABLE billing_monthly_invoice ADD COLUMN IF NOT EXISTS enrollment_deletion_id bigint REFERENCES billing_enrollment_deletion(signup_id);
ALTER TABLE billing_monthly_invoice_line ADD COLUMN IF NOT EXISTS deleted_charge_id bigint;
ALTER TABLE billing_monthly_invoice_line DROP CONSTRAINT IF EXISTS billing_monthly_invoice_line_source_check;
ALTER TABLE billing_monthly_invoice_line DROP CONSTRAINT IF EXISTS billing_monthly_invoice_line_check;
ALTER TABLE billing_monthly_invoice_line ADD CONSTRAINT billing_monthly_invoice_line_source_check CHECK (
  (line_type = 'charge' AND billing_payment_id IS NULL AND amount_cents > 0
    AND ((billing_charge_id IS NOT NULL AND deleted_charge_id IS NULL) OR (billing_charge_id IS NULL AND deleted_charge_id IS NOT NULL)))
  OR (line_type = 'credit' AND amount_cents < 0 AND (
    (billing_charge_id IS NOT NULL AND billing_payment_id IS NULL AND deleted_charge_id IS NULL)
    OR (billing_charge_id IS NULL AND billing_payment_id IS NOT NULL AND deleted_charge_id IS NULL)
    OR (billing_charge_id IS NULL AND billing_payment_id IS NULL AND deleted_charge_id IS NOT NULL)))
);
-- Keep canceled reservation amounts and original identifiers, including lines
-- for other enrollments in a household checkout. Only their live FK is detached.
ALTER TABLE billing_payment_attempt_charge ADD COLUMN IF NOT EXISTS id bigserial;
ALTER TABLE billing_payment_attempt_charge ADD COLUMN IF NOT EXISTS deleted_charge_id bigint;
ALTER TABLE billing_payment_attempt_charge DROP CONSTRAINT IF EXISTS billing_payment_attempt_charge_pkey;
ALTER TABLE billing_payment_attempt_charge ALTER COLUMN billing_charge_id DROP NOT NULL;
ALTER TABLE billing_payment_attempt_charge ADD CONSTRAINT billing_payment_attempt_charge_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_charge_live ON billing_payment_attempt_charge(billing_payment_attempt_id,billing_charge_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_charge_original ON billing_payment_attempt_charge(billing_payment_attempt_id,COALESCE(billing_charge_id,deleted_charge_id));
ALTER TABLE billing_payment_attempt_charge ADD CONSTRAINT attempt_charge_identity CHECK (
  (billing_charge_id IS NOT NULL AND deleted_charge_id IS NULL) OR (billing_charge_id IS NULL AND deleted_charge_id IS NOT NULL)
);

CREATE OR REPLACE FUNCTION reject_billing_payment_attempt_charge_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.billing_charge_id IS NULL AND NEW.deleted_charge_id = OLD.billing_charge_id
    AND OLD.deleted_charge_id IS NULL
    AND (to_jsonb(NEW)-ARRAY['billing_charge_id','deleted_charge_id']) = (to_jsonb(OLD)-ARRAY['billing_charge_id','deleted_charge_id'])
    AND COALESCE(NULLIF(current_setting('vortex.enrollment_deletion_charge_ids',true),''),'[]')::jsonb @> to_jsonb(OLD.billing_charge_id)
    AND EXISTS (SELECT 1 FROM billing_payment_attempt WHERE id=OLD.billing_payment_attempt_id AND status='canceled' AND billing_payment_id IS NULL)
    AND NOT EXISTS (SELECT 1 FROM billing_payment_application WHERE billing_charge_id=OLD.billing_charge_id)
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'billing payment attempt charge reservations are immutable';
END $$;

CREATE OR REPLACE FUNCTION reject_billing_monthly_invoice_line_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.billing_charge_id IS NULL AND NEW.deleted_charge_id = OLD.billing_charge_id
    AND OLD.deleted_charge_id IS NULL
    AND (to_jsonb(NEW)-ARRAY['billing_charge_id','deleted_charge_id']) = (to_jsonb(OLD)-ARRAY['billing_charge_id','deleted_charge_id'])
    AND COALESCE(NULLIF(current_setting('vortex.enrollment_deletion_charge_ids',true),''),'[]')::jsonb @> to_jsonb(OLD.billing_charge_id)
    AND EXISTS (SELECT 1 FROM billing_monthly_invoice WHERE id=OLD.billing_monthly_invoice_id AND status='void' AND enrollment_deletion_id IS NOT NULL AND paid_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM billing_payment_application WHERE billing_charge_id=OLD.billing_charge_id)
    AND NOT EXISTS (SELECT 1 FROM billing_charge_credit_application WHERE credit_invoice_line_id=OLD.id OR target_invoice_line_id=OLD.id)
  THEN RETURN NEW; END IF;
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(NULLIF(current_setting('vortex.enrollment_deletion_charge_ids',true),''),'[]')::jsonb @> to_jsonb(OLD.billing_charge_id)
      AND EXISTS (SELECT 1 FROM billing_monthly_invoice WHERE id=OLD.billing_monthly_invoice_id
        AND stripe_invoice_id IS NULL AND stripe_payment_intent_id IS NULL AND paid_at IS NULL AND status <> 'paid')
      AND NOT EXISTS (SELECT 1 FROM billing_payment_application WHERE billing_charge_id=OLD.billing_charge_id)
      AND NOT EXISTS (SELECT 1 FROM billing_charge_credit_application WHERE credit_invoice_line_id=OLD.id OR target_invoice_line_id=OLD.id)
    THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'billing_monthly_invoice_line records cannot be deleted';
  END IF;
  IF (to_jsonb(NEW)-'stripe_invoice_item_id') IS DISTINCT FROM (to_jsonb(OLD)-'stripe_invoice_item_id') THEN
    RAISE EXCEPTION 'billing_monthly_invoice_line financial terms are immutable';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION guard_enrollment_deletion_collection()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_id bigint;
BEGIN
  IF TG_TABLE_NAME='billing_payment_attempt' THEN
    IF TG_OP='UPDATE' AND OLD.metadata->>'enrollmentDeletionRetired'='true' AND NEW.status <> 'canceled' THEN
      RAISE EXCEPTION 'Deleted enrollment payment attempt cannot resume';
    END IF;
    account_id := NEW.family_billing_account_id;
  ELSE
    IF TG_OP='UPDATE' AND OLD.enrollment_deletion_id IS NOT NULL AND NEW.status <> 'void' THEN
      RAISE EXCEPTION 'Deleted enrollment invoice cannot resume';
    END IF;
    account_id := NEW.family_billing_account_id;
  END IF;
  IF TG_OP='INSERT' AND EXISTS (SELECT 1 FROM billing_enrollment_deletion
    WHERE family_billing_account_id=account_id AND status='reconciling') THEN
    RAISE EXCEPTION 'Enrollment deletion reconciliation must finish before new collection';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enrollment_deletion_attempt ON billing_payment_attempt;
CREATE TRIGGER trg_enrollment_deletion_attempt BEFORE INSERT OR UPDATE ON billing_payment_attempt FOR EACH ROW EXECUTE FUNCTION guard_enrollment_deletion_collection();
DROP TRIGGER IF EXISTS trg_enrollment_deletion_invoice ON billing_monthly_invoice;
CREATE TRIGGER trg_enrollment_deletion_invoice BEFORE INSERT OR UPDATE ON billing_monthly_invoice FOR EACH ROW EXECUTE FUNCTION guard_enrollment_deletion_collection();
