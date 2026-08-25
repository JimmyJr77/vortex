-- Research-authored cards without a legacy ID must expose one explicit primary
-- identity source.  Derive it from their existing candidate `identity`
-- evidence rather than inventing a new provenance claim.
WITH primary_identity_source AS (
  SELECT DISTINCT ON (d.id) d.id AS definition_id, e.source_url
  FROM coaching.exercise_definition_v1 d
  JOIN coaching.exercise_section_evidence_v1 e ON e.definition_id=d.id
  WHERE d.facility_id=1
    AND d.status='review'
    AND d.legacy_exercise_id IS NULL
    AND d.provenance_json->>'canonicalAuthoredFromResearch'='true'
    AND COALESCE(d.provenance_json->>'primaryIdentitySource','')=''
    AND e.section_key='identity'
    AND e.review_status IN ('candidate','superseded')
    AND e.reviewer_user_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM coaching.exercise_section_evidence_v1 reviewed_evidence
      WHERE reviewed_evidence.definition_id=d.id
        AND (reviewed_evidence.reviewer_user_id IS NOT NULL OR reviewed_evidence.review_status NOT IN ('candidate','superseded'))
    )
  ORDER BY d.id, e.evidence_quality DESC, e.source_url
)
UPDATE coaching.exercise_definition_v1 d
SET provenance_json=d.provenance_json || jsonb_build_object(
      'primaryIdentitySource', source.source_url,
      'primaryIdentitySourceStatus', 'candidate_research_evidence_unreviewed'
    ),
    updated_at=now()
FROM primary_identity_source source
WHERE d.id=source.definition_id
  AND d.reviewed_by IS NULL
  AND d.approved_by IS NULL
  AND d.last_reviewed_at IS NULL;
