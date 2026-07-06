-- Dedupe framework education rows duplicated on every initTables boot.
-- Root cause: UNIQUE (entity_type, entity_key, entity_id) treats NULL entity_id as distinct in PostgreSQL.
-- IDEMPOTENT.

-- Keep canonical row (lowest id) per framework entity key.
DELETE FROM coaching.education_content a
USING coaching.education_content b
WHERE a.entity_id IS NULL
  AND b.entity_id IS NULL
  AND a.entity_type = b.entity_type
  AND a.entity_key = b.entity_key
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS coaching_education_framework_uniq
  ON coaching.education_content (entity_type, entity_key)
  WHERE entity_id IS NULL;
