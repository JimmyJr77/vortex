-- Facility-level additional fees (registration, annual, technology, etc.)

CREATE TABLE IF NOT EXISTS additional_fee (
  id              BIGSERIAL PRIMARY KEY,
  facility_id     BIGINT REFERENCES facility(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  amount_cents    INTEGER NOT NULL DEFAULT 0,
  apply_basis     TEXT NOT NULL DEFAULT 'per_order'
                  CHECK (apply_basis IN ('per_order','per_slot','per_class','per_offering','per_month','per_year')),
  apply_interval  INTEGER NOT NULL DEFAULT 1,
  trigger_type    TEXT NOT NULL DEFAULT 'each_enrollment'
                  CHECK (trigger_type IN ('each_enrollment','new_member','once_per_year')),
  scope_level     TEXT NOT NULL DEFAULT 'global'
                  CHECK (scope_level IN ('global','sport','program','class','offering')),
  scope_ref_id    BIGINT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  priority        INTEGER NOT NULL DEFAULT 100,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_additional_fee_facility_active ON additional_fee(facility_id, active);

CREATE TABLE IF NOT EXISTS additional_fee_redemption (
  id            BIGSERIAL PRIMARY KEY,
  fee_id        BIGINT NOT NULL REFERENCES additional_fee(id) ON DELETE CASCADE,
  member_id     BIGINT REFERENCES member(id) ON DELETE SET NULL,
  signup_id     BIGINT REFERENCES scheduling_signup(id) ON DELETE SET NULL,
  period_key    TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fee_id, member_id, period_key)
);
CREATE INDEX IF NOT EXISTS idx_additional_fee_redemption_fee ON additional_fee_redemption(fee_id);
CREATE INDEX IF NOT EXISTS idx_additional_fee_redemption_member ON additional_fee_redemption(member_id);
