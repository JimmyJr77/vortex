-- Canonical identity/access boundary.
--
-- This migration is intentionally additive. Existing user_role enum values and
-- admin_profile rows remain available during the compatibility window, but
-- neither is used to infer the facility owner or a member-portal login.

ALTER TABLE facility
  ADD COLUMN IF NOT EXISTS owner_user_id BIGINT;

-- Portal suspension is independent. Add the controls as nullable first so a
-- legacy globally-disabled account can be distinguished from a newly created
-- account that should default to both capabilities enabled.
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS staff_access_active BOOLEAN,
  ADD COLUMN IF NOT EXISTS member_portal_access_active BOOLEAN;

-- Empty strings are not identifiers. Normalize them before enforcing the
-- public sign-in namespace: email identifiers contain "@" and usernames do
-- not, so the two columns can never resolve the same input differently.
UPDATE app_user
   SET email = NULLIF(BTRIM(email), ''),
       username = NULLIF(BTRIM(username), ''),
       updated_at = now()
 WHERE email IS DISTINCT FROM NULLIF(BTRIM(email), '')
    OR username IS DISTINCT FROM NULLIF(BTRIM(username), '');

-- Earlier member-login writes sometimes placed an email address in username.
-- That is one identifier in the email namespace, not a second username. Keep
-- the sign-in usable by promoting it when email is blank, then clear the
-- invalid username before the namespace constraints are installed. If this
-- produces a duplicate email, the explicit duplicate preflight below still
-- blocks deployment instead of selecting an identity arbitrarily.
UPDATE app_user
   SET email = CASE
                 WHEN email IS NULL THEN username
                 ELSE email
               END,
       username = NULL,
       updated_at = now()
 WHERE username IS NOT NULL
   AND POSITION('@' IN username) > 0;

-- A duplicated legacy username is not a usable sign-in identifier. When every
-- affected account already has its own valid email login, remove just that
-- ambiguous alias and preserve those email logins. Groups without a safe email
-- login remain blocked by the duplicate preflight below rather than guessing
-- which account should keep the username.
WITH duplicated_usernames AS (
  SELECT LOWER(BTRIM(username)) AS normalized_username
    FROM app_user
   WHERE NULLIF(BTRIM(username), '') IS NOT NULL
   GROUP BY LOWER(BTRIM(username))
  HAVING COUNT(*) > 1
     AND BOOL_AND(POSITION('@' IN COALESCE(email, '')) > 1)
)
UPDATE app_user app_user_row
   SET username = NULL,
       updated_at = now()
  FROM duplicated_usernames duplicate
 WHERE LOWER(BTRIM(app_user_row.username)) = duplicate.normalized_username;

DO $$
DECLARE
  invalid_email TEXT;
  invalid_username TEXT;
BEGIN
  SELECT email INTO invalid_email
    FROM app_user
   WHERE email IS NOT NULL
     AND POSITION('@' IN email) <= 1
   ORDER BY id
   LIMIT 1;
  IF invalid_email IS NOT NULL THEN
    RAISE EXCEPTION
      'Canonical access migration blocked: app_user email "%" is not a valid email login identifier.',
      invalid_email
      USING ERRCODE = '23514';
  END IF;

  SELECT username INTO invalid_username
    FROM app_user
   WHERE username IS NOT NULL
     AND POSITION('@' IN username) > 0
   ORDER BY id
   LIMIT 1;
  IF invalid_username IS NOT NULL THEN
    RAISE EXCEPTION
      'Canonical access migration blocked: app_user username "%" contains @, which is reserved for email login identifiers.',
      invalid_username
      USING ERRCODE = '23514';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'app_user_email_identifier_shape_check'
       AND conrelid = 'app_user'::regclass
  ) THEN
    ALTER TABLE app_user
      ADD CONSTRAINT app_user_email_identifier_shape_check
      CHECK (email IS NULL OR POSITION('@' IN email) > 1);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'app_user_username_identifier_shape_check'
       AND conrelid = 'app_user'::regclass
  ) THEN
    ALTER TABLE app_user
      ADD CONSTRAINT app_user_username_identifier_shape_check
      CHECK (username IS NULL OR POSITION('@' IN username) = 0);
  END IF;
