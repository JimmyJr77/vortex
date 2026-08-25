-- ============================================================
-- Flip & Fit: canonical exercise-card reconciliation ledger
--
-- Keeps deterministic program card keys linked to real canonical library
-- definitions. The payload hash makes reconciliation idempotent while the
-- review state prevents uncertain fuzzy matches from creating duplicates.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.flip_fit_card_reference (
  facility_id              BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  program_card_key         TEXT NOT NULL,
  canonical_definition_id  UUID REFERENCES coaching.exercise_definition_v1(id) ON DELETE SET NULL,
  match_status             TEXT NOT NULL CHECK (match_status IN ('reused', 'alias', 'new', 'review')),
  match_reason             TEXT NOT NULL,
  match_score              SMALLINT CHECK (match_score BETWEEN 0 AND 100),
  payload_hash             TEXT NOT NULL,
  payload_json             JSONB NOT NULL,
  reconciled_by            BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (facility_id, program_card_key),
  CONSTRAINT flip_fit_card_reference_payload_object_chk
    CHECK (jsonb_typeof(payload_json) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_flip_fit_card_reference_definition
  ON coaching.flip_fit_card_reference(canonical_definition_id)
  WHERE canonical_definition_id IS NOT NULL;
