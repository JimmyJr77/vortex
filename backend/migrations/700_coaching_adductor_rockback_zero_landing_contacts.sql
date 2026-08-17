-- Exact adductor-rockback variants use controlled floor support and rocking,
-- not landings.  Record zero landing contacts explicitly; this does not
-- suppress support/floor-contact exposure tracked elsewhere on the card.
UPDATE coaching.exercise_variant_v1 v
SET load_profile_json=jsonb_set(v.load_profile_json, '{landingContactsPerRep}', '0'::jsonb, true),
    updated_at=now()
FROM coaching.exercise_definition_v1 d
WHERE v.definition_id=d.id
  AND d.facility_id=1
  AND d.slug='adductor-rockback'
  AND d.status='review'
  AND v.status='review'
  AND d.reviewed_by IS NULL
  AND d.approved_by IS NULL
  AND d.last_reviewed_at IS NULL
  AND v.load_profile_json->>'landingContactsPerRep' IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM coaching.exercise_section_evidence_v1 e
    WHERE e.definition_id=d.id
      AND (e.reviewer_user_id IS NOT NULL OR e.review_status NOT IN ('candidate','superseded'))
  );
