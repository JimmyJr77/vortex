-- Durable per-member drop-in benefits. The annual cycle is anchored to the
-- member's actual annual-fee payment anniversary, never to January 1.
-- The application normally creates this table during scheduling startup. Keep
-- the migration self-contained so a clean `run-migration.js --all` database
-- does not depend on application boot order.
CREATE TABLE IF NOT EXISTS drop_in_registration (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT REFERENCES member(id) ON DELETE SET NULL,
  form_id BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
  slot_group_id BIGINT NOT NULL REFERENCES scheduling_slot_group(id) ON DELETE CASCADE,
  class_date DATE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  benefit_type TEXT NOT NULL DEFAULT 'paid'
    CHECK (benefit_type IN ('paid','free_trial','annual_credit')),
  base_price_cents INTEGER NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('account_required','payment_pending','confirmed','attended','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, slot_group_id, class_date)
);
CREATE INDEX IF NOT EXISTS idx_drop_in_slot_date
  ON drop_in_registration(slot_group_id, class_date, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_drop_in_lifetime_trial_member
  ON drop_in_registration(member_id)
  WHERE benefit_type='free_trial' AND member_id IS NOT NULL AND status <> 'cancelled';

CREATE TABLE IF NOT EXISTS member_drop_in_entitlement (
  member_id                    BIGINT PRIMARY KEY REFERENCES member(id) ON DELETE CASCADE,
  lifetime_trial_granted       INTEGER NOT NULL DEFAULT 1 CHECK (lifetime_trial_granted >= 0),
  annual_cycle_started_at      TIMESTAMPTZ,
  annual_cycle_expires_at      TIMESTAMPTZ,
  annual_credits_granted       INTEGER NOT NULL DEFAULT 0 CHECK (annual_credits_granted >= 0),
  admin_credits_granted        INTEGER NOT NULL DEFAULT 0 CHECK (admin_credits_granted >= 0),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drop_in_credit_adjustment (
  id              BIGSERIAL PRIMARY KEY,
  member_id       BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  quantity        INTEGER NOT NULL CHECK (quantity <> 0),
  reason          TEXT,
  admin_user_id   BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drop_in_credit_adjustment_member
  ON drop_in_credit_adjustment(member_id, created_at);

INSERT INTO member_drop_in_entitlement (member_id)
SELECT id FROM member
ON CONFLICT (member_id) DO NOTHING;

CREATE OR REPLACE FUNCTION ensure_member_drop_in_entitlement()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO member_drop_in_entitlement (member_id)
  VALUES (NEW.id)
  ON CONFLICT (member_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_member_drop_in_entitlement ON member;
CREATE TRIGGER trg_member_drop_in_entitlement
AFTER INSERT ON member
FOR EACH ROW EXECUTE FUNCTION ensure_member_drop_in_entitlement();

ALTER TABLE drop_in_registration
  DROP CONSTRAINT IF EXISTS drop_in_registration_benefit_type_check;
ALTER TABLE drop_in_registration
  ADD CONSTRAINT drop_in_registration_benefit_type_check
  CHECK (benefit_type IN ('paid','free_trial','annual_credit','admin_credit','free_pass','promo_code'));

ALTER TABLE drop_in_registration
  ADD COLUMN IF NOT EXISTS free_pass_template_id BIGINT REFERENCES free_pass_template(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_free_pass_id BIGINT REFERENCES member_free_pass(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_code TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_drop_in_member_benefit_created
  ON drop_in_registration(member_id, benefit_type, created_at)
  WHERE status IN ('account_required','payment_pending','confirmed','attended');

-- Families commonly share one parent email. Lifetime trial uniqueness for an
-- account-less request is therefore athlete identity within that contact email,
-- not email alone.
DROP INDEX IF EXISTS uq_drop_in_lifetime_trial_email;
CREATE UNIQUE INDEX IF NOT EXISTS uq_drop_in_lifetime_trial_contact_athlete
  ON drop_in_registration(lower(email), lower(first_name), lower(last_name))
  WHERE benefit_type = 'free_trial' AND member_id IS NULL AND status <> 'cancelled';

CREATE UNIQUE INDEX IF NOT EXISTS uq_drop_in_pending_contact_occurrence
  ON drop_in_registration(
    lower(email), lower(first_name), lower(last_name), slot_group_id, class_date
  )
  WHERE member_id IS NULL AND status = 'account_required';
