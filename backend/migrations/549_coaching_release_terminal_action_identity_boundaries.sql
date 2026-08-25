-- Separate cards whose release, catch, terminal action, or target joint differs.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '549_coaching_release_terminal_action_identity_boundaries';
  cards JSONB;
BEGIN
  SELECT jsonb_object_agg(slug,id) INTO cards FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND status='review' AND slug IN(
    'medicine-ball-rotational-toss-to-lateral-bound','slam-ball-rotational-slam','medicine-ball-rebound-slam-to-catch',
    'medicine-ball-side-toss-with-step','barbell-rollout','medicine-ball-shot-put-throw','standing-calf-raise','tibialis-raise-eccentric-lower');
  IF cards IS NULL OR NOT cards ?& ARRAY['medicine-ball-rotational-toss-to-lateral-bound','slam-ball-rotational-slam','medicine-ball-rebound-slam-to-catch','medicine-ball-side-toss-with-step','barbell-rollout','medicine-ball-shot-put-throw','standing-calf-raise','tibialis-raise-eccentric-lower']::TEXT[] THEN
    RAISE EXCEPTION '% requires eight active exact definitions',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 r WHERE
    ((r.survivor_definition_id=(cards->>'medicine-ball-rotational-toss-to-lateral-bound')::uuid AND r.resolved_definition_id=(cards->>'slam-ball-rotational-slam')::uuid)
    OR (r.survivor_definition_id=(cards->>'medicine-ball-rebound-slam-to-catch')::uuid AND r.resolved_definition_id=(cards->>'slam-ball-rotational-slam')::uuid)
    OR (r.survivor_definition_id=(cards->>'medicine-ball-side-toss-with-step')::uuid AND r.resolved_definition_id=(cards->>'slam-ball-rotational-slam')::uuid)
    OR (r.survivor_definition_id=(cards->>'barbell-rollout')::uuid AND r.resolved_definition_id=(cards->>'medicine-ball-shot-put-throw')::uuid)
    OR (r.survivor_definition_id=(cards->>'standing-calf-raise')::uuid AND r.resolved_definition_id=(cards->>'tibialis-raise-eccentric-lower')::uuid))
    AND (r.reviewed_by IS NOT NULL OR r.resolution_source='human_review')) THEN
    RAISE EXCEPTION '% refuses to overwrite a human-reviewed identity decision',migration_key;
  END IF;
  INSERT INTO coaching.exercise_identity_resolution_v1(facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,(cards->>left_slug)::uuid,(cards->>right_slug)::uuid,'distinct_exercises',rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',boundary,'automaticSubstitution',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    ('medicine-ball-rotational-toss-to-lateral-bound','slam-ball-rotational-slam','rotational_toss_lateral_bound_vs_floor_slam','Rotational Toss to Lateral Bound combines a ballistic toss with a lateral bound and landing. Rotational Ball Slam releases to the floor and retrieves. Target, contacts, landing exposure, terminal action, and station controls differ.'),
    ('medicine-ball-rebound-slam-to-catch','slam-ball-rotational-slam','rebound_slam_catch_vs_floor_slam','Rebound Slam to Catch requires an incoming rebound catch and deceleration after the slam. Rotational Ball Slam has no required catch. Ball behavior, perception demand, terminal action, and safety controls differ.'),
    ('medicine-ball-side-toss-with-step','slam-ball-rotational-slam','side_toss_step_vs_floor_slam','Side Toss with Step uses a lateral step and ballistic side release. Rotational Ball Slam uses a floor-directed slam. Release direction, target, footwork, and retrieval differ.'),
    ('barbell-rollout','medicine-ball-shot-put-throw','barbell_rollout_vs_ballistic_shot_put','Barbell Rollout is a closed-chain rolling trunk exercise with hands on a barbell and no projectile release. Medicine-Ball Shot-Put Throw is a unilateral ballistic release. Contacts, loading, action, and station requirements differ.'),
    ('standing-calf-raise','tibialis-raise-eccentric-lower','plantarflexion_raise_vs_dorsiflexion_eccentric_lower','Standing Calf Raise is a plantarflexion raise from forefoot support. Tibialis Raise Eccentric Lower emphasizes controlled lowering from dorsiflexion. Primary action, range direction, setup, and loading intent differ.')
  ) i(left_slug,right_slug,boundary,rationale)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=EXCLUDED.resolved_at;
  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1 WHERE resolution_source='deterministic_identity_equivalence' AND evidence_json->>'migration'=migration_key AND decision='distinct_exercises')<>5 THEN
    RAISE EXCEPTION '% identity-boundary assertions failed',migration_key;
  END IF;
END
$migration$;
