-- Keep the database payment guard aligned with verified correction retirement.
-- Immutable credit applications remain available for audit, but an explicitly
-- retired zero-net correction cannot consume the capacity of a valid charge.
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
      JOIN billing_monthly_invoice_line credit_line
        ON credit_line.id = application.credit_invoice_line_id
      JOIN billing_charge credit_source ON credit_source.id = credit_line.billing_charge_id
     WHERE target_line.billing_charge_id = charge_id
       AND COALESCE(credit_source.metadata->>'allocationRetired', 'false') <> 'true';
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
