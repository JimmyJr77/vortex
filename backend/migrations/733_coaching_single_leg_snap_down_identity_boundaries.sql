-- The unilateral non-flight snap-down shares words with landing and hopping
-- cards, but its contact sequence and direction remain identity-bearing.
DO $single_leg_snap_down_identity_boundaries$
DECLARE
  migration_key CONSTANT TEXT := '733_coaching_single_leg_snap_down_identity_boundaries';
  snap_down_id UUID;
  other_id UUID;
  item RECORD;
BEGIN
  SELECT id INTO snap_down_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='single-leg-snap-down-stick' AND status='review';
  IF snap_down_id IS NULL THEN RAISE EXCEPTION '% requires active single-leg snap-down card', migration_key; END IF;
  FOR item IN SELECT * FROM (VALUES
    ('drop-landing-to-stick','Drop Landing to Stick includes a drop/flight or external-height landing contract; Single-Leg Snap-Down starts and remains grounded on the declared leg without intentional flight.','nonflight_same_leg_snap_down_vs_drop_or_flight_landing'),
    ('single-leg-quarter-turn-hop-to-stick','Single-Leg Quarter-Turn Hop to Stick includes unilateral flight and a declared 90-degree rotation; Single-Leg Snap-Down has no flight or rotation.','nonflight_nonrotational_snap_down_vs_unilateral_quarter_turn_hop'),
    ('single-leg-lateral-hop-to-stick','Single-Leg Lateral Hop to Stick includes lateral unilateral flight; Single-Leg Snap-Down has no flight and no travel.','nonflight_stationary_snap_down_vs_lateral_unilateral_hop')
  ) AS boundaries(other_slug,rationale,boundary) LOOP
    SELECT id INTO other_id FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug=item.other_slug AND status='review';
    IF other_id IS NULL THEN RAISE EXCEPTION '% requires active card %', migration_key,item.other_slug; END IF;
    IF EXISTS (SELECT 1 FROM coaching.exercise_identity_resolution_v1 WHERE survivor_definition_id=snap_down_id AND resolved_definition_id=other_id AND (resolution_source='human_review' OR reviewed_by IS NOT NULL)) THEN RAISE EXCEPTION '% refuses to overwrite human decision for %', migration_key,item.other_slug; END IF;
    INSERT INTO coaching.exercise_identity_resolution_v1(facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
    VALUES (1,snap_down_id,other_id,'distinct_exercises',item.rationale,jsonb_build_object('identityBoundary',item.boundary,'decisionScope','identity_only_not_human_approval','humanReviewRequired',TRUE,'approvalsCreated',FALSE,'migration',migration_key),'deterministic_identity_equivalence',NULL,now())
    ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now() WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review' AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;
  END LOOP;
END;
$single_leg_snap_down_identity_boundaries$;
