-- Drop legacy member_program enrollment table (0 rows on prod as of 2026-07-05).
-- Canonical enrollments: scheduling_signup → billing_subscription / billing_charge.

ALTER TABLE enrollment_receipt_token DROP COLUMN IF EXISTS member_program_id;

DROP TABLE IF EXISTS member_program;
