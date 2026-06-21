-- ============================================================
-- 032: Role model consolidation
-- ------------------------------------------------------------
-- Collapse the user_role enum + RBAC role catalog down to the
-- four roles the product actually uses:
--   MASTER_ADMIN, ADMIN, COACH, MEMBER_ATHLETE
--
-- Legacy roles are migrated, not preserved:
--   OWNER_ADMIN                          -> MASTER_ADMIN
--   MEMBER / PARENT_GUARDIAN /
--   ATHLETE / ATHLETE_VIEWER             -> MEMBER_ATHLETE
--
-- Youth Athlete (<18), Athlete (18+) and Family Rep are NOT roles.
-- They are derived member attributes:
--   - youth vs adult  -> member.date_of_birth
--   - family rep      -> family_billing_account.payer_member_id
--
-- NOTE: this file is executed inside the migration runner's own
-- transaction, so it must not contain BEGIN/COMMIT. The enum is
-- rebuilt via DROP/CREATE TYPE (transaction-safe) rather than
-- ALTER TYPE ... DROP VALUE (which Postgres does not support).
-- ============================================================

-- 1) Detach the columns from the enum so values can be remapped.
ALTER TABLE app_user ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE app_user_role ALTER COLUMN role TYPE text USING role::text;

-- 1b) Drop the (user_id, role) uniqueness while remapping. Collapsing several
--     legacy roles into MEMBER_ATHLETE would otherwise violate it mid-UPDATE
--     (the constraint is enforced even with the column typed as text).
ALTER TABLE app_user_role DROP CONSTRAINT IF EXISTS app_user_role_user_id_role_key;

-- 2) Remap legacy role values onto the consolidated set.
UPDATE app_user SET role = CASE
  WHEN role IN ('OWNER_ADMIN', 'MASTER_ADMIN') THEN 'MASTER_ADMIN'
  WHEN role = 'ADMIN' THEN 'ADMIN'
  WHEN role = 'COACH' THEN 'COACH'
  ELSE 'MEMBER_ATHLETE'
END;

UPDATE app_user_role SET role = CASE
  WHEN role IN ('OWNER_ADMIN', 'MASTER_ADMIN') THEN 'MASTER_ADMIN'
  WHEN role = 'ADMIN' THEN 'ADMIN'
  WHEN role = 'COACH' THEN 'COACH'
  ELSE 'MEMBER_ATHLETE'
END;

-- 3) Remove the duplicate (user_id, role) rows created by the collapse,
--    keeping the lowest id per pair.
DELETE FROM app_user_role a
USING app_user_role b
WHERE a.user_id = b.user_id
  AND a.role = b.role
  AND a.id > b.id;

-- 4) Replace the enum type with the consolidated value set.
DROP TYPE user_role;
CREATE TYPE user_role AS ENUM ('MASTER_ADMIN', 'ADMIN', 'COACH', 'MEMBER_ATHLETE');

-- 5) Re-attach the columns to the rebuilt enum and restore uniqueness.
ALTER TABLE app_user ALTER COLUMN role TYPE user_role USING role::user_role;
ALTER TABLE app_user_role ALTER COLUMN role TYPE user_role USING role::user_role;
ALTER TABLE app_user_role ADD CONSTRAINT app_user_role_user_id_role_key UNIQUE (user_id, role);

-- 6) RBAC role catalog: retire legacy rows (role_permission cascades),
--    then ensure the consolidated member role exists with member perms.
DELETE FROM role WHERE key IN ('OWNER_ADMIN', 'MEMBER', 'PARENT_GUARDIAN', 'ATHLETE', 'ATHLETE_VIEWER');

INSERT INTO role (key, name, description, is_system) VALUES
  ('MEMBER_ATHLETE', 'Member / Athlete', 'Logged-in account that registers themselves or their family members for classes and events.', TRUE)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.key IN ('members.view', 'billing.view', 'waivers.view')
WHERE r.key = 'MEMBER_ATHLETE'
ON CONFLICT DO NOTHING;
