-- Billing System Overhaul — Phase 1 data model (additive, idempotent).
-- Adds charge typing, a recurring-rate table (billing_subscription), refunds,
-- bundle-ledger hardening, and a unified account-ledger view.
-- Safe to re-run on every boot: IF NOT EXISTS + guarded constraints + null-guarded backfills.

-- 1. billing_charge: typing + gross/discount split + subscription link.
ALTER TABLE billing_charge ADD COLUMN IF NOT EXISTS charge_type TEXT NOT NULL DEFAULT 'one_time';
ALTER TABLE billing_charge ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'one_time';
ALTER TABLE billing_charge ADD COLUMN IF NOT EXISTS gross_amount_cents INTEGER;
ALTER TABLE billing_charge ADD COLUMN IF NOT EXISTS discount_amount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE billing_charge ADD COLUMN IF NOT EXISTS subscription_id BIGINT;

-- Backfill gross for pre-existing rows (net == gross, no recorded discount).
UPDATE billing_charge SET gross_amount_cents = amount_cents WHERE gross_amount_cents IS NULL;

DO $$
BEGIN
  ALTER TABLE billing_charge
    ADD CONSTRAINT billing_charge_charge_type_check
    CHECK (charge_type IN ('recurring', 'one_time', 'adjustment', 'refund', 'credit'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE billing_charge
    ADD CONSTRAINT billing_charge_billing_interval_check
    CHECK (billing_interval IN ('month', 'one_time'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. billing_subscription: the recurring monthly-rate record (source of truth for monthly totals).
CREATE TABLE IF NOT EXISTS billing_subscription (
  id                        BIGSERIAL PRIMARY KEY,
  family_billing_account_id BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE CASCADE,
  member_id                 BIGINT REFERENCES member(id) ON DELETE SET NULL,
  source_type               TEXT NOT NULL DEFAULT 'scheduling_signup',
  source_id                 TEXT,
  description               TEXT NOT NULL,
  monthly_amount_cents      INTEGER NOT NULL DEFAULT 0,
  discount_amount_cents     INTEGER NOT NULL DEFAULT 0,
  net_monthly_cents         INTEGER NOT NULL DEFAULT 0,
  status                    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  start_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date                  DATE,
  anchor_day                INTEGER NOT NULL DEFAULT 1 CHECK (anchor_day BETWEEN 1 AND 31),
  next_bill_date            DATE,
  pricing_option_key        TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_subscription_account ON billing_subscription(family_billing_account_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscription_member ON billing_subscription(member_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscription_due ON billing_subscription(next_bill_date) WHERE status = 'active';

-- One active subscription per source enrollment (cancelled rows are allowed to coexist for history).
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_subscription_source
  ON billing_subscription (source_type, source_id)
  WHERE source_id IS NOT NULL AND status <> 'cancelled';

-- 3. billing_charge → billing_subscription FK (added after the table exists).
DO $$
BEGIN
  ALTER TABLE billing_charge
    ADD CONSTRAINT billing_charge_subscription_fk
    FOREIGN KEY (subscription_id) REFERENCES billing_subscription(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_billing_charge_subscription ON billing_charge(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_charge_type ON billing_charge(charge_type);

-- 4. billing_refund: refunds linked to a payment; surface as positive-to-balance ledger entries.
CREATE TABLE IF NOT EXISTS billing_refund (
  id                        BIGSERIAL PRIMARY KEY,
  family_billing_account_id BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE CASCADE,
  payment_id                BIGINT REFERENCES billing_payment(id) ON DELETE SET NULL,
  amount_cents              INTEGER NOT NULL CHECK (amount_cents > 0),
  reason                    TEXT,
  external_reference        TEXT,
  created_by_user_id        BIGINT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_refund_account ON billing_refund(family_billing_account_id);
CREATE INDEX IF NOT EXISTS idx_billing_refund_payment ON billing_refund(payment_id);

-- 5. Bundle ledger hardening: expiration + status on passes; typed redemption entries.
-- Bundle tables (049) are created lazily on first program API hit, so guard for existence
-- (also mirrored in 049 itself for the lazy path). Signed credit_delta: negative for
-- use/expire/refund, positive for restore/adjust-up.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'member_multi_class_pass'
  ) THEN
    ALTER TABLE member_multi_class_pass ADD COLUMN IF NOT EXISTS expires_at DATE;
    ALTER TABLE member_multi_class_pass ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
    BEGIN
      ALTER TABLE member_multi_class_pass
        ADD CONSTRAINT member_multi_class_pass_status_check
        CHECK (status IN ('active', 'expired', 'refunded'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'multi_class_pass_redemption'
  ) THEN
    ALTER TABLE multi_class_pass_redemption ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'use';
    ALTER TABLE multi_class_pass_redemption ADD COLUMN IF NOT EXISTS reason TEXT;
    ALTER TABLE multi_class_pass_redemption ADD COLUMN IF NOT EXISTS credit_delta INTEGER;
    BEGIN
      ALTER TABLE multi_class_pass_redemption
        ADD CONSTRAINT multi_class_pass_redemption_entry_type_check
        CHECK (entry_type IN ('use', 'restore', 'expire', 'refund', 'adjust'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    UPDATE multi_class_pass_redemption SET credit_delta = -classes_used WHERE credit_delta IS NULL;
  END IF;
END $$;

-- 6. v_account_ledger: unified running-balance ledger (charges +, payments -, refunds +).
CREATE OR REPLACE VIEW v_account_ledger AS
WITH entries AS (
  SELECT
    c.family_billing_account_id,
    'charge'::text        AS entry_kind,
    c.charge_type         AS entry_type,
    c.id                  AS ref_id,
    c.member_id           AS member_id,
    c.description         AS description,
    c.amount_cents        AS amount_cents,
    c.created_at          AS occurred_at
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
