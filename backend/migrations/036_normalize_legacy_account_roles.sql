-- ============================================================
-- 036: Normalize legacy account role assignments (idempotent)
-- ------------------------------------------------------------
-- Migration 032 consolidated the role model to:
--   MASTER_ADMIN, ADMIN, COACH, MEMBER_ATHLETE
-- with this mapping:
--   OWNER_ADMIN                                  -> MASTER_ADMIN
--   MEMBER / PARENT_GUARDIAN / ATHLETE /
--   ATHLETE_VIEWER                               -> MEMBER_ATHLETE
--
-- However, on databases where 032 was backfilled into schema_migrations
-- without actually executing (ledger drift, see DATABASE_ARCHITECTURE §10.5),
-- existing `app_user` / `app_user_role` rows still carry the legacy role
-- labels and the `user_role` enum still lists them. The Access Control and
-- Members views then show stale roles like "PARENT GUARDIAN", "ATHLETE",
-- "ATHLETE VIEWER", "OWNER ADMIN", "MEMBER".
--
-- This migration RE-APPLIES the consolidation and is safe to run repeatedly:
--   - On an already-clean DB the UPDATEs match nothing and the enum is
--     rebuilt to the identical canonical set.
--   - It also drops any stray legacy values (e.g. 'MEMBER') from the enum.
--
-- Only app_user.role and app_user_role.role use the user_role type (verified),
-- and no views/rules depend on it, so the DROP/CREATE TYPE rebuild is safe.
--
-- NOTE: runs inside the migration runner's transaction; no BEGIN/COMMIT.
-- The enum is rebuilt via DROP/CREATE TYPE (transaction-safe) rather than
-- ALTER TYPE ... DROP VALUE (unsupported by Postgres).
-- ============================================================

-- 1) Detach the columns from the enum so values can be remapped freely.
ALTER TABLE app_user ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE app_user_role ALTER COLUMN role TYPE text USING role::text;

-- 1b) Drop (user_id, role) uniqueness while collapsing several legacy roles
--     into MEMBER_ATHLETE (would otherwise trip mid-UPDATE).
ALTER TABLE app_user_role DROP CONSTRAINT IF EXISTS app_user_role_user_id_role_key;

-- 2) Remap any non-canonical role value onto the consolidated set.
UPDATE app_user SET role = CASE
  WHEN role IN ('OWNER_ADMIN', 'MASTER_ADMIN') THEN 'MASTER_ADMIN'
  WHEN role = 'ADMIN' THEN 'ADMIN'
  WHEN role = 'COACH' THEN 'COACH'
  ELSE 'MEMBER_ATHLETE'
END
WHERE role NOT IN ('MASTER_ADMIN', 'ADMIN', 'COACH', 'MEMBER_ATHLETE');

UPDATE app_user_role SET role = CASE
  WHEN role IN ('OWNER_ADMIN', 'MASTER_ADMIN') THEN 'MASTER_ADMIN'
  WHEN role = 'ADMIN' THEN 'ADMIN'
  WHEN role = 'COACH' THEN 'COACH'
  ELSE 'MEMBER_ATHLETE'
END
WHERE role NOT IN ('MASTER_ADMIN', 'ADMIN', 'COACH', 'MEMBER_ATHLETE');

-- 3) Remove duplicate (user_id, role) rows produced by the collapse,
--    keeping the lowest id per pair.
DELETE FROM app_user_role a
USING app_user_role b
WHERE a.user_id = b.user_id
  AND a.role = b.role
  AND a.id > b.id;

-- 4) Rebuild the enum to exactly the canonical set (drops any stray legacy
--    labels still present, e.g. 'MEMBER').
DROP TYPE IF EXISTS user_role;
CREATE TYPE user_role AS ENUM ('MASTER_ADMIN', 'ADMIN', 'COACH', 'MEMBER_ATHLETE');

-- 5) Re-attach the columns to the rebuilt enum and restore uniqueness.
ALTER TABLE app_user ALTER COLUMN role TYPE user_role USING role::user_role;
ALTER TABLE app_user_role ALTER COLUMN role TYPE user_role USING role::user_role;
ALTER TABLE app_user_role
  ADD CONSTRAINT app_user_role_user_id_role_key UNIQUE (user_id, role);
