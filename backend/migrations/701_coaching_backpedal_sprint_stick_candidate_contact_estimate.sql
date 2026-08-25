-- The sibling backpedal-to-sprint-turn family uses an 8-contact candidate
-- estimate for the same backward-run, turn, and forward-sprint unit across a
-- wider declared distance range.  Carry that estimate to the stick variants
-- only as review-only planning input; actual contacts remain logged and human
-- calibration is still required before publication.
UPDATE coaching.exercise_variant_v1 v
SET load_profile_json = v.load_profile_json || jsonb_build_object(
      'landingContactsPerRep', 8,
      'contactEstimate', jsonb_build_object(
        'status', 'candidate',
        'basis', 'backpedal_to_sprint_turn_review_variant_candidate_estimate',
        'scope', 'one exact backward-run_turn_forward-sprint_terminal-stick repetition',
        'actualContactsMustBeRecorded', true,
        'humanCalibrationRequired', true
      )
    ),
    updated_at=now()
FROM coaching.exercise_definition_v1 d
WHERE v.definition_id=d.id
  AND d.facility_id=1
  AND d.slug='backpedal-to-sprint-to-stick'
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
