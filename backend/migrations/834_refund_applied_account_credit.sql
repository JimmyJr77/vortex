ALTER TABLE billing_refund
  DROP CONSTRAINT IF EXISTS billing_refund_ledger_treatment_check;

ALTER TABLE billing_refund
  ADD CONSTRAINT billing_refund_ledger_treatment_check
  CHECK (
    ledger_treatment IS NULL
    OR ledger_treatment IN ('reverse_charge', 'return_overpayment', 'return_credit')
  );
