-- ============================================================
-- Coaching Module: Message file attachments
-- Migration: 064_coaching_message_attachments.sql
-- IDEMPOTENT: safe to re-run on every boot.
-- ============================================================

ALTER TABLE coaching.message
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

ALTER TABLE coaching.message
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

ALTER TABLE coaching.message
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT;
