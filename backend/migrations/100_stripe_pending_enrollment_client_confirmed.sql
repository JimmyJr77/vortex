-- Fire-once browser purchase confirmation for GTM (vortex_purchase dataLayer push).
-- The first /api/members/billing/confirm-enrollment-checkout call after payment stamps
-- client_confirmed_at; only that response returns firstConfirmation=true, so refreshing
-- or revisiting the Stripe success URL never re-fires the browser-side conversion.
-- Idempotent; applied lazily via ensurePendingEnrollmentSchema.

ALTER TABLE stripe_pending_enrollment
  ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMPTZ;
