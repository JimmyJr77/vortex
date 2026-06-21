-- Family identity cleanup.
-- Canonical model:
-- - app_user is the login identity.
-- - member is the person/athlete identity.
-- - family_member is the only family membership relation.
-- - family_billing_account.payer_member_id is the only family payer/primary concept.

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
    SELECT 1
    FROM member existing
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
SELECT m.family_id, m.id
FROM member m
WHERE m.family_id IS NOT NULL
ON CONFLICT (family_id, member_id) DO UPDATE
SET is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF to_regclass('public.family_guardian') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'family_guardian'
        AND column_name = 'member_id'
    ) THEN
      EXECUTE $sql$
        INSERT INTO family_member (family_id, member_id, is_active)
        SELECT fg.family_id, fg.member_id, TRUE
        FROM family_guardian fg
        WHERE fg.member_id IS NOT NULL
        ON CONFLICT (family_id, member_id) DO UPDATE
        SET is_active = TRUE,
            updated_at = CURRENT_TIMESTAMP
      $sql$;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'family_guardian'
        AND column_name = 'user_id'
    ) THEN
      EXECUTE $sql$
        INSERT INTO family_member (family_id, member_id, is_active)
        SELECT fg.family_id, m.id, TRUE
        FROM family_guardian fg
        JOIN member m ON m.app_user_id = fg.user_id
        WHERE fg.user_id IS NOT NULL
        ON CONFLICT (family_id, member_id) DO UPDATE
        SET is_active = TRUE,
            updated_at = CURRENT_TIMESTAMP
      $sql$;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_family_member_member
  ON family_member(member_id);

CREATE INDEX IF NOT EXISTS idx_family_member_family_active
  ON family_member(family_id, is_active);

CREATE INDEX IF NOT EXISTS idx_member_app_user
  ON member(app_user_id)
  WHERE app_user_id IS NOT NULL;

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
LEFT JOIN family_member fm
  ON fm.family_id = f.id
  AND fm.is_active = TRUE
LEFT JOIN member m
  ON m.id = fm.member_id
  AND m.is_active = TRUE
ORDER BY f.id, (m.email IS NULL), m.id
ON CONFLICT (family_id) DO NOTHING;

UPDATE family_billing_account fba
SET payer_member_id = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE payer_member_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM family_member fm
    WHERE fm.family_id = fba.family_id
      AND fm.member_id = fba.payer_member_id
      AND fm.is_active = TRUE
  );

UPDATE family_billing_account fba
SET payer_member_id = replacement.member_id,
    updated_at = CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (fm.family_id)
    fm.family_id,
    fm.member_id
  FROM family_member fm
  JOIN member m ON m.id = fm.member_id
  WHERE fm.is_active = TRUE
    AND m.is_active = TRUE
  ORDER BY fm.family_id, (m.email IS NULL), m.id
) replacement
WHERE fba.family_id = replacement.family_id
  AND fba.payer_member_id IS NULL;

ALTER TABLE family
  DROP COLUMN IF EXISTS primary_user_id,
  DROP COLUMN IF EXISTS primary_member_id;

DROP TABLE IF EXISTS family_guardian;
