ALTER TABLE store_order
  DROP CONSTRAINT IF EXISTS store_order_payment_method_check;

ALTER TABLE store_order
  ADD CONSTRAINT store_order_payment_method_check
  CHECK (payment_method IN ('billing_account', 'card', 'terminal', 'cash', 'check', 'mobile'));
