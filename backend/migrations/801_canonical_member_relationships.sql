-- Canonical household and guardian relationships.
--
-- family_member and parent_guardian_authority are the authoritative
-- relationship stores. The member.family_id and member.parent_guardian_ids
-- columns remain in place during the compatibility window; this migration
-- deterministically imports their valid relationships without deleting any
-- member, family, enrollment, billing, or historical relationship row.

-- A valid member.family_id is the strongest deterministic family signal.
-- Materialize it first so it wins when duplicate active links are reduced.
INSERT INTO family_member (
  family_id,
  member_id,
  is_active,
  joined_at,
  created_at,
  updated_at
)
SELECT
  member_row.family_id,
  member_row.id,
  TRUE,
  COALESCE(member_row.created_at, now()),
  COALESCE(member_row.created_at, now()),
  now()
FROM member member_row
JOIN family family_row
  ON family_row.id = member_row.family_id
 AND family_row.facility_id = member_row.facility_id
WHERE member_row.family_id IS NOT NULL
ON CONFLICT (family_id, member_id) DO UPDATE
SET is_active = TRUE,
    updated_at = now();

-- A cross-facility family link cannot be an active household relationship.
-- Keep the row as history, but retire it from the canonical active set.
UPDATE family_member family_link
   SET is_active = FALSE,
       updated_at = now()
  FROM member member_row,
       family family_row
 WHERE member_row.id = family_link.member_id
   AND family_row.id = family_link.family_id
   AND member_row.facility_id IS DISTINCT FROM family_row.facility_id
   AND family_link.is_active = TRUE;

-- Preserve exactly one active link whenever a member has a deterministic
-- family assignment. Prefer the valid compatibility pointer, then the oldest
-- active link, then the lowest family id as a stable final tiebreaker.
WITH ranked_active_links AS (
  SELECT
    family_link.family_id,
    family_link.member_id,
    ROW_NUMBER() OVER (
      PARTITION BY family_link.member_id
      ORDER BY
        (member_row.family_id = family_link.family_id) DESC NULLS LAST,
        family_link.joined_at ASC,
        family_link.created_at ASC,
        family_link.family_id ASC
    ) AS canonical_rank
  FROM family_member family_link
  JOIN member member_row
    ON member_row.id = family_link.member_id
  JOIN family family_row
    ON family_row.id = family_link.family_id
   AND family_row.facility_id = member_row.facility_id
  WHERE family_link.is_active = TRUE
)
UPDATE family_member family_link
   SET is_active = FALSE,
       updated_at = now()
  FROM ranked_active_links ranked
 WHERE ranked.family_id = family_link.family_id
   AND ranked.member_id = family_link.member_id
   AND ranked.canonical_rank > 1;

-- Keep the compatibility pointer aligned with the canonical active link.
-- Invalid or cross-facility pointers become NULL; the referenced family and
-- every historical family_member row remain untouched.
WITH canonical_links AS (
  SELECT family_link.member_id, family_link.family_id
    FROM family_member family_link
   WHERE family_link.is_active = TRUE
)
UPDATE member member_row
   SET family_id = canonical.family_id,
       updated_at = now()
  FROM canonical_links canonical
 WHERE canonical.member_id = member_row.id
   AND member_row.family_id IS DISTINCT FROM canonical.family_id;

UPDATE member member_row
   SET family_id = NULL,
       updated_at = now()
 WHERE member_row.family_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM family_member family_link
      WHERE family_link.member_id = member_row.id
        AND family_link.family_id = member_row.family_id
        AND family_link.is_active = TRUE
   );

CREATE UNIQUE INDEX IF NOT EXISTS uq_family_member_one_active_per_member
  ON family_member(member_id)
  WHERE is_active = TRUE;

