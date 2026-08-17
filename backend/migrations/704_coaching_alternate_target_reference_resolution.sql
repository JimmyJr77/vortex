-- Candidate alternate assessments may point to a prior definition UUID. Those
-- references are advisory, not foreign keys, so distinguish live targets from
-- archived or missing ones before reviewers use them to decide whether a new
-- card is required. This never creates or approves a definition.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_alternate_assessment_v1 a
    JOIN coaching.exercise_definition_v1 d
      ON d.id=a.definition_id
     AND d.card_version=a.reviewed_card_version
    WHERE d.facility_id=1
      AND d.status='review'
      AND a.classification='new_definition'
      AND COALESCE(a.distinguishing_dimensions->>'targetDefinitionId','')<>''
      AND (
        a.review_status <> 'candidate'
        OR a.reviewer_user_id IS NOT NULL
        OR a.reviewed_at IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION
      'Cannot normalize candidate target references after human alternate review has started.';
  END IF;
END $$;

WITH target_resolution AS (
  SELECT
    a.id,
    a.distinguishing_dimensions->>'targetDefinitionId' AS source_target_id,
    CASE
      WHEN target.id IS NOT NULL AND target.status='review' THEN 'active_current_definition'
      WHEN target.id IS NOT NULL THEN 'archived_requires_human_triage'
      ELSE 'missing_requires_human_triage'
    END AS resolution,
    COALESCE(target.status, 'missing') AS target_status
  FROM coaching.exercise_alternate_assessment_v1 a
  JOIN coaching.exercise_definition_v1 d
    ON d.id=a.definition_id
   AND d.card_version=a.reviewed_card_version
  LEFT JOIN coaching.exercise_definition_v1 target
    ON target.id::text=a.distinguishing_dimensions->>'targetDefinitionId'
   AND target.facility_id=d.facility_id
  WHERE d.facility_id=1
    AND d.status='review'
    AND a.classification='new_definition'
    AND a.review_status='candidate'
    AND a.reviewer_user_id IS NULL
    AND a.reviewed_at IS NULL
    AND COALESCE(a.distinguishing_dimensions->>'targetDefinitionId','')<>''
)
UPDATE coaching.exercise_alternate_assessment_v1 a
SET distinguishing_dimensions=a.distinguishing_dimensions || jsonb_build_object(
      'targetDefinitionResolution', resolution.resolution,
      'targetDefinitionStatusAtResolution', resolution.target_status,
      'sourceTargetDefinitionId', resolution.source_target_id
    ),
    updated_at=now()
FROM target_resolution resolution
WHERE a.id=resolution.id;
