-- Durable request identity and immutable annual-membership fulfillment terms.
-- Checkout creation can cross a process crash or client retry, so the local
-- request record is authoritative and Stripe's idempotency key is a second
-- line of defense rather than the only deduplication mechanism.

ALTER TABLE stripe_pending_enrollment
  ADD COLUMN IF NOT EXISTS request_key TEXT,
  ADD COLUMN IF NOT EXISTS request_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_url TEXT;

ALTER TABLE stripe_pending_enrollment
  DROP CONSTRAINT IF EXISTS stripe_pending_enrollment_request_fingerprint_check;
ALTER TABLE stripe_pending_enrollment
  ADD CONSTRAINT stripe_pending_enrollment_request_fingerprint_check CHECK (
    request_fingerprint IS NULL
    OR request_fingerprint ~ '^[0-9a-f]{64}$'
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_stripe_pending_enrollment_request
  ON stripe_pending_enrollment (family_billing_account_id, request_key)
  WHERE request_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS annual_membership_checkout_request (
  id                          BIGSERIAL PRIMARY KEY,
  family_billing_account_id   BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE RESTRICT,
  payer_member_id             BIGINT NOT NULL REFERENCES member(id) ON DELETE RESTRICT,
  request_key                 TEXT NOT NULL,
  request_fingerprint         TEXT NOT NULL,
  pricing_snapshot            JSONB NOT NULL,
  pricing_snapshot_hash       TEXT NOT NULL,
  currency                    TEXT NOT NULL DEFAULT 'usd',
  expected_amount_cents       INTEGER NOT NULL CHECK (expected_amount_cents >= 0),
  stripe_checkout_session_id  TEXT,
  stripe_checkout_session_url TEXT,
  status                      TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'fulfilling', 'completed', 'failed', 'expired', 'quarantined')),
  error_message               TEXT,
  expires_at                  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at                TIMESTAMPTZ,
  UNIQUE (family_billing_account_id, request_key),
  UNIQUE (stripe_checkout_session_id),
  CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CHECK (pricing_snapshot_hash ~ '^[0-9a-f]{64}$'),
  CHECK (currency ~ '^[a-z]{3}$')
);

CREATE INDEX IF NOT EXISTS idx_annual_membership_checkout_request_status
  ON annual_membership_checkout_request (status, expires_at);

CREATE TABLE IF NOT EXISTS annual_membership_checkout_promo_reservation (
  id                   BIGSERIAL PRIMARY KEY,
  checkout_request_id  BIGINT NOT NULL REFERENCES annual_membership_checkout_request(id) ON DELETE RESTRICT,
  rule_id              BIGINT NOT NULL REFERENCES discount_rule(id) ON DELETE RESTRICT,
  member_id            BIGINT NOT NULL REFERENCES member(id) ON DELETE RESTRICT,
  family_id            BIGINT NOT NULL REFERENCES family(id) ON DELETE RESTRICT,
  amount_cents         INTEGER NOT NULL CHECK (amount_cents > 0),
  expires_at           TIMESTAMPTZ NOT NULL,
  consumed_at          TIMESTAMPTZ,
  released_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (checkout_request_id, member_id, rule_id),
  CHECK (consumed_at IS NULL OR released_at IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_annual_membership_promo_reservation_active
  ON annual_membership_checkout_promo_reservation (rule_id, expires_at)
  WHERE consumed_at IS NULL AND released_at IS NULL;

ALTER TABLE discount_redemption
  ADD COLUMN IF NOT EXISTS annual_membership_checkout_request_id
    BIGINT REFERENCES annual_membership_checkout_request(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_discount_redemption_annual_checkout_member_rule
  ON discount_redemption (annual_membership_checkout_request_id, member_id, rule_id)
  WHERE annual_membership_checkout_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION guard_annual_membership_checkout_request_terms()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (
    NEW.family_billing_account_id,
    NEW.payer_member_id,
    NEW.request_key,
    NEW.request_fingerprint,
    NEW.pricing_snapshot,
    NEW.pricing_snapshot_hash,
    NEW.currency,
    NEW.expected_amount_cents,
    NEW.created_at
  ) IS DISTINCT FROM (
    OLD.family_billing_account_id,
    OLD.payer_member_id,
    OLD.request_key,
    OLD.request_fingerprint,
    OLD.pricing_snapshot,
    OLD.pricing_snapshot_hash,
    OLD.currency,
    OLD.expected_amount_cents,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'annual membership checkout financial terms are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_annual_membership_checkout_request_terms
  ON annual_membership_checkout_request;
CREATE TRIGGER trg_annual_membership_checkout_request_terms
BEFORE UPDATE ON annual_membership_checkout_request
FOR EACH ROW EXECUTE FUNCTION guard_annual_membership_checkout_request_terms();
