-- One current, reproducible test packet per canonical exercise card.
-- A failed packet is a quarantine record, not an approval. The audit CLI
-- refreshes these rows after migrations and whenever card content changes.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.exercise_card_test_packet_v1 (
  definition_id UUID PRIMARY KEY
    REFERENCES coaching.exercise_definition_v1(id) ON DELETE CASCADE,
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  card_version INTEGER NOT NULL CHECK (card_version >= 1),
  schema_version TEXT NOT NULL DEFAULT '1.0.0',
  audit_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'quarantined')),
  checks_json JSONB NOT NULL,
  blocking_issues_json JSONB NOT NULL DEFAULT '[]',
  human_review_required BOOLEAN NOT NULL DEFAULT TRUE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercise_card_test_packet_facility_status_idx
  ON coaching.exercise_card_test_packet_v1 (facility_id, status);

-- Ensure every migrated card is explicitly quarantined until the executable
-- audit has evaluated its complete canonical contract.
INSERT INTO coaching.exercise_card_test_packet_v1 (
  definition_id, facility_id, card_version, audit_version, status,
  checks_json, blocking_issues_json, human_review_required
)
SELECT
  d.id,
  d.facility_id,
  d.card_version,
  'canonical-card-audit-v1',
  'quarantined',
  '{}'::jsonb,
  jsonb_build_array(jsonb_build_object(
    'code', 'audit_pending',
    'message', 'Run the canonical exercise library audit before publication.'
  )),
  TRUE
FROM coaching.exercise_definition_v1 d
ON CONFLICT (definition_id) DO NOTHING;

UPDATE coaching.exercise_definition_v1
SET provenance_json = provenance_json || jsonb_build_object(
      'canonical_audit_required', TRUE,
      'publication_quarantined', TRUE
    ),
    updated_at = now()
WHERE status IN ('draft', 'review')
  AND (
    provenance_json->>'canonical_audit_required' IS DISTINCT FROM 'true'
    OR provenance_json->>'publication_quarantined' IS DISTINCT FROM 'true'
  );
