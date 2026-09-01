-- Pause-credit persistence was historically created by live enrollment and
-- recurring-billing paths. Deploy it before processes start so requests and
-- workers never execute schema DDL.

CREATE TABLE IF NOT EXISTS billing_pause_credit (
  id                        BIGSERIAL PRIMARY KEY,
  scheduling_signup_id      BIGINT NOT NULL REFERENCES scheduling_signup(id) ON DELETE CASCADE,
  family_billing_account_id BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE CASCADE,
  member_id                 BIGINT REFERENCES member(id) ON DELETE SET NULL,
  credit_cents              INTEGER NOT NULL CHECK (credit_cents > 0),
  pause_date                DATE NOT NULL,
  service_month             TEXT NOT NULL,
  apply_on_month            TEXT NOT NULL,
  remaining_classes         INTEGER,
  credit_kind               TEXT NOT NULL DEFAULT 'pause',
  applied_at                TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scheduling_signup_id, pause_date)
);

ALTER TABLE billing_pause_credit
  ADD COLUMN IF NOT EXISTS credit_kind TEXT NOT NULL DEFAULT 'pause';

CREATE INDEX IF NOT EXISTS idx_billing_pause_credit_apply
  ON billing_pause_credit(apply_on_month)
  WHERE applied_at IS NULL;
