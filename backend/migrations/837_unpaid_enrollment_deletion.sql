-- Preserve administrative evidence when an unpaid enrollment is removed.
-- Financial applications/invoices retain RESTRICT foreign keys: paid records
-- and collection evidence cannot be erased through this operation.
ALTER TABLE enrollment_price_adjustment ALTER COLUMN signup_id DROP NOT NULL;
DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT conrelid::regclass AS table_name, conname, att.attname AS column_name, confrelid::regclass AS target
    FROM pg_constraint con JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f' AND array_length(con.conkey, 1) = 1
      AND con.conrelid IN ('enrollment_price_adjustment'::regclass, 'billing_account_migration_item'::regclass)
      AND con.confrelid IN ('scheduling_signup'::regclass, 'billing_subscription'::regclass)
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', item.table_name, item.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(id) ON DELETE SET NULL',
      item.table_name, item.conname, item.column_name, item.target);
  END LOOP;
END $$;

-- Allow only FK-triggered detachment; audit content remains immutable.
CREATE OR REPLACE FUNCTION reject_billing_account_activity_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1
    AND (to_jsonb(NEW) - ARRAY['signup_id','related_charge_id']::text[]) =
        (to_jsonb(OLD) - ARRAY['signup_id','related_charge_id']::text[])
    AND (NEW.signup_id IS NULL OR NEW.signup_id IS NOT DISTINCT FROM OLD.signup_id)
    AND (NEW.related_charge_id IS NULL OR NEW.related_charge_id IS NOT DISTINCT FROM OLD.related_charge_id)
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'billing_account_activity is append-only';
END $$;

CREATE OR REPLACE FUNCTION guard_enrollment_price_adjustment_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'enrollment_price_adjustment records cannot be deleted'; END IF;
  IF pg_trigger_depth() > 1
    AND (to_jsonb(NEW) - ARRAY['signup_id','billing_subscription_id']::text[]) =
        (to_jsonb(OLD) - ARRAY['signup_id','billing_subscription_id']::text[])
    AND (NEW.signup_id IS NULL OR NEW.signup_id IS NOT DISTINCT FROM OLD.signup_id)
    AND (NEW.billing_subscription_id IS NULL OR NEW.billing_subscription_id IS NOT DISTINCT FROM OLD.billing_subscription_id)
  THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - ARRAY['status','stripe_sync_error','stripe_synced_at','revoked_by_user_id','revoked_at','revoke_reason']::text[])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','stripe_sync_error','stripe_synced_at','revoked_by_user_id','revoked_at','revoke_reason']::text[])
  THEN RAISE EXCEPTION 'enrollment_price_adjustment financial terms are immutable'; END IF;
  RETURN NEW;
END $$;

-- Unissued local invoices may drop the exact unpaid lines authorized by the
-- enrollment deletion transaction. Issued/paid invoice evidence stays immutable.
CREATE OR REPLACE FUNCTION reject_billing_monthly_invoice_line_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(NULLIF(current_setting('vortex.enrollment_deletion_charge_ids', true), ''), '[]')::jsonb @> to_jsonb(OLD.billing_charge_id)
      AND EXISTS (SELECT 1 FROM billing_monthly_invoice invoice WHERE invoice.id = OLD.billing_monthly_invoice_id
        AND invoice.stripe_invoice_id IS NULL AND invoice.stripe_payment_intent_id IS NULL
        AND invoice.paid_at IS NULL AND invoice.status <> 'paid')
      AND NOT EXISTS (SELECT 1 FROM billing_payment_application WHERE billing_charge_id = OLD.billing_charge_id)
      AND NOT EXISTS (SELECT 1 FROM billing_charge_credit_application
        WHERE credit_invoice_line_id = OLD.id OR target_invoice_line_id = OLD.id)
    THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'billing_monthly_invoice_line records cannot be deleted';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['stripe_invoice_item_id']::text[]) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['stripe_invoice_item_id']::text[]) THEN
    RAISE EXCEPTION 'billing_monthly_invoice_line financial terms are immutable';
  END IF;
  RETURN NEW;
END $$;
