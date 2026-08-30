-- Customer Billing administration workspace.
-- Additive, append-only financial controls for effective-dated enrollment prices,
-- exact charge collection, refund treatment, and a unified administrative audit.

CREATE TABLE IF NOT EXISTS enrollment_price_adjustment (
  id                         BIGSERIAL PRIMARY KEY,
  family_billing_account_id  BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE RESTRICT,
  member_id                  BIGINT REFERENCES member(id) ON DELETE RESTRICT,
  signup_id                  BIGINT NOT NULL REFERENCES scheduling_signup(id) ON DELETE RESTRICT,
  billing_subscription_id    BIGINT REFERENCES billing_subscription(id) ON DELETE RESTRICT,
  kind                       TEXT NOT NULL CHECK (kind IN ('fixed_final_price', 'promo_code', 'legacy_discount')),
  final_price_cents          INTEGER CHECK (final_price_cents IS NULL OR final_price_cents >= 0),
  promo_code                 TEXT,
  discount_rule_id           BIGINT REFERENCES discount_rule(id) ON DELETE RESTRICT,
  discount_rule_snapshot     JSONB,
  effective_from_month       DATE NOT NULL,
  effective_through_month    DATE,
  standard_price_cents       INTEGER,
  preview_snapshot           JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason                     TEXT NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'pending_sync'
                             CHECK (status IN ('pending_sync', 'active', 'sync_failed', 'revoked')),
  stripe_sync_error          TEXT,
  stripe_synced_at           TIMESTAMPTZ,
  created_by_user_id         BIGINT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by_user_id         BIGINT,
  revoked_at                 TIMESTAMPTZ,
  revoke_reason              TEXT,
  supersedes_adjustment_id   BIGINT REFERENCES enrollment_price_adjustment(id) ON DELETE RESTRICT,
  CHECK (date_trunc('month', effective_from_month)::date = effective_from_month),
  CHECK (effective_through_month IS NULL OR date_trunc('month', effective_through_month)::date = effective_through_month),
  CHECK (effective_through_month IS NULL OR effective_through_month >= effective_from_month),
  CHECK (
    (kind = 'fixed_final_price' AND final_price_cents IS NOT NULL AND promo_code IS NULL)
    OR (kind = 'promo_code' AND promo_code IS NOT NULL AND final_price_cents IS NULL)
    OR kind = 'legacy_discount'
  )
);

CREATE INDEX IF NOT EXISTS idx_enrollment_price_adjustment_signup_period
  ON enrollment_price_adjustment(signup_id, effective_from_month, effective_through_month);
CREATE INDEX IF NOT EXISTS idx_enrollment_price_adjustment_account
  ON enrollment_price_adjustment(family_billing_account_id, created_at DESC);

