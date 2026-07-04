-- Stripe catalog mapping: Vortex sellable items ↔ Stripe Products + Prices.
-- Idempotent; applied on boot via initPlatformTables and migrate:all.

CREATE TABLE IF NOT EXISTS stripe_catalog_item (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT REFERENCES facility(id) ON DELETE CASCADE,
  entity_type         TEXT NOT NULL
                      CHECK (entity_type IN (
                        'program_option', 'multi_class_pass',
                        'additional_fee', 'class_override', 'balance'
                      )),
  entity_id           BIGINT NOT NULL,
  sub_key             TEXT,
  stripe_product_id   TEXT NOT NULL,
  stripe_price_id     TEXT NOT NULL,
  stripe_lookup_key   TEXT NOT NULL UNIQUE,
  amount_cents        INTEGER NOT NULL DEFAULT 0,
  recurring_interval  TEXT,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_catalog_item_entity
  ON stripe_catalog_item (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_stripe_catalog_item_facility_active
  ON stripe_catalog_item (facility_id, active);

ALTER TABLE billing_charge ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE billing_charge ADD COLUMN IF NOT EXISTS stripe_invoice_item_id TEXT;

ALTER TABLE billing_subscription ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE billing_subscription ADD COLUMN IF NOT EXISTS stripe_subscription_item_id TEXT;

CREATE INDEX IF NOT EXISTS idx_billing_charge_stripe_price
  ON billing_charge (stripe_price_id)
  WHERE stripe_price_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_subscription_stripe_sub
  ON billing_subscription (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
