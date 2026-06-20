-- Unified pricing benefit selections (discounts + free passes) at sport/program/class/category scope.

CREATE TABLE IF NOT EXISTS pricing_benefit_selection (
  id              BIGSERIAL PRIMARY KEY,
  scope_level     TEXT NOT NULL CHECK (scope_level IN ('sport','program','class','category')),
  scope_ref_id    BIGINT NOT NULL,
  benefit_type    TEXT NOT NULL CHECK (benefit_type IN ('discount_rule','free_pass')),
  benefit_id      BIGINT NOT NULL,
  auto_apply      BOOLEAN NOT NULL DEFAULT FALSE,
  allow_member_code BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope_level, scope_ref_id, benefit_type, benefit_id)
);
CREATE INDEX IF NOT EXISTS idx_pricing_benefit_selection_scope
  ON pricing_benefit_selection(scope_level, scope_ref_id);

-- Migrate existing free pass attachments.
INSERT INTO pricing_benefit_selection (scope_level, scope_ref_id, benefit_type, benefit_id, auto_apply, allow_member_code, sort_order)
SELECT scope_level, scope_ref_id, 'free_pass', pass_template_id, auto_apply, FALSE, sort_order
FROM pricing_pass_attachment
ON CONFLICT (scope_level, scope_ref_id, benefit_type, benefit_id) DO NOTHING;
