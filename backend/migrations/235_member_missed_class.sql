CREATE TABLE IF NOT EXISTS member_missed_class (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES member(id),
  scheduling_signup_id BIGINT REFERENCES scheduling_signup(id),
  missed_on DATE NOT NULL,
  reason TEXT,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'declined')),
  approval_note TEXT,
  recorded_by_user_id BIGINT,
  reviewed_by_user_id BIGINT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_missed_class_member_date ON member_missed_class(member_id, missed_on DESC);
