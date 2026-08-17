-- Close the name-similarity pair surfaced by the hardened Nordic Hamstring
-- family. This is an identity-only, review-quarantined decision; it creates no
-- card, graph, calibration, media, content, or publication approval.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '465_coaching_nordic_reverse_nordic_identity_closure';
  nordic_id UUID;
  reverse_nordic_id UUID;
BEGIN
  SELECT definition_id INTO nordic_id FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=4;
  SELECT definition_id INTO reverse_nordic_id FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=575;
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=nordic_id AND slug='nordic-hamstring-curl' AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=reverse_nordic_id AND slug='reverse-nordic-curl' AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=575
      AND slug='reverse-nordic-curl'
      AND movement_requirements->'primary_tissues' ? 'quadriceps'
      AND movement_requirements->'primary_joint_actions' ? 'knee_flexion_eccentric') THEN
    RAISE EXCEPTION '% prerequisite Nordic identities are missing or drifted',
      migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE ((resolution.survivor_definition_id=nordic_id
          AND resolution.resolved_definition_id=reverse_nordic_id)
        OR (resolution.survivor_definition_id=reverse_nordic_id
          AND resolution.resolved_definition_id=nordic_id))
        AND resolution.decision<>'distinct_exercises') THEN
    RAISE EXCEPTION '% conflicts with an existing Nordic identity decision',
      migration_key;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(
    1,nordic_id,reverse_nordic_id,'distinct_exercises',
    'Nordic Hamstring Curl is a forward-fall, bilateral ankle-anchored knee-flexor family: the knees extend during lowering while the hamstrings act eccentrically, or the knee flexors hold or return the body. Reverse Nordic Curl is a backward-lean knee-extensor task: the knees flex during lowering while the quadriceps act eccentrically. Loaded tissues, visible joint motion, force direction, anchor, balance, range, failure handling, fatigue, and substitutions differ.',
    jsonb_build_object(
      'migration',migration_key,
      'identityBoundary','forward_ankle_anchored_knee_flexor_nordic_vs_backward_kneeling_knee_extensor_reverse_nordic',
      'variantDimensions',jsonb_build_array(
        'loaded_tissues','joint_motion','muscle_action','lean_direction','ankle_anchor',
        'balance','range','failure_handling','fatigue','substitution'),
      'nordicEvidence',jsonb_build_object(
        'definitionId',nordic_id,
        'migration','464_coaching_nordic_hamstring_family_audit_hardening',
        'action','bilateral_knee_extension_during_eccentric_hamstring_loading'),
      'reverseNordicEvidence',jsonb_build_object(
        'definitionId',reverse_nordic_id,
        'legacyExerciseId',575,
        'primaryTissues',jsonb_build_array('quadriceps','hip_flexors','core'),
        'primaryJointAction','knee_flexion_eccentric'),
      'evidenceSource','current_authored_nordic_contract_and_reverse_nordic_legacy_movement_requirements',
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
      'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
      'reverseNordicCanonicalAuditStillRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_exact_identity',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.survivor_definition_id=nordic_id
        AND resolution.resolved_definition_id=reverse_nordic_id
        AND resolution.decision='distinct_exercises'
        AND resolution.reviewed_by IS NULL
        AND resolution.evidence_json->>'migration'=migration_key
        AND resolution.evidence_json->>'approvalsCreated'='false')<>1 THEN
    RAISE EXCEPTION '% did not close the Nordic identity boundary',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.evidence_json->>'migration'=migration_key
        AND coaching.exercise_json_has_level_classification(
          resolution.evidence_json)) THEN
    RAISE EXCEPTION '% created forbidden exercise level metadata',migration_key;
  END IF;
END;
$$;
