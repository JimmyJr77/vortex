-- Scheduling: member linking, per-form pricing, auth tokens, member stubs

ALTER TABLE scheduling_form
  ADD COLUMN IF NOT EXISTS max_slots_per_user INTEGER,
  ADD COLUMN IF NOT EXISTS slot_cost_monthly_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_slots_per_user INTEGER NOT NULL DEFAULT 0;

ALTER TABLE member
  ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS signup_source VARCHAR(32);

ALTER TABLE scheduling_signup
  ADD COLUMN IF NOT EXISTS member_id BIGINT REFERENCES member(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_signup_member ON scheduling_signup(member_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_signup_form_member ON scheduling_signup(form_id, member_id);

CREATE TABLE IF NOT EXISTS scheduling_auth_token (
  id          BIGSERIAL PRIMARY KEY,
  token_hash  TEXT NOT NULL,
  email       VARCHAR(255) NOT NULL,
  form_id     BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
  member_id   BIGINT REFERENCES member(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduling_auth_token_email_form ON scheduling_auth_token(email, form_id);
