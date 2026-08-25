-- Delivery profiles must declare equipment explicitly.  For review-only,
-- unreviewed bodyweight profiles, the controlled `none` key is the required
-- sentinel; do not infer equipment for any reviewed or published content.
UPDATE coaching.exercise_delivery_profile_v1 p
SET equipment_required=ARRAY['none']::TEXT[], updated_at=now()
FROM coaching.exercise_variant_v1 v
JOIN coaching.exercise_definition_v1 d ON d.id=v.definition_id
WHERE p.variant_id=v.id
  AND d.facility_id=1
  AND d.status='review'
  AND v.status='review'
  AND p.status='review'
  AND cardinality(p.equipment_required)=0
  AND d.reviewed_by IS NULL
  AND d.approved_by IS NULL
  AND d.last_reviewed_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM coaching.exercise_section_evidence_v1 e
    WHERE e.definition_id=d.id
      AND (e.reviewer_user_id IS NOT NULL OR e.review_status NOT IN ('candidate','superseded'))
  )
  AND NOT EXISTS (
    SELECT 1 FROM coaching.exercise_media_candidate_v1 m
    WHERE m.definition_id=d.id
      AND (m.reviewer_user_id IS NOT NULL OR m.reviewed_at IS NOT NULL OR m.review_status NOT IN ('candidate','superseded'))
  );
