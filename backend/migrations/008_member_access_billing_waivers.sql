-- Member, access, billing, and waiver platform foundation.
-- Compatibility-first: adds canonical tables without dropping legacy columns/tables.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'ADMIN'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'ADMIN';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'MASTER_ADMIN'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'MASTER_ADMIN';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'MEMBER'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'MEMBER';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_user_role (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role                user_role NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_app_user_role_user_id ON app_user_role(user_id);
CREATE INDEX IF NOT EXISTS idx_app_user_role_role ON app_user_role(role);

INSERT INTO app_user_role (user_id, role, created_at)
SELECT au.id, au.role, au.created_at
FROM app_user au
WHERE NOT EXISTS (
  SELECT 1 FROM app_user_role ur
  WHERE ur.user_id = au.id AND ur.role = au.role
);

CREATE TABLE IF NOT EXISTS role (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permission (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permission (
  role_id BIGINT NOT NULL REFERENCES role(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permission(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS app_user_permission_override (
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permission(id) ON DELETE CASCADE,
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id)
);

ALTER TABLE member
  ADD COLUMN IF NOT EXISTS app_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS member_app_user_unique
  ON member(app_user_id)
  WHERE app_user_id IS NOT NULL;

UPDATE member m
SET app_user_id = au.id
FROM app_user au
WHERE m.app_user_id IS NULL
  AND m.email IS NOT NULL
  AND au.email = m.email
  AND au.facility_id = m.facility_id
  AND NOT EXISTS (
    SELECT 1 FROM member existing
    WHERE existing.app_user_id = au.id
  );

CREATE TABLE IF NOT EXISTS family_member (
  family_id BIGINT NOT NULL REFERENCES family(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  relationship_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, member_id)
);

INSERT INTO family_member (family_id, member_id)
SELECT family_id, id
FROM member
WHERE family_id IS NOT NULL
ON CONFLICT (family_id, member_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_profile (
  user_id BIGINT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  is_master_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coach_profile (
  user_id BIGINT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_billing_account (
  id BIGSERIAL PRIMARY KEY,
  family_id BIGINT NOT NULL UNIQUE REFERENCES family(id) ON DELETE CASCADE,
  payer_member_id BIGINT REFERENCES member(id) ON DELETE SET NULL,
  billing_email TEXT,
  billing_phone TEXT,
  billing_street TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_zip TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_billing_account_payer
  ON family_billing_account(payer_member_id);

INSERT INTO family_billing_account (
  family_id,
  payer_member_id,
  billing_email,
  billing_phone,
  billing_street,
  billing_city,
  billing_state,
  billing_zip
)
SELECT DISTINCT ON (f.id)
  f.id,
  m.id,
  m.email,
  m.phone,
  m.billing_street,
  m.billing_city,
  m.billing_state,
  m.billing_zip
FROM family f
LEFT JOIN member m ON m.family_id = f.id AND m.is_active = TRUE
ORDER BY f.id, (m.email IS NULL), m.id
ON CONFLICT (family_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS billing_charge (
  id BIGSERIAL PRIMARY KEY,
  family_billing_account_id BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE CASCADE,
  member_id BIGINT REFERENCES member(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  service_period_start DATE,
  service_period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_charge_account
  ON billing_charge(family_billing_account_id);
CREATE INDEX IF NOT EXISTS idx_billing_charge_member
  ON billing_charge(member_id);

CREATE TABLE IF NOT EXISTS billing_payment (
  id BIGSERIAL PRIMARY KEY,
  family_billing_account_id BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_statement (
  id BIGSERIAL PRIMARY KEY,
  family_billing_account_id BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE CASCADE,
  statement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  total_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_statement_account
  ON billing_statement(family_billing_account_id);

CREATE TABLE IF NOT EXISTS billing_statement_line (
  id BIGSERIAL PRIMARY KEY,
  statement_id BIGINT NOT NULL REFERENCES billing_statement(id) ON DELETE CASCADE,
  charge_id BIGINT REFERENCES billing_charge(id) ON DELETE SET NULL,
  member_id BIGINT REFERENCES member(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_statement_line_statement
  ON billing_statement_line(statement_id);
CREATE INDEX IF NOT EXISTS idx_billing_statement_line_member
  ON billing_statement_line(member_id);

CREATE TABLE IF NOT EXISTS waiver_template (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  body TEXT NOT NULL,
  active_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_to TIMESTAMPTZ,
  requires_resign BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, name, version)
);

CREATE TABLE IF NOT EXISTS member_waiver_acceptance (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  waiver_template_id BIGINT NOT NULL REFERENCES waiver_template(id) ON DELETE CASCADE,
  accepted_by_member_id BIGINT REFERENCES member(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, waiver_template_id)
);

CREATE INDEX IF NOT EXISTS idx_member_waiver_acceptance_member
  ON member_waiver_acceptance(member_id);

CREATE TABLE IF NOT EXISTS coach_class_assignment (
  id BIGSERIAL PRIMARY KEY,
  coach_user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  program_id BIGINT REFERENCES program(id) ON DELETE CASCADE,
  class_iteration_id BIGINT REFERENCES class_iteration(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (program_id IS NOT NULL OR class_iteration_id IS NOT NULL),
  UNIQUE (coach_user_id, program_id, class_iteration_id)
);

INSERT INTO role (key, name, description, is_system) VALUES
  ('MASTER_ADMIN', 'Master Admin', 'Full platform access with no admin limits.', TRUE),
  ('ADMIN', 'Admin', 'Administrative user with assigned permissions.', TRUE),
  ('COACH', 'Coach', 'Coach portal and class/roster access.', TRUE),
  ('MEMBER', 'Member', 'Athlete or family member portal access.', TRUE),
  ('PARENT_GUARDIAN', 'Parent/Guardian', 'Family management access.', TRUE),
  ('ATHLETE', 'Athlete', 'Athlete account access.', TRUE),
  ('ATHLETE_VIEWER', 'Athlete Viewer', 'Read-only athlete account access.', TRUE),
  ('OWNER_ADMIN', 'Owner Admin', 'Legacy owner admin compatibility role.', TRUE)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO permission (key, description) VALUES
  ('admins.manage', 'Create and manage admin accounts.'),
  ('admin_access.manage', 'Manage roles and permission assignments.'),
  ('members.view', 'View members and families.'),
  ('members.edit', 'Edit member records.'),
  ('members.archive', 'Archive member records.'),
  ('families.view', 'View family records.'),
  ('families.edit', 'Edit family records.'),
  ('family_billing.manage', 'Manage family billing owners.'),
  ('billing.view', 'View billing accounts and statements.'),
  ('billing.manage', 'Create and manage charges and payments.'),
  ('billing.statements.manage', 'Generate and manage statements.'),
  ('waivers.view', 'View waiver templates and acceptances.'),
  ('waivers.manage', 'Manage waiver templates and acceptances.'),
  ('classes.view', 'View classes and rosters.'),
  ('classes.manage', 'Manage class records.'),
  ('classes.build', 'Build class schedules and offerings.'),
  ('scheduling.view', 'View scheduling.'),
  ('scheduling.manage', 'Manage scheduling.'),
  ('pricing.view', 'View pricing.'),
  ('pricing.manage', 'Manage pricing.'),
  ('schools.view', 'View schools.'),
  ('schools.manage', 'Manage schools.'),
  ('analytics.view', 'View analytics.'),
  ('coach_portal.access', 'Access coach portal.')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
CROSS JOIN permission p
WHERE r.key IN ('MASTER_ADMIN', 'OWNER_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key IN (
  'members.view', 'members.edit', 'families.view', 'families.edit',
  'family_billing.manage', 'billing.view', 'billing.manage',
  'billing.statements.manage', 'waivers.view', 'waivers.manage',
  'classes.view', 'classes.manage', 'classes.build',
  'scheduling.view', 'scheduling.manage', 'pricing.view', 'pricing.manage',
  'schools.view', 'schools.manage', 'analytics.view'
)
WHERE r.key = 'ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key IN ('coach_portal.access', 'classes.view', 'classes.build', 'waivers.view')
WHERE r.key = 'COACH'
ON CONFLICT DO NOTHING;

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key IN ('members.view', 'billing.view', 'waivers.view')
WHERE r.key IN ('MEMBER', 'PARENT_GUARDIAN', 'ATHLETE', 'ATHLETE_VIEWER')
ON CONFLICT DO NOTHING;

INSERT INTO admin_profile (user_id, is_master_admin)
SELECT au.id, TRUE
FROM app_user au
WHERE au.role::text IN ('OWNER_ADMIN', 'MASTER_ADMIN')
   OR EXISTS (
    SELECT 1 FROM app_user_role aur
    WHERE aur.user_id = au.id AND aur.role::text IN ('OWNER_ADMIN', 'MASTER_ADMIN')
   )
ON CONFLICT (user_id) DO UPDATE SET
  is_master_admin = admin_profile.is_master_admin OR EXCLUDED.is_master_admin,
  updated_at = now();

INSERT INTO coach_profile (user_id)
SELECT au.id
FROM app_user au
WHERE au.role = 'COACH'
   OR EXISTS (
    SELECT 1 FROM app_user_role aur
    WHERE aur.user_id = au.id AND aur.role::text = 'COACH'
   )
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO waiver_template (facility_id, name, version, body)
SELECT f.id, 'Athlete Waiver', '1.0', 'Default athlete waiver. Replace this text in Admin Waivers.'
FROM facility f
WHERE NOT EXISTS (
  SELECT 1 FROM waiver_template wt
  WHERE wt.facility_id = f.id
    AND wt.active_to IS NULL
);
