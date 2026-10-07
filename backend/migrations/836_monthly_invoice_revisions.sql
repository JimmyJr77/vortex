-- Retain immutable voided invoice history while allowing a replacement invoice
-- for the same month after settled payments have reduced the amount still owed.
ALTER TABLE billing_monthly_invoice
  DROP CONSTRAINT IF EXISTS billing_monthly_invoice_family_billing_account_id_billing_mon_key;
DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid='billing_monthly_invoice'::regclass AND c.contype='u'
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
           FROM unnest(c.conkey) k JOIN pg_attribute a
           ON a.attrelid=c.conrelid AND a.attnum=k)
          = ARRAY['billing_month','family_billing_account_id']::text[]
  LOOP
    EXECUTE format('ALTER TABLE billing_monthly_invoice DROP CONSTRAINT %I',constraint_name);
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_monthly_invoice_current
  ON billing_monthly_invoice(family_billing_account_id,billing_month)
  WHERE status <> 'void';
