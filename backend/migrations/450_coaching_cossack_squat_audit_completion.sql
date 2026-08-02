-- Repair the already-researched Cossack Squat family against the current
-- canonical audit contract. Automated YouTube oEmbed checks establish only
-- current link/embed health; exactness, captions, quality, graph/calibration
-- review, card approval, and publication remain protected human decisions.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '450_coaching_cossack_squat_audit_completion';
  research_version CONSTANT TEXT := '2026-08-02.64';
  canonical_id CONSTANT UUID := '40f08f99-5977-4e49-8907-02d80330d422';
  baseline_variant CONSTANT UUID := '5a64974c-9f85-4671-ba5e-04f6e04d8621';
  supported_variant CONSTANT UUID := 'c054800a-64e9-4fc0-8c2b-f9b8c0a0f450';
  unresolved_variant_ids CONSTANT UUID[] := ARRAY[
    '8370db2e-90e5-46f4-8e0d-bf58f5ddfd7c'::UUID,
    '9e2668ab-877e-4e24-b1e4-fb91a59e7f0d'::UUID
  ];
  source_ids CONSTANT BIGINT[] := ARRAY[
    60,175,259,467,529,751,812,835,885,1012,1362,1386,1422,1460
  ];
  current_video_ids CONSTANT TEXT[] := ARRAY[
    'tpczTeSkHz0','iPZNB5GsOnM','nLNqEQ4B6XI','Zi_x6s6YXHo','usfu415_0AI'
  ];
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND facility_id=1 AND slug='cossack-squat')<>1
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=baseline_variant AND definition_id=canonical_id)<>1
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(unresolved_variant_ids) AND definition_id=canonical_id)<>2
    OR (SELECT count(*) FROM coaching.exercise
      WHERE id=ANY(source_ids) AND facility_id=1)<>cardinality(source_ids)
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=canonical_id)
        <>cardinality(source_ids) THEN
    RAISE EXCEPTION '% requires the protected Cossack survivor, source map, variants, and legacy rows',migration_key;
  END IF;

  IF EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id
        AND (card_version<>2 OR status<>'review' OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL
          OR approved_video_url IS NOT NULL))
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND (review_status<>'candidate' OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR exact_variant_match IS NOT NULL
          OR captions_available IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 source_variant
        ON source_variant.id=relationship.from_variant_id
      WHERE source_variant.definition_id=canonical_id
        AND (relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      WHERE variant.definition_id=canonical_id
        AND (calibration.status<>'review' OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL))
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_card_review_v1
      WHERE definition_id=canonical_id)
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_media_review_v1
      WHERE definition_id=canonical_id) THEN
    RAISE EXCEPTION '% refuses to overwrite human-reviewed or approved Cossack state',migration_key;
  END IF;

  UPDATE coaching.exercise
  SET skill_level=NULL
  WHERE id=ANY(source_ids);

  UPDATE coaching.exercise_safety_profile
  SET minimum_skill_level=NULL
  WHERE exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_definition_v1
  SET canonical_name='Cossack Squat',
      display_name='Cossack Squat',
      aliases=ARRAY[
        'Cossack Shift','Side-to-Side Cossack Squat','Wide-Stance Cossack Squat',
        'Cossack Shift — Low Amplitude','Cossack Shift Low Amplitude',
        'Cossack Bottom Hold / Cossack Shift Hold','Cossack Bottom Hold',
        'Cossack Shift with Reach','Cossack Shift with T-Spine Reach',
        'Cossack Shift with T Spine Reach','Cossack Shift with TSpine Reach',
        'Cossack Squat Pry','Cossack Squat Shift to Stick',
        'Kettlebell Cossack Squat','KB Cossack Squat',
        'Landmine Cossack Squat','Loaded Cossack Squat',
        'Sandbag Cossack Squat','Slow Cossack Squat Shift',
        'Cossack Squat — Kicking','Cossack Squat Kicking'
      ]::TEXT[],
      family_key='cossack_squat_family',
      schema_version='2.0.0',
      card_version=2,
      status='review',
      content_confidence=82,
      scoring_confidence=68,
      media_confidence=44,
      movement_patterns=ARRAY['squat','brace']::TEXT[],
      body_regions=ARRAY['foot','ankle','knee','hip','pelvis','spine','core']::TEXT[],
      required_equipment=ARRAY['none']::TEXT[],
      optional_equipment=ARRAY[
        'rack_or_wall','wedge','kettlebell','landmine','barbell','sandbag'
      ]::TEXT[],
      anatomy_json=jsonb_build_object(
        'primaryMuscles',jsonb_build_array(
          'quadriceps','gluteus_maximus','adductors'),
        'secondaryMuscles',jsonb_build_array(
          'gluteus_medius_and_minimus','hamstrings','soleus','gastrocnemius',
          'tibialis_anterior','foot_intrinsics','obliques','spinal_stabilizers'),
        'joints',jsonb_build_array(
          'foot','ankle','knee','hip','pelvis','lumbar_spine','thoracic_spine'),
        'jointActions',jsonb_build_array(
          'working_side_hip_and_knee_flexion_during_descent',
          'working_side_ankle_dorsiflexion_during_descent',
          'working_side_hip_and_knee_extension_during_ascent',
          'working_side_ankle_plantarflexor_force_control',
          'contralateral_hip_abduction_with_long_leg_knee_extension',
          'frontal_center_of_mass_transfer',
          'pelvic_and_spinal_stabilization'),
        'planes',jsonb_build_array('frontal','sagittal','transverse'),
        'laterality','alternating',
        'lateralityDetail','One side accepts the squat while the opposite leg remains long; both directions require an explicit, balanced dose.',
        'evidenceLimit','Direct Cossack kinematic research is limited. Lateral-lunge and wide-stance squat findings inform candidate mechanics but do not prove one universal stance, foot angle, depth, or muscle-activation ranking.'
      ),
      provenance_json=provenance_json||jsonb_build_object(
        'cossackAuditCompletionMigration',migration_key,
        'researchVersion',research_version,
        'researchSources',jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC3463242/',
          'https://pubmed.ncbi.nlm.nih.gov/41886869/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC4725067/',
          'https://pubmed.ncbi.nlm.nih.gov/30026952/',
          'https://www.monash.edu/__data/assets/pdf_file/0020/2534141/Cossack-Squat.pdf'),
        'identityDecision','one_fixed_wide_stance_lateral_squat_identity_with_exact_range_support_tempo_reach_and_load_variants',
        'unresolvedVariantsArchived',jsonb_build_array(
          'loaded-unspecified-implement','reach-overlay'),
        'mediaState','five_current_oembed_healthy_candidates_unreviewed',
        'oembedCheckedAt','2026-08-02',
        'mediaApprovalCreated',FALSE,
        'graphApprovalCreated',FALSE,
        'calibrationApprovalCreated',FALSE,
        'cardApprovalCreated',FALSE,
        'publicationQuarantined',TRUE,
        'humanReviewRequired',TRUE,
        'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only'
      ),
      reviewed_by=NULL,
      approved_by=NULL,
      last_reviewed_at=NULL,
      approved_video_url=NULL,
      updated_at=now()
  WHERE id=canonical_id;

  UPDATE coaching.exercise_variant_v1
  SET status='archived',
      requirements_json=requirements_json||jsonb_build_object(
        'selectable',FALSE,
        'identityQuarantine',TRUE,
        'archiveReason','Legacy wording does not declare the exact reach direction or the exact implement and load position; the placeholder remains preserved but cannot enter workout selection.',
        'archivedByMigration',migration_key,
        'humanReviewRequired',TRUE),
      programming_profile_json=programming_profile_json||jsonb_build_object(
        'selectionStatus','archived_unresolved_legacy_placeholder'),
      updated_at=now()
  WHERE id=ANY(unresolved_variant_ids);

  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived',updated_at=now()
  WHERE variant_id=ANY(unresolved_variant_ids);

  UPDATE coaching.exercise_variant_v1
  SET load_profile_json=load_profile_json||jsonb_build_object(
        'spinalLoading',CASE
          WHEN variant_key='landmine-loaded' THEN 48
          WHEN variant_key IN ('kettlebell-loaded','sandbag-loaded') THEN 42
          ELSE 18
        END,
        'landingContactsPerRep',1),
      updated_at=now()
  WHERE definition_id=canonical_id AND status<>'archived';

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,
    difficulty_json,requirements_json,status,load_profile_json,
    fatigue_profile_json,programming_profile_json)
  VALUES(
    supported_variant,canonical_id,'stable-hand-supported',
    'Cossack Squat — Stable-Hand Supported',
    ARRAY[
      'fixed_wide_stance_cossack_squat','self_selected_pain_free_range',
      'stable_hand_support','none']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',38,'absoluteLoadDemand',30,
      'baseOverallDifficulty',38,'supervisionDemand',24,
      'failureConsequence',28,'impact',4,'workCapacityDemand',34,
      'coordinationDemand',36,'provisional',TRUE,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'dimensionMeaning',jsonb_build_object(
        'technicalComplexity','exercise_complexity',
        'absoluteLoadDemand','physical_difficulty')),
    jsonb_build_object(
      'actionIdentity','fixed_wide_stance_cossack_squat',
      'stance','declared_fixed_wide_stance',
      'rangeContract','self_selected_pain_free_range',
      'supportOrImplement','stable_rack_or_wall_hand_support',
      'overlayOrProtocol','none',
      'terminalAction','controlled_return_through_center_or_declared_transfer',
      'sideDose','both_sides_declared_and_recorded',
      'surface','level_non_slip',
      'supportRule','Use support for balance and range ownership, not to pull the body into forced depth.',
      'selectable',TRUE,'identityQuarantine',FALSE),
    'review',
    jsonb_build_object(
      'gripDemand',12,'spinalLoading',16,
      'eccentricStress',36,'landingContactsPerRep',1,
      'externalLoadMethod','bodyweight_with_stable_hand_support',
      'externalLoadDescription','Bodyweight lateral squat with one or two hands lightly contacting a stable rack or wall.',
      'impactClass','very_low_no_planned_jump',
      'loadTracking',jsonb_build_array(
        'support_type','support_height','stance','range','side',
        'repetitions_or_hold_seconds'),
      'effectiveLoadDrivers',jsonb_build_array(
        'body_mass','stance','working_range','support_assistance',
        'tempo','side_dose','repetitions')),
    jsonb_build_object(
      'localMuscleFatigue',34,'gripFatigue',12,
      'technicalFatigueSensitivity',40,'impactAccumulation',4,
      'recoveryHours',18,
      'primaryFatigueSites',jsonb_build_array(
        'working_leg_quadriceps_and_gluteals','adductors',
        'ankle_and_foot_stabilizers','pelvic_and_trunk_stabilizers'),
      'earlyFatigueSignals',jsonb_build_array(
        'increasing_pull_on_support','shortened_or_forced_range',
        'foot_contact_or_knee_tracking_loss','pelvis_or_trunk_collapse',
        'rushed_transfer','side_asymmetry'),
      'downstreamConflicts',jsonb_build_array(
        'heavy_squatting_lunging_or_adductor_work',
        'sprinting_cutting_or_lateral_jumping')),
    jsonb_build_object(
      'primaryIntent','supported_fixed_wide_stance_cossack_squat',
      'selectionStatus','candidate_requires_human_review',
      'appropriatePhases',jsonb_build_array(
        'prepare_and_access','movement_intelligence','resilience','restore'),
      'avoidUse',jsonb_build_array(
        'unstable_support','forced_range','pain_or_guarding',
        'unequal_side_dose','fatigue_degraded_alignment'),
      'cumulativeBudget',jsonb_build_object(
        'lateralSquatRepetitionsPerSide',1,'adductorAndHipLoad',34,
        'kneeAnkleAndFootLoad',34,'technicalSensitivity',40,
        'gripStress',12,'impactContacts',0)))
  ON CONFLICT(definition_id,variant_key) DO UPDATE SET
    display_name=EXCLUDED.display_name,
    modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,
    status='review',
    load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,
    updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,time_model_json,dose_scaling_json,
    measurement_json,support_prompts_json,status)
  VALUES
  (
    supported_variant,'prepare-supported-access','prepare_and_access','primary',
    'Rehearse pain-free frontal-plane range and side-to-side control with stable hand support.',
    94,90,
    jsonb_build_object(
      'frontalPlaneAccess',96,'lateralSquatControl',92,
      'warmupReadiness',88,'maxStrength',25),
    jsonb_build_object(
      'sets',jsonb_build_array(1,3),'repetitionsPerSide',jsonb_build_array(3,6),
      'tempo','3-second controlled descent, optional 1-second owned pause, controlled return',
      'restSeconds',jsonb_build_array(30,60),
      'sideOrder','alternate or complete balanced declared sides',
      'intensityRule','Stop with at least two technically repeatable repetitions in reserve.'),
    'Every counted repetition retains full-foot contact, working-knee tracking, long-leg control, quiet support pressure, an organized trunk, and a pain-free owned range on both sides.',
    ARRAY[
      'sharp_or_increasing_pain','numbness_tingling_or_dizziness',
      'support_moves_or_slips','athlete_pulls_into_forced_depth',
      'working_heel_or_foot_contact_is_lost','repeated_knee_or_pelvic_collapse',
      'unequal_side_dose_cannot_be_corrected']::TEXT[],
    'Secure the rack or wall first. Declare stance, side order, range ceiling, tempo, and support rule. Observe foot, knee, pelvis, trunk, long leg, and support pressure from front and oblique views.',
    'Use the support lightly. Sit toward one side only as far as the whole working foot stays down and the knee follows the toes. Keep the other leg long, return under control, and match both sides.',
    'More repeatable pain-free frontal-plane squat range with less balance assistance and preserved side symmetry.',
    ARRAY['rack_or_wall']::TEXT[],
    jsonb_build_object(
      'setup','Verify a fixed rack upright or clear wall, non-slip floor, side clearance, and coach sightline.',
      'stationCapacity',2,'transitionRule','Reset stance and support contact before changing side.',
      'substitutionRevalidation',jsonb_build_array(
        'equipment','range','side_dose','duration','fatigue','population_constraints')),
    jsonb_build_object(
      'setupSeconds',30,'secondsPerRepetition',8,'sideTransitionSeconds',8,
      'restSeconds',45,'estimatedTotalSecondsRange',jsonb_build_array(120,300)),
    jsonb_build_object(
      'regress',jsonb_build_array(
        'reduce_range','increase_support_height','reduce_repetitions','increase_rest'),
      'progress',jsonb_build_array(
        'reduce_support_pressure','increase_owned_range','use_bodyweight_baseline'),
      'revalidateAfterChange',TRUE),
    jsonb_build_object(
      'count','valid_repetitions_per_side','record',jsonb_build_array(
        'range_marker','support_type_and_height','support_assistance',
        'valid_and_failed_repetitions','symptoms','side_asymmetry')),
    jsonb_build_object(
      'athlete','Show support point, working side, range limit, tempo, side dose, rest, and stop signal.',
      'coach','Show foot/knee/pelvis/trunk observations, support pressure, fatigue budget, and substitution effect.',
      'support','Escalate pain, neurologic symptoms, unsafe support, repeated balance loss, or unclear side dosing.'),
    'review'
  ),
  (
    supported_variant,'resilience-supported-control','resilience','secondary',
    'Build controlled lateral squat capacity while stable support limits balance failure rather than forcing range.',
    82,84,
    jsonb_build_object(
      'frontalPlaneCapacity',88,'adductorTolerance',82,
      'lateralSquatControl',90,'maxStrength',30),
    jsonb_build_object(
      'sets',jsonb_build_array(2,4),'repetitionsPerSide',jsonb_build_array(4,8),
      'tempo','controlled descent and ascent with no bounce or support pull',
      'restSeconds',jsonb_build_array(60,90),
      'sideOrder','balanced declared sides',
      'intensityRule','End the set before range, alignment, support pressure, or side symmetry deteriorates.'),
    'All repetitions are pain-free, the support remains fixed and lightly used, both feet obey the declared contact rule, and the last repetition matches the first without forced range.',
    ARRAY[
      'sharp_or_increasing_pain','numbness_tingling_or_dizziness',
      'support_moves_or_slips','support_pull_increases',
      'working_heel_or_foot_contact_is_lost','repeated_knee_or_pelvic_collapse',
      'range_or_side_symmetry_deteriorates']::TEXT[],
    'Treat support pressure as a measured constraint. Cap the set when the athlete starts pulling on the support, losing foot contact, collapsing the knee or pelvis, shortening one side, or rushing through center.',
    'Keep the support quiet and use the legs to move. Stay inside the assigned range, breathe, finish every repetition under control, and stop before one side becomes different.',
    'Improved repeatable lateral squat control and local tissue capacity within the supported range.',
    ARRAY['rack_or_wall']::TEXT[],
    jsonb_build_object(
      'setup','Use a fixed support and non-slip floor with room for the long leg and side transfer.',
      'stationCapacity',2,'transitionRule','Record both sides before changing range or support.',
      'substitutionRevalidation',jsonb_build_array(
        'equipment','range','side_dose','duration','fatigue','recovery','population_constraints')),
    jsonb_build_object(
      'setupSeconds',30,'secondsPerRepetition',7,'sideTransitionSeconds',10,
      'restSeconds',75,'estimatedTotalSecondsRange',jsonb_build_array(240,600)),
    jsonb_build_object(
      'regress',jsonb_build_array(
        'reduce_range','reduce_set_repetitions','increase_support_height','increase_rest'),
      'progress',jsonb_build_array(
        'reduce_support_pressure','increase_owned_range','increase_repetitions_within_cap','use_bodyweight_baseline'),
      'revalidateAfterChange',TRUE),
    jsonb_build_object(
      'count','valid_repetitions_per_side','record',jsonb_build_array(
        'range_marker','support_type_and_height','support_assistance',
        'valid_and_failed_repetitions','session_rpe','symptoms','side_asymmetry')),
    jsonb_build_object(
      'athlete','Render support, range, repetitions per side, tempo, rest, expected effort, and stop signal.',
      'coach','Render cumulative lateral-squat, adductor, knee/ankle/foot, fatigue, and recovery budgets.',
      'support','Record equipment failure, symptom escalation, substitution reason, and unresolved accessibility needs.'),
    'review'
  )
  ON CONFLICT(variant_id,profile_key) DO UPDATE SET
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,coach_instructions=EXCLUDED.coach_instructions,
    athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,
    equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,status='review',updated_at=now();

  UPDATE coaching.exercise_relationship_v1 relationship
  SET dimensions=(
        SELECT array_agg(dimension ORDER BY first_ordinal)
        FROM (
          SELECT CASE
              WHEN item='support' THEN 'stability'
              WHEN item='action_sequence' THEN 'complexity'
              ELSE item
            END AS dimension,
            min(ordinality) AS first_ordinal
          FROM unnest(relationship.dimensions) WITH ORDINALITY AS value(item,ordinality)
          WHERE CASE
              WHEN item='support' THEN 'stability'
              WHEN item='action_sequence' THEN 'complexity'
              ELSE item
            END=ANY(ARRAY[
              'load','leverage','range','speed','stability','complexity',
              'impact','decision_demand','fatigue']::TEXT[])
          GROUP BY CASE
              WHEN item='support' THEN 'stability'
              WHEN item='action_sequence' THEN 'complexity'
              ELSE item
            END
        ) controlled_dimensions),
      updated_at=now()
  WHERE relationship.review_status='review'
    AND relationship.reviewed_by IS NULL
    AND relationship.reviewed_at IS NULL
    AND relationship.relationship IN ('progression','regression')
    AND EXISTS(
      SELECT 1 FROM coaching.exercise_variant_v1 source_variant
      WHERE source_variant.id=relationship.from_variant_id
        AND source_variant.definition_id=canonical_id);

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status)
  VALUES
  (baseline_variant,supported_variant,'regression',92,
    ARRAY['stability','range','complexity','load']::TEXT[],
    'Stable hand contact reduces balance and active-range demand while preserving the fixed-stance lateral squat action and balanced side dose.',
    jsonb_build_object(
      'condition','use_when_balance_or_range_ownership_limits_the_bodyweight_baseline',
      'changedAttributes',jsonb_build_array(
        'support','balance_demand','owned_range','relative_loading'),
      'humanReviewRequired',TRUE),
    'review'),
  (supported_variant,baseline_variant,'progression',92,
    ARRAY['stability','range','complexity','load']::TEXT[],
    'Removing stable hand support increases balance, active-range, and relative-loading demand without changing the Cossack squat identity.',
    jsonb_build_object(
      'condition','progress_only_after_quiet_support_pressure_and_repeatable_pain_free_bilateral_range',
      'changedAttributes',jsonb_build_array(
        'support','balance_demand','owned_range','relative_loading'),
      'humanReviewRequired',TRUE),
    'review')
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',reviewed_by=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
    status,version)
  VALUES
  (1,supported_variant,'technicalComplexity',38,40,
    'Stable hand contact lowers balance and coordination demand relative to the bodyweight baseline, while the wide stance, asymmetric squat, long-leg control, and bilateral side dose remain.',
    'review',1),
  (1,supported_variant,'absoluteLoadDemand',30,40,
    'Bodyweight remains the primary resistance, but stable support can reduce balance-limited loading and lets range be scaled without adding external mass.',
    'review',1)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',reviewed_by=NULL,
    review_notes=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status)
  VALUES
  (canonical_id,2,'biomechanics',
    'https://pubmed.ncbi.nlm.nih.gov/30026952/',
    'How to squat? Effects of various stance widths, foot placement angles and level of experience on knee, hip and trunk motion and loading',
    'BMC Sports Science, Medicine and Rehabilitation','peer_reviewed_research',
    jsonb_build_array(
      'In bilateral squats, stance width and foot angle changed hip and knee moments and mediolateral knee displacement; the authors cautioned against assuming one extreme position is universally appropriate.',
      'This is adjacent wide-stance squat evidence, not direct Cossack validation. The card therefore records stance, foot contact, range, support, and side-specific quality instead of prescribing one universal geometry.'),
    86,'candidate'),
  (canonical_id,2,'instructions',
    'https://www.monash.edu/__data/assets/pdf_file/0020/2534141/Cossack-Squat.pdf',
    'Cossack Squat','Monash University','professional_standard',
    jsonb_build_array(
      'The institutional guide describes a flat heel on the bending-leg side, the knee aligned with the toes, an extended opposite leg, and an organized spine.',
      'These are candidate technique cues rather than universal clinical rules; Vortex still scales stance and range to the declared pain-free task and stops when contact, alignment, balance, or symptoms fail.'),
    72,'candidate')
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,
    claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise_media_candidate_v1 candidate
  SET title=media.title,
      channel_name=media.channel_name,
      embed_url='https://www.youtube-nocookie.com/embed/'||candidate.video_id,
      link_status='healthy',
      embedding_allowed=TRUE,
      exact_variant_match=NULL,
      captions_available=NULL,
      demonstration_quality_score=NULL,
      review_status='candidate',
      reviewer_user_id=NULL,
      reviewed_at=NULL,
      next_review_at=NULL,
      notes='YouTube oEmbed returned current title, channel, and embeddable iframe metadata on 2026-08-02. Full playback, exact exercise and variant match, cue safety, captions, accessibility, quality, reviewer identity, and approval remain unresolved.',
      updated_at=now()
  FROM (VALUES
    ('tpczTeSkHz0','How to Cossack Squat Mobility Exercise: Tutorial & Progressions','FitnessFAQs'),
    ('iPZNB5GsOnM','Cossack Squat Movement Demo','The Active Life'),
    ('nLNqEQ4B6XI','Cossack Squat | Hip Mobilization Exercise','Dr. Carl Baird'),
    ('Zi_x6s6YXHo','Cossack Squat Tutorial for Beginners and Athletes','Mike | J2FIT Strength & Conditioning'),
    ('usfu415_0AI','Assisted Cossack Squat','OPEX Fitness')
  ) AS media(video_id,title,channel_name)
  WHERE candidate.definition_id=canonical_id
    AND candidate.reviewed_card_version=2
    AND candidate.video_id=media.video_id;

  UPDATE coaching.exercise_card_test_packet_v1
  SET status='quarantined',human_review_required=TRUE,
      checked_at=now()
  WHERE definition_id=canonical_id;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE definition_id=canonical_id AND status<>'archived')<>11
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(unresolved_variant_ids) AND status='archived')<>2
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_variant_v1
      WHERE definition_id=canonical_id AND status<>'archived'
        AND (NOT difficulty_json ?& ARRAY[
            'technicalComplexity','absoluteLoadDemand','supervisionDemand',
            'failureConsequence','impact','workCapacityDemand',
            'baseOverallDifficulty']::TEXT[]
          OR (difficulty_json->>'baseOverallDifficulty')::INTEGER
            <>GREATEST(
              (difficulty_json->>'technicalComplexity')::INTEGER,
              (difficulty_json->>'absoluteLoadDemand')::INTEGER)))
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_variant_v1
      WHERE definition_id=canonical_id AND status<>'archived'
        AND NOT load_profile_json ?& ARRAY[
          'gripDemand','spinalLoading','eccentricStress',
          'landingContactsPerRep','externalLoadMethod']::TEXT[])
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
        JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
        WHERE variant.definition_id=canonical_id AND variant.status<>'archived'
          AND profile.status='review')<>22
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      WHERE variant.definition_id=canonical_id AND variant.status<>'archived'
        AND (cardinality(profile.equipment_required)=0
          OR profile.dosage_json='{}'::JSONB
          OR profile.time_model_json='{}'::JSONB
          OR profile.dose_scaling_json='{}'::JSONB
          OR profile.measurement_json='{}'::JSONB
          OR profile.support_prompts_json='{}'::JSONB))
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND video_id=ANY(current_video_ids) AND link_status='healthy'
        AND embedding_allowed IS TRUE AND review_status='candidate'
        AND exact_variant_match IS NULL AND captions_available IS NULL
        AND demonstration_quality_score IS NULL
        AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>5
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 source_variant
        ON source_variant.id=relationship.from_variant_id
      WHERE source_variant.definition_id=canonical_id
        AND relationship.relationship IN ('progression','regression')
        AND (cardinality(relationship.dimensions)=0
          OR EXISTS(
            SELECT 1 FROM unnest(relationship.dimensions) dimension
            WHERE dimension<>ALL(ARRAY[
              'load','leverage','range','speed','stability','complexity',
              'impact','decision_demand','fatigue']::TEXT[]))))
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
        JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
        WHERE variant.definition_id=canonical_id AND variant.status<>'archived'
          AND calibration.status='review')<>22
    OR (SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate')<>18
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=canonical_id)
        <>cardinality(source_ids)
    OR EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=ANY(source_ids) AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(source_ids) AND minimum_skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND coaching.exercise_json_has_level_classification(
        jsonb_build_array(
          provenance_json,environment_json,population_json,anatomy_json,
          athlete_support_json,coach_support_json,support_operations_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE definition_id=canonical_id
        AND coaching.exercise_json_has_level_classification(jsonb_build_array(
          difficulty_json,requirements_json,load_profile_json,
          fatigue_profile_json,programming_profile_json))) THEN
    RAISE EXCEPTION '% failed its canonical Cossack completion assertions',migration_key;
  END IF;
END $$;
