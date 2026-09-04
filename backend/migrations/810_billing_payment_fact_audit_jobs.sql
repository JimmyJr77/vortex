-- Every payment-state transition gets a durable, fact-only audit request.
-- The application worker owns execution; this trigger only captures committed
-- ledger facts, so a process restart cannot lose an audit request.

CREATE TABLE IF NOT EXISTS billing_payment_fact_audit_job (
  id BIGSERIAL PRIMARY KEY,
  billing_payment_id BIGINT NOT NULL REFERENCES billing_payment(id) ON DELETE CASCADE,
  family_billing_account_id BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE CASCADE,
  payment_external_status TEXT NOT NULL,
  run_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (run_status IN ('pending', 'running', 'succeeded', 'failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (billing_payment_id, payment_external_status)
);

CREATE INDEX IF NOT EXISTS idx_billing_payment_fact_audit_job_due
  ON billing_payment_fact_audit_job (run_status, next_attempt_at, id);

CREATE OR REPLACE FUNCTION enqueue_billing_payment_fact_audit_job()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  normalized_status TEXT;
BEGIN
  normalized_status := LOWER(COALESCE(NULLIF(BTRIM(NEW.external_status), ''), 'settled'));

  -- A payment's processor state, rather than an optimistic UI action, is the
  -- source of truth. Reconcile every committed state that can be displayed.
  IF normalized_status NOT IN (
    'pending', 'processing', 'reconciliation_required',
    'settled', 'succeeded', 'failed', 'canceled', 'cancelled'
  ) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO billing_payment_fact_audit_job (
      billing_payment_id,
      family_billing_account_id,
      payment_external_status,
      run_status,
      requested_at,
      next_attempt_at,
      result,
      error_message,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.family_billing_account_id,
      normalized_status,
      'pending',
      now(),
      now(),
      '{}'::jsonb,
      NULL,
      now()
    )
    ON CONFLICT (billing_payment_id, payment_external_status) DO UPDATE
      SET run_status = 'pending',
          requested_at = now(),
          next_attempt_at = now(),
          error_message = NULL,
          updated_at = now();
  ELSIF normalized_status IS DISTINCT FROM LOWER(COALESCE(NULLIF(BTRIM(OLD.external_status), ''), 'settled')) THEN
    INSERT INTO billing_payment_fact_audit_job (
      billing_payment_id,
      family_billing_account_id,
      payment_external_status,
      run_status,
      requested_at,
      next_attempt_at,
      result,
      error_message,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.family_billing_account_id,
      normalized_status,
      'pending',
      now(),
      now(),
      '{}'::jsonb,
      NULL,
      now()
    )
    ON CONFLICT (billing_payment_id, payment_external_status) DO UPDATE
      SET run_status = 'pending',
          requested_at = now(),
          next_attempt_at = now(),
          error_message = NULL,
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_payment_fact_audit_job ON billing_payment;
CREATE TRIGGER trg_billing_payment_fact_audit_job
AFTER INSERT OR UPDATE OF external_status ON billing_payment
FOR EACH ROW EXECUTE FUNCTION enqueue_billing_payment_fact_audit_job();
