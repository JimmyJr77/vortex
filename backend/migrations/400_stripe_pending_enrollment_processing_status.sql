-- Allow processing status while enrollment commit runs outside a long transaction.

ALTER TABLE stripe_pending_enrollment
  DROP CONSTRAINT IF EXISTS stripe_pending_enrollment_status_check;

ALTER TABLE stripe_pending_enrollment
  ADD CONSTRAINT stripe_pending_enrollment_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'expired', 'failed'));
