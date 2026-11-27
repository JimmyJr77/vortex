-- A cancellation and its recipient snapshot commit together. SMTP delivery can
-- then recover independently without reopening the cancelled session.
CREATE TABLE IF NOT EXISTS scheduling_cancellation_notice (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  time_slot_id BIGINT REFERENCES scheduling_time_slot(id) ON DELETE SET NULL,
  scope_key TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  affected_sessions JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_contact_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  restored_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS scheduling_cancellation_notice_active_scope
  ON scheduling_cancellation_notice(facility_id, occurrence_date, scope_key) WHERE restored_at IS NULL;

CREATE TABLE IF NOT EXISTS scheduling_cancellation_delivery (
  id BIGSERIAL PRIMARY KEY,
  notice_id BIGINT NOT NULL REFERENCES scheduling_cancellation_notice(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  member_id BIGINT REFERENCES member(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claim_token TEXT,
  claimed_until TIMESTAMPTZ,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(notice_id, recipient_email)
);
CREATE INDEX IF NOT EXISTS scheduling_cancellation_delivery_due
  ON scheduling_cancellation_delivery(next_attempt_at, id) WHERE status IN ('pending','failed','sending');
