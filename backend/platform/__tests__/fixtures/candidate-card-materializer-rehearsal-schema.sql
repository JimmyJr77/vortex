-- Minimal representative canonical-card schema used only in the disposable
-- PostgreSQL rehearsal. It intentionally models the materializer's touched
-- columns and conflict keys, without masquerading as a production bootstrap.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS coaching;

CREATE TABLE public.facility (id BIGINT PRIMARY KEY);
CREATE TABLE coaching.exercise (
  id BIGINT PRIMARY KEY, facility_id BIGINT NOT NULL, name TEXT NOT NULL DEFAULT 'legacy', slug TEXT NOT NULL DEFAULT 'legacy',
  description TEXT, skill_level TEXT, age_min INTEGER, age_max INTEGER, default_sets INTEGER, default_reps INTEGER,
  default_work_seconds INTEGER, default_rest_seconds INTEGER, tempo TEXT, load_note TEXT, est_seconds_per_set INTEGER,
  is_published BOOLEAN NOT NULL DEFAULT FALSE, archived BOOLEAN NOT NULL DEFAULT FALSE, card_summary TEXT,
  coach_language TEXT, athlete_language TEXT, programming_logic JSONB NOT NULL DEFAULT '{}', scalable_variables TEXT[] NOT NULL DEFAULT '{}',
  movement_family TEXT, primary_phase_key TEXT, phase_subrole TEXT, primary_order_slot TEXT,
  movement_requirements JSONB NOT NULL DEFAULT '{}', coaching_execution JSONB NOT NULL DEFAULT '{}', pairing_logic JSONB NOT NULL DEFAULT '{}',
  media_library JSONB NOT NULL DEFAULT '{}', participant_structure TEXT, programming_kind TEXT, linked_skill_id BIGINT,
  why_publish_ready BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE coaching.exercise_definition_v1 (
  id UUID PRIMARY KEY, facility_id BIGINT NOT NULL, legacy_exercise_id BIGINT UNIQUE, slug TEXT NOT NULL, canonical_name TEXT NOT NULL,
  display_name TEXT NOT NULL, aliases TEXT[] NOT NULL DEFAULT '{}', description TEXT, family_key TEXT NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '1.0.0', card_version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'review',
  content_confidence SMALLINT, scoring_confidence SMALLINT, media_confidence SMALLINT, movement_patterns TEXT[] NOT NULL DEFAULT '{}',
  body_regions TEXT[] NOT NULL DEFAULT '{}', required_equipment TEXT[] NOT NULL DEFAULT '{}', optional_equipment TEXT[] NOT NULL DEFAULT '{}',
  environment_json JSONB NOT NULL DEFAULT '{}', population_json JSONB NOT NULL DEFAULT '{}', provenance_json JSONB NOT NULL DEFAULT '{}',
  approved_video_url TEXT, reviewed_by BIGINT, approved_by BIGINT, last_reviewed_at TIMESTAMPTZ,
  anatomy_json JSONB NOT NULL DEFAULT '{}', athlete_support_json JSONB NOT NULL DEFAULT '{}', coach_support_json JSONB NOT NULL DEFAULT '{}',
  support_operations_json JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(facility_id, slug)
);
CREATE TABLE coaching.exercise_variant_v1 (
  id UUID PRIMARY KEY, definition_id UUID NOT NULL, variant_key TEXT NOT NULL, display_name TEXT NOT NULL,
  modifier_keys TEXT[] NOT NULL DEFAULT '{}', difficulty_json JSONB NOT NULL DEFAULT '{}', requirements_json JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'review', load_profile_json JSONB NOT NULL DEFAULT '{}', fatigue_profile_json JSONB NOT NULL DEFAULT '{}',
  programming_profile_json JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(definition_id, variant_key)
);
CREATE TABLE coaching.exercise_delivery_profile_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), variant_id UUID NOT NULL, profile_key TEXT NOT NULL, phase_key TEXT NOT NULL,
  role TEXT NOT NULL, purpose TEXT NOT NULL, phase_suitability SMALLINT NOT NULL, methodology_alignment SMALLINT,
  objective_relevance_json JSONB NOT NULL DEFAULT '{}', dosage_json JSONB NOT NULL DEFAULT '{}', quality_gate TEXT NOT NULL,
  stop_rules TEXT[] NOT NULL DEFAULT '{}', coach_instructions TEXT, athlete_instructions TEXT, expected_adaptation TEXT,
  equipment_required TEXT[] NOT NULL DEFAULT '{}', logistics_json JSONB NOT NULL DEFAULT '{}', substitution_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'review', time_model_json JSONB NOT NULL DEFAULT '{}', dose_scaling_json JSONB NOT NULL DEFAULT '{}',
  measurement_json JSONB NOT NULL DEFAULT '{}', support_prompts_json JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(variant_id, profile_key)
);
CREATE TABLE coaching.exercise_definition_source_v1 (
  definition_id UUID NOT NULL, legacy_exercise_id BIGINT NOT NULL, source_kind TEXT NOT NULL DEFAULT 'legacy_migration',
  provenance_json JSONB NOT NULL DEFAULT '{}', PRIMARY KEY(definition_id, legacy_exercise_id), UNIQUE(legacy_exercise_id)
);
CREATE TABLE coaching.exercise_section_evidence_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), definition_id UUID NOT NULL, reviewed_card_version INTEGER NOT NULL, section_key TEXT NOT NULL,
  source_url TEXT NOT NULL, source_title TEXT, source_publisher TEXT, source_kind TEXT NOT NULL, claims_json JSONB NOT NULL DEFAULT '[]',
  evidence_quality SMALLINT, review_status TEXT NOT NULL DEFAULT 'candidate', reviewer_user_id BIGINT, reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(definition_id, reviewed_card_version, section_key, source_url)
);
CREATE TABLE coaching.exercise_media_candidate_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), definition_id UUID NOT NULL, variant_id UUID, reviewed_card_version INTEGER NOT NULL,
  url TEXT NOT NULL, embed_url TEXT NOT NULL, video_id TEXT NOT NULL, title TEXT, channel_name TEXT, exact_variant_match BOOLEAN,
  demonstration_quality_score SMALLINT, link_status TEXT NOT NULL DEFAULT 'unverified', review_status TEXT NOT NULL DEFAULT 'candidate',
  discovery_method TEXT NOT NULL DEFAULT 'manual_research', source_query TEXT, reviewer_user_id BIGINT, reviewed_at TIMESTAMPTZ,
  notes TEXT, embedding_allowed BOOLEAN, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(definition_id, reviewed_card_version, video_id)
);
CREATE TABLE coaching.exercise_alternate_assessment_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), definition_id UUID NOT NULL, reviewed_card_version INTEGER NOT NULL,
  alternate_name TEXT NOT NULL, classification TEXT NOT NULL, rationale TEXT NOT NULL, distinguishing_dimensions JSONB NOT NULL DEFAULT '{}',
  proposed_card_json JSONB, review_status TEXT NOT NULL DEFAULT 'candidate', reviewer_user_id BIGINT, reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(definition_id, reviewed_card_version, alternate_name)
);
CREATE TABLE coaching.exercise_card_review_v1 (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), definition_id UUID NOT NULL);
CREATE TABLE coaching.exercise_card_revision_v1 (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), definition_id UUID NOT NULL);
CREATE TABLE coaching.exercise_media_review_v1 (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), definition_id UUID NOT NULL);
CREATE TABLE coaching.exercise_relationship_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), from_variant_id UUID NOT NULL, to_variant_id UUID NOT NULL, relationship TEXT NOT NULL,
  similarity_score SMALLINT NOT NULL, dimensions TEXT[] NOT NULL DEFAULT '{}', reason TEXT NOT NULL, conditions_json JSONB NOT NULL DEFAULT '{}',
  review_status TEXT NOT NULL DEFAULT 'review', reviewed_by BIGINT, reviewed_at TIMESTAMPTZ, UNIQUE(from_variant_id, to_variant_id, relationship)
);
CREATE TABLE coaching.exercise_score_calibration_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), facility_id BIGINT NOT NULL, variant_id UUID NOT NULL, dimension TEXT NOT NULL,
  proposed_score SMALLINT NOT NULL, anchor_tier SMALLINT NOT NULL, rationale TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'review',
  version INTEGER NOT NULL DEFAULT 1, reviewed_by BIGINT, review_notes TEXT, reviewed_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(facility_id, variant_id, dimension, version)
);
CREATE TABLE coaching.exercise_identity_resolution_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), facility_id BIGINT NOT NULL, survivor_definition_id UUID NOT NULL,
  resolved_definition_id UUID NOT NULL, decision TEXT NOT NULL, rationale TEXT NOT NULL, evidence_json JSONB NOT NULL DEFAULT '{}',
  resolution_source TEXT NOT NULL, reviewed_by BIGINT, resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(survivor_definition_id, resolved_definition_id)
);
CREATE TABLE coaching.exercise_safety_profile (
  exercise_id BIGINT PRIMARY KEY, risk_level INTEGER, impact_level INTEGER, minimum_age_recommended INTEGER, minimum_skill_level TEXT,
  requires_spotting BOOLEAN, requires_coach_supervision TEXT, minimum_prerequisite_notes TEXT, readiness_checks TEXT[] NOT NULL DEFAULT '{}',
  stop_signs TEXT[] NOT NULL DEFAULT '{}', contraindications TEXT[] NOT NULL DEFAULT '{}', common_substitutions TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE coaching.exercise_score_v1 (
  exercise_id BIGINT PRIMARY KEY, technical_complexity SMALLINT, absolute_load_demand SMALLINT, coordination_demand SMALLINT,
  impact SMALLINT, supervision_demand SMALLINT, base_overall_difficulty SMALLINT, legacy_scores JSONB NOT NULL DEFAULT '{}',
  migration_confidence SMALLINT, human_review_status TEXT NOT NULL DEFAULT 'queued', reviewed_by BIGINT, reviewed_at TIMESTAMPTZ,
  review_notes TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE coaching.exercise_difficulty_profile (
  exercise_id BIGINT PRIMARY KEY, technical NUMERIC, complexity NUMERIC, load NUMERIC, overall NUMERIC,
  recommended_age_min INTEGER, recommended_age_max INTEGER, attention_demand TEXT, notes TEXT, source TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE coaching.exercise_card_test_packet_v1 (
  definition_id UUID PRIMARY KEY, facility_id BIGINT NOT NULL, card_version INTEGER NOT NULL, schema_version TEXT NOT NULL,
  audit_version TEXT NOT NULL, status TEXT NOT NULL, checks_json JSONB NOT NULL, blocking_issues_json JSONB NOT NULL DEFAULT '[]',
  human_review_required BOOLEAN NOT NULL DEFAULT TRUE, checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE coaching.movement_pattern (key TEXT PRIMARY KEY);
CREATE TABLE coaching.body_region (key TEXT PRIMARY KEY);
CREATE TABLE coaching.equipment (key TEXT PRIMARY KEY);

INSERT INTO public.facility(id) VALUES (1);
INSERT INTO coaching.movement_pattern(key) VALUES ('brace'), ('calf_raise'), ('isometric'), ('weight_shift');
INSERT INTO coaching.body_region(key) VALUES ('ankle'), ('calf'), ('core'), ('foot'), ('hip'), ('knee');
INSERT INTO coaching.equipment(key) VALUES ('bench'), ('none'), ('wall');