CREATE OR REPLACE FUNCTION guard_canonical_family_member()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM 1
    FROM member member_row
    JOIN family family_row
      ON family_row.id = NEW.family_id
     AND family_row.facility_id = member_row.facility_id
   WHERE member_row.id = NEW.member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'family_member must link a member and family in the same facility'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_canonical_family_member_guard ON family_member;
CREATE TRIGGER trg_canonical_family_member_guard
BEFORE INSERT OR UPDATE OF family_id, member_id, is_active ON family_member
FOR EACH ROW EXECUTE FUNCTION guard_canonical_family_member();

-- Canonical writes also keep member.family_id accurate for compatibility
-- readers. This is one-way synchronization: family_member stays authoritative.
CREATE OR REPLACE FUNCTION sync_member_family_pointer_from_family_member()
RETURNS TRIGGER AS $$
DECLARE
  affected_member_id BIGINT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    affected_member_id := OLD.member_id;
    UPDATE member member_row
       SET family_id = (
             SELECT family_link.family_id
               FROM family_member family_link
              WHERE family_link.member_id = affected_member_id
                AND family_link.is_active = TRUE
              ORDER BY family_link.family_id
              LIMIT 1
           ),
           updated_at = now()
     WHERE member_row.id = affected_member_id
       AND member_row.family_id IS DISTINCT FROM (
             SELECT family_link.family_id
               FROM family_member family_link
              WHERE family_link.member_id = affected_member_id
                AND family_link.is_active = TRUE
              ORDER BY family_link.family_id
              LIMIT 1
           );
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE')
     AND (TG_OP = 'INSERT' OR NEW.member_id IS DISTINCT FROM OLD.member_id) THEN
    affected_member_id := NEW.member_id;
    UPDATE member member_row
       SET family_id = (
             SELECT family_link.family_id
               FROM family_member family_link
              WHERE family_link.member_id = affected_member_id
                AND family_link.is_active = TRUE
              ORDER BY family_link.family_id
              LIMIT 1
           ),
           updated_at = now()
     WHERE member_row.id = affected_member_id
       AND member_row.family_id IS DISTINCT FROM (
             SELECT family_link.family_id
               FROM family_member family_link
              WHERE family_link.member_id = affected_member_id
                AND family_link.is_active = TRUE
              ORDER BY family_link.family_id
              LIMIT 1
           );
  ELSIF TG_OP = 'UPDATE' THEN
    affected_member_id := NEW.member_id;
    UPDATE member member_row
       SET family_id = (
             SELECT family_link.family_id
               FROM family_member family_link
              WHERE family_link.member_id = affected_member_id
                AND family_link.is_active = TRUE
              ORDER BY family_link.family_id
              LIMIT 1
           ),
           updated_at = now()
     WHERE member_row.id = affected_member_id
       AND member_row.family_id IS DISTINCT FROM (
             SELECT family_link.family_id
               FROM family_member family_link
              WHERE family_link.member_id = affected_member_id
                AND family_link.is_active = TRUE
              ORDER BY family_link.family_id
              LIMIT 1
           );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_member_family_pointer ON family_member;
CREATE TRIGGER trg_sync_member_family_pointer
AFTER INSERT OR UPDATE OR DELETE ON family_member
FOR EACH ROW EXECUTE FUNCTION sync_member_family_pointer_from_family_member();

-- Import only guardian ids that resolve to a different member in the same
-- facility. Existing relationship metadata is preserved on conflict.
INSERT INTO parent_guardian_authority (
  parent_member_id,
  child_member_id,
  has_legal_authority,
  created_at,
  updated_at
)
SELECT DISTINCT
  parent_row.id,
  child_row.id,
  TRUE,
  now(),
  now()
FROM member child_row
CROSS JOIN LATERAL unnest(
  COALESCE(child_row.parent_guardian_ids, ARRAY[]::BIGINT[])
) guardian_id(parent_member_id)
JOIN member parent_row
  ON parent_row.id = guardian_id.parent_member_id
 AND parent_row.facility_id = child_row.facility_id
