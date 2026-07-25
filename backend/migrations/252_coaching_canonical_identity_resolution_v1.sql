-- Consolidate objectively identical canonical definitions without losing any
-- legacy source identity or contextual delivery profile.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.exercise_definition_source_v1 (
  definition_id UUID NOT NULL REFERENCES coaching.exercise_definition_v1(id) ON DELETE CASCADE,
  legacy_exercise_id BIGINT NOT NULL REFERENCES coaching.exercise(id) ON DELETE RESTRICT,
  source_kind TEXT NOT NULL DEFAULT 'legacy_migration'
    CHECK (source_kind IN ('legacy_migration', 'duplicate_consolidation')),
  provenance_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (definition_id, legacy_exercise_id),
  UNIQUE (legacy_exercise_id)
);

CREATE TABLE IF NOT EXISTS coaching.exercise_identity_resolution_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  survivor_definition_id UUID NOT NULL REFERENCES coaching.exercise_definition_v1(id) ON DELETE CASCADE,
  resolved_definition_id UUID NOT NULL REFERENCES coaching.exercise_definition_v1(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('duplicate_consolidated', 'distinct_exercises', 'needs_human_review')),
  rationale TEXT NOT NULL,
  evidence_json JSONB NOT NULL DEFAULT '{}',
  resolution_source TEXT NOT NULL CHECK (
    resolution_source IN ('deterministic_exact_identity', 'deterministic_identity_equivalence', 'human_review')
  ),
  reviewed_by BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (survivor_definition_id, resolved_definition_id),
  CHECK (survivor_definition_id <> resolved_definition_id),
  CHECK (
    (resolution_source IN ('deterministic_exact_identity', 'deterministic_identity_equivalence') AND reviewed_by IS NULL)
    OR resolution_source = 'human_review'
  )
);

INSERT INTO coaching.exercise_definition_source_v1 (
  definition_id, legacy_exercise_id, source_kind, provenance_json
)
SELECT id, legacy_exercise_id, 'legacy_migration',
       jsonb_build_object('source_table', 'coaching.exercise')
FROM coaching.exercise_definition_v1
WHERE legacy_exercise_id IS NOT NULL
ON CONFLICT (legacy_exercise_id) DO NOTHING;

CREATE TEMP TABLE canonical_exact_identity_resolution ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    d.*,
    first_value(d.id) OVER (
      PARTITION BY d.facility_id, lower(regexp_replace(d.canonical_name, '\s+', ' ', 'g'))
      ORDER BY d.legacy_exercise_id NULLS LAST, d.id
    ) AS survivor_id,
    count(*) OVER (
      PARTITION BY d.facility_id, lower(regexp_replace(d.canonical_name, '\s+', ' ', 'g'))
    ) AS identity_count
  FROM coaching.exercise_definition_v1 d
  WHERE d.status <> 'archived'
)
SELECT id AS duplicate_id, survivor_id, facility_id, legacy_exercise_id,
       canonical_name, display_name, family_key
FROM ranked
WHERE identity_count > 1 AND id <> survivor_id;

-- Orthographic and word-order equivalents reviewed against the seeded source
-- names. Movement-changing modifiers (direction, stance, implement, range, cue,
-- start type, landing count, or jump type) are intentionally absent.
INSERT INTO canonical_exact_identity_resolution (
  duplicate_id, survivor_id, facility_id, legacy_exercise_id,
  canonical_name, display_name, family_key
)
SELECT
  duplicate.id, survivor.id, duplicate.facility_id,
  duplicate.legacy_exercise_id, duplicate.canonical_name,
  duplicate.display_name, duplicate.family_key
FROM (VALUES
  (27::bigint,1458::bigint), (35,899), (38,912), (40,875), (43,214),
  (102,927), (120,708), (121,709), (139,541), (148,157), (182,573),
  (188,487), (201,1074), (206,1025), (210,1080), (213,315),
  (213,680), (227,847), (230,1059), (231,887), (234,567), (238,660),
  (249,673), (261,838), (289,1606), (309,942), (310,738), (358,1316),
  (366,1363), (508,1350), (517,837), (558,689), (945,1185),
  (975,1110), (1088,1495), (1180,1196), (1189,1195), (1199,1324),
  (1305,1454)
) reviewed(survivor_legacy_id, duplicate_legacy_id)
JOIN coaching.exercise_definition_v1 survivor
  ON survivor.legacy_exercise_id = reviewed.survivor_legacy_id
JOIN coaching.exercise_definition_v1 duplicate
  ON duplicate.legacy_exercise_id = reviewed.duplicate_legacy_id
WHERE survivor.status <> 'archived' AND duplicate.status <> 'archived'
ON CONFLICT DO NOTHING;

