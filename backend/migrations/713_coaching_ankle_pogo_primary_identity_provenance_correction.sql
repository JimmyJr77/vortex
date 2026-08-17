-- Keep the applied candidate-materialization migration immutable while correcting
-- its primary identity provenance to the source actually used by its packet.
DO $ankle_pogo_primary_identity_provenance_correction$
DECLARE
  migration_key CONSTANT TEXT := '713_coaching_ankle_pogo_primary_identity_provenance_correction';
  definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='ankle-pogo-in-place' AND status='review';
  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION '% requires the active review Stationary Bilateral Ankle Pogo definition', migration_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id=definition_id_value
      AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refuses to change human-reviewed provenance', migration_key;
  END IF;
  UPDATE coaching.exercise_definition_v1
  SET provenance_json=jsonb_set(
        provenance_json,
        '{primaryIdentitySource}',
        to_jsonb('https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed'::TEXT),
        TRUE
      ) || jsonb_build_object(
        'primaryIdentitySourceStatus','candidate_research_evidence_unreviewed',
        'primaryIdentityProvenanceCorrection',migration_key,
        'externalPlaybackVerificationPerformed',FALSE,
        'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE,
        'publicationQuarantined',TRUE
      ),
      updated_at=now()
  WHERE id=definition_id_value;
  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_definition_v1
    WHERE id=definition_id_value
      AND provenance_json->>'primaryIdentitySource'='https://worldathletics.org/personal-best/performance/jereem-richards-games-drills-develop-speed'
      AND provenance_json->>'primaryIdentityProvenanceCorrection'=migration_key
      AND provenance_json->>'approvalsCreated'='false'
      AND provenance_json->>'publicationQuarantined'='true'
  ) THEN
    RAISE EXCEPTION '% failed to persist candidate-only provenance correction', migration_key;
  END IF;
END;
$ankle_pogo_primary_identity_provenance_correction$;
