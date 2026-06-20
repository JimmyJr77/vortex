-- Free pass templates, pricing attachments, member grants, and redemption ledger.

CREATE TABLE IF NOT EXISTS free_pass_template (
  id                            BIGSERIAL PRIMARY KEY,
  facility_id                   BIGINT REFERENCES facility(id) ON DELETE CASCADE,
  name                          TEXT NOT NULL,
  description                   TEXT,
  active                        BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at                     TIMESTAMPTZ,
  ends_at                       TIMESTAMPTZ,
  benefit_unit                  TEXT NOT NULL DEFAULT 'slot'
                                CHECK (benefit_unit IN ('slot','offering','day','week','month','hour')),
  benefit_quantity              INTEGER NOT NULL DEFAULT 1,
  application_method            TEXT NOT NULL DEFAULT 'waive_enrollment'
                                CHECK (application_method IN ('waive_enrollment','monthly_prorate')),
  scope_level                   TEXT NOT NULL DEFAULT 'global'
                                CHECK (scope_level IN ('global','sport','program','class','offering')),
  scope_ref_id                  BIGINT,
  day_of_week                   INTEGER CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  offering_ids                  BIGINT[] NOT NULL DEFAULT '{}',
  eligibility                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  issuance                      JSONB NOT NULL DEFAULT '{}'::jsonb,
  debits_free_class_allowance   BOOLEAN NOT NULL DEFAULT FALSE,
  stackable                     BOOLEAN NOT NULL DEFAULT TRUE,
  exclusivity_group             TEXT,
  max_redemptions               INTEGER,
  redeemed_count                INTEGER NOT NULL DEFAULT 0,
  config                        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_free_pass_template_facility_active
  ON free_pass_template(facility_id, active);

CREATE TABLE IF NOT EXISTS pricing_pass_attachment (
  id                BIGSERIAL PRIMARY KEY,
  scope_level       TEXT NOT NULL CHECK (scope_level IN ('program','class')),
  scope_ref_id      BIGINT NOT NULL,
  pass_template_id  BIGINT NOT NULL REFERENCES free_pass_template(id) ON DELETE CASCADE,
  auto_apply        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope_level, scope_ref_id, pass_template_id)
);
CREATE INDEX IF NOT EXISTS idx_pricing_pass_attachment_scope
  ON pricing_pass_attachment(scope_level, scope_ref_id);

CREATE TABLE IF NOT EXISTS member_free_pass (
  id                  BIGSERIAL PRIMARY KEY,
  member_id           BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  pass_template_id    BIGINT NOT NULL REFERENCES free_pass_template(id) ON DELETE CASCADE,
  quantity_granted    INTEGER NOT NULL DEFAULT 1,
  quantity_remaining  INTEGER NOT NULL DEFAULT 1,
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ,
  issued_by           TEXT NOT NULL DEFAULT 'admin'
                      CHECK (issued_by IN ('promo','admin','auto')),
  source_ref          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_member_free_pass_member
  ON member_free_pass(member_id);
CREATE INDEX IF NOT EXISTS idx_member_free_pass_template
  ON member_free_pass(pass_template_id);

CREATE TABLE IF NOT EXISTS free_pass_redemption (
  id                    BIGSERIAL PRIMARY KEY,
  member_pass_id        BIGINT REFERENCES member_free_pass(id) ON DELETE SET NULL,
  pass_template_id      BIGINT REFERENCES free_pass_template(id) ON DELETE SET NULL,
  member_id             BIGINT REFERENCES member(id) ON DELETE SET NULL,
  signup_id             BIGINT REFERENCES scheduling_signup(id) ON DELETE CASCADE,
  units                 INTEGER NOT NULL DEFAULT 1,
  amount_cents_credited INTEGER NOT NULL DEFAULT 0,
  context               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_free_pass_redemption_member ON free_pass_redemption(member_id);
CREATE INDEX IF NOT EXISTS idx_free_pass_redemption_signup ON free_pass_redemption(signup_id);
CREATE INDEX IF NOT EXISTS idx_free_pass_redemption_template ON free_pass_redemption(pass_template_id);
