-- Versioned research evidence, alternate-version decisions, and multi-video
-- candidates for the canonical exercise review program.
-- Candidate records never grant media or card approval.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.exercise_review_batch_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
  batch_key TEXT NOT NULL,
  scope_json JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'researching', 'content_review', 'media_review', 'complete', 'blocked')),
  assigned_to BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, batch_key)
);

CREATE TABLE IF NOT EXISTS coaching.exercise_section_evidence_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES coaching.exercise_definition_v1(id) ON DELETE CASCADE,
  reviewed_card_version INTEGER NOT NULL CHECK (reviewed_card_version >= 1),
  section_key TEXT NOT NULL CHECK (section_key IN (
    'identity', 'taxonomy', 'anatomy', 'biomechanics', 'difficulty',
    'load_fatigue_recovery', 'constraints', 'dosage', 'instructions',
    'safety_stop_rules', 'programming', 'athlete_support', 'coach_support',
    'accessibility', 'alternates', 'media'
  )),
  source_url TEXT NOT NULL CHECK (source_url ~ '^https://'),
  source_title TEXT,
  source_publisher TEXT,
  source_kind TEXT NOT NULL CHECK (source_kind IN (
    'peer_reviewed_research', 'professional_standard', 'governing_body',
    'manufacturer_instruction', 'expert_instruction', 'internal_observation'
  )),
  claims_json JSONB NOT NULL DEFAULT '[]',
  evidence_quality SMALLINT CHECK (evidence_quality BETWEEN 1 AND 100),
  review_status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (review_status IN ('candidate', 'reviewed', 'rejected', 'superseded')),
  reviewer_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (definition_id, reviewed_card_version, section_key, source_url),
  CHECK (
    review_status NOT IN ('reviewed', 'rejected')
    OR (reviewer_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS coaching.exercise_media_candidate_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES coaching.exercise_definition_v1(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES coaching.exercise_variant_v1(id) ON DELETE CASCADE,
  reviewed_card_version INTEGER NOT NULL CHECK (reviewed_card_version >= 1),
  url TEXT NOT NULL CHECK (
    url ~ '^https://(www\.)?(youtube\.com/watch\?v=|youtu\.be/)'
  ),
  embed_url TEXT NOT NULL CHECK (embed_url ~ '^https://www\.youtube-nocookie\.com/embed/'),
  video_id TEXT NOT NULL,
  title TEXT,
  channel_name TEXT,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  language_code TEXT NOT NULL DEFAULT 'en',
  captions_available BOOLEAN,
  embedding_allowed BOOLEAN,
  exact_variant_match BOOLEAN,
  demonstration_quality_score SMALLINT
    CHECK (demonstration_quality_score BETWEEN 1 AND 100),
  link_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (link_status IN ('unverified', 'healthy', 'broken', 'embedding_disabled', 'mismatched')),
  review_status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (review_status IN ('candidate', 'shortlisted', 'approved', 'rejected', 'superseded')),
  discovery_method TEXT NOT NULL DEFAULT 'manual_research'
    CHECK (discovery_method IN ('manual_research', 'youtube_api', 'legacy_import', 'coach_submission')),
  source_query TEXT,
  reviewer_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (definition_id, reviewed_card_version, url),
  UNIQUE (definition_id, reviewed_card_version, video_id),
  CHECK (
    review_status <> 'approved'
    OR (
      reviewer_user_id IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND exact_variant_match IS TRUE
      AND link_status = 'healthy'
      AND embedding_allowed IS TRUE
      AND demonstration_quality_score >= 80
    )
  ),
  CHECK (
    review_status NOT IN ('shortlisted', 'approved', 'rejected')
    OR (reviewer_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS coaching.exercise_alternate_assessment_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES coaching.exercise_definition_v1(id) ON DELETE CASCADE,
  reviewed_card_version INTEGER NOT NULL CHECK (reviewed_card_version >= 1),
  alternate_name TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN (
    'new_definition', 'new_variant', 'modifier_annotation', 'same_identity', 'reject'
  )),
  rationale TEXT NOT NULL,
  distinguishing_dimensions JSONB NOT NULL DEFAULT '{}',
  proposed_card_json JSONB,
  review_status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (review_status IN ('candidate', 'reviewed', 'approved', 'rejected', 'superseded')),
  reviewer_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (definition_id, reviewed_card_version, alternate_name),
  CHECK (
    review_status NOT IN ('reviewed', 'approved', 'rejected')
    OR (reviewer_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS exercise_section_evidence_definition_idx
  ON coaching.exercise_section_evidence_v1(definition_id, reviewed_card_version, section_key);
CREATE INDEX IF NOT EXISTS exercise_media_candidate_review_idx
  ON coaching.exercise_media_candidate_v1(review_status, link_status, next_review_at);
CREATE INDEX IF NOT EXISTS exercise_alternate_assessment_review_idx
  ON coaching.exercise_alternate_assessment_v1(review_status, classification);

-- Preserve legacy links as unverified candidates. Existing URLs are not treated
-- as exact-match, embeddable, healthy, or approved without an actual review.
INSERT INTO coaching.exercise_media_candidate_v1 (
  definition_id, reviewed_card_version, url, embed_url, video_id,
  review_status, link_status, discovery_method, notes
)
SELECT
  d.id,
  d.card_version,
  d.approved_video_url,
  'https://www.youtube-nocookie.com/embed/' || match[1],
  match[1],
  'candidate',
  'unverified',
  'legacy_import',
  'Imported from the legacy approved_video_url field; exact-match and embedding review are still required.'
FROM coaching.exercise_definition_v1 d
CROSS JOIN LATERAL regexp_match(
  d.approved_video_url,
  '(?:youtube\.com/watch\?v=|youtu\.be/)([A-Za-z0-9_-]{6,})'
) match
WHERE d.status <> 'archived'
  AND d.approved_video_url IS NOT NULL
ON CONFLICT (definition_id, reviewed_card_version, video_id) DO NOTHING;
