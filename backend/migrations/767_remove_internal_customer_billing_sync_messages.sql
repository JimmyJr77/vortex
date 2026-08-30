-- Internal migration instructions are not customer-facing Stripe errors. Keep
-- the failed/retryable state intact, but remove this implementation detail
-- from both recurring subscriptions and price-adjustment records.

UPDATE billing_subscription
SET price_sync_error = NULL,
    updated_at = now()
WHERE price_sync_error = 'Restored promo assignment requires Stripe expiration-schedule synchronization.';

UPDATE enrollment_price_adjustment
SET stripe_sync_error = NULL
WHERE stripe_sync_error = 'Restored promo assignment requires Stripe expiration-schedule synchronization.';