ALTER TABLE discount_redemption
  ADD COLUMN IF NOT EXISTS price_adjustment_id BIGINT REFERENCES enrollment_price_adjustment(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_discount_redemption_price_adjustment
  ON discount_redemption(price_adjustment_id) WHERE price_adjustment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION reject_overlapping_enrollment_price_adjustment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'revoked' AND EXISTS (
    SELECT 1
    FROM enrollment_price_adjustment existing
    WHERE existing.signup_id = NEW.signup_id
      AND existing.id <> COALESCE(NEW.id, 0)
      AND existing.status <> 'revoked'
      AND daterange(
        existing.effective_from_month,
        COALESCE(existing.effective_through_month + 1, 'infinity'::date),
        '[)'
      ) && daterange(
        NEW.effective_from_month,
        COALESCE(NEW.effective_through_month + 1, 'infinity'::date),
        '[)'
      )
  ) THEN
    RAISE EXCEPTION 'Enrollment price adjustment overlaps an existing adjustment'
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollment_price_adjustment_no_overlap ON enrollment_price_adjustment;
CREATE TRIGGER trg_enrollment_price_adjustment_no_overlap
BEFORE INSERT OR UPDATE OF effective_from_month, effective_through_month, status
ON enrollment_price_adjustment
FOR EACH ROW EXECUTE FUNCTION reject_overlapping_enrollment_price_adjustment();

CREATE OR REPLACE FUNCTION guard_enrollment_price_adjustment_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'enrollment_price_adjustment records cannot be deleted';
  END IF;
  IF (
    to_jsonb(NEW) - ARRAY[
      'status', 'stripe_sync_error', 'stripe_synced_at',
      'revoked_by_user_id', 'revoked_at', 'revoke_reason'
    ]::text[]
  ) IS DISTINCT FROM (
    to_jsonb(OLD) - ARRAY[
      'status', 'stripe_sync_error', 'stripe_synced_at',
      'revoked_by_user_id', 'revoked_at', 'revoke_reason'
    ]::text[]
  ) THEN
    RAISE EXCEPTION 'enrollment_price_adjustment financial terms are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollment_price_adjustment_immutable ON enrollment_price_adjustment;
CREATE TRIGGER trg_enrollment_price_adjustment_immutable
BEFORE UPDATE OR DELETE ON enrollment_price_adjustment
FOR EACH ROW EXECUTE FUNCTION guard_enrollment_price_adjustment_mutation();

CREATE TABLE IF NOT EXISTS billing_account_activity (
  id                         BIGSERIAL PRIMARY KEY,
  event_key                  TEXT,
  family_billing_account_id  BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE RESTRICT,
  member_id                  BIGINT REFERENCES member(id) ON DELETE SET NULL,
  signup_id                  BIGINT REFERENCES scheduling_signup(id) ON DELETE SET NULL,
  related_charge_id          BIGINT REFERENCES billing_charge(id) ON DELETE SET NULL,
  related_payment_id         BIGINT REFERENCES billing_payment(id) ON DELETE SET NULL,
  related_refund_id          BIGINT REFERENCES billing_refund(id) ON DELETE SET NULL,
  event_type                 TEXT NOT NULL,
  summary                    TEXT NOT NULL,
  before_value               JSONB,
  after_value                JSONB,
  details                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  stripe_object_id           TEXT,
  actor_user_id              BIGINT,
  actor_type                 TEXT NOT NULL DEFAULT 'admin' CHECK (actor_type IN ('admin', 'member', 'system', 'stripe')),
  occurred_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_account_activity_event_key
  ON billing_account_activity(event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_account_activity_account
  ON billing_account_activity(family_billing_account_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_billing_account_activity_member
  ON billing_account_activity(member_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION reject_billing_account_activity_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'billing_account_activity is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_account_activity_immutable ON billing_account_activity;
CREATE TRIGGER trg_billing_account_activity_immutable
BEFORE UPDATE OR DELETE ON billing_account_activity
FOR EACH ROW EXECUTE FUNCTION reject_billing_account_activity_mutation();

CREATE TABLE IF NOT EXISTS billing_payment_application (
  id                 BIGSERIAL PRIMARY KEY,
  billing_payment_id BIGINT NOT NULL REFERENCES billing_payment(id) ON DELETE RESTRICT,
  billing_charge_id  BIGINT NOT NULL REFERENCES billing_charge(id) ON DELETE RESTRICT,
  amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (billing_payment_id, billing_charge_id),
  UNIQUE (billing_charge_id)
);

CREATE OR REPLACE FUNCTION reject_billing_payment_application_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'billing_payment_application is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_payment_application_immutable ON billing_payment_application;
CREATE TRIGGER trg_billing_payment_application_immutable
BEFORE UPDATE OR DELETE ON billing_payment_application
FOR EACH ROW EXECUTE FUNCTION reject_billing_payment_application_mutation();

ALTER TABLE billing_charge
  ADD COLUMN IF NOT EXISTS price_adjustment_id BIGINT REFERENCES enrollment_price_adjustment(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_charge_id BIGINT REFERENCES billing_charge(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS collection_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS authorization_source TEXT,
  ADD COLUMN IF NOT EXISTS authorization_date DATE,
  ADD COLUMN IF NOT EXISTS authorization_note TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE billing_charge DROP CONSTRAINT IF EXISTS billing_charge_collection_status_check;
ALTER TABLE billing_charge ADD CONSTRAINT billing_charge_collection_status_check
  CHECK (collection_status IN ('none', 'unpaid', 'checkout_pending', 'processing', 'paid', 'failed'));

CREATE INDEX IF NOT EXISTS idx_billing_charge_price_adjustment ON billing_charge(price_adjustment_id);
CREATE INDEX IF NOT EXISTS idx_billing_charge_related ON billing_charge(related_charge_id);
CREATE INDEX IF NOT EXISTS idx_billing_charge_collection_status ON billing_charge(collection_status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_charge_stripe_pi
  ON billing_charge(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE billing_refund
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS external_status TEXT NOT NULL DEFAULT 'succeeded',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS exception_category VARCHAR(40),
  ADD COLUMN IF NOT EXISTS evidence_note TEXT,
  ADD COLUMN IF NOT EXISTS approved_by_user_id BIGINT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS request_key TEXT,
  ADD COLUMN IF NOT EXISTS ledger_treatment TEXT,
  ADD COLUMN IF NOT EXISTS related_charge_id BIGINT REFERENCES billing_charge(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offset_credit_charge_id BIGINT REFERENCES billing_charge(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_refund_stripe_refund
  ON billing_refund (stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_refund_request_key
  ON billing_refund (request_key)
  WHERE request_key IS NOT NULL;

ALTER TABLE billing_refund DROP CONSTRAINT IF EXISTS billing_refund_exception_category_check;
ALTER TABLE billing_refund ADD CONSTRAINT billing_refund_exception_category_check CHECK (
  exception_category IS NULL OR exception_category IN (
    'duplicate_charge', 'vortex_cancellation', 'medical', 'relocation', 'owner_discretion'
  )
);

ALTER TABLE billing_refund DROP CONSTRAINT IF EXISTS billing_refund_ledger_treatment_check;
ALTER TABLE billing_refund ADD CONSTRAINT billing_refund_ledger_treatment_check
  CHECK (ledger_treatment IS NULL OR ledger_treatment IN ('reverse_charge', 'return_overpayment'));

ALTER TABLE billing_subscription
  ADD COLUMN IF NOT EXISTS stripe_subscription_schedule_id TEXT,
  ADD COLUMN IF NOT EXISTS price_sync_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS price_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS price_synced_at TIMESTAMPTZ;

ALTER TABLE billing_subscription DROP CONSTRAINT IF EXISTS billing_subscription_price_sync_status_check;
ALTER TABLE billing_subscription ADD CONSTRAINT billing_subscription_price_sync_status_check
  CHECK (price_sync_status IN ('not_required', 'pending', 'synced', 'failed'));

-- Preserve legacy manual enrollment discounts as append-only records. The canonical
-- resolver treats these records as descriptive because the legacy discount engine
-- already includes their amount in its computed net price.
INSERT INTO enrollment_price_adjustment (
  family_billing_account_id,
  member_id,
  signup_id,
  billing_subscription_id,
  kind,
  discount_rule_id,
  discount_rule_snapshot,
  effective_from_month,
  standard_price_cents,
  reason,
  status,
  created_at
)
SELECT
  bs.family_billing_account_id,
  s.member_id,
  s.id,
  bs.id,
  'legacy_discount',
  s.manual_discount_rule_id,
  jsonb_build_object(
    'manualDiscountCents', s.manual_discount_cents,
    'manualDiscountPct', s.manual_discount_pct,
    'manualDiscountReason', s.manual_discount_reason
  ),
  date_trunc('month', CURRENT_DATE)::date,
  bs.monthly_amount_cents,
  COALESCE(NULLIF(s.manual_discount_reason, ''), 'Migrated legacy enrollment discount'),
  'active',
  COALESCE(s.created_at, now())
FROM scheduling_signup s
JOIN billing_subscription bs
  ON bs.source_type = 'scheduling_signup'
 AND bs.source_id = s.id::text
 AND bs.status <> 'cancelled'
WHERE (s.manual_discount_cents IS NOT NULL OR s.manual_discount_pct IS NOT NULL OR s.manual_discount_rule_id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM enrollment_price_adjustment existing
    WHERE existing.signup_id = s.id AND existing.kind = 'legacy_discount'
  );

-- Failed and pending refunds do not change the account balance. Credits remain
-- ordinary signed billing_charge rows, so every correction is still visible.
CREATE OR REPLACE VIEW v_account_ledger AS
WITH entries AS (
  SELECT
    c.family_billing_account_id,
    'charge'::text AS entry_kind,
    c.charge_type AS entry_type,
    c.id AS ref_id,
    c.member_id,
    c.description,
    c.amount_cents,
    c.created_at AS occurred_at
  FROM billing_charge c
  UNION ALL
  SELECT
    p.family_billing_account_id,
    'payment'::text,
    'payment'::text,
    p.id,
    NULL::bigint,
    COALESCE(NULLIF(p.method, ''), 'Payment'),
    -p.amount_cents,
    p.paid_at
  FROM billing_payment p
  UNION ALL
  SELECT
    r.family_billing_account_id,
    'refund'::text,
    'refund'::text,
    r.id,
    NULL::bigint,
    COALESCE(NULLIF(r.reason, ''), 'Refund'),
    r.amount_cents,
    r.created_at
  FROM billing_refund r
  WHERE COALESCE(r.external_status, 'succeeded') = 'succeeded'
)
SELECT
  entries.family_billing_account_id,
  entries.entry_kind,
  entries.entry_type,
  entries.ref_id,
  entries.member_id,
  entries.description,
  entries.amount_cents,
  entries.occurred_at,
  SUM(entries.amount_cents) OVER (
    PARTITION BY entries.family_billing_account_id
    ORDER BY entries.occurred_at, entries.entry_kind, entries.ref_id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS running_balance_cents
FROM entries;
