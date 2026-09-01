-- Household invoices must preserve canonical negative billing_charge rows as
-- immutable Stripe invoice lines.  The original schema allowed only an
-- unapplied billing_payment to back a credit line, which made linked discounts
-- and account-level ledger credits invisible to household collection.

ALTER TABLE billing_monthly_invoice_line
  DROP CONSTRAINT IF EXISTS billing_monthly_invoice_line_check;

ALTER TABLE billing_monthly_invoice_line
  DROP CONSTRAINT IF EXISTS billing_monthly_invoice_line_source_check;

ALTER TABLE billing_monthly_invoice_line
  ADD CONSTRAINT billing_monthly_invoice_line_source_check CHECK (
    (
      line_type = 'charge'
      AND billing_charge_id IS NOT NULL
      AND billing_payment_id IS NULL
      AND amount_cents > 0
    )
    OR
    (
      line_type = 'credit'
      AND amount_cents < 0
      AND (
        (billing_charge_id IS NOT NULL AND billing_payment_id IS NULL)
        OR (billing_charge_id IS NULL AND billing_payment_id IS NOT NULL)
      )
    )
  );

CREATE OR REPLACE FUNCTION validate_billing_monthly_invoice_line_ownership()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  invoice_account_id BIGINT;
  source_account_id BIGINT;
  source_amount_cents INTEGER;
BEGIN
  SELECT family_billing_account_id
    INTO invoice_account_id
    FROM billing_monthly_invoice
   WHERE id = NEW.billing_monthly_invoice_id;

  IF NEW.billing_charge_id IS NOT NULL THEN
    SELECT family_billing_account_id, amount_cents
      INTO source_account_id, source_amount_cents
      FROM billing_charge
     WHERE id = NEW.billing_charge_id
     FOR UPDATE;

    IF source_account_id IS NULL OR source_account_id <> invoice_account_id THEN
      RAISE EXCEPTION 'monthly invoice line charge belongs to a different billing account';
    END IF;
    IF NEW.line_type = 'charge' AND (
      source_amount_cents <= 0 OR NEW.amount_cents > source_amount_cents
    ) THEN
      RAISE EXCEPTION 'monthly invoice charge line exceeds its positive ledger charge';
    END IF;
    IF NEW.line_type = 'credit' AND (
      source_amount_cents >= 0 OR ABS(NEW.amount_cents) > ABS(source_amount_cents)
    ) THEN
      RAISE EXCEPTION 'monthly invoice credit line exceeds its negative ledger charge';
    END IF;
  ELSIF NEW.billing_payment_id IS NOT NULL THEN
    SELECT family_billing_account_id, amount_cents
      INTO source_account_id, source_amount_cents
      FROM billing_payment
     WHERE id = NEW.billing_payment_id
     FOR UPDATE;

    IF source_account_id IS NULL OR source_account_id <> invoice_account_id THEN
      RAISE EXCEPTION 'monthly invoice line payment belongs to a different billing account';
    END IF;
    IF ABS(NEW.amount_cents) > source_amount_cents THEN
      RAISE EXCEPTION 'monthly invoice credit line exceeds its source payment';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_monthly_invoice_line_ownership
  ON billing_monthly_invoice_line;
CREATE TRIGGER trg_billing_monthly_invoice_line_ownership
BEFORE INSERT ON billing_monthly_invoice_line
FOR EACH ROW EXECUTE FUNCTION validate_billing_monthly_invoice_line_ownership();
