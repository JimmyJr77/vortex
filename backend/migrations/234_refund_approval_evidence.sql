ALTER TABLE billing_refund
  ADD COLUMN IF NOT EXISTS exception_category VARCHAR(40),
  ADD COLUMN IF NOT EXISTS evidence_note TEXT,
  ADD COLUMN IF NOT EXISTS approved_by_user_id BIGINT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE billing_refund DROP CONSTRAINT IF EXISTS billing_refund_exception_category_check;
ALTER TABLE billing_refund ADD CONSTRAINT billing_refund_exception_category_check CHECK (
  exception_category IS NULL OR exception_category IN (
    'duplicate_charge', 'vortex_cancellation', 'medical', 'relocation', 'owner_discretion'
  )
);
