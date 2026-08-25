-- Close the exact name-similarity neighbors surfaced by migration 437 and
-- retire the underspecified Single-Leg Rebound Hop source. The rebound label
-- does not establish direction, amplitude, contact count, repetition boundary,
-- landing contract, terminal action, exit, or reset, so no exact mapping is
-- inferred. This migration creates no media, graph, calibration, reviewer, or
-- publication approval and no exercise skill/proficiency classification.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '438_coaching_single_leg_hop_similarity_and_rebound_quarantine';
  vertical_id CONSTANT UUID :=
    '3d700ba6-9179-4560-84ea-2ad092bf432f';
  forward_id CONSTANT UUID :=
    'aaef001d-2c36-4bb4-80b0-76618e074297';
  triple_id UUID;
  lateral_hurdle_id CONSTANT UUID :=
    '9a1aa70b-9f83-4cc2-90ff-71576c8d6c8a';
  quarter_turn_id CONSTANT UUID :=
    'e6be6032-cd3d-4453-84f0-70d764c2dbe1';
  opposite_leg_bound_id UUID;
  pogo_id UUID;
  rebound_id UUID;
  protected_count INTEGER;
  completed_count INTEGER;
BEGIN
  SELECT id INTO triple_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='single-leg-triple-hop-to-stick';

  SELECT id INTO opposite_leg_bound_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='bound-to-stick';

  SELECT id INTO pogo_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='single-leg-pogo';

  SELECT id INTO rebound_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='single-leg-rebound-hop';

  IF(SELECT count(*) FROM coaching.exercise_definition_v1
     WHERE id IN(vertical_id,forward_id,triple_id,lateral_hurdle_id,
       quarter_turn_id,opposite_leg_bound_id,pogo_id,rebound_id)
       AND facility_id=1)<>8 THEN
    RAISE EXCEPTION '% cannot find all eight identity-boundary definitions',
      migration_key;
  END IF;

  SELECT count(*) INTO completed_count
  FROM coaching.exercise_identity_resolution_v1 resolution
  WHERE resolution.evidence_json->>'migration'=migration_key
    AND resolution.decision='distinct_exercises'
    AND resolution.reviewed_by IS NULL;
  IF completed_count=6
    AND EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=rebound_id AND status='archived' AND card_version=2)
    AND EXISTS(SELECT 1 FROM coaching.exercise
      WHERE facility_id=1 AND id=1142 AND archived IS TRUE
        AND is_published IS FALSE AND skill_level IS NULL)
    AND EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=rebound_id AND audit_version=migration_key
        AND status='quarantined') THEN
    RETURN;
  END IF;
  IF completed_count<>0 THEN
    RAISE EXCEPTION '% found partial prior identity closure',migration_key;
  END IF;

  SELECT count(*) INTO protected_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=rebound_id
    AND(definition.reviewed_by IS NOT NULL
      OR definition.approved_by IS NOT NULL
      OR definition.last_reviewed_at IS NOT NULL
      OR definition.approved_video_url IS NOT NULL);
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refuses to retire human-reviewed rebound state',
      migration_key;
  END IF;

  SELECT count(*) INTO protected_count
  FROM coaching.exercise_identity_resolution_v1 resolution
  WHERE(
      (resolution.survivor_definition_id=vertical_id
        AND resolution.resolved_definition_id IN(
          triple_id,lateral_hurdle_id,quarter_turn_id))
      OR(resolution.resolved_definition_id=vertical_id
        AND resolution.survivor_definition_id IN(
          triple_id,lateral_hurdle_id,quarter_turn_id))
      OR(resolution.survivor_definition_id=forward_id
        AND resolution.resolved_definition_id IN(
          triple_id,opposite_leg_bound_id,quarter_turn_id))
      OR(resolution.resolved_definition_id=forward_id
        AND resolution.survivor_definition_id IN(
          triple_id,opposite_leg_bound_id,quarter_turn_id)))
    AND(resolution.reviewed_by IS NOT NULL
      OR resolution.resolution_source='human_review');
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human identity decision(s)',
      migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=rebound_id AND review_status='candidate';

  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',exact_variant_match=NULL,
    demonstration_quality_score=NULL,reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=rebound_id AND review_status='candidate';

  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=rebound_id AND review_status='candidate';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id=variant.id
    AND variant.definition_id=rebound_id;

  UPDATE coaching.exercise_variant_v1
  SET status='archived',
    requirements_json=requirements_json||jsonb_build_object(
      'selectable',FALSE,'identityQuarantine',TRUE,
      'retirementMigration',migration_key),
    updated_at=now()
  WHERE definition_id=rebound_id;

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name='Single-Leg Rebound Hop (Unresolved Legacy)',
    display_name='Single-Leg Rebound Hop (Unresolved Legacy)',
    aliases=CASE
      WHEN 'Single-Leg Rebound Hop (Identity Unresolved)'=ANY(definition.aliases)
        THEN definition.aliases
      ELSE array_append(definition.aliases,
        'Single-Leg Rebound Hop (Identity Unresolved)') END,
    description='Archived nonprescribable source. The source suggests unilateral elastic distance-jump work, but it does not declare exact direction, amplitude, approach, contact count, same-leg versus opposite-leg landing sequence, repetition boundary, rebound policy, target, terminal landing or run-out, exit, or reset.',
    family_key='unresolved_single_leg_rebound_contact_identity',
    card_version=2,status='archived',content_confidence=96,
    scoring_confidence=1,media_confidence=35,
    movement_patterns=ARRAY['hop','rebound_possible'],
    body_regions=ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
    required_equipment=ARRAY[]::TEXT[],
    optional_equipment=ARRAY['floor_markers','video_capture'],
    environment_json=$json${"known":{"levelDryHighTractionSurfaceRequired":true,"clearLaneAndFallSpaceRequired":true},"unresolved":["direction","amplitude","approach","contact_count","landing_sequence","target","terminal_action","exit","reset"]}$json$::JSONB,
    population_json=$json${"selection":"blocked_before_exposure","reason":"movement_identity_unresolved","humanReviewRequired":true}$json$::JSONB,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'singleLegReboundQuarantineMigration',migration_key,
      'legacySourceAudited',TRUE,
      'resolution','retire_ambiguous_source_without_direct_consolidation',
      'missingIdentityFacts',TRUE,'directMappingCreated',FALSE,
      'exerciseDifficultyModel',
        'exercise_complexity_and_physical_difficulty_only',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,
    anatomy_json=$json${"known":{"regions":["foot","ankle","lower_leg","knee","hip","pelvis","trunk"],"actions":["unilateral_takeoff_or_contact","elastic_rebound_possible","some_form_of_terminal_landing_or_runout"]},"unresolved":["projection_direction","contact_sequence","takeoff_landing_relationship","rebound_policy","terminal_action"],"assignmentBlocked":true}$json$::JSONB,
    athlete_support_json=$json${"availability":"unavailable","message":"This old label does not define one executable exercise. Ask for an exact direction, contact sequence, landing pattern, and finish.","doNotAttemptFromThisCard":true}$json$::JSONB,
    coach_support_json=$json${"availability":"unavailable","adjudicationRequired":["direction","approach","takeoff_leg","landing_leg_each_contact","contact_count","amplitude","target","rebound_policy","terminal_action","exit","reset"],"doNotRenderInstructions":true,"doNotPrescribe":true}$json$::JSONB,
    support_operations_json=$json${"selection":"blocked","dosage":"blocked","duration":"blocked","logistics":"blocked","impactBudget":"blocked","fatigueBudget":"blocked","substitution":"exact_identity_required","persistence":"retain_traceability_only","humanReviewQueue":"identity_adjudication"}$json$::JSONB,
    updated_at=now()
  WHERE definition.id=rebound_id;

  UPDATE coaching.exercise
  SET archived=TRUE,is_published=FALSE,visibility='private',skill_level=NULL,
    linked_skill_id=NULL,why_publish_ready=FALSE,
    default_sets=NULL,default_reps=NULL,default_work_seconds=NULL,
    default_rest_seconds=NULL,tempo=NULL,
    load_note='Unscored unresolved identity; do not prescribe or budget.',
    description='Archived ambiguous single-leg rebound source. Direction, approach, amplitude, contact count, landing sequence, rebound policy, target, terminal action, exit, and reset require human adjudication.',
    instructions='Unavailable. Select an exact reviewed contact and direction contract; do not infer execution from this legacy label.',
    card_summary='Archived nonprescribable source retained for traceability. No direct canonical mapping or approval was created.',
    coach_language='Identity adjudication is required before instruction, difficulty, dose, substitution, selection, or publication.',
    athlete_language='This old card is unavailable because it does not define one exact movement. Ask for an exact alternative.',
    programming_logic=jsonb_build_object(
      'selection','blocked','reason','identity_unresolved',
      'migration',migration_key,
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'difficultyScored',FALSE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    scalable_variables=ARRAY[]::TEXT[],
    movement_family='unresolved_identity',primary_phase_key=NULL,
    phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object('selectionBlocked',TRUE,
      'missingIdentityFacts',jsonb_build_array('direction','approach',
        'takeoff_leg','landing_leg_each_contact','contact_count','amplitude',
        'target','rebound_policy','terminal_action','exit','reset')),
    coaching_execution=jsonb_build_object('renderInstructions',FALSE,
      'renderDose',FALSE,'renderSubstitution',FALSE),
    pairing_logic=jsonb_build_object('pairingBlocked',TRUE),
    media_library='[]'::JSONB,participant_structure='individual',
    programming_kind='exercise',updated_at=now()
  WHERE facility_id=1 AND id=1142;

  UPDATE coaching.exercise_safety_profile
  SET minimum_skill_level=NULL
  WHERE exercise_id=1142;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  VALUES
    (1,vertical_id,triple_id,'distinct_exercises',
      'The exact vertical card has one primarily vertical flight and one terminal same-leg landing. The triple-hop card declares three repeated unilateral horizontal projections followed by its final stick.',
      jsonb_build_object('migration',migration_key,
        'leftSlug','single-leg-vertical-hop-to-stick',
        'rightSlug','single-leg-triple-hop-to-stick',
        'identityBoundary','one_vertical_flight_vs_three_horizontal_hops',
        'changedDimensions',jsonb_build_array('projection_direction',
          'flight_count','intermediate_contacts','repetition_boundary',
          'fatigue_accumulation'),
        'missingIdentityFacts',FALSE,
        'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
        'exerciseDifficultyModel',
          'exercise_complexity_and_physical_difficulty_only',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,forward_id,triple_id,'distinct_exercises',
      'Both project horizontally from one leg and finish with a stick, but the exact forward-hop card has one flight and one same-leg terminal landing; the triple-hop card declares three successive projections and contacts before the final stick.',
      jsonb_build_object('migration',migration_key,
        'leftSlug','single-leg-forward-hop-to-stick',
        'rightSlug','single-leg-triple-hop-to-stick',
        'identityBoundary','one_forward_flight_vs_three_forward_hops',
        'changedDimensions',jsonb_build_array('flight_count',
          'intermediate_contacts','repetition_boundary','target_geometry',
          'fatigue_accumulation'),
        'missingIdentityFacts',FALSE,
        'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
        'exerciseDifficultyModel',
          'exercise_complexity_and_physical_difficulty_only',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,vertical_id,lateral_hurdle_id,'distinct_exercises',
      'The vertical card requires primarily upward projection with minimal horizontal displacement and no obstacle. The hurdle card requires lateral projection across one declared low hurdle to a displaced same-leg landing zone.',
      jsonb_build_object('migration',migration_key,
        'leftSlug','single-leg-vertical-hop-to-stick',
        'rightSlug','single-leg-lateral-low-hurdle-hop-to-stick',
        'identityBoundary','vertical_no_obstacle_vs_lateral_hurdle_clearance',
        'changedDimensions',jsonb_build_array('projection_direction',
          'horizontal_displacement','obstacle','equipment','target_geometry',
          'failure_conditions'),
        'missingIdentityFacts',FALSE,
        'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
        'exerciseDifficultyModel',
          'exercise_complexity_and_physical_difficulty_only',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,vertical_id,quarter_turn_id,'distinct_exercises',
      'Both can use minimal horizontal displacement and a same-leg terminal stick, but the exact vertical hop preserves heading while the quarter-turn hop requires a declared 90-degree aerial reorientation and changed finish heading.',
      jsonb_build_object('migration',migration_key,
        'leftSlug','single-leg-vertical-hop-to-stick',
        'rightSlug','single-leg-quarter-turn-hop-to-stick',
        'identityBoundary','no_rotation_vertical_hop_vs_90_degree_turn',
        'changedDimensions',jsonb_build_array('rotation_degrees',
          'finish_heading','projection_contract','orientation_demand'),
        'missingIdentityFacts',FALSE,
        'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
        'exerciseDifficultyModel',
          'exercise_complexity_and_physical_difficulty_only',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,forward_id,opposite_leg_bound_id,'distinct_exercises',
      'Both are single-flight forward tasks with a terminal stick, but the exact forward hop lands on the takeoff leg while the opposite-leg bound must land on the other leg. That support contract changes identity, faults, side accounting, and substitutions.',
      jsonb_build_object('migration',migration_key,
        'leftSlug','single-leg-forward-hop-to-stick',
        'rightSlug','bound-to-stick',
        'identityBoundary','same_leg_forward_hop_vs_opposite_leg_forward_bound',
        'changedDimensions',jsonb_build_array('landing_leg',
          'support_transition','side_accounting','fault_contract',
          'substitution_contract'),
        'missingIdentityFacts',FALSE,
        'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
        'exerciseDifficultyModel',
          'exercise_complexity_and_physical_difficulty_only',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,forward_id,quarter_turn_id,'distinct_exercises',
      'The exact forward hop preserves heading and requires purposeful forward horizontal projection to a displaced target. The quarter-turn hop requires a 90-degree reorientation with minimal horizontal displacement and a changed finish heading.',
      jsonb_build_object('migration',migration_key,
        'leftSlug','single-leg-forward-hop-to-stick',
        'rightSlug','single-leg-quarter-turn-hop-to-stick',
        'identityBoundary','forward_displacement_no_rotation_vs_minimal_displacement_quarter_turn',
        'changedDimensions',jsonb_build_array('projection_direction',
          'horizontal_displacement','rotation_degrees','finish_heading',
          'target_geometry'),
        'missingIdentityFacts',FALSE,
        'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
        'exerciseDifficultyModel',
          'exercise_complexity_and_physical_difficulty_only',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now();

  UPDATE coaching.exercise_identity_resolution_v1
  SET evidence_json=evidence_json||jsonb_build_object(
      'retirementMigration',migration_key,
      'legacySourceArchived',TRUE,'directMappingCreated',FALSE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    resolved_at=now()
  WHERE((survivor_definition_id=pogo_id
        AND resolved_definition_id=rebound_id)
      OR(survivor_definition_id=rebound_id
        AND resolved_definition_id=pogo_id))
    AND decision='needs_human_review' AND reviewed_by IS NULL;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(rebound_id,1,2,'1.0.0',migration_key,'quarantined',
    $json${"identityKnown":false,"selectableVariant":false,"taxonomyControlled":false,"anatomyComplete":false,"difficultyComplete":false,"loadComplete":false,"fatigueRecoveryComplete":false,"constraintsComplete":false,"deliveryComplete":false,"durationComplete":false,"cumulativeFatigueAndImpactBudgetComplete":false,"substitutionValidationComplete":false,"athleteSupportComplete":true,"coachSupportComplete":true,"stopRulesComplete":true,"mediaCandidateSetComplete":false,"mediaApprovalComplete":false,"graphReviewComplete":false,"calibrationReviewComplete":false,"exerciseSkillLevelAbsent":true,"publicationApproved":false}$json$::JSONB,
    $json$[{"code":"CARD-IDENTITY-01","message":"Direction, amplitude, contact sequence, landing contract, target, and terminal action remain unresolved."},{"code":"CARD-DIFFICULTY-01","message":"Exercise complexity and physical difficulty cannot be scored for an undefined movement."},{"code":"CARD-DELIVERY-01","message":"Selection, dose, duration, logistics, budgets, substitutions, and rendering are blocked."},{"code":"CARD-MEDIA-01","message":"A neighboring demonstration cannot establish the missing movement identity."},{"code":"CARD-PUBLISH-01","message":"Archived source is intentionally nonprescribable."}]$json$::JSONB,
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=1,card_version=2,
    schema_version='1.0.0',audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
     WHERE resolution.evidence_json->>'migration'=migration_key
       AND resolution.decision='distinct_exercises'
       AND resolution.resolution_source='deterministic_exact_identity'
       AND resolution.reviewed_by IS NULL
       AND resolution.evidence_json->>'approvalsCreated'='false')<>6 THEN
    RAISE EXCEPTION '% failed to close all six exact neighbors',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
     WHERE((survivor_definition_id=pogo_id
          AND resolved_definition_id=rebound_id)
        OR(survivor_definition_id=rebound_id
          AND resolved_definition_id=pogo_id))
       AND decision='needs_human_review' AND reviewed_by IS NULL
       AND evidence_json->>'retirementMigration'=migration_key
       AND evidence_json->>'directMappingCreated'='false') THEN
    RAISE EXCEPTION '% failed to preserve rebound identity uncertainty',
      migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=rebound_id AND definition.status='archived'
        AND definition.card_version=2 AND definition.reviewed_by IS NULL
        AND definition.approved_by IS NULL
        AND definition.last_reviewed_at IS NULL
        AND definition.approved_video_url IS NULL
        AND definition.provenance_json->>'directMappingCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise exercise
      WHERE exercise.facility_id=1 AND exercise.id=1142
        AND exercise.archived IS TRUE AND exercise.is_published IS FALSE
        AND exercise.visibility='private' AND exercise.skill_level IS NULL
        AND exercise.linked_skill_id IS NULL
        AND exercise.why_publish_ready IS FALSE)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile safety
      WHERE safety.exercise_id=1142
        AND safety.minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% found invalid rebound quarantine state',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1 packet
      WHERE packet.definition_id=rebound_id
        AND packet.audit_version=migration_key
        AND packet.status='quarantined'
        AND packet.human_review_required IS TRUE
        AND packet.checks_json->>'exerciseSkillLevelAbsent'='true')
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=rebound_id
        AND coaching.exercise_json_has_level_classification(
          jsonb_build_array(definition.anatomy_json,
            definition.athlete_support_json,definition.coach_support_json,
            definition.support_operations_json,definition.provenance_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1 media
      WHERE media.definition_id=rebound_id
        AND(media.review_status IN('approved','shortlisted','rejected')
          OR media.reviewer_user_id IS NOT NULL OR media.reviewed_at IS NOT NULL
          OR media.exact_variant_match IS NOT NULL
          OR media.demonstration_quality_score IS NOT NULL)) THEN
    RAISE EXCEPTION '% created forbidden approval or proficiency state',
      migration_key;
  END IF;
END $$;
