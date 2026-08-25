-- Close the three name-similarity pairs surfaced by the hardened Front Plank
-- family. These identity-only decisions create no card, media, graph,
-- calibration, content, or publication approval.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '468_coaching_front_plank_similarity_closure';
  front_plank_id UUID;
  bear_plank_id UUID;
  glute_bridge_id UUID;
  side_plank_id UUID;
BEGIN
  SELECT definition_id INTO front_plank_id FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=240;
  SELECT id INTO bear_plank_id FROM coaching.exercise_definition_v1 WHERE slug='bear-plank-hold';
  SELECT id INTO glute_bridge_id FROM coaching.exercise_definition_v1 WHERE slug='glute-bridge';
  SELECT id INTO side_plank_id FROM coaching.exercise_definition_v1 WHERE slug='side-plank';
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=front_plank_id AND slug='front-plank' AND status<>'archived' AND family_key='prone_bilateral_forearm_front_support_isometric_anti_extension')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=bear_plank_id AND slug='bear-plank-hold' AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=glute_bridge_id AND slug='glute-bridge' AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=side_plank_id AND slug='side-plank' AND status<>'archived') THEN
    RAISE EXCEPTION '% prerequisite identities are missing or drifted',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.survivor_definition_id=front_plank_id
        AND resolution.resolved_definition_id=ANY(ARRAY[bear_plank_id,glute_bridge_id,side_plank_id]::UUID[])
        AND resolution.decision<>'distinct_exercises') THEN
    RAISE EXCEPTION '% conflicts with an existing Front Plank identity decision',migration_key;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,front_plank_id,p.other_id,'distinct_exercises',p.rationale,
    jsonb_build_object(
      'migration',migration_key,'identityBoundary',p.boundary,
      'variantDimensions',p.dimensions,
      'frontPlankEvidence',jsonb_build_object(
        'definitionId',front_plank_id,
        'migration','467_coaching_front_plank_family_audit_hardening',
        'contract','prone_bilateral_forearm_and_toe_isometric_anti_extension'),
      'neighborEvidence',jsonb_build_object(
        'definitionId',p.other_id,'slug',p.other_slug,'contract',p.other_contract),
      'evidenceSource','current_authored_front_plank_contract_and_existing_neighbor_canonical_identity',
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
      'decisionScope','identity_only_not_card_media_graph_calibration_content_or_publication_approval',
      'neighborCanonicalAuditStillRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_exact_identity',NULL,now()
  FROM (VALUES
    (bear_plank_id,'bear-plank-hold','quadruped_flexed_knee_hand_foot_bear_support_vs_prone_extended_body_forearm_toe_front_support',jsonb_build_array('orientation','upper_support','lower_support','hip_angle','knee_angle','lever','load_distribution','entry','exit'),'quadruped hands-and-feet support with flexed hips and knees hovering below the pelvis','Bear Plank Hold uses a quadruped hand-and-foot base with flexed hips and knees hovering below the pelvis. Front Plank uses a long prone forearm-and-toe line with extended hips and knees. Orientation, contacts, joint angles, lever, load distribution, entry, exit, and fault criteria differ.'),
    (glute_bridge_id,'glute-bridge','supine_dynamic_hip_extension_bridge_vs_prone_static_forearm_toe_anti_extension',jsonb_build_array('orientation','support','primary_joint_action','contraction','repetition_boundary','loaded_tissues','entry','exit'),'supine dynamic bilateral hip-extension cycle supported by upper back and feet','Glute Bridge is a supine dynamic hip-extension cycle supported by the upper back and feet. Front Plank is a prone static anti-extension hold supported by forearms and toes. Orientation, support contacts, primary action, contraction, repetition boundary, loaded tissues, entry, and exit differ; the alias prone bridge does not make it a glute bridge.'),
    (side_plank_id,'side-plank','unilateral_lateral_anti_flexion_support_vs_bilateral_prone_anti_extension_support',jsonb_build_array('orientation','laterality','plane','upper_support','lower_support','primary_anti_motion','loaded_tissues','side_dose'),'side-lying unilateral forearm-and-foot anti-lateral-flexion support with per-side dose','Side Plank uses unilateral lateral forearm-and-foot support and primarily resists lateral flexion with a per-side dose. Front Plank uses bilateral prone forearm-and-toe support and primarily resists extension. Orientation, laterality, plane, contacts, loaded tissues, failure response, and dosage differ.')
  ) p(other_id,other_slug,boundary,dimensions,other_contract,rationale)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.survivor_definition_id=front_plank_id
        AND resolution.resolved_definition_id=ANY(ARRAY[bear_plank_id,glute_bridge_id,side_plank_id]::UUID[])
        AND resolution.decision='distinct_exercises'
        AND resolution.reviewed_by IS NULL
        AND resolution.evidence_json->>'migration'=migration_key
        AND resolution.evidence_json->>'approvalsCreated'='false')<>3 THEN
    RAISE EXCEPTION '% did not close all Front Plank similarity boundaries',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.evidence_json->>'migration'=migration_key
        AND coaching.exercise_json_has_level_classification(resolution.evidence_json)) THEN
    RAISE EXCEPTION '% created forbidden exercise level metadata',migration_key;
  END IF;
END;
$$;
