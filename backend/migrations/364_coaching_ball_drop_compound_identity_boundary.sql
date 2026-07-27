-- Keep the two remaining Ball Drop compound tasks distinct.
--
-- Reaction Ball Drop Catch to Cut requires capture followed by a called exit
-- cut. Reaction Ball Drop to Hop-and-Go requires a hop contact followed by
-- acceleration and does not require the capture-then-cut sequence.
--
-- This changes identity-queue state only. It creates no exercise proficiency
-- metadata, card approval, media approval, graph approval, calibration
-- approval, or publication approval. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '364_coaching_ball_drop_compound_identity_boundary';
  catch_cut_id UUID;
  hop_go_id UUID;
  facility BIGINT;
BEGIN
  SELECT id, facility_id
  INTO catch_cut_id, facility
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'reaction-ball-drop-catch-to-cut'
    AND status <> 'archived';

  SELECT id
  INTO hop_go_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = facility
    AND slug = 'reaction-ball-drop-to-hop-and-go'
    AND status <> 'archived';

  IF catch_cut_id IS NULL OR hop_go_id IS NULL THEN
    RAISE EXCEPTION
      '% requires active catch-to-cut and hop-and-go definitions',
      migration_key;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE (
      (
        resolution.survivor_definition_id = catch_cut_id
        AND resolution.resolved_definition_id = hop_go_id
      )
      OR (
        resolution.survivor_definition_id = hop_go_id
        AND resolution.resolved_definition_id = catch_cut_id
      )
    )
      AND (
        resolution.decision <> 'distinct_exercises'
        OR resolution.resolution_source = 'human_review'
      )
  ) THEN
    RAISE EXCEPTION
      '% conflicts with protected identity decision',
      migration_key;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1 (
    facility_id,
    survivor_definition_id,
    resolved_definition_id,
    decision,
    rationale,
    evidence_json,
    resolution_source,
    reviewed_by,
    resolved_at
  )
  VALUES (
    facility,
    catch_cut_id,
    hop_go_id,
    'distinct_exercises',
    'Reaction Ball Drop Catch to Cut requires the athlete to track and secure the dropped ball before processing or executing a called exit cut. Reaction Ball Drop to Hop-and-Go requires a visually cued hop contact followed by acceleration. Capture-then-cut and hop-then-accelerate have different ordered actions, contacts, equipment outcomes, prerequisites, load, fatigue, coaching, quality gates, and stop rules.',
    jsonb_build_object(
      'match', 'different_ordered_action_sequences',
      'leftSlug', 'reaction-ball-drop-catch-to-cut',
      'rightSlug', 'reaction-ball-drop-to-hop-and-go',
      'identityBoundary',
        'capture_then_called_cut_vs_hop_contact_then_acceleration',
      'researchSourceKeys', jsonb_build_array(
        'ball_catching_visual_information',
        'agility_perception_action_meta_analysis',
        'sprint_acceleration_hamstrings'
      ),
      'researchSources', jsonb_build_array(
        'https://pubmed.ncbi.nlm.nih.gov/23435115/',
        'https://pubmed.ncbi.nlm.nih.gov/41710443/',
        'https://pubmed.ncbi.nlm.nih.gov/26733889/'
      ),
      'exerciseDifficultyModel',
        'max_exercise_complexity_physical_difficulty',
      'humanReviewRequired', TRUE,
      'publicationQuarantined', TRUE,
      'decisionScope',
        'identity_only_not_card_media_graph_calibration_or_publication_approval',
      'migration', migration_key
    ),
    'deterministic_identity_equivalence',
    NULL,
    now()
  )
  ON CONFLICT (
    survivor_definition_id,
    resolved_definition_id
  )
  DO UPDATE SET
    decision = EXCLUDED.decision,
    rationale = EXCLUDED.rationale,
    evidence_json = EXCLUDED.evidence_json,
    resolution_source = EXCLUDED.resolution_source,
    reviewed_by = NULL,
    resolved_at = now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source
    <> 'human_review';

  IF NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE (
      (
        resolution.survivor_definition_id = catch_cut_id
        AND resolution.resolved_definition_id = hop_go_id
      )
      OR (
        resolution.survivor_definition_id = hop_go_id
        AND resolution.resolved_definition_id = catch_cut_id
      )
    )
      AND resolution.decision = 'distinct_exercises'
  ) THEN
    RAISE EXCEPTION
      '% did not persist the distinct identity decision',
      migration_key;
  END IF;
END;
$$;
