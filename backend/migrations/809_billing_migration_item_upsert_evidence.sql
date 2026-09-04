-- Permit an evidence upsert to reach PostgreSQL's conflict handler. The
-- durable guard must still reject a subscription mapping claimed by a
-- different migration item, but a BEFORE INSERT trigger otherwise sees the
-- existing natural-key row before ON CONFLICT can update it.

CREATE OR REPLACE FUNCTION enforce_billing_migration_item_evidence()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  conflicting_item_id BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical billing migration items are append-only';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (OLD.source_snapshot <> '{}'::jsonb AND NEW.source_snapshot IS DISTINCT FROM OLD.source_snapshot)
      OR (OLD.idempotency_key IS NOT NULL AND NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key)
      OR (OLD.billing_subscription_id IS NOT NULL AND NEW.billing_subscription_id IS DISTINCT FROM OLD.billing_subscription_id)
      OR (OLD.signup_id IS NOT NULL AND NEW.signup_id IS DISTINCT FROM OLD.signup_id)
      OR (OLD.member_id IS NOT NULL AND NEW.member_id IS DISTINCT FROM OLD.member_id)
      OR (OLD.former_stripe_subscription_id IS NOT NULL AND NEW.former_stripe_subscription_id IS DISTINCT FROM OLD.former_stripe_subscription_id)
      OR (OLD.former_stripe_item_id IS NOT NULL AND NEW.former_stripe_item_id IS DISTINCT FROM OLD.former_stripe_item_id)
      OR (OLD.former_stripe_schedule_id IS NOT NULL AND NEW.former_stripe_schedule_id IS DISTINCT FROM OLD.former_stripe_schedule_id)
      OR (OLD.local_status IS NOT NULL AND NEW.local_status IS DISTINCT FROM OLD.local_status)
      OR (OLD.local_start_date IS NOT NULL AND NEW.local_start_date IS DISTINCT FROM OLD.local_start_date)
      OR (OLD.local_end_date IS NOT NULL AND NEW.local_end_date IS DISTINCT FROM OLD.local_end_date)
      OR (OLD.local_next_bill_date IS NOT NULL AND NEW.local_next_bill_date IS DISTINCT FROM OLD.local_next_bill_date)
      OR (OLD.local_net_monthly_cents IS NOT NULL AND NEW.local_net_monthly_cents IS DISTINCT FROM OLD.local_net_monthly_cents)
      OR (OLD.target_id IS NOT NULL AND NEW.target_id IS DISTINCT FROM OLD.target_id)
    THEN
      RAISE EXCEPTION 'canonical billing migration item source mapping is immutable';
    END IF;
    IF NOT (NEW.target_snapshot @> OLD.target_snapshot) THEN
      RAISE EXCEPTION 'canonical billing migration item target evidence cannot be removed';
    END IF;
  END IF;

  IF NEW.billing_subscription_id IS NOT NULL OR NEW.former_stripe_subscription_id IS NOT NULL THEN
    SELECT other_item.id
      INTO conflicting_item_id
      FROM billing_account_migration_item other_item
      JOIN billing_account_migration other_account
        ON other_account.id = other_item.billing_account_migration_id
     WHERE other_item.id <> COALESCE(NEW.id, 0)
       -- Before ON CONFLICT resolves an insert, NEW has no id. Exclude only
       -- the exact natural-key item that the upsert will update; any other
       -- item retaining this mapping remains a conflict.
       AND NOT (
         other_item.billing_account_migration_id = NEW.billing_account_migration_id
         AND other_item.item_type = NEW.item_type
         AND other_item.source_id = NEW.source_id
       )
       AND other_account.state NOT IN ('verified', 'rolled_back')
       AND (
         (NEW.billing_subscription_id IS NOT NULL
           AND other_item.billing_subscription_id = NEW.billing_subscription_id)
         OR
         (NEW.former_stripe_subscription_id IS NOT NULL
           AND other_item.former_stripe_subscription_id = NEW.former_stripe_subscription_id)
       )
     LIMIT 1;
    IF conflicting_item_id IS NOT NULL THEN
      RAISE EXCEPTION 'canonical billing subscription mapping already belongs to active migration item %', conflicting_item_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