END $$;

-- Preserve legacy disabled state as two independent suspensions, then restore
-- the global credential flag. Explicit values from a partial/retried migration
-- are never overwritten. After this one-time split, app_user.is_active remains
-- available only as the emergency global credential kill switch.
UPDATE app_user
   SET staff_access_active = COALESCE(staff_access_active, COALESCE(is_active, FALSE)),
       member_portal_access_active = COALESCE(member_portal_access_active, COALESCE(is_active, FALSE)),
       is_active = TRUE,
       updated_at = now()
 WHERE staff_access_active IS NULL
    OR member_portal_access_active IS NULL;

ALTER TABLE app_user
  ALTER COLUMN staff_access_active SET DEFAULT TRUE,
  ALTER COLUMN staff_access_active SET NOT NULL,
  ALTER COLUMN member_portal_access_active SET DEFAULT TRUE,
  ALTER COLUMN member_portal_access_active SET NOT NULL;

-- Public sign-in has no facility selector, so a login identifier must resolve
-- to exactly one durable identity across the entire system. Fail closed on
-- pre-existing collisions rather than silently choosing or rewriting an
-- account. Blank identifiers are not credentials and remain outside the
-- indexes.
DO $$
DECLARE
  duplicate_email TEXT;
  duplicate_username TEXT;
