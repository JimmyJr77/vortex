-- Allow Checkout mode=setup for recurring enrollments with $0 due now
-- (collect payment method, then create one Stripe Subscription per class).

ALTER TABLE stripe_pending_enrollment
  DROP CONSTRAINT IF EXISTS stripe_pending_enrollment_checkout_mode_check;

ALTER TABLE stripe_pending_enrollment
  ADD CONSTRAINT stripe_pending_enrollment_checkout_mode_check
  CHECK (checkout_mode IN ('payment', 'subscription', 'setup'));
