-- Supports account-scoped drop-in rows in the cursor-paged customer audit.
-- The account is resolved to member ids first, keeping this partial index
-- narrow without denormalizing billing-account ids onto registrations.
CREATE INDEX IF NOT EXISTS idx_drop_in_registration_member_class_date
  ON drop_in_registration(member_id, class_date DESC, id DESC)
  WHERE member_id IS NOT NULL
    AND status IN ('confirmed', 'attended');
