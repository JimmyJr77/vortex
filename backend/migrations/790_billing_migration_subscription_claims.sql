-- Atomically claim every local and remote subscription identifier for its
-- canonical household account. The earlier evidence trigger performs a
-- read-before-write check, which is not sufficient when two migrations insert
-- the same identifier concurrently under PostgreSQL READ COMMITTED isolation.

CREATE TABLE IF NOT EXISTS billing_migration_subscription_claim (
  claim_kind TEXT NOT NULL
    CHECK (claim_kind IN ('local_subscription', 'stripe_subscription')),
  claim_value TEXT NOT NULL,
  family_billing_account_id BIGINT NOT NULL
    REFERENCES family_billing_account(id) ON DELETE RESTRICT,
  first_migration_item_id BIGINT NOT NULL
    REFERENCES billing_account_migration_item(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (claim_kind, claim_value)
);

CREATE INDEX IF NOT EXISTS idx_billing_migration_subscription_claim_account
  ON billing_migration_subscription_claim(family_billing_account_id, claim_kind, claim_value);

DO $$
DECLARE
  conflict RECORD;
BEGIN
  SELECT candidates.claim_kind, candidates.claim_value,
         array_agg(DISTINCT candidates.family_billing_account_id ORDER BY candidates.family_billing_account_id) AS account_ids
    INTO conflict
    FROM (
      SELECT 'local_subscription'::text AS claim_kind,
             item.billing_subscription_id::text AS claim_value,
             account_migration.family_billing_account_id
        FROM billing_account_migration_item item
        JOIN billing_account_migration account_migration
          ON account_migration.id = item.billing_account_migration_id
       WHERE item.billing_subscription_id IS NOT NULL
      UNION ALL
      SELECT 'stripe_subscription'::text AS claim_kind,
             item.former_stripe_subscription_id AS claim_value,
             account_migration.family_billing_account_id
        FROM billing_account_migration_item item
        JOIN billing_account_migration account_migration
          ON account_migration.id = item.billing_account_migration_id
       WHERE item.former_stripe_subscription_id IS NOT NULL
    ) candidates
   GROUP BY candidates.claim_kind, candidates.claim_value
  HAVING COUNT(DISTINCT candidates.family_billing_account_id) > 1
   LIMIT 1;

  IF conflict.claim_value IS NOT NULL THEN
    RAISE EXCEPTION
      'canonical billing % identifier % is already mapped to multiple accounts %',
      conflict.claim_kind, conflict.claim_value, conflict.account_ids;
  END IF;
END;
$$;

INSERT INTO billing_migration_subscription_claim (
  claim_kind,
  claim_value,
  family_billing_account_id,
  first_migration_item_id
)
SELECT DISTINCT ON (candidates.claim_kind, candidates.claim_value)
       candidates.claim_kind,
       candidates.claim_value,
       candidates.family_billing_account_id,
       candidates.item_id
  FROM (
    SELECT 'local_subscription'::text AS claim_kind,
           item.billing_subscription_id::text AS claim_value,
           account_migration.family_billing_account_id,
           item.id AS item_id
      FROM billing_account_migration_item item
      JOIN billing_account_migration account_migration
        ON account_migration.id = item.billing_account_migration_id
     WHERE item.billing_subscription_id IS NOT NULL
    UNION ALL
    SELECT 'stripe_subscription'::text AS claim_kind,
           item.former_stripe_subscription_id AS claim_value,
           account_migration.family_billing_account_id,
           item.id AS item_id
      FROM billing_account_migration_item item
      JOIN billing_account_migration account_migration
        ON account_migration.id = item.billing_account_migration_id
     WHERE item.former_stripe_subscription_id IS NOT NULL
  ) candidates
 ORDER BY candidates.claim_kind, candidates.claim_value, candidates.item_id
ON CONFLICT (claim_kind, claim_value) DO NOTHING;

CREATE OR REPLACE FUNCTION claim_billing_migration_subscription_mapping()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  owner_account_id BIGINT;
  claimed_account_id BIGINT;
BEGIN
  SELECT account_migration.family_billing_account_id
    INTO STRICT owner_account_id
    FROM billing_account_migration account_migration
   WHERE account_migration.id = NEW.billing_account_migration_id;

  IF NEW.billing_subscription_id IS NOT NULL THEN
    INSERT INTO billing_migration_subscription_claim (
      claim_kind, claim_value, family_billing_account_id, first_migration_item_id
    ) VALUES (
      'local_subscription', NEW.billing_subscription_id::text, owner_account_id, NEW.id
    )
    ON CONFLICT (claim_kind, claim_value) DO NOTHING;

    SELECT family_billing_account_id
      INTO STRICT claimed_account_id
      FROM billing_migration_subscription_claim
     WHERE claim_kind = 'local_subscription'
       AND claim_value = NEW.billing_subscription_id::text;
    IF claimed_account_id <> owner_account_id THEN
      RAISE EXCEPTION
        'canonical billing local subscription % belongs to account %, not account %',
        NEW.billing_subscription_id, claimed_account_id, owner_account_id;
    END IF;
  END IF;

  IF NEW.former_stripe_subscription_id IS NOT NULL THEN
    INSERT INTO billing_migration_subscription_claim (
      claim_kind, claim_value, family_billing_account_id, first_migration_item_id
    ) VALUES (
      'stripe_subscription', NEW.former_stripe_subscription_id, owner_account_id, NEW.id
    )
    ON CONFLICT (claim_kind, claim_value) DO NOTHING;

    SELECT family_billing_account_id
      INTO STRICT claimed_account_id
      FROM billing_migration_subscription_claim
     WHERE claim_kind = 'stripe_subscription'
       AND claim_value = NEW.former_stripe_subscription_id;
    IF claimed_account_id <> owner_account_id THEN
      RAISE EXCEPTION
        'canonical billing Stripe subscription % belongs to account %, not account %',
        NEW.former_stripe_subscription_id, claimed_account_id, owner_account_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_migration_subscription_claim
  ON billing_account_migration_item;
CREATE TRIGGER trg_billing_migration_subscription_claim
AFTER INSERT OR UPDATE OF billing_subscription_id, former_stripe_subscription_id
ON billing_account_migration_item
FOR EACH ROW EXECUTE FUNCTION claim_billing_migration_subscription_mapping();

CREATE OR REPLACE FUNCTION reject_billing_migration_subscription_claim_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'canonical billing subscription ownership claims are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_migration_subscription_claim_immutable
  ON billing_migration_subscription_claim;
CREATE TRIGGER trg_billing_migration_subscription_claim_immutable
BEFORE UPDATE OR DELETE ON billing_migration_subscription_claim
FOR EACH ROW EXECUTE FUNCTION reject_billing_migration_subscription_claim_mutation();