WHERE parent_row.id <> child_row.id
  AND parent_row.date_of_birth IS NOT NULL
  AND parent_row.date_of_birth <= (CURRENT_DATE - INTERVAL '18 years')::date
ON CONFLICT (parent_member_id, child_member_id) DO UPDATE
SET has_legal_authority = TRUE,
    updated_at = now();

-- Retain invalid historical rows but remove their legal authority. Canonical
-- reads already scope to has_legal_authority = TRUE.
UPDATE parent_guardian_authority authority
   SET has_legal_authority = FALSE,
       updated_at = now()
  FROM member parent_row,
       member child_row
 WHERE parent_row.id = authority.parent_member_id
   AND child_row.id = authority.child_member_id
   AND authority.has_legal_authority = TRUE
   AND (
     parent_row.id = child_row.id
     OR parent_row.facility_id IS DISTINCT FROM child_row.facility_id
     OR parent_row.date_of_birth IS NULL
     OR parent_row.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date
   );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'parent_guardian_authority'::regclass
       AND conname = 'parent_guardian_authority_non_self_check'
  ) THEN
    ALTER TABLE parent_guardian_authority
      ADD CONSTRAINT parent_guardian_authority_non_self_check
      CHECK (
        has_legal_authority = FALSE
        OR parent_member_id <> child_member_id
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION guard_parent_guardian_authority_scope()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.has_legal_authority = TRUE THEN
    PERFORM 1
      FROM member parent_row
      JOIN member child_row
        ON child_row.id = NEW.child_member_id
       AND child_row.facility_id = parent_row.facility_id
     WHERE parent_row.id = NEW.parent_member_id
       AND parent_row.id <> child_row.id
       AND parent_row.date_of_birth IS NOT NULL
       AND parent_row.date_of_birth <= (CURRENT_DATE - INTERVAL '18 years')::date;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'legal guardian authority must identify an adult and link different members in the same facility'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_parent_guardian_authority_scope_guard
  ON parent_guardian_authority;
CREATE TRIGGER trg_parent_guardian_authority_scope_guard
BEFORE INSERT OR UPDATE OF parent_member_id, child_member_id, has_legal_authority
ON parent_guardian_authority
FOR EACH ROW EXECUTE FUNCTION guard_parent_guardian_authority_scope();

-- A later DOB or facility edit must not turn an existing legal guardian row
-- into contradictory authority. Require the relationship to be explicitly
-- retired before changing the guardian into an unknown/minor/cross-facility
-- identity. Runtime reads still repeat these checks as defense in depth.
CREATE OR REPLACE FUNCTION guard_member_guardian_eligibility()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM parent_guardian_authority authority
      JOIN member parent_row ON parent_row.id = authority.parent_member_id
      JOIN member child_row ON child_row.id = authority.child_member_id
     WHERE (authority.parent_member_id = OLD.id OR authority.child_member_id = OLD.id)
       AND authority.has_legal_authority = TRUE
       AND (
         (
           authority.parent_member_id = OLD.id
           AND (
             NEW.date_of_birth IS NULL
             OR NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date
             OR NEW.facility_id IS DISTINCT FROM child_row.facility_id
           )
         )
         OR (
           authority.child_member_id = OLD.id
           AND NEW.facility_id IS DISTINCT FROM parent_row.facility_id
         )
       )
  ) THEN
    RAISE EXCEPTION 'remove active legal guardian authority before changing a linked guardian DOB or either member facility'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_member_guardian_eligibility_guard ON member;
CREATE TRIGGER trg_member_guardian_eligibility_guard
BEFORE UPDATE OF date_of_birth, facility_id ON member
FOR EACH ROW EXECUTE FUNCTION guard_member_guardian_eligibility();

CREATE INDEX IF NOT EXISTS idx_parent_guardian_authority_active_child
  ON parent_guardian_authority(child_member_id, parent_member_id)
  WHERE has_legal_authority = TRUE;
