-- Close the remaining score-72+ canonical similarity queue without guessing.
-- Twenty-three legacy definitions omit at least one movement-identity fact and
-- are retired as nonprescribable traceability records. Landmine Split Squat and
-- Split Squat now have exact completed contracts and are recorded as distinct.
-- No media, graph, calibration, reviewer, or publication approval is created,
-- and exercise cards receive no skill/proficiency classification.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '439_coaching_remaining_identity_queue_quarantine';
  landmine_split_id UUID;
  split_squat_id UUID;
  target_ids UUID[];
  source_ids CONSTANT INTEGER[] := ARRAY[
    982,840,1088,1571,1567,1062,430,963,956,1133,994,627,1469,
    1573,1090,1451,1107,1506,202,1348,1669,1103,1539
  ];
  protected_count INTEGER;
  completed_count INTEGER;
  retired RECORD;
BEGIN
  SELECT id INTO landmine_split_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='landmine-split-squat';

  SELECT id INTO split_squat_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='split-squat';

  SELECT array_agg(id ORDER BY legacy_exercise_id) INTO target_ids
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=ANY(source_ids);

  IF(SELECT count(*) FROM coaching.exercise_definition_v1
     WHERE facility_id=1 AND id=ANY(target_ids))<>23
    OR(SELECT count(*) FROM coaching.exercise
       WHERE facility_id=1 AND id=ANY(source_ids))<>23
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
       WHERE id=landmine_split_id AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
       WHERE id=split_squat_id AND facility_id=1) THEN
    RAISE EXCEPTION '% cannot find all queue definitions and sources',
      migration_key;
  END IF;

  SELECT count(*) INTO completed_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(target_ids)
    AND definition.status='archived'
    AND definition.provenance_json->>'identityQueueRetirementMigration'
      =migration_key;
  IF completed_count=23
    AND(SELECT count(*) FROM coaching.exercise exercise
      WHERE exercise.facility_id=1 AND exercise.id=ANY(source_ids)
        AND exercise.archived IS TRUE AND exercise.is_published IS FALSE
        AND exercise.skill_level IS NULL)=23
    AND(SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
      WHERE packet.definition_id=ANY(target_ids)
        AND packet.audit_version=migration_key
        AND packet.status='quarantined')=23
    AND EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=landmine_split_id
        AND resolved_definition_id=split_squat_id
        AND decision='distinct_exercises'
        AND evidence_json->>'migration'=migration_key) THEN
    RETURN;
  END IF;
  IF completed_count<>0 THEN
    RAISE EXCEPTION '% found partial prior retirement',migration_key;
  END IF;

  SELECT count(*) INTO protected_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(target_ids)
    AND(definition.reviewed_by IS NOT NULL
      OR definition.approved_by IS NOT NULL
      OR definition.last_reviewed_at IS NOT NULL
      OR definition.approved_video_url IS NOT NULL);
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % reviewed definition(s)',
      migration_key,protected_count;
  END IF;

  SELECT count(*) INTO protected_count FROM(
    SELECT evidence.id
    FROM coaching.exercise_section_evidence_v1 evidence
    WHERE evidence.definition_id=ANY(target_ids)
      AND(evidence.reviewer_user_id IS NOT NULL
        OR evidence.reviewed_at IS NOT NULL
        OR evidence.review_status IN('approved','rejected'))
    UNION ALL
    SELECT media.id
    FROM coaching.exercise_media_candidate_v1 media
    WHERE media.definition_id=ANY(target_ids)
      AND(media.reviewer_user_id IS NOT NULL OR media.reviewed_at IS NOT NULL
        OR media.review_status IN('approved','shortlisted','rejected')
        OR media.exact_variant_match IS NOT NULL
        OR media.demonstration_quality_score IS NOT NULL)
    UNION ALL
    SELECT alternate.id
    FROM coaching.exercise_alternate_assessment_v1 alternate
    WHERE alternate.definition_id=ANY(target_ids)
      AND(alternate.reviewer_user_id IS NOT NULL
        OR alternate.reviewed_at IS NOT NULL
        OR alternate.review_status IN('approved','rejected'))
  ) protected;
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % reviewed candidate(s)',
      migration_key,protected_count;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
     WHERE((resolution.survivor_definition_id=landmine_split_id
          AND resolution.resolved_definition_id=split_squat_id)
        OR(resolution.survivor_definition_id=split_squat_id
          AND resolution.resolved_definition_id=landmine_split_id))
       AND(resolution.reviewed_by IS NOT NULL
         OR resolution.resolution_source='human_review')) THEN
    RAISE EXCEPTION '% refuses to overwrite reviewed split-squat decision',
      migration_key;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=ANY(target_ids) AND review_status='candidate';

  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',exact_variant_match=NULL,
    demonstration_quality_score=NULL,reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=ANY(target_ids) AND review_status='candidate';

  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=ANY(target_ids) AND review_status='candidate';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id=variant.id
    AND variant.definition_id=ANY(target_ids);

  UPDATE coaching.exercise_variant_v1
  SET status='archived',
    requirements_json=requirements_json||jsonb_build_object(
      'selectable',FALSE,'identityQuarantine',TRUE,
      'retirementMigration',migration_key),
    updated_at=now()
  WHERE definition_id=ANY(target_ids);

  FOR retired IN
    SELECT definition.id AS definition_id,retired_values.source_id,
      retired_values.target_card_version,retired_values.missing_facts,
      retired_values.reason
    FROM(VALUES
      ('9652daf0-4093-448f-808b-f46f88edd002'::UUID,982,3,
        ARRAY['added_pogo_contact_or_cue','exact_contact_order','repetition_boundary','landing_contact_count','terminal_action']::TEXT[],
        'The source does not establish whether pogo is only a springy-contact cue or an added same-leg contact inside the A-Skip sequence.'),
      ('cd34dd6b-808e-47a0-86ee-c050f5bd5997'::UUID,840,2,
        ARRAY['standing_or_supine_base','support_contract','visible_motion','side_exchange_sequence','repetition_boundary']::TEXT[],
        'The source permits standing wall-supported or supine bases and does not declare whether or how sides exchange within one repetition.'),
      ('30d0b69b-42fb-4b5f-afbd-28e472221270'::UUID,1088,2,
        ARRAY['projection_direction','takeoff_foot_count','landing_foot_count','contact_count','landing_zone','exit','reset']::TEXT[],
        'The source could describe a vertical, forward, lateral, bilateral, or unilateral hurdle task and does not define one exact clearance and landing contract.'),
      ('883769ae-18db-4be2-9b73-ba4f025f29fc'::UUID,1571,2,
        ARRAY['takeoff_foot_count','hurdle_landing_foot_count','box_takeoff_contract','box_landing_foot_count','terminal_action','exit']::TEXT[],
        'The source declares lateral travel but not every takeoff, intermediate landing, rebound, box landing, terminal action, or exit.'),
      ('3106a8a9-3ba8-4fc7-958e-95562ea30e0c'::UUID,1567,2,
        ARRAY['hurdle_direction','hurdle_landing_leg','box_takeoff_leg','box_landing_foot_count','terminal_action','exit']::TEXT[],
        'The source declares single-leg work but not hurdle direction or whether each intermediate and box contact remains unilateral.'),
      ('1b6a0161-bf65-4ecd-8e2a-0e2ba824d020'::UUID,1062,2,
        ARRAY['body_orientation','support_surface','hip_position','band_anchor','implement_retention','contraction_tempo']::TEXT[],
        'The source names loaded knee flexion but not prone, standing, seated, or supine orientation, support, hip position, band anchor, or exact retention contract.'),
      ('6e32ac97-6759-4c5a-8a19-102c5f079002'::UUID,430,2,
        ARRAY['body_orientation','support_surface','hip_position','dumbbell_location','implement_retention','contraction_tempo']::TEXT[],
        'The source names loaded knee flexion but not body orientation, support, hip position, dumbbell location, retention method, or contraction contract.'),
      ('cd5f0df3-c10c-44a4-8513-7fd92ce3f074'::UUID,963,2,
        ARRAY['stimulus_source','branch_count','cue_timing','false_start_rule','entry_speed','exit_contract']::TEXT[],
        'The source calls the cut reactive but does not declare the cue, available branches, cue timing, false-start rule, entry, or exit.'),
      ('82a46e38-90d7-47f4-8eea-d45401302b42'::UUID,956,2,
        ARRAY['zone_count','zone_order','zone_distances','zone_intensities','build_up_contract','finish']::TEXT[],
        'The source mentions relaxation and re-acceleration but does not declare the number, order, distance, or intensity of velocity zones.'),
      ('1e99f726-ac34-446b-9bb6-8a47e7ed9d3e'::UUID,1133,2,
        ARRAY['takeoff_leg_each_contact','landing_leg_each_contact','same_leg_or_alternating_sequence','projection_direction','terminal_landing']::TEXT[],
        'The source names three distance-oriented bounds but does not declare whether contacts alternate legs, stay on one leg, or permit both.'),
      ('1bb5268f-a8c3-44e8-a52a-ab89153bf4d1'::UUID,994,2,
        ARRAY['takeoff_leg_each_contact','landing_leg_each_contact','same_leg_or_alternating_sequence','projection_direction','terminal_landing']::TEXT[],
        'The source names a three-hop bound series but does not declare the support leg for every takeoff and landing.'),
      ('682a846d-5476-497d-8ffd-36c2379d53e2'::UUID,627,2,
        ARRAY['support_foot_count','pad_foot_placement','side_sequence','thrower_distance','color_cue_timing','catch_contract']::TEXT[],
        'The source adds a color choice and catch on a balance pad but does not declare unilateral or bilateral support, pad placement, or side sequencing.'),
      ('42d4bd23-5907-4b04-a6d3-689a573e1fb6'::UUID,1469,2,
        ARRAY['knee_contact_or_hover','base_support_state','tap_sequence','pelvis_motion_rule','repetition_boundary']::TEXT[],
        'The source does not establish whether the knees stay down, hover, or transition during shoulder taps.'),
      ('4686517f-e94f-4738-adff-6da9a1ff859d'::UUID,1573,2,
        ARRAY['entry_contact','rebound_direction','ground_contact_target','additional_broad_jump_landing','box_takeoff','terminal_action']::TEXT[],
        'The title adds reactive rebound to an otherwise duplicated floor-to-box summary but never declares the extra ordered contact sequence.'),
      ('e8924419-0e6e-4564-850d-059e7bd9ff1f'::UUID,1090,2,
        ARRAY['hurdle_count','travel_direction','takeoff_foot_count','landing_foot_count','rebound_policy','terminal_action']::TEXT[],
        'The source names continuous hurdle work but not hurdle count, travel direction, support foot count, rebound policy, or finish.'),
      ('2705cb94-1507-489d-a565-06256c010f4d'::UUID,1451,2,
        ARRAY['stance_width','foot_angle','handle_geometry','bar_position','floor_start','grip_contract','knee_contribution']::TEXT[],
        'The source does not define stance, handle, bar position, floor start, grip, or whether the action is sumo-specific.'),
      ('a9217009-8ae8-46c1-b657-94cd6bfa0bde'::UUID,1107,2,
        ARRAY['entry_action','projection_direction','takeoff_support','drop_or_step_height','perturbation','landing_target','reset']::TEXT[],
        'The source describes unilateral landing alignment but not whether entry is a step, drop, jump, hop, or external perturbation.'),
      ('ae0777af-7ca5-452d-8820-26174891baa9'::UUID,1506,2,
        ARRAY['line_orientation','projection_direction','projection_distance','line_crossing_rule','intermediate_contact_contract','terminal_stick']::TEXT[],
        'The source names three contacts and a stick but not line orientation or small crossings versus distance-oriented projection.'),
      ('4671c046-b9d2-4f37-8c3d-4bca0b2a653c'::UUID,202,2,
        ARRAY['rope_or_towel','full_climb_or_low_pull','foot_lock_required_or_optional','support_contract','ascent_distance','return','repetition_boundary']::TEXT[],
        'The combined label permits rope or towel, full or low pulls, and optional foot lock without defining one repetition contract.'),
      ('f4be344f-2ff6-4d63-9f10-2e216f5f367f'::UUID,1348,2,
        ARRAY['shoulder_abduction_angle','elbow_position','rotation_plane','start_position','return_assistance','eccentric_duration']::TEXT[],
        'The source names eccentric external rotation but not arm position, rotation plane, start, return assistance, or exact eccentric duration.'),
      ('0c765ce3-152e-4847-acb4-316fd4d89363'::UUID,1669,2,
        ARRAY['ladder_or_line_target','travel_path','foot_placement_target','contact_count','rebound_policy','terminal_action']::TEXT[],
        'The source says ladder-focused side-to-side two-foot elasticity but does not define rung path, line crossing, foot placement, contacts, or finish.'),
      ('7e6c630a-0f99-4ae6-9a0c-569393012679'::UUID,1103,2,
        ARRAY['band_anchor','force_direction','assistance_magnitude','contact_count','rebound_sequence','terminal_landing']::TEXT[],
        'The source does not define band anchor, assistance direction and magnitude, contact count, rebound sequence, or terminal landing.'),
      ('a4602342-8bc5-4ff8-88e6-4373e96a22dc'::UUID,1539,2,
        ARRAY['band_anchor','assistance_or_resistance_direction','contact_count','rebound_sequence','terminal_landing','release_policy']::TEXT[],
        'The source combines resisted and assisted language without declaring anchor, force direction, rebound contacts, release, or finish.')
    ) retired_values(
      legacy_definition_id,source_id,target_card_version,missing_facts,reason)
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id=1
      AND definition.legacy_exercise_id=retired_values.source_id
  LOOP
    UPDATE coaching.exercise_definition_v1 definition
    SET canonical_name=regexp_replace(definition.canonical_name,
          ' \(Unresolved Legacy\)$','')||' (Unresolved Legacy)',
      display_name=regexp_replace(definition.display_name,
          ' \(Unresolved Legacy\)$','')||' (Unresolved Legacy)',
      description='Archived nonprescribable source. '||retired.reason||
        ' Missing identity facts: '||array_to_string(retired.missing_facts,', ')||'.',
      family_key='unresolved_identity_'||replace(definition.slug,'-','_'),
      card_version=retired.target_card_version,status='archived',
      content_confidence=96,scoring_confidence=1,media_confidence=30,
      movement_patterns=ARRAY['identity_unresolved'],
      required_equipment=ARRAY[]::TEXT[],optional_equipment=ARRAY[]::TEXT[],
      environment_json=jsonb_build_object('selection','blocked',
        'reason','movement_identity_unresolved','missingIdentityFacts',
        to_jsonb(retired.missing_facts)),
      population_json=jsonb_build_object('selection',
        'blocked_before_exposure','humanReviewRequired',TRUE),
      provenance_json=definition.provenance_json||jsonb_build_object(
        'identityQueueRetirementMigration',migration_key,
        'legacySourceAudited',TRUE,
        'resolution','retire_ambiguous_source_without_direct_consolidation',
        'missingIdentityFacts',TRUE,'directMappingCreated',FALSE,
        'exerciseDifficultyModel',
          'exercise_complexity_and_physical_difficulty_only',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
      last_reviewed_at=NULL,
      anatomy_json=jsonb_build_object('knownBodyRegions',
        to_jsonb(definition.body_regions),'unresolvedIdentityFacts',
        to_jsonb(retired.missing_facts),'assignmentBlocked',TRUE),
      athlete_support_json=jsonb_build_object('availability','unavailable',
        'message','This old label does not define one executable exercise. Ask for an exact movement, contact, support, and finish contract.',
        'doNotAttemptFromThisCard',TRUE),
      coach_support_json=jsonb_build_object('availability','unavailable',
        'adjudicationRequired',to_jsonb(retired.missing_facts),
        'doNotRenderInstructions',TRUE,'doNotPrescribe',TRUE),
      support_operations_json=jsonb_build_object(
        'selection','blocked','dosage','blocked','duration','blocked',
        'logistics','blocked','impactBudget','blocked','fatigueBudget','blocked',
        'substitution','exact_identity_required',
        'persistence','retain_traceability_only',
        'humanReviewQueue','identity_adjudication'),updated_at=now()
    WHERE definition.id=retired.definition_id;

    UPDATE coaching.exercise exercise
    SET archived=TRUE,is_published=FALSE,visibility='private',skill_level=NULL,
      linked_skill_id=NULL,why_publish_ready=FALSE,
      default_sets=NULL,default_reps=NULL,default_work_seconds=NULL,
      default_rest_seconds=NULL,tempo=NULL,
      load_note='Unscored unresolved identity; do not prescribe or budget.',
      description='Archived ambiguous source. '||retired.reason||
        ' Missing identity facts: '||array_to_string(retired.missing_facts,', ')||'.',
      instructions='Unavailable. Select an exact reviewed movement contract; do not infer execution from this legacy label.',
      card_summary='Archived nonprescribable source retained for traceability. No direct canonical mapping or approval was created.',
      coach_language='Identity adjudication is required before instruction, difficulty, dose, substitution, selection, or publication.',
      athlete_language='This old card is unavailable because it does not define one exact movement. Ask for an exact alternative.',
      programming_logic=jsonb_build_object('selection','blocked',
        'reason','identity_unresolved','migration',migration_key,
        'difficultyModel','exercise_complexity_and_physical_difficulty_only',
        'difficultyScored',FALSE,'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE),
      scalable_variables=ARRAY[]::TEXT[],movement_family='unresolved_identity',
      primary_phase_key=NULL,phase_subrole=NULL,primary_order_slot=NULL,
      movement_requirements=jsonb_build_object('selectionBlocked',TRUE,
        'missingIdentityFacts',to_jsonb(retired.missing_facts)),
      coaching_execution=jsonb_build_object('renderInstructions',FALSE,
        'renderDose',FALSE,'renderSubstitution',FALSE),
      pairing_logic=jsonb_build_object('pairingBlocked',TRUE),
      media_library='[]'::JSONB,participant_structure='individual',
      programming_kind='exercise',updated_at=now()
    WHERE exercise.facility_id=1 AND exercise.id=retired.source_id;

    UPDATE coaching.exercise_safety_profile
    SET minimum_skill_level=NULL
    WHERE exercise_id=retired.source_id;

    INSERT INTO coaching.exercise_card_test_packet_v1(
      definition_id,facility_id,card_version,schema_version,audit_version,
      status,checks_json,blocking_issues_json,human_review_required,checked_at)
    VALUES(retired.definition_id,1,retired.target_card_version,'1.0.0',
      migration_key,'quarantined',
      jsonb_build_object('identityKnown',FALSE,'selectableVariant',FALSE,
        'taxonomyControlled',FALSE,'anatomyComplete',FALSE,
        'difficultyComplete',FALSE,'loadComplete',FALSE,
        'fatigueRecoveryComplete',FALSE,'constraintsComplete',FALSE,
        'deliveryComplete',FALSE,'durationComplete',FALSE,
        'cumulativeFatigueAndImpactBudgetComplete',FALSE,
        'substitutionValidationComplete',FALSE,
        'athleteSupportComplete',TRUE,'coachSupportComplete',TRUE,
        'stopRulesComplete',TRUE,'mediaCandidateSetComplete',FALSE,
        'mediaApprovalComplete',FALSE,'graphReviewComplete',FALSE,
        'calibrationReviewComplete',FALSE,'exerciseSkillLevelAbsent',TRUE,
        'publicationApproved',FALSE),
      jsonb_build_array(
        jsonb_build_object('code','CARD-IDENTITY-01','message',
          'Movement identity is unresolved: '||
            array_to_string(retired.missing_facts,', ')||'.'),
        jsonb_build_object('code','CARD-DIFFICULTY-01','message',
          'Exercise complexity and physical difficulty cannot be scored for an undefined movement.'),
        jsonb_build_object('code','CARD-DELIVERY-01','message',
          'Selection, dose, duration, logistics, budgets, substitutions, persistence output, and rendering are blocked.'),
        jsonb_build_object('code','CARD-MEDIA-01','message',
          'Adjacent candidate media cannot establish missing movement identity facts.'),
        jsonb_build_object('code','CARD-PUBLISH-01','message',
          'Archived source is intentionally nonprescribable.')),
      TRUE,now())
    ON CONFLICT(definition_id) DO UPDATE SET facility_id=1,
      card_version=EXCLUDED.card_version,schema_version='1.0.0',
      audit_version=EXCLUDED.audit_version,status='quarantined',
      checks_json=EXCLUDED.checks_json,
      blocking_issues_json=EXCLUDED.blocking_issues_json,
      human_review_required=TRUE,checked_at=now();
  END LOOP;

  UPDATE coaching.exercise_identity_resolution_v1 resolution
  SET evidence_json=resolution.evidence_json||jsonb_build_object(
      'retirementMigration',migration_key,
      'ambiguousSourceArchived',TRUE,'directMappingCreated',FALSE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    resolved_at=now()
  WHERE(resolution.survivor_definition_id=ANY(target_ids)
      OR resolution.resolved_definition_id=ANY(target_ids))
    AND resolution.decision='needs_human_review'
    AND resolution.reviewed_by IS NULL;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  VALUES(1,landmine_split_id,split_squat_id,'distinct_exercises',
    'Both use a stationary split stance without stepping, but Landmine Split Squat requires a fixed landmine pivot, diagonal bar path, declared sleeve or compatible-handle rack, pickup and rerack contract, and load orientation. Split Squat uses bodyweight or non-landmine implement variants without the fixed-pivot path.',
    jsonb_build_object('migration',migration_key,
      'leftSlug','landmine-split-squat','rightSlug','split-squat',
      'identityBoundary','fixed_pivot_landmine_split_squat_vs_general_split_squat',
      'sharedDimensions',jsonb_build_array('stationary_fore_aft_stance',
        'feet_fixed_for_set','no_step','return_to_same_split_stance'),
      'changedDimensions',jsonb_build_array('fixed_landmine_pivot',
        'diagonal_bar_path','rack_contract','orientation_to_pivot',
        'pickup_transfer_rerack_and_set_down','equipment'),
      'missingIdentityFacts',FALSE,
      'decisionScope',
        'identity_only_not_card_media_graph_calibration_or_publication_approval',
      'exerciseDifficultyModel',
        'exercise_complexity_and_physical_difficulty_only',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_exact_identity',NULL)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now();

  IF(SELECT count(*) FROM coaching.exercise_definition_v1 definition
     WHERE definition.id=ANY(target_ids)
       AND definition.status='archived'
       AND definition.provenance_json->>'identityQueueRetirementMigration'
         =migration_key
       AND definition.provenance_json->>'directMappingCreated'='false'
       AND definition.reviewed_by IS NULL
       AND definition.approved_by IS NULL
       AND definition.last_reviewed_at IS NULL
       AND definition.approved_video_url IS NULL)<>23 THEN
    RAISE EXCEPTION '% failed to retire all 23 definitions',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise exercise
     WHERE exercise.facility_id=1 AND exercise.id=ANY(source_ids)
       AND exercise.archived IS TRUE AND exercise.is_published IS FALSE
       AND exercise.visibility='private' AND exercise.skill_level IS NULL
       AND exercise.linked_skill_id IS NULL
       AND exercise.why_publish_ready IS FALSE)<>23
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile safety
      WHERE safety.exercise_id=ANY(source_ids)
        AND safety.minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% found invalid legacy quarantine state',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
     WHERE packet.definition_id=ANY(target_ids)
       AND packet.audit_version=migration_key
       AND packet.status='quarantined'
       AND packet.human_review_required IS TRUE
       AND packet.checks_json->>'exerciseSkillLevelAbsent'='true')<>23 THEN
    RAISE EXCEPTION '% failed to write all quarantine test packets',
      migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=landmine_split_id
        AND resolved_definition_id=split_squat_id
        AND decision='distinct_exercises'
        AND resolution_source='deterministic_exact_identity'
        AND reviewed_by IS NULL
        AND evidence_json->>'migration'=migration_key
        AND evidence_json->>'approvalsCreated'='false') THEN
    RAISE EXCEPTION '% failed to close the split-squat boundary',
      migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=ANY(target_ids)
        AND coaching.exercise_json_has_level_classification(
          jsonb_build_array(definition.anatomy_json,
            definition.athlete_support_json,definition.coach_support_json,
            definition.support_operations_json,definition.provenance_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1 media
      WHERE media.definition_id=ANY(target_ids)
        AND(media.review_status IN('approved','shortlisted','rejected')
          OR media.reviewer_user_id IS NOT NULL OR media.reviewed_at IS NOT NULL
          OR media.exact_variant_match IS NOT NULL
          OR media.demonstration_quality_score IS NOT NULL)) THEN
    RAISE EXCEPTION '% created forbidden approval or proficiency state',
      migration_key;
  END IF;
END $$;
