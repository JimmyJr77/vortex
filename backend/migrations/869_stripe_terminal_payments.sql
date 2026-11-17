CREATE TABLE IF NOT EXISTS stripe_terminal_payment (
  id UUID PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('billing', 'store')),
  target_id BIGINT NOT NULL,
  actor_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  reader_id TEXT NOT NULL,
  reader_simulated BOOLEAN NOT NULL,
  livemode BOOLEAN NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'succeeded', 'canceled')),
  amount_cents INTEGER CHECK (amount_cents >= 50),
  stripe_customer_id TEXT,
  stripe_metadata JSONB NOT NULL DEFAULT '{}',
  stripe_payment_intent_id TEXT UNIQUE,
  create_started_at TIMESTAMPTZ,
  dispatch_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_terminal_payment_open_target_idx
  ON stripe_terminal_payment (facility_id, kind, target_id)
  WHERE state = 'open';

CREATE INDEX IF NOT EXISTS stripe_terminal_payment_target_idx
  ON stripe_terminal_payment (facility_id, kind, target_id, created_at DESC, id DESC);
