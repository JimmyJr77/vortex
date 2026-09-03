-- Pickup-only retail storefront. Catalog items are scoped to a facility; food
-- and drink can be kept internal by setting is_public = false.

CREATE TABLE IF NOT EXISTS store_product (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  sku                 TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  category            TEXT NOT NULL DEFAULT 'apparel'
                      CHECK (category IN ('apparel', 'food_drink', 'other')),
  price_cents         INTEGER NOT NULL CHECK (price_cents >= 0),
  inventory_quantity  INTEGER CHECK (inventory_quantity IS NULL OR inventory_quantity >= 0),
  is_public           BOOLEAN NOT NULL DEFAULT TRUE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_store_product_catalog
  ON store_product (facility_id, is_active, is_public, sort_order, name);

CREATE TABLE IF NOT EXISTS store_discount_code (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  code                TEXT NOT NULL,
  discount_type       TEXT NOT NULL CHECK (discount_type IN ('percent', 'amount')),
  value               INTEGER NOT NULL CHECK (value > 0),
  minimum_order_cents INTEGER NOT NULL DEFAULT 0 CHECK (minimum_order_cents >= 0),
  max_redemptions     INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redemption_count    INTEGER NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  starts_at           TIMESTAMPTZ,
  ends_at             TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, code),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CHECK ((discount_type = 'percent' AND value <= 100) OR discount_type = 'amount')
);

CREATE INDEX IF NOT EXISTS idx_store_discount_code_lookup
  ON store_discount_code (facility_id, code, is_active);

CREATE TABLE IF NOT EXISTS store_order (
  id                        BIGSERIAL PRIMARY KEY,
  facility_id               BIGINT NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
  order_number              TEXT NOT NULL,
  member_id                 BIGINT REFERENCES member(id) ON DELETE SET NULL,
  family_billing_account_id BIGINT REFERENCES family_billing_account(id) ON DELETE SET NULL,
  billing_charge_id         BIGINT REFERENCES billing_charge(id) ON DELETE SET NULL,
  discount_code_id          BIGINT REFERENCES store_discount_code(id) ON DELETE SET NULL,
  purchaser_name            TEXT,
  purchaser_email           TEXT,
  source                    TEXT NOT NULL CHECK (source IN ('public', 'member', 'admin')),
  status                    TEXT NOT NULL DEFAULT 'awaiting_payment'
                            CHECK (status IN ('awaiting_payment', 'placed', 'fulfilled', 'cancelled')),
  payment_status            TEXT NOT NULL DEFAULT 'pending'
                            CHECK (payment_status IN ('pending', 'billed_to_account', 'paid', 'external')),
  payment_method            TEXT NOT NULL
                            CHECK (payment_method IN ('billing_account', 'card', 'cash', 'check', 'mobile')),
  external_reference        TEXT,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_checkout_session_url TEXT,
  subtotal_cents            INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents            INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents               INTEGER NOT NULL CHECK (total_cents >= 0),
  fulfillment_note          TEXT NOT NULL DEFAULT 'Pickup at Vortex Athletics.',
  picked_up_at              TIMESTAMPTZ,
  idempotency_key           TEXT,
  request_fingerprint       TEXT,
  receipt_sent_at           TIMESTAMPTZ,
  created_by_user_id        BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, order_number),
  UNIQUE (facility_id, idempotency_key),
  CHECK (discount_cents <= subtotal_cents),
  CHECK (total_cents = subtotal_cents - discount_cents)
);

CREATE INDEX IF NOT EXISTS idx_store_order_facility_created
  ON store_order (facility_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_order_member
  ON store_order (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_order_pickup
  ON store_order (facility_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS store_order_item (
  id                BIGSERIAL PRIMARY KEY,
  order_id          BIGINT NOT NULL REFERENCES store_order(id) ON DELETE CASCADE,
  product_id        BIGINT REFERENCES store_product(id) ON DELETE SET NULL,
  product_name      TEXT NOT NULL,
  sku               TEXT,
  unit_price_cents  INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents  INTEGER NOT NULL CHECK (line_total_cents >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (line_total_cents = unit_price_cents * quantity)
);

CREATE INDEX IF NOT EXISTS idx_store_order_item_order ON store_order_item(order_id);

CREATE TABLE IF NOT EXISTS store_inventory_adjustment (
  id                BIGSERIAL PRIMARY KEY,
  product_id        BIGINT NOT NULL REFERENCES store_product(id) ON DELETE CASCADE,
  order_id          BIGINT REFERENCES store_order(id) ON DELETE SET NULL,
  quantity_delta    INTEGER NOT NULL,
  reason            TEXT NOT NULL,
  created_by_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_inventory_adjustment_product
  ON store_inventory_adjustment(product_id, created_at DESC);

INSERT INTO store_product (
  facility_id, sku, name, description, category, price_cents,
  inventory_quantity, is_public, is_active, sort_order
)
SELECT f.id, seed.sku, seed.name, seed.description, seed.category, seed.price_cents,
       seed.inventory_quantity, seed.is_public, TRUE, seed.sort_order
FROM facility f
CROSS JOIN (
  VALUES
    ('VTX-TEE', 'Vortex T-Shirt', 'Classic Vortex training tee.', 'apparel', 2500, 24, TRUE, 10),
    ('VTX-WU-TOP', 'Vortex Warmup Top', 'Lightweight warmup layer for training days.', 'apparel', 4500, 18, TRUE, 20),
    ('VTX-WU-BOTTOM', 'Vortex Warmup Bottoms', 'Comfortable warmup bottoms for athletes.', 'apparel', 4500, 18, TRUE, 30),
    ('VTX-SPORT-DRINK', 'Sports Drink', 'Available at the front desk.', 'food_drink', 300, 36, FALSE, 100),
    ('VTX-SNACK', 'Snack', 'Available at the front desk.', 'food_drink', 200, 30, FALSE, 110)
) AS seed(sku, name, description, category, price_cents, inventory_quantity, is_public, sort_order)
ON CONFLICT (facility_id, sku) DO NOTHING;
