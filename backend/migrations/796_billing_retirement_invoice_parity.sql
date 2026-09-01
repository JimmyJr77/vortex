-- Preserve three-way invoice evidence for safe legacy retirement. Historical
-- rows remain append-only and nullable; retirement readiness rejects them until
-- a post-migration verification records complete charge, credit, and net totals.

ALTER TABLE billing_cycle_verification_evidence
  ADD COLUMN IF NOT EXISTS local_invoice_line_subtotal_cents BIGINT,
  ADD COLUMN IF NOT EXISTS local_invoice_line_credit_cents BIGINT,
  ADD COLUMN IF NOT EXISTS local_invoice_credit_cents BIGINT,
  ADD COLUMN IF NOT EXISTS local_invoice_total_cents BIGINT,
  ADD COLUMN IF NOT EXISTS facility_timezone TEXT;

ALTER TABLE billing_cycle_verification_evidence
  DROP CONSTRAINT IF EXISTS billing_cycle_verification_three_way_invoice_parity_check;
ALTER TABLE billing_cycle_verification_evidence
  ADD CONSTRAINT billing_cycle_verification_three_way_invoice_parity_check
  CHECK (
    status <> 'verified'
    OR (
      local_invoice_line_subtotal_cents IS NOT NULL
      AND local_invoice_line_credit_cents IS NOT NULL
      AND local_invoice_credit_cents IS NOT NULL
      AND local_invoice_total_cents IS NOT NULL
      AND NULLIF(BTRIM(facility_timezone), '') IS NOT NULL
      AND local_invoice_line_subtotal_cents >= 0
      AND local_invoice_line_credit_cents >= 0
      AND local_invoice_credit_cents >= 0
      AND local_invoice_total_cents >= 0
      AND local_invoice_line_total_cents >= 0
      AND local_invoice_subtotal_cents >= 0
      AND local_invoice_line_subtotal_cents = local_invoice_subtotal_cents
      AND local_invoice_line_credit_cents = local_invoice_credit_cents
      AND local_invoice_line_total_cents = local_invoice_total_cents
      AND local_invoice_total_cents = GREATEST(
        0,
        local_invoice_subtotal_cents - local_invoice_credit_cents
      )
      AND date_trunc('month', verified_at AT TIME ZONE facility_timezone)::date
            > billing_month
    )
  ) NOT VALID;
