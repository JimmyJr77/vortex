-- Keep the AI audit-log constraint aligned with every kind written by the
-- current coaching routes. Idempotent and safe for existing rows.

ALTER TABLE coaching.ai_draft_log
  DROP CONSTRAINT IF EXISTS ai_draft_log_kind_check;

ALTER TABLE coaching.ai_draft_log
  ADD CONSTRAINT ai_draft_log_kind_check
  CHECK (kind IN (
    'session_draft',
    'coverage_nudge',
    'narrative',
    'auto_tag',
    'nl_needs'
  ));
