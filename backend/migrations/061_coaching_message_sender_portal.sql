-- ============================================================
-- Coaching Module: Message sender portal origin
-- Migration: 061_coaching_message_sender_portal.sql
--
-- Records which portal (admin / coach / member) a message was sent from.
-- IDEMPOTENT: safe to re-run on every boot.
-- ============================================================

ALTER TABLE coaching.message
  ADD COLUMN IF NOT EXISTS sender_portal TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'message_sender_portal_check'
      AND conrelid = 'coaching.message'::regclass
  ) THEN
    ALTER TABLE coaching.message
      ADD CONSTRAINT message_sender_portal_check
      CHECK (sender_portal IS NULL OR sender_portal IN ('admin', 'coach', 'member'));
  END IF;
END $$;

UPDATE coaching.message
SET sender_portal = 'member'
WHERE sender_portal IS NULL AND sender_member_id IS NOT NULL;
