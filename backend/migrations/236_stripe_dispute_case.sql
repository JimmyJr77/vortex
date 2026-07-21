CREATE TABLE IF NOT EXISTS stripe_dispute_case (
  id BIGSERIAL PRIMARY KEY,
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT,
  family_billing_account_id BIGINT REFERENCES family_billing_account(id),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT,
  reason TEXT,
  status TEXT NOT NULL,
  response_due_at TIMESTAMPTZ,
  owner_email TEXT NOT NULL DEFAULT 'billing@vortexathletics.com',
  evidence_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (evidence_status IN ('not_started','collecting','ready','submitted','won','lost')),
  evidence_note TEXT,
  updated_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stripe_dispute_case_deadline ON stripe_dispute_case(status, response_due_at);
