-- Durable reservations prevent a hosted Checkout Session, an off-session
-- PaymentIntent, and the household monthly invoice from collecting the same
-- ledger charges concurrently.

CREATE TABLE IF NOT EXISTS billing_payment_attempt (
  id                         BIGSERIAL PRIMARY KEY,
  family_billing_account_id  BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE RESTRICT,
  attempt_type               TEXT NOT NULL CHECK (attempt_type IN (
                               'member_balance_checkout',
                               'admin_balance_checkout',
                               'admin_balance_saved_card',
                               'charge_checkout',
                               'charge_saved_card'
                             )),
  request_key                TEXT NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN (
                               'reserved',
                               'pending',
                               'processing',
                               'reconciliation_required',
                               'succeeded',
                               'failed',
                               'expired',
                               'canceled'
                             )),
  amount_cents               INTEGER NOT NULL CHECK (amount_cents > 0),
  target_charge_id           BIGINT REFERENCES billing_charge(id) ON DELETE RESTRICT,
  billing_payment_id         BIGINT REFERENCES billing_payment(id) ON DELETE RESTRICT,
  stripe_checkout_session_id TEXT,
  stripe_checkout_url        TEXT,
  stripe_payment_intent_id   TEXT,
  expires_at                 TIMESTAMPTZ NOT NULL,
  metadata                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  released_at                TIMESTAMPTZ,
  completed_at               TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_billing_account_id, attempt_type, request_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_payment_attempt_checkout_session
  ON billing_payment_attempt(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_payment_attempt_payment_intent
  ON billing_payment_attempt(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_payment_attempt_account_status
  ON billing_payment_attempt(family_billing_account_id, status, expires_at, id);

CREATE TABLE IF NOT EXISTS billing_payment_attempt_charge (
  billing_payment_attempt_id BIGINT NOT NULL REFERENCES billing_payment_attempt(id) ON DELETE RESTRICT,
  billing_charge_id          BIGINT NOT NULL REFERENCES billing_charge(id) ON DELETE RESTRICT,
  amount_cents               INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (billing_payment_attempt_id, billing_charge_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_payment_attempt_charge_charge
  ON billing_payment_attempt_charge(billing_charge_id, billing_payment_attempt_id);

CREATE OR REPLACE FUNCTION reject_billing_payment_attempt_charge_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'billing payment attempt charge reservations are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_payment_attempt_charge_immutable ON billing_payment_attempt_charge;
CREATE TRIGGER trg_billing_payment_attempt_charge_immutable
BEFORE UPDATE OR DELETE ON billing_payment_attempt_charge
FOR EACH ROW EXECUTE FUNCTION reject_billing_payment_attempt_charge_mutation();

CREATE OR REPLACE FUNCTION validate_billing_payment_attempt_reservation_total()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  attempt_id BIGINT;
  expected_cents INTEGER;
  reserved_cents BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'billing_payment_attempt' THEN
    attempt_id := NEW.id;
  ELSE
    attempt_id := NEW.billing_payment_attempt_id;
  END IF;
  SELECT amount_cents INTO expected_cents
    FROM billing_payment_attempt
   WHERE id = attempt_id;
  SELECT COALESCE(SUM(amount_cents), 0) INTO reserved_cents
    FROM billing_payment_attempt_charge
   WHERE billing_payment_attempt_id = attempt_id;
  IF expected_cents IS NULL OR reserved_cents <> expected_cents THEN
    RAISE EXCEPTION 'billing payment attempt % reserves %, expected %',
      attempt_id, reserved_cents, expected_cents;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_payment_attempt_total ON billing_payment_attempt;
CREATE CONSTRAINT TRIGGER trg_billing_payment_attempt_total
AFTER INSERT OR UPDATE ON billing_payment_attempt
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_billing_payment_attempt_reservation_total();

DROP TRIGGER IF EXISTS trg_billing_payment_attempt_charge_total ON billing_payment_attempt_charge;
CREATE CONSTRAINT TRIGGER trg_billing_payment_attempt_charge_total
AFTER INSERT ON billing_payment_attempt_charge
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_billing_payment_attempt_reservation_total();

-- Every payment allocation path, including legacy-compatible admin writes,
-- must preserve the invariant that a payment can never fund more applications
-- than the amount actually received. Deferred validation allows an application
-- and its reversal to be written atomically in either order.
CREATE OR REPLACE FUNCTION validate_billing_payment_application_capacity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  payment_id BIGINT;
  received_cents INTEGER;
  applied_cents BIGINT;
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
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_payment_application_capacity ON billing_payment_application;
CREATE CONSTRAINT TRIGGER trg_billing_payment_application_capacity
AFTER INSERT OR UPDATE OR DELETE ON billing_payment_application
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_billing_payment_application_capacity();
