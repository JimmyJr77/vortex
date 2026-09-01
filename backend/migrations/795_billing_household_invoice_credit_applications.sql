-- Persist the non-cash portion of a paid household invoice against the exact
-- positive charges it satisfied.  Invoice credit lines are reservations while
-- an invoice is unpaid; these append-only rows become the durable allocation
-- only when that invoice settles.

CREATE TABLE IF NOT EXISTS billing_charge_credit_application (
  id                         BIGSERIAL PRIMARY KEY,
  billing_monthly_invoice_id BIGINT NOT NULL REFERENCES billing_monthly_invoice(id) ON DELETE RESTRICT,
  credit_invoice_line_id     BIGINT NOT NULL REFERENCES billing_monthly_invoice_line(id) ON DELETE RESTRICT,
  target_invoice_line_id     BIGINT NOT NULL REFERENCES billing_monthly_invoice_line(id) ON DELETE RESTRICT,
  amount_cents               INTEGER NOT NULL CHECK (amount_cents > 0),
  idempotency_key            TEXT NOT NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_charge_credit_application_distinct_lines_check
    CHECK (credit_invoice_line_id <> target_invoice_line_id),
  CONSTRAINT uq_billing_charge_credit_application_pair
    UNIQUE (credit_invoice_line_id, target_invoice_line_id),
  CONSTRAINT uq_billing_charge_credit_application_idempotency
    UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_billing_charge_credit_application_invoice
  ON billing_charge_credit_application(billing_monthly_invoice_id, id);
CREATE INDEX IF NOT EXISTS idx_billing_charge_credit_application_credit_line
  ON billing_charge_credit_application(credit_invoice_line_id);
CREATE INDEX IF NOT EXISTS idx_billing_charge_credit_application_target_line
  ON billing_charge_credit_application(target_invoice_line_id);

CREATE OR REPLACE FUNCTION reject_billing_charge_credit_application_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'billing_charge_credit_application is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_charge_credit_application_immutable
  ON billing_charge_credit_application;
CREATE TRIGGER trg_billing_charge_credit_application_immutable
BEFORE UPDATE OR DELETE ON billing_charge_credit_application
FOR EACH ROW EXECUTE FUNCTION reject_billing_charge_credit_application_mutation();

CREATE OR REPLACE FUNCTION validate_billing_charge_credit_application_capacity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  invoice_account_id BIGINT;
  invoice_status TEXT;
  credit_line_invoice_id BIGINT;
  credit_charge_id BIGINT;
  credit_line_type TEXT;
  credit_line_cents INTEGER;
  credit_charge_account_id BIGINT;
  credit_charge_cents INTEGER;
  target_line_invoice_id BIGINT;
  target_charge_id BIGINT;
  target_line_type TEXT;
  target_line_cents INTEGER;
  target_charge_account_id BIGINT;
  target_charge_cents INTEGER;
  allocated_cents BIGINT;
  payment_applied_cents BIGINT;
BEGIN
  SELECT family_billing_account_id, status
    INTO invoice_account_id, invoice_status
    FROM billing_monthly_invoice
   WHERE id = NEW.billing_monthly_invoice_id
   FOR UPDATE;

  SELECT line.billing_monthly_invoice_id, line.billing_charge_id,
         line.line_type, line.amount_cents
    INTO credit_line_invoice_id, credit_charge_id,
         credit_line_type, credit_line_cents
    FROM billing_monthly_invoice_line line
   WHERE line.id = NEW.credit_invoice_line_id;

  SELECT line.billing_monthly_invoice_id, line.billing_charge_id,
         line.line_type, line.amount_cents
    INTO target_line_invoice_id, target_charge_id,
         target_line_type, target_line_cents
    FROM billing_monthly_invoice_line line
   WHERE line.id = NEW.target_invoice_line_id;

  IF invoice_account_id IS NULL
     OR credit_line_invoice_id IS DISTINCT FROM NEW.billing_monthly_invoice_id
     OR target_line_invoice_id IS DISTINCT FROM NEW.billing_monthly_invoice_id THEN
    RAISE EXCEPTION 'household invoice credit allocation lines must belong to its invoice';
  END IF;
  IF invoice_status <> 'paid' THEN
    RAISE EXCEPTION 'household invoice credit allocations require a paid invoice';
  END IF;
  IF credit_line_type <> 'credit' OR credit_charge_id IS NULL OR credit_line_cents >= 0 THEN
    RAISE EXCEPTION 'household invoice credit allocation requires a negative charge-backed credit line';
  END IF;
  IF target_line_type <> 'charge' OR target_charge_id IS NULL OR target_line_cents <= 0 THEN
    RAISE EXCEPTION 'household invoice credit allocation requires a positive target charge line';
  END IF;

  -- Lock both immutable ledger sources in a stable order. This serializes a
  -- paid invoice settlement against any other collector for the same charges.
  PERFORM id
    FROM billing_charge
   WHERE id IN (credit_charge_id, target_charge_id)
   ORDER BY id
   FOR UPDATE;

  SELECT family_billing_account_id, amount_cents
    INTO credit_charge_account_id, credit_charge_cents
    FROM billing_charge
   WHERE id = credit_charge_id;
  SELECT family_billing_account_id, amount_cents
    INTO target_charge_account_id, target_charge_cents
    FROM billing_charge
   WHERE id = target_charge_id;

  IF credit_charge_account_id IS DISTINCT FROM invoice_account_id
     OR target_charge_account_id IS DISTINCT FROM invoice_account_id THEN
    RAISE EXCEPTION 'household invoice credit allocation crosses billing accounts';
  END IF;
  IF credit_charge_cents >= 0 OR target_charge_cents <= 0 THEN
    RAISE EXCEPTION 'household invoice credit allocation has invalid ledger source signs';
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0)
    INTO allocated_cents
    FROM billing_charge_credit_application
   WHERE credit_invoice_line_id = NEW.credit_invoice_line_id;
  IF allocated_cents > ABS(credit_line_cents) THEN
    RAISE EXCEPTION 'household invoice credit line % is over-allocated', NEW.credit_invoice_line_id;
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0)
    INTO allocated_cents
    FROM billing_charge_credit_application
   WHERE target_invoice_line_id = NEW.target_invoice_line_id;
  IF allocated_cents > target_line_cents THEN
    RAISE EXCEPTION 'household invoice target line % is over-credited', NEW.target_invoice_line_id;
  END IF;

  SELECT COALESCE(SUM(application.amount_cents), 0)
    INTO allocated_cents
    FROM billing_charge_credit_application application
    JOIN billing_monthly_invoice_line credit_line
      ON credit_line.id = application.credit_invoice_line_id
   WHERE credit_line.billing_charge_id = credit_charge_id;
  IF allocated_cents > ABS(credit_charge_cents) THEN
    RAISE EXCEPTION 'negative billing charge % is over-allocated', credit_charge_id;
  END IF;

  SELECT COALESCE(SUM(CASE
           WHEN application_kind = 'reversal' THEN -amount_cents
           ELSE amount_cents
         END), 0)
    INTO payment_applied_cents
    FROM billing_payment_application
   WHERE billing_charge_id = target_charge_id;
  SELECT COALESCE(SUM(application.amount_cents), 0)
    INTO allocated_cents
    FROM billing_charge_credit_application application
    JOIN billing_monthly_invoice_line target_line
      ON target_line.id = application.target_invoice_line_id
   WHERE target_line.billing_charge_id = target_charge_id;
  IF payment_applied_cents < 0
     OR payment_applied_cents + allocated_cents > target_charge_cents THEN
    RAISE EXCEPTION 'positive billing charge % is over-funded by payments and credits', target_charge_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_charge_credit_application_capacity
  ON billing_charge_credit_application;
