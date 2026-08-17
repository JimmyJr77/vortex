-- Backfill explicit review provenance for archived sources whose own legacy
-- descriptions record unresolved identity facts. This does not synthesize a
-- selectable task, modify difficulty, add media, or create approvals.
WITH source_ids(legacy_exercise_id) AS (
  VALUES
    (202::bigint),(222),(267),(269),(270),(430),(490),(491),(585),(627),
    (714),(726),(774),(840),(947),(948),(956),(963),(969),(982),(985),(994),
    (1062),(1085),(1088),(1090),(1103),(1107),(1130),(1133),(1142),(1322),
    (1348),(1378),(1441),(1448),(1451),(1469),(1488),(1489),(1495),(1500),
    (1506),(1512),(1539),(1567),(1571),(1573),(1669)
), affected_definitions AS (
  SELECT DISTINCT d.id
  FROM coaching.exercise_definition_source_v1 source
  JOIN coaching.exercise_definition_v1 d ON d.id=source.definition_id
  JOIN source_ids ids ON ids.legacy_exercise_id=source.legacy_exercise_id
  WHERE d.facility_id=1
    AND d.status='archived'
    AND coalesce(d.provenance_json ->> 'reviewDispositionVersion','') <> '2026-08-11.archived-identity-backfill-v1'
)
UPDATE coaching.exercise_definition_v1 definition
SET card_version=definition.card_version+1,
    provenance_json=coalesce(definition.provenance_json,'{}'::jsonb)
      || jsonb_build_object(
        'sourceDisposition','identity_quarantine',
        'reviewDispositionVersion','2026-08-11.archived-identity-backfill-v1',
        'reviewBasis','Legacy description documents unresolved identity facts; no exact task was synthesized.',
        'humanReviewRequired',true,
        'approvalsCreated',false,
        'publicationQuarantined',true
      )
WHERE definition.id IN (SELECT id FROM affected_definitions);

WITH source_ids(legacy_exercise_id) AS (
  VALUES
    (202::bigint),(222),(267),(269),(270),(430),(490),(491),(585),(627),
    (714),(726),(774),(840),(947),(948),(956),(963),(969),(982),(985),(994),
    (1062),(1085),(1088),(1090),(1103),(1107),(1130),(1133),(1142),(1322),
    (1348),(1378),(1441),(1448),(1451),(1469),(1488),(1489),(1495),(1500),
    (1506),(1512),(1539),(1567),(1571),(1573),(1669)
)
UPDATE coaching.exercise_variant_v1 variant
SET programming_profile_json=coalesce(variant.programming_profile_json,'{}'::jsonb)
      || jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
WHERE variant.definition_id IN (
  SELECT DISTINCT d.id
  FROM coaching.exercise_definition_source_v1 source
  JOIN coaching.exercise_definition_v1 d ON d.id=source.definition_id
  JOIN source_ids ids ON ids.legacy_exercise_id=source.legacy_exercise_id
  WHERE d.facility_id=1 AND d.status='archived'
);