INSERT INTO coaching.exercise_identity_resolution_v1 (
  facility_id, survivor_definition_id, resolved_definition_id, decision,
  rationale, evidence_json, resolution_source
)
SELECT
  r.facility_id, r.survivor_id, r.duplicate_id, 'duplicate_consolidated',
  CASE
    WHEN lower(r.canonical_name) = lower(survivor.canonical_name)
      THEN 'Canonical names are an exact normalized match; legacy sources and variants were preserved.'
    ELSE 'Names are deterministic orthographic or word-order equivalents; legacy sources and variants were preserved.'
  END,
  jsonb_build_object(
    'match', CASE
      WHEN lower(r.canonical_name) = lower(survivor.canonical_name)
        THEN 'normalized_canonical_name'
      ELSE 'reviewed_identity_equivalence'
    END,
    'canonical_name', r.canonical_name,
    'legacy_exercise_id', r.legacy_exercise_id,
    'family_key', r.family_key
  ),
  CASE
    WHEN lower(r.canonical_name) = lower(survivor.canonical_name)
      THEN 'deterministic_exact_identity'
    ELSE 'deterministic_identity_equivalence'
  END
FROM canonical_exact_identity_resolution r
JOIN coaching.exercise_definition_v1 survivor ON survivor.id = r.survivor_id
ON CONFLICT (survivor_definition_id, resolved_definition_id) DO NOTHING;

-- Retain every legacy source under the surviving definition.
UPDATE coaching.exercise_definition_source_v1 s
SET definition_id = r.survivor_id,
    source_kind = 'duplicate_consolidation',
    provenance_json = s.provenance_json || jsonb_build_object(
      'resolved_from_definition_id', r.duplicate_id,
      'resolution', 'deterministic_identity_equivalence'
    )
FROM canonical_exact_identity_resolution r
WHERE s.definition_id = r.duplicate_id;

CREATE TEMP TABLE canonical_variant_resolution ON COMMIT DROP AS
SELECT
  duplicate_variant.id AS duplicate_variant_id,
  r.survivor_id,
  r.legacy_exercise_id
FROM canonical_exact_identity_resolution r
JOIN coaching.exercise_variant_v1 duplicate_variant
  ON duplicate_variant.definition_id = r.duplicate_id;

-- Preserve source-specific requirements, difficulty, loading, fatigue, and
-- profiles as variants of the surviving identity.
UPDATE coaching.exercise_variant_v1 v
SET definition_id = vr.survivor_id,
    variant_key = left(v.variant_key, 80) || '-source-' || vr.legacy_exercise_id::text,
    updated_at = now()
FROM canonical_variant_resolution vr
WHERE v.id = vr.duplicate_variant_id;

UPDATE coaching.exercise_definition_v1 survivor
SET aliases = (
      SELECT ARRAY(
        SELECT DISTINCT value
        FROM unnest(
          survivor.aliases
          || r.display_names
          || r.canonical_names
        ) value
        WHERE nullif(btrim(value), '') IS NOT NULL
          AND lower(value) <> lower(survivor.canonical_name)
        ORDER BY value
      )
    ),
    provenance_json = survivor.provenance_json || jsonb_build_object(
      'identity_resolution', 'deterministic_identity_equivalence',
      'consolidated_legacy_exercise_ids', r.legacy_exercise_ids
    ),
    updated_at = now()
FROM (
  SELECT
    survivor_id,
    ARRAY_AGG(display_name ORDER BY legacy_exercise_id) AS display_names,
    ARRAY_AGG(canonical_name ORDER BY legacy_exercise_id) AS canonical_names,
    ARRAY_AGG(legacy_exercise_id ORDER BY legacy_exercise_id) AS legacy_exercise_ids
  FROM canonical_exact_identity_resolution
  GROUP BY survivor_id
) r
WHERE survivor.id = r.survivor_id
;

UPDATE coaching.exercise_definition_v1 duplicate
SET status = 'archived',
    provenance_json = duplicate.provenance_json || jsonb_build_object(
      'identity_resolution', 'duplicate_consolidated',
      'canonical_survivor_definition_id', r.survivor_id,
      'human_review_required', true,
      'publication_quarantined', true
    ),
    updated_at = now()
FROM canonical_exact_identity_resolution r
WHERE duplicate.id = r.duplicate_id;

CREATE INDEX IF NOT EXISTS exercise_definition_source_definition_idx
  ON coaching.exercise_definition_source_v1(definition_id);
CREATE INDEX IF NOT EXISTS exercise_identity_resolution_facility_decision_idx
  ON coaching.exercise_identity_resolution_v1(facility_id, decision);
