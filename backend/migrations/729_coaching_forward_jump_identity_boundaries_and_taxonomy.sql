-- Remove an obstacle-only alternate key from the no-obstacle card and record
-- the identity-bearing boundaries exposed by its explicit bilateral aliases.
DO $forward_jump_identity_boundaries_and_taxonomy$
DECLARE
  migration_key CONSTANT TEXT := '729_coaching_forward_jump_identity_boundaries_and_taxonomy';
  forward_id UUID;
  other_id UUID;
  item RECORD;
BEGIN
  SELECT id INTO forward_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='forward-hop-to-stick-low-amplitude' AND status='review';
  IF forward_id IS NULL THEN
    RAISE EXCEPTION '% requires the active Low-Amplitude Forward Jump to Stick card', migration_key;
  END IF;
  IF EXISTS (SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=forward_id AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% refuses to change a human-reviewed card', migration_key;
  END IF;
  UPDATE coaching.exercise_definition_v1
  SET optional_equipment=array_remove(optional_equipment,'low_hurdle'),
      provenance_json=provenance_json || jsonb_build_object('taxonomyCorrection',migration_key,'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
      updated_at=now()
  WHERE id=forward_id;
  IF EXISTS (SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=forward_id AND 'low_hurdle'=ANY(optional_equipment)) THEN
    RAISE EXCEPTION '% failed to remove alternate-only low_hurdle taxonomy from the no-obstacle card', migration_key;
  END IF;
  FOR item IN SELECT * FROM (VALUES
    ('lateral-bound','Opposite-Leg Lateral Bound to Stick uses unilateral opposite-leg flight and lateral projection; the reviewed card uses bilateral takeoff/landing and sagittal forward travel.','bilateral_sagittal_forward_jump_vs_unilateral_lateral_opposite_leg_bound'),
    ('bilateral-360-degree-jump-to-stick','Bilateral 360-Degree Jump to Stick requires a full whole-body rotation and declared final heading; the reviewed card is non-rotational low-amplitude forward travel.','nonrotational_forward_jump_vs_full_360_degree_rotating_jump'),
    ('bilateral-lateral-low-hurdle-jump-to-stick','Bilateral Lateral Low-Hurdle Jump to Stick requires lateral obstacle clearance and a collapsible hurdle; the reviewed card has no obstacle and travels forward.','forward_no_obstacle_jump_vs_lateral_low_hurdle_clearance'),
    ('single-leg-forward-hop-to-stick','Single-Leg Forward Hop to Stick uses same-leg unilateral takeoff and landing; the reviewed card requires two-foot takeoff and two-foot landing.','bilateral_two_foot_jump_vs_same_leg_unilateral_hop'),
    ('bound-to-stick','Opposite-Leg Forward Bound to Stick uses unilateral support, opposite-leg landing, and a free-foot no-touch contract; the reviewed card requires bilateral takeoff and bilateral landing.','bilateral_two_foot_jump_vs_opposite_leg_forward_bound')
  ) AS boundaries(other_slug,rationale,boundary) LOOP
    SELECT id INTO other_id FROM coaching.exercise_definition_v1
    WHERE facility_id=1 AND slug=item.other_slug AND status='review';
    IF other_id IS NULL THEN
      RAISE EXCEPTION '% requires active review card %', migration_key,item.other_slug;
    END IF;
    IF EXISTS (SELECT 1 FROM coaching.exercise_identity_resolution_v1 WHERE survivor_definition_id=forward_id AND resolved_definition_id=other_id AND (resolution_source='human_review' OR reviewed_by IS NOT NULL)) THEN
      RAISE EXCEPTION '% refuses to overwrite human decision for %', migration_key,item.other_slug;
    END IF;
    INSERT INTO coaching.exercise_identity_resolution_v1(facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
    VALUES (1,forward_id,other_id,'distinct_exercises',item.rationale,jsonb_build_object('identityBoundary',item.boundary,'decisionScope','identity_only_not_human_approval','humanReviewRequired',TRUE,'approvalsCreated',FALSE,'migration',migration_key),'deterministic_identity_equivalence',NULL,now())
    ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE
      SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now()
    WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review' AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;
  END LOOP;
END;
$forward_jump_identity_boundaries_and_taxonomy$;
