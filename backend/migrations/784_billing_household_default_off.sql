-- Canonical household collection is cohort-controlled. New accounts must not
-- enter it implicitly while activation and invoice kill switches are off.
ALTER TABLE family_billing_account
  ALTER COLUMN household_monthly_billing_enabled SET DEFAULT FALSE;