BEGIN
  SELECT LOWER(BTRIM(email))
    INTO duplicate_email
    FROM app_user
   WHERE NULLIF(BTRIM(email), '') IS NOT NULL
   GROUP BY LOWER(BTRIM(email))
  HAVING COUNT(*) > 1
   ORDER BY LOWER(BTRIM(email))
   LIMIT 1;

  IF duplicate_email IS NOT NULL THEN
    RAISE EXCEPTION
      'Canonical access migration blocked: duplicate normalized login email "%". Merge or explicitly relink these app_user identities before deployment.',
      duplicate_email
      USING ERRCODE = '23505';
  END IF;

  SELECT LOWER(BTRIM(username))
    INTO duplicate_username
    FROM app_user
   WHERE NULLIF(BTRIM(username), '') IS NOT NULL
   GROUP BY LOWER(BTRIM(username))
  HAVING COUNT(*) > 1
   ORDER BY LOWER(BTRIM(username))
   LIMIT 1;

  IF duplicate_username IS NOT NULL THEN
    RAISE EXCEPTION
      'Canonical access migration blocked: duplicate normalized login username "%". Merge or explicitly relink these app_user identities before deployment.',
      duplicate_username
      USING ERRCODE = '23505';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_login_email_normalized
  ON app_user (LOWER(BTRIM(email)))
  WHERE NULLIF(BTRIM(email), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_login_username_normalized
  ON app_user (LOWER(BTRIM(username)))
  WHERE NULLIF(BTRIM(username), '') IS NOT NULL;

-- A member login is a facility-scoped identity link. Fail closed rather than
-- letting a pre-existing cross-facility link make one tenant's login resolve
-- another tenant's household through the canonical access view.
DO $$
DECLARE
  invalid_member_id BIGINT;
  member_facility_id BIGINT;
  invalid_app_user_id BIGINT;
  app_user_facility_id BIGINT;
BEGIN
  SELECT m.id, m.facility_id, au.id, au.facility_id
    INTO invalid_member_id, member_facility_id, invalid_app_user_id, app_user_facility_id
    FROM member m
    JOIN app_user au ON au.id = m.app_user_id
   WHERE m.app_user_id IS NOT NULL
     AND m.facility_id IS DISTINCT FROM au.facility_id
   ORDER BY m.id
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Canonical access migration blocked: member % in facility % links to app_user % in facility %. Relink both identities within one facility before deployment.',
      invalid_member_id,
      member_facility_id,
      invalid_app_user_id,
      app_user_facility_id
      USING ERRCODE = '23514';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION guard_member_app_user_facility()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.app_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lock the linked identity while this member row is written so a concurrent
  -- app_user facility move cannot pass both sides of the invariant.
  PERFORM 1
    FROM app_user au
   WHERE au.id = NEW.app_user_id
     AND au.facility_id = NEW.facility_id
   FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'member.app_user_id must identify an app_user in the same facility'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_member_app_user_facility_guard ON member;
CREATE TRIGGER trg_member_app_user_facility_guard
BEFORE INSERT OR UPDATE ON member
FOR EACH ROW EXECUTE FUNCTION guard_member_app_user_facility();

CREATE OR REPLACE FUNCTION guard_app_user_member_link_facility()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP <> 'UPDATE'
     OR NEW.facility_id IS NOT DISTINCT FROM OLD.facility_id THEN
    RETURN NEW;
  END IF;

  -- The app_user row is already update-locked. Lock any incompatible linked
  -- member before rejecting the move, closing the race with member-side writes.
  PERFORM 1
    FROM member m
   WHERE m.app_user_id = OLD.id
     AND m.facility_id IS DISTINCT FROM NEW.facility_id
   FOR KEY SHARE;

  IF FOUND THEN
    RAISE EXCEPTION 'linked app_user cannot move to a different facility than its member'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_user_member_link_facility_guard ON app_user;
CREATE TRIGGER trg_app_user_member_link_facility_guard
BEFORE UPDATE ON app_user
FOR EACH ROW EXECUTE FUNCTION guard_app_user_member_link_facility();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'facility_owner_user_id_fkey'
       AND conrelid = 'facility'::regclass
  ) THEN
    ALTER TABLE facility
      ADD CONSTRAINT facility_owner_user_id_fkey
      FOREIGN KEY (owner_user_id)
      REFERENCES app_user(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_facility_owner_user_id
  ON facility(owner_user_id)
  WHERE owner_user_id IS NOT NULL;

-- Backfill only when the role data itself identifies exactly one active owner
-- candidate. Ambiguous facilities remain NULL and require an explicit repair;
-- mutable email and admin_profile flags are deliberately excluded.
WITH owner_candidates AS (
  SELECT DISTINCT au.facility_id, au.id AS user_id
   FROM app_user au
   WHERE au.is_active = TRUE
     AND au.staff_access_active = TRUE
     AND (
       au.role::text = 'MASTER_ADMIN'
       OR EXISTS (
         SELECT 1
           FROM app_user_role aur
          WHERE aur.user_id = au.id
            AND aur.role::text = 'MASTER_ADMIN'
       )
     )
), unambiguous_owner AS (
  SELECT facility_id, MIN(user_id) AS user_id
    FROM owner_candidates
   GROUP BY facility_id
  HAVING COUNT(*) = 1
)
UPDATE facility f
   SET owner_user_id = candidate.user_id,
       updated_at = now()
  FROM unambiguous_owner candidate
 WHERE f.id = candidate.facility_id
   AND f.owner_user_id IS NULL;

-- MASTER_ADMIN is now an owner-only compatibility storage key. Once an owner
-- is known, normalize every other assignment to ADMIN without dropping Coach
-- or linked-member capabilities.
UPDATE app_user au
   SET role = 'ADMIN'::user_role,
       updated_at = now()
  FROM facility f
 WHERE f.id = au.facility_id
   AND f.owner_user_id IS NOT NULL
   AND f.owner_user_id <> au.id
   AND au.role::text = 'MASTER_ADMIN';

DELETE FROM app_user_role master_role
USING app_user au, facility f
WHERE master_role.user_id = au.id
  AND f.id = au.facility_id
  AND f.owner_user_id IS NOT NULL
  AND f.owner_user_id <> au.id
  AND master_role.role::text = 'MASTER_ADMIN'
  AND EXISTS (
    SELECT 1
      FROM app_user_role admin_role
     WHERE admin_role.user_id = master_role.user_id
       AND admin_role.role::text = 'ADMIN'
  );

UPDATE app_user_role master_role
   SET role = 'ADMIN'::user_role
  FROM app_user au, facility f
 WHERE master_role.user_id = au.id
   AND f.id = au.facility_id
   AND f.owner_user_id IS NOT NULL
   AND f.owner_user_id <> au.id
   AND master_role.role::text = 'MASTER_ADMIN';

UPDATE app_user au
   SET role = 'MASTER_ADMIN'::user_role,
       updated_at = now()
  FROM facility f
 WHERE f.owner_user_id = au.id
   AND au.role::text <> 'MASTER_ADMIN';

DELETE FROM app_user_role admin_role
USING facility f
WHERE f.owner_user_id = admin_role.user_id
  AND admin_role.role::text = 'ADMIN';

INSERT INTO app_user_role (user_id, role)
SELECT owner_user_id, 'MASTER_ADMIN'::user_role
  FROM facility
 WHERE owner_user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION guard_facility_owner_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.owner_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM 1
     FROM app_user au
     WHERE au.id = NEW.owner_user_id
       AND au.facility_id = NEW.id
       AND au.is_active = TRUE
       AND au.staff_access_active = TRUE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'facility owner_user_id must identify an active user in the same facility'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.owner_user_id IS NOT NULL
       AND NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'facility owner_user_id is immutable once assigned'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.owner_user_id IS NOT NULL
       AND NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      PERFORM 1
       FROM app_user au
       WHERE au.id = NEW.owner_user_id
         AND au.facility_id = NEW.id
         AND au.is_active = TRUE
         AND au.staff_access_active = TRUE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'facility owner_user_id must identify an active user in the same facility'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_facility_owner_user_id_guard ON facility;
CREATE TRIGGER trg_facility_owner_user_id_guard
BEFORE INSERT OR UPDATE ON facility
FOR EACH ROW EXECUTE FUNCTION guard_facility_owner_user_id();

CREATE OR REPLACE FUNCTION canonicalize_facility_owner_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.owner_user_id IS NULL THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.owner_user_id IS NULL
       OR NEW.owner_user_id IS NOT DISTINCT FROM OLD.owner_user_id THEN
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  UPDATE app_user
     SET role = 'ADMIN'::user_role,
         updated_at = now()
   WHERE facility_id = NEW.id
     AND id <> NEW.owner_user_id
     AND role::text = 'MASTER_ADMIN';

  DELETE FROM app_user_role master_role
   WHERE master_role.role::text = 'MASTER_ADMIN'
     AND master_role.user_id <> NEW.owner_user_id
     AND EXISTS (
       SELECT 1
         FROM app_user au
        WHERE au.id = master_role.user_id
          AND au.facility_id = NEW.id
     )
     AND EXISTS (
       SELECT 1
         FROM app_user_role admin_role
        WHERE admin_role.user_id = master_role.user_id
          AND admin_role.role::text = 'ADMIN'
     );

  UPDATE app_user_role master_role
     SET role = 'ADMIN'::user_role
    FROM app_user au
   WHERE master_role.user_id = au.id
     AND au.facility_id = NEW.id
     AND au.id <> NEW.owner_user_id
     AND master_role.role::text = 'MASTER_ADMIN';

  UPDATE app_user
     SET role = 'MASTER_ADMIN'::user_role,
         updated_at = now()
   WHERE id = NEW.owner_user_id;

  DELETE FROM app_user_role
   WHERE user_id = NEW.owner_user_id
     AND role::text = 'ADMIN';

  INSERT INTO app_user_role (user_id, role)
  VALUES (NEW.owner_user_id, 'MASTER_ADMIN'::user_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_facility_owner_role_canonicalization ON facility;
CREATE TRIGGER trg_facility_owner_role_canonicalization
AFTER INSERT OR UPDATE ON facility
FOR EACH ROW EXECUTE FUNCTION canonicalize_facility_owner_roles();

-- Before a facility has an owner, MASTER_ADMIN remains available solely as a
-- bootstrap marker so the owner backfill/repair flow can identify a candidate.
-- Once owner_user_id is assigned, both role storage locations reject any new
-- MASTER_ADMIN assignment for a different user.
CREATE OR REPLACE FUNCTION guard_app_user_master_admin_owner()
RETURNS TRIGGER AS $$
DECLARE
  facility_owner_user_id BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP NOT IN ('INSERT', 'UPDATE') THEN
    RETURN NEW;
  END IF;

  IF NEW.role::text <> 'MASTER_ADMIN' THEN
    RETURN NEW;
  END IF;

  SELECT f.owner_user_id
    INTO facility_owner_user_id
    FROM facility f
   WHERE f.id = NEW.facility_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MASTER_ADMIN app_user must belong to an existing facility'
      USING ERRCODE = '23503';
  END IF;

  IF facility_owner_user_id IS NOT NULL
     AND facility_owner_user_id <> NEW.id THEN
    RAISE EXCEPTION 'MASTER_ADMIN is reserved for facility.owner_user_id'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_user_master_admin_owner_guard ON app_user;
CREATE TRIGGER trg_app_user_master_admin_owner_guard
BEFORE INSERT OR UPDATE ON app_user
FOR EACH ROW EXECUTE FUNCTION guard_app_user_master_admin_owner();

CREATE OR REPLACE FUNCTION guard_app_user_role_master_admin_owner()
RETURNS TRIGGER AS $$
DECLARE
  assigned_user_id BIGINT;
  facility_owner_user_id BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.role::text <> 'MASTER_ADMIN' THEN
    RETURN NEW;
  END IF;

  SELECT au.id, f.owner_user_id
    INTO assigned_user_id, facility_owner_user_id
    FROM app_user au
    JOIN facility f ON f.id = au.facility_id
   WHERE au.id = NEW.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MASTER_ADMIN app_user_role must reference an existing user and facility'
      USING ERRCODE = '23503';
  END IF;

  IF facility_owner_user_id IS NOT NULL
     AND facility_owner_user_id <> assigned_user_id THEN
    RAISE EXCEPTION 'MASTER_ADMIN is reserved for facility.owner_user_id'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_user_role_master_admin_owner_guard ON app_user_role;
CREATE TRIGGER trg_app_user_role_master_admin_owner_guard
BEFORE INSERT OR UPDATE OR DELETE ON app_user_role
FOR EACH ROW EXECUTE FUNCTION guard_app_user_role_master_admin_owner();

CREATE OR REPLACE FUNCTION guard_facility_owner_app_user()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM facility f WHERE f.owner_user_id = OLD.id) THEN
      RAISE EXCEPTION 'facility owner app_user cannot be deleted'
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF EXISTS (
      SELECT 1
        FROM facility f
       WHERE f.owner_user_id = OLD.id
         AND (
           NEW.facility_id IS DISTINCT FROM OLD.facility_id
           OR NEW.is_active IS NOT TRUE
           OR NEW.staff_access_active IS NOT TRUE
         )
    ) THEN
      RAISE EXCEPTION 'facility owner app_user cannot be deactivated, staff-suspended, or moved to another facility'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_facility_owner_app_user_guard ON app_user;
CREATE TRIGGER trg_facility_owner_app_user_guard
BEFORE DELETE OR UPDATE ON app_user
FOR EACH ROW EXECUTE FUNCTION guard_facility_owner_app_user();

-- Product terminology is Owner/Administrator/Coach. MASTER_ADMIN remains the storage
-- key during rollout so old tokens and enum-backed rows remain readable.
UPDATE role
   SET name = CASE key
       WHEN 'MASTER_ADMIN' THEN 'Owner'
       WHEN 'ADMIN' THEN 'Administrator'
       WHEN 'COACH' THEN 'Coach'
       ELSE name
     END,
       description = CASE key
       WHEN 'MASTER_ADMIN' THEN 'Immutable facility owner with complete administrative authority.'
       WHEN 'ADMIN' THEN 'Administrative staff access governed by assigned permissions.'
       WHEN 'COACH' THEN 'Coaching portal access governed by assigned permissions.'
       ELSE description
     END,
       updated_at = now()
 WHERE key IN ('MASTER_ADMIN', 'ADMIN', 'COACH');

CREATE OR REPLACE VIEW v_app_user_access_context AS
WITH role_state AS (
  SELECT
    au.id AS user_id,
    ARRAY(
      SELECT DISTINCT role_key
        FROM (
          SELECT au.role::text AS role_key
          UNION ALL
          SELECT aur.role::text
            FROM app_user_role aur
           WHERE aur.user_id = au.id
        ) assigned_roles
       WHERE role_key IS NOT NULL
       ORDER BY role_key
    ) AS storage_roles
  FROM app_user au
), linked_member AS (
  SELECT DISTINCT ON (m.app_user_id)
    m.app_user_id AS user_id,
    m.facility_id,
    m.id AS member_id,
    active_family.family_id,
    m.is_active AS member_is_active
  FROM member m
  LEFT JOIN family_member active_family
    ON active_family.member_id = m.id
   AND active_family.is_active = TRUE
  WHERE m.app_user_id IS NOT NULL
  ORDER BY m.app_user_id, m.id, active_family.family_id
), access_state AS (
  SELECT
    au.id AS user_id,
    au.facility_id,
    f.owner_user_id,
    au.email,
    au.full_name,
    au.phone,
    au.username,
    au.role::text AS primary_storage_role,
    roles.storage_roles,
    au.is_active,
    au.staff_access_active,
    au.member_portal_access_active,
    linked.member_id,
    linked.family_id,
    linked.member_is_active,
    COALESCE(f.owner_user_id = au.id, FALSE) AS is_owner,
    CASE
      WHEN linked.member_id IS NULL THEN 'no_login'
      WHEN au.is_active IS NOT TRUE
        OR au.member_portal_access_active IS NOT TRUE
        OR linked.member_is_active IS NOT TRUE THEN 'suspended'
      WHEN au.password_hash IS NULL
        OR (NULLIF(BTRIM(au.email), '') IS NULL AND NULLIF(BTRIM(au.username), '') IS NULL)
        THEN 'setup_required'
      ELSE 'active'
    END AS member_portal_status
  FROM app_user au
  JOIN facility f ON f.id = au.facility_id
  JOIN role_state roles ON roles.user_id = au.id
  LEFT JOIN linked_member linked
    ON linked.user_id = au.id
   AND linked.facility_id = au.facility_id
)
SELECT
  state.*,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN state.is_owner THEN 'OWNER' END,
    CASE WHEN NOT state.is_owner AND (
      'ADMIN' = ANY(state.storage_roles)
      OR 'MASTER_ADMIN' = ANY(state.storage_roles)
    ) THEN 'ADMINISTRATOR' END,
    CASE WHEN 'COACH' = ANY(state.storage_roles) THEN 'COACH' END
  ], NULL)::text[] AS staff_roles,
  (
    state.is_active = TRUE
    AND state.staff_access_active = TRUE
    AND (
      state.is_owner
      OR 'ADMIN' = ANY(state.storage_roles)
      OR 'MASTER_ADMIN' = ANY(state.storage_roles)
    )
  ) AS can_access_admin_portal,
  (
    state.is_active = TRUE
    AND state.staff_access_active = TRUE
    AND 'COACH' = ANY(state.storage_roles)
  ) AS can_access_coach_portal,
  (state.member_portal_status = 'active') AS can_access_member_portal
FROM access_state state;

COMMENT ON COLUMN facility.owner_user_id IS
  'Immutable app_user identity for the facility owner. NULL means ownership requires explicit resolution.';

COMMENT ON VIEW v_app_user_access_context IS
  'Canonical portal capability context. Member access requires an explicit active member.app_user_id link and usable app_user credentials.';

COMMENT ON COLUMN app_user.staff_access_active IS
  'Independent suspension control for Administrator and Coach portals.';

COMMENT ON COLUMN app_user.member_portal_access_active IS
  'Independent suspension control for Member Portal access.';
