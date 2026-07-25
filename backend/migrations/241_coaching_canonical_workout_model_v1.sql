-- Canonical definition -> variant -> delivery profile -> prescription model.
-- Legacy rows are imported into review state; nothing is auto-published.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.exercise_definition_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  legacy_exercise_id BIGINT UNIQUE REFERENCES coaching.exercise(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  family_key TEXT NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '1.0.0',
  card_version INTEGER NOT NULL DEFAULT 1 CHECK (card_version >= 1),
  status TEXT NOT NULL DEFAULT 'review'
    CHECK (status IN ('draft', 'review', 'published', 'deprecated', 'archived')),
  content_confidence SMALLINT CHECK (content_confidence BETWEEN 1 AND 100),
  scoring_confidence SMALLINT CHECK (scoring_confidence BETWEEN 1 AND 100),
  media_confidence SMALLINT CHECK (media_confidence BETWEEN 1 AND 100),
  movement_patterns TEXT[] NOT NULL DEFAULT '{}',
  body_regions TEXT[] NOT NULL DEFAULT '{}',
  required_equipment TEXT[] NOT NULL DEFAULT '{}',
  optional_equipment TEXT[] NOT NULL DEFAULT '{}',
  environment_json JSONB NOT NULL DEFAULT '{}',
  population_json JSONB NOT NULL DEFAULT '{}',
  provenance_json JSONB NOT NULL DEFAULT '{}',
  approved_video_url TEXT,
  created_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  reviewed_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  approved_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, slug)
);

CREATE TABLE IF NOT EXISTS coaching.exercise_variant_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES coaching.exercise_definition_v1(id) ON DELETE CASCADE,
  variant_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  modifier_keys TEXT[] NOT NULL DEFAULT '{}',
  difficulty_json JSONB NOT NULL DEFAULT '{}',
  requirements_json JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'review'
    CHECK (status IN ('draft', 'review', 'published', 'deprecated', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (definition_id, variant_key)
);

CREATE TABLE IF NOT EXISTS coaching.exercise_delivery_profile_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES coaching.exercise_variant_v1(id) ON DELETE CASCADE,
  profile_key TEXT NOT NULL,
  phase_key TEXT NOT NULL CHECK (phase_key IN (
    'prepare_and_access', 'movement_intelligence', 'output', 'capacity',
    'resilience', 'sustained_capacity', 'restore'
  )),
  role TEXT NOT NULL CHECK (role IN ('primary', 'secondary', 'conditional', 'avoid')),
  purpose TEXT NOT NULL,
  phase_suitability SMALLINT NOT NULL CHECK (phase_suitability BETWEEN 1 AND 100),
  methodology_alignment SMALLINT CHECK (methodology_alignment BETWEEN 1 AND 100),
  objective_relevance_json JSONB NOT NULL DEFAULT '{}',
  dosage_json JSONB NOT NULL DEFAULT '{}',
  quality_gate TEXT NOT NULL,
  stop_rules TEXT[] NOT NULL DEFAULT '{}',
  coach_instructions TEXT,
  athlete_instructions TEXT,
  expected_adaptation TEXT,
  equipment_required TEXT[] NOT NULL DEFAULT '{}',
  logistics_json JSONB NOT NULL DEFAULT '{}',
  substitution_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'review'
    CHECK (status IN ('draft', 'review', 'published', 'deprecated', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (variant_id, profile_key)
);

CREATE TABLE IF NOT EXISTS coaching.exercise_relationship_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_variant_id UUID NOT NULL REFERENCES coaching.exercise_variant_v1(id) ON DELETE CASCADE,
  to_variant_id UUID NOT NULL REFERENCES coaching.exercise_variant_v1(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN (
    'regression', 'progression', 'lateral_substitution', 'equipment_equivalent',
    'phase_equivalent', 'compatible_pairing', 'contraindicated_pairing'
  )),
  similarity_score SMALLINT NOT NULL CHECK (similarity_score BETWEEN 1 AND 100),
  dimensions TEXT[] NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL,
  conditions_json JSONB NOT NULL DEFAULT '{}',
  review_status TEXT NOT NULL DEFAULT 'review'
    CHECK (review_status IN ('review', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_variant_id, to_variant_id, relationship)
);

CREATE TABLE IF NOT EXISTS coaching.workout_library_release_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '1.0.0',
  definition_ids UUID[] NOT NULL DEFAULT '{}',
  rule_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  published_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, version)
);

CREATE TABLE IF NOT EXISTS coaching.generated_workout_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  library_release_id UUID REFERENCES coaching.workout_library_release_v1(id) ON DELETE RESTRICT,
  schema_version TEXT NOT NULL,
  generator_version TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  model_version TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('deterministic', 'ai_assisted')),
  random_seed TEXT NOT NULL,
  intent_json JSONB NOT NULL,
  output_json JSONB NOT NULL,
  validation_json JSONB NOT NULL,
  created_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO coaching.exercise_definition_v1 (
  facility_id, legacy_exercise_id, slug, canonical_name, display_name,
  description, family_key, status, content_confidence, scoring_confidence,
  media_confidence, provenance_json, created_by
)
SELECT
  e.facility_id, e.id, e.slug, e.name, e.name, e.description,
  COALESCE(NULLIF(e.movement_family, ''), e.slug), 'review', 40, 40, 20,
  jsonb_build_object('source_table', 'coaching.exercise', 'source_id', e.id,
    'human_review_required', true), e.created_by
