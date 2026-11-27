-- A class move and its parent notification snapshot commit together.
CREATE TABLE IF NOT EXISTS scheduling_class_swap_notice (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL UNIQUE,
  swap_mode TEXT NOT NULL CHECK (swap_mode IN ('temporary','permanent')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  missing_contact_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS scheduling_class_swap_delivery (
  id BIGSERIAL PRIMARY KEY,
  notice_id BIGINT NOT NULL REFERENCES scheduling_class_swap_notice(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  member_id BIGINT REFERENCES member(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claim_token TEXT,
  claimed_until TIMESTAMPTZ,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(notice_id, recipient_email)
);
CREATE INDEX IF NOT EXISTS scheduling_class_swap_delivery_due
  ON scheduling_class_swap_delivery(next_attempt_at,id) WHERE status IN ('pending','sending');
