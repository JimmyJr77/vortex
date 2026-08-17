-- Preserve the existing anatomy content while exposing the canonical keys
-- consumed by selection and audit code.  This is a lossless review-only
-- schema normalization: phased joint-action objects are retained alongside a
-- flattened canonical array, and legacy muscle/action aliases remain intact.
UPDATE coaching.exercise_definition_v1 d
SET anatomy_json = d.anatomy_json
  || CASE
    WHEN jsonb_typeof(d.anatomy_json->'primaryMuscles') IS DISTINCT FROM 'array'
      AND jsonb_typeof(d.anatomy_json->'primaryMusclesAndTissues')='array'
    THEN jsonb_build_object('primaryMuscles', d.anatomy_json->'primaryMusclesAndTissues')
    ELSE '{}'::jsonb
  END
  || CASE
    WHEN jsonb_typeof(d.anatomy_json->'jointActions')='object'
    THEN jsonb_build_object(
      'jointActionPhases', d.anatomy_json->'jointActions',
      'jointActions', jsonb_path_query_array(d.anatomy_json, '$.jointActions.*[*]')
    )
    WHEN jsonb_typeof(d.anatomy_json->'jointActions') IS DISTINCT FROM 'array'
      AND jsonb_typeof(d.anatomy_json->'actions')='array'
    THEN jsonb_build_object('jointActions', d.anatomy_json->'actions')
    ELSE '{}'::jsonb
  END,
  updated_at=now()
WHERE d.facility_id=1
  AND d.status='review'
  AND d.reviewed_by IS NULL
  AND d.approved_by IS NULL
  AND d.last_reviewed_at IS NULL
  AND (
    (jsonb_typeof(d.anatomy_json->'primaryMuscles') IS DISTINCT FROM 'array'
      AND jsonb_typeof(d.anatomy_json->'primaryMusclesAndTissues')='array')
    OR jsonb_typeof(d.anatomy_json->'jointActions')='object'
    OR (jsonb_typeof(d.anatomy_json->'jointActions') IS DISTINCT FROM 'array'
      AND jsonb_typeof(d.anatomy_json->'actions')='array')
  )
  AND NOT EXISTS (
    SELECT 1 FROM coaching.exercise_section_evidence_v1 e
    WHERE e.definition_id=d.id
      AND (e.reviewer_user_id IS NOT NULL OR e.review_status NOT IN ('candidate','superseded'))
  );