CREATE CONSTRAINT TRIGGER trg_billing_charge_credit_application_capacity
AFTER INSERT ON billing_charge_credit_application
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_billing_charge_credit_application_capacity();

-- Extend the existing payment guard so a later cash/card application cannot
-- over-fund a charge that was already partly satisfied by an invoice credit.
CREATE OR REPLACE FUNCTION validate_billing_payment_application_capacity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  payment_id BIGINT;
  charge_id BIGINT;
  received_cents INTEGER;
  charge_cents INTEGER;
  applied_cents BIGINT;
  credited_cents BIGINT;
BEGIN
  FOREACH payment_id IN ARRAY ARRAY[
    CASE WHEN TG_OP = 'DELETE' THEN OLD.billing_payment_id ELSE NEW.billing_payment_id END,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.billing_payment_id ELSE NULL END
  ] LOOP
    IF payment_id IS NULL THEN
      CONTINUE;
    END IF;
    SELECT amount_cents INTO received_cents
      FROM billing_payment
     WHERE id = payment_id;
    IF received_cents IS NULL THEN
      CONTINUE;
    END IF;
    SELECT COALESCE(SUM(CASE
             WHEN application_kind = 'reversal' THEN -amount_cents
             ELSE amount_cents
           END), 0)
      INTO applied_cents
      FROM billing_payment_application
     WHERE billing_payment_id = payment_id;
    IF applied_cents < 0 OR applied_cents > received_cents THEN
      RAISE EXCEPTION 'billing payment % has % applied cents, received %',
        payment_id, applied_cents, received_cents;
    END IF;
  END LOOP;

  FOREACH charge_id IN ARRAY ARRAY[
    CASE WHEN TG_OP = 'DELETE' THEN OLD.billing_charge_id ELSE NEW.billing_charge_id END,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.billing_charge_id ELSE NULL END
  ] LOOP
    IF charge_id IS NULL THEN
      CONTINUE;
    END IF;
    SELECT amount_cents INTO charge_cents
      FROM billing_charge
     WHERE id = charge_id
     FOR UPDATE;
    IF charge_cents IS NULL OR charge_cents <= 0 THEN
      CONTINUE;
    END IF;
    SELECT COALESCE(SUM(CASE
             WHEN application_kind = 'reversal' THEN -amount_cents
             ELSE amount_cents
           END), 0)
      INTO applied_cents
      FROM billing_payment_application
     WHERE billing_charge_id = charge_id;
    SELECT COALESCE(SUM(application.amount_cents), 0)
      INTO credited_cents
      FROM billing_charge_credit_application application
      JOIN billing_monthly_invoice_line target_line
        ON target_line.id = application.target_invoice_line_id
     WHERE target_line.billing_charge_id = charge_id;
    IF applied_cents < 0 OR applied_cents + credited_cents > charge_cents THEN
      RAISE EXCEPTION 'positive billing charge % is over-funded by payments and credits', charge_id;
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
