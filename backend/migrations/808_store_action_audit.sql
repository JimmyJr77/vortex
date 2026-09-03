-- Store Desk activity is append-only. The app uses this record as the source
-- of truth for who changed catalog data and who recorded each sale.

CREATE TABLE IF NOT EXISTS store_action_audit (
  id            BIGSERIAL PRIMARY KEY,
  facility_id   BIGINT NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
  actor_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  actor_label   TEXT NOT NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     BIGINT,
  details       JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_action_audit_facility_occurred
  ON store_action_audit (facility_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_store_action_audit_facility_actor
  ON store_action_audit (facility_id, actor_label, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_action_audit_facility_action
  ON store_action_audit (facility_id, action, occurred_at DESC);

-- Preserve the existing accountable sales and inventory history when this
-- audit is introduced. Earlier catalog and discount edits did not store an
-- actor, so they are intentionally not inferred or fabricated here.
INSERT INTO store_action_audit (
  facility_id, actor_user_id, actor_label, action, entity_type, entity_id, details, occurred_at
)
SELECT
  order_row.facility_id,
  order_row.created_by_user_id,
  COALESCE(NULLIF(TRIM(actor.full_name), ''), 'System'),
  'sale_recorded',
  'sale',
  order_row.id,
  jsonb_build_object(
    'orderNumber', order_row.order_number,
    'source', order_row.source,
    'purchaserName', order_row.purchaser_name,
    'purchaserEmail', order_row.purchaser_email,
    'paymentMethod', order_row.payment_method,
    'paymentStatus', order_row.payment_status,
    'subtotalCents', order_row.subtotal_cents,
    'discountCents', order_row.discount_cents,
    'totalCents', order_row.total_cents
  ),
  order_row.created_at
FROM store_order order_row
LEFT JOIN app_user actor ON actor.id = order_row.created_by_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM store_action_audit audit
   WHERE audit.entity_type = 'sale'
     AND audit.entity_id = order_row.id
     AND audit.action = 'sale_recorded'
);

INSERT INTO store_action_audit (
  facility_id, actor_user_id, actor_label, action, entity_type, entity_id, details, occurred_at
)
SELECT
  product.facility_id,
  adjustment.created_by_user_id,
  COALESCE(NULLIF(TRIM(actor.full_name), ''), 'System'),
  CASE adjustment.reason
    WHEN 'order_reserved' THEN 'inventory_reserved_for_sale'
    WHEN 'order_cancelled' THEN 'inventory_restored_after_cancellation'
    ELSE 'inventory_adjusted'
  END,
  'inventory',
  adjustment.product_id,
  jsonb_build_object(
    'productName', product.name,
    'sku', product.sku,
    'quantityDelta', adjustment.quantity_delta,
    'reason', adjustment.reason,
    'orderId', adjustment.order_id,
    'orderNumber', order_row.order_number
  ),
  adjustment.created_at
FROM store_inventory_adjustment adjustment
JOIN store_product product ON product.id = adjustment.product_id
LEFT JOIN store_order order_row ON order_row.id = adjustment.order_id
LEFT JOIN app_user actor ON actor.id = adjustment.created_by_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM store_action_audit audit
   WHERE audit.entity_type = 'inventory'
     AND audit.entity_id = adjustment.product_id
     AND audit.occurred_at = adjustment.created_at
     AND audit.details->>'reason' = adjustment.reason
);

CREATE OR REPLACE FUNCTION prevent_store_action_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Store action audit records are immutable';
END;
$$;

DROP TRIGGER IF EXISTS store_action_audit_immutable ON store_action_audit;
CREATE TRIGGER store_action_audit_immutable
  BEFORE UPDATE OR DELETE ON store_action_audit
  FOR EACH ROW EXECUTE FUNCTION prevent_store_action_audit_mutation();