FROM coaching.exercise e
ON CONFLICT (legacy_exercise_id) DO NOTHING;

INSERT INTO coaching.exercise_variant_v1 (
  definition_id, variant_key, display_name, difficulty_json, status
)
SELECT
  d.id, 'baseline', d.display_name,
  jsonb_strip_nulls(jsonb_build_object(
    'technicalComplexity', s.technical_complexity,
    'absoluteLoadDemand', s.absolute_load_demand,
    'coordinationDemand', s.coordination_demand,
    'impact', s.impact,
    'supervisionDemand', s.supervision_demand,
    'baseOverallDifficulty', s.base_overall_difficulty
  )),
  'review'
FROM coaching.exercise_definition_v1 d
LEFT JOIN coaching.exercise_score_v1 s ON s.exercise_id = d.legacy_exercise_id
ON CONFLICT (definition_id, variant_key) DO NOTHING;

UPDATE coaching.exercise_definition_v1 d
SET approved_video_url = media.url,
    media_confidence = 40
FROM (
  SELECT DISTINCT ON (exercise_id) exercise_id, url
  FROM coaching.exercise_media
  WHERE kind = 'video' AND url IS NOT NULL AND url <> ''
  ORDER BY exercise_id, sort_order, id
) media
WHERE d.legacy_exercise_id = media.exercise_id
  AND d.approved_video_url IS NULL;

INSERT INTO coaching.exercise_delivery_profile_v1 (
  variant_id, profile_key, phase_key, role, purpose, phase_suitability,
  methodology_alignment, objective_relevance_json, dosage_json,
  quality_gate, stop_rules, coach_instructions, athlete_instructions,
  status
)
SELECT
  v.id,
  'legacy-' || CASE sp.key
    WHEN 'prepare_access' THEN 'prepare_and_access'
    WHEN 'skill_movement_intelligence' THEN 'movement_intelligence'
    WHEN 'control_resilience' THEN 'resilience'
    WHEN 'fitness_repeatability' THEN 'sustained_capacity'
    ELSE sp.key
  END,
  CASE sp.key
    WHEN 'prepare_access' THEN 'prepare_and_access'
    WHEN 'skill_movement_intelligence' THEN 'movement_intelligence'
    WHEN 'control_resilience' THEN 'resilience'
    WHEN 'fitness_repeatability' THEN 'sustained_capacity'
    ELSE sp.key
  END,
  CASE WHEN pp.role IN ('primary', 'secondary', 'conditional', 'avoid') THEN pp.role ELSE 'conditional' END,
  COALESCE(NULLIF(pp.notes, ''), NULLIF(e.card_summary, ''), NULLIF(e.description, ''),
    'Coach review required before publication.'),
  LEAST(100, GREATEST(1, pp.fit_weight * 10)),
  50,
  '{"default": 50}'::jsonb,
  jsonb_strip_nulls(jsonb_build_object(
    'sets', COALESCE(dp.default_sets, e.default_sets),
    'reps', COALESCE(dp.default_reps, e.default_reps),
    'workSeconds', COALESCE(dp.default_work_seconds, e.default_work_seconds),
    'restSeconds', COALESCE(dp.default_rest_seconds, e.default_rest_seconds),
    'rpe', dp.default_rpe_max,
    'tempo', e.tempo
  )),
  COALESCE(NULLIF(e.coaching_execution->>'quality_gate', ''),
    'Stop before movement quality declines.'),
  CASE
    WHEN jsonb_typeof(e.coaching_execution->'stop_signs') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(e.coaching_execution->'stop_signs'))
    ELSE ARRAY['Stop on pain.', 'Stop when technique changes.']
  END,
  NULLIF(e.coach_language, ''),
  NULLIF(e.athlete_language, ''),
  'review'
FROM coaching.exercise_definition_v1 d
JOIN coaching.exercise e ON e.id = d.legacy_exercise_id
JOIN coaching.exercise_variant_v1 v ON v.definition_id = d.id AND v.variant_key = 'baseline'
JOIN coaching.exercise_phase_profile pp ON pp.exercise_id = e.id
JOIN coaching.session_phase sp ON sp.id = pp.phase_id
LEFT JOIN LATERAL (
  SELECT *
  FROM coaching.exercise_dosage_profile candidate
  WHERE candidate.exercise_id = e.id
  ORDER BY candidate.id
  LIMIT 1
) dp ON true
WHERE (CASE sp.key
  WHEN 'prepare_access' THEN 'prepare_and_access'
  WHEN 'skill_movement_intelligence' THEN 'movement_intelligence'
  WHEN 'control_resilience' THEN 'resilience'
  WHEN 'fitness_repeatability' THEN 'sustained_capacity'
  ELSE sp.key
END) IN (
  'prepare_and_access', 'movement_intelligence', 'output', 'capacity',
  'resilience', 'sustained_capacity', 'restore'
)
ON CONFLICT (variant_id, profile_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_exercise_definition_v1_publish_pool
  ON coaching.exercise_definition_v1(facility_id, status);
CREATE INDEX IF NOT EXISTS idx_exercise_delivery_profile_v1_phase
  ON coaching.exercise_delivery_profile_v1(phase_key, status);
CREATE INDEX IF NOT EXISTS idx_generated_workout_v1_facility
  ON coaching.generated_workout_v1(facility_id, created_at DESC);
