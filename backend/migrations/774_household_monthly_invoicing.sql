-- One authoritative Stripe collection per household and calendar billing month.
-- Existing accounts remain on legacy per-class subscriptions until the migration
-- utility explicitly enables this path after cancelling those subscriptions.

ALTER TABLE family_billing_account
  ADD COLUMN IF NOT EXISTS household_monthly_billing_enabled BOOLEAN NOT NULL DEFAULT FALSE;
-- Existing rows retain FALSE until the explicit migration verifies and retires
-- their legacy Stripe subscriptions. Accounts created after this deployment use
-- the consolidated path by default.
ALTER TABLE family_billing_account
  ALTER COLUMN household_monthly_billing_enabled SET DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS billing_monthly_invoice (
  id                         BIGSERIAL PRIMARY KEY,
  family_billing_account_id  BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE RESTRICT,
  billing_month              DATE NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'open', 'paid', 'failed', 'payment_method_required', 'void')),
  subtotal_cents             INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  credit_cents               INTEGER NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  total_cents                INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  stripe_invoice_id          TEXT,
  stripe_payment_intent_id   TEXT,
  hosted_invoice_url         TEXT,
  payment_attempted_at       TIMESTAMPTZ,
  paid_at                    TIMESTAMPTZ,
  failure_message            TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (date_trunc('month', billing_month)::date = billing_month),
  UNIQUE (family_billing_account_id, billing_month)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_monthly_invoice_stripe_invoice
  ON billing_monthly_invoice(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_monthly_invoice_account_status
  ON billing_monthly_invoice(family_billing_account_id, status, billing_month DESC);

CREATE TABLE IF NOT EXISTS billing_monthly_invoice_line (
  id                         BIGSERIAL PRIMARY KEY,
  billing_monthly_invoice_id BIGINT NOT NULL REFERENCES billing_monthly_invoice(id) ON DELETE RESTRICT,
  billing_charge_id          BIGINT REFERENCES billing_charge(id) ON DELETE RESTRICT,
  billing_payment_id         BIGINT REFERENCES billing_payment(id) ON DELETE RESTRICT,
  member_id                  BIGINT REFERENCES member(id) ON DELETE SET NULL,
  line_type                  TEXT NOT NULL CHECK (line_type IN ('charge', 'credit')),
  description                TEXT NOT NULL,
  amount_cents               INTEGER NOT NULL CHECK (amount_cents <> 0),
  stripe_invoice_item_id     TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (line_type = 'charge' AND billing_charge_id IS NOT NULL AND billing_payment_id IS NULL AND amount_cents > 0)
    OR (line_type = 'credit' AND billing_payment_id IS NOT NULL AND billing_charge_id IS NULL AND amount_cents < 0)
  ),
  UNIQUE (billing_monthly_invoice_id, billing_charge_id),
  UNIQUE (billing_monthly_invoice_id, billing_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_monthly_invoice_line_charge
  ON billing_monthly_invoice_line(billing_charge_id) WHERE billing_charge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_monthly_invoice_line_invoice
  ON billing_monthly_invoice_line(billing_monthly_invoice_id, id);

CREATE OR REPLACE FUNCTION reject_billing_monthly_invoice_line_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'billing_monthly_invoice_line records cannot be deleted';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['stripe_invoice_item_id']::text[]) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['stripe_invoice_item_id']::text[]) THEN
    RAISE EXCEPTION 'billing_monthly_invoice_line financial terms are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_monthly_invoice_line_immutable ON billing_monthly_invoice_line;
CREATE TRIGGER trg_billing_monthly_invoice_line_immutable
BEFORE UPDATE OR DELETE ON billing_monthly_invoice_line
FOR EACH ROW EXECUTE FUNCTION reject_billing_monthly_invoice_line_mutation();
