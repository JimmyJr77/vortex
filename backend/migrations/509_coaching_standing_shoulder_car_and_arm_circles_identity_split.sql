-- Source 37: split the conflated Arm Circles / Shoulder CARs label into an exact
-- standing single-arm Shoulder CAR and a distinct canonical bilateral Arm Circles
-- card. Evidence, media, graph, calibration, content, and publication authority
-- remain human-only; exercise difficulty never classifies participant skill.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '509_coaching_standing_shoulder_car_and_arm_circles_identity_split';
  research_version CONSTANT TEXT := '2026-08-09.104';
  shoulder_definition UUID;
  source_variant UUID;
  shoulder_variant UUID;
  arm_circle_definition UUID;
  arm_circle_variant UUID;
  active_variant_ids UUID[];
  all_owned_variant_ids UUID[];
  full_body_definition UUID;
  full_body_variant UUID;
  neck_definition UUID;
  quadruped_definition UUID;
  quadruped_variant UUID;
  wall_slide_definition UUID;
  wall_slide_variant UUID;
  dowel_definition UUID;
  dowel_variant UUID;
  band_rotation_definition UUID;
  band_rotation_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT id INTO shoulder_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=37;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=shoulder_definition AND variant_key='baseline';
  SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1
    WHERE definition_id=shoulder_definition AND variant_key='standing-single-arm-full-range-car'),gen_random_uuid())
  INTO shoulder_variant;
  SELECT coalesce((SELECT id FROM coaching.exercise_definition_v1
    WHERE facility_id=1 AND slug='standing-bilateral-arm-circles'),gen_random_uuid())
  INTO arm_circle_definition;
  SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1
    WHERE definition_id=arm_circle_definition AND variant_key='standing-bilateral-small-circles'),gen_random_uuid())
  INTO arm_circle_variant;
  SELECT id INTO full_body_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=23;
  SELECT id INTO full_body_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=full_body_definition AND variant_key='standing-independent-eight-region-sequence';
  SELECT id INTO neck_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=24;
  SELECT id INTO quadruped_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=34;
  SELECT id INTO quadruped_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=quadruped_definition AND variant_key='fixed-contact-bilateral-scapular-circle';
  SELECT id INTO wall_slide_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=35;
  SELECT id INTO wall_slide_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=wall_slide_definition AND variant_key='bilateral-forearm-slide-terminal-full-arm-lift-off';
  SELECT id INTO dowel_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=902;
  SELECT id INTO dowel_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=dowel_definition AND variant_key='baseline';
  SELECT id INTO band_rotation_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=36;
  SELECT id INTO band_rotation_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=band_rotation_definition AND variant_key='bilateral-standing-elbows-at-sides-unanchored-band';
  active_variant_ids:=ARRAY[shoulder_variant,arm_circle_variant];
  all_owned_variant_ids:=ARRAY[source_variant,shoulder_variant,arm_circle_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=37 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=shoulder_definition AND facility_id=1 AND legacy_exercise_id=37)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=37 AND definition_id=shoulder_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=shoulder_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=full_body_variant AND definition_id=full_body_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=neck_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=quadruped_variant AND definition_id=quadruped_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=wall_slide_variant AND definition_id=wall_slide_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=dowel_variant AND definition_id=dowel_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=band_rotation_variant AND definition_id=band_rotation_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=37)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=37)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=37) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=shoulder_variant AND definition_id<>shoulder_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=arm_circle_variant AND definition_id<>arm_circle_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='arm-circles' AND id<>shoulder_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='standing-bilateral-arm-circles' AND id<>arm_circle_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=ANY(ARRAY[shoulder_definition,arm_circle_definition])
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(ARRAY[shoulder_definition,arm_circle_definition])
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(ARRAY[shoulder_definition,arm_circle_definition])
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=ANY(ARRAY[shoulder_definition,arm_circle_definition])
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=ANY(ARRAY[shoulder_definition,arm_circle_definition])
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=ANY(ARRAY[shoulder_definition,arm_circle_definition])
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id=ANY(ARRAY[shoulder_definition,arm_circle_definition])
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=ANY(ARRAY[shoulder_definition,arm_circle_definition])
          OR resolved_definition_id=ANY(ARRAY[shoulder_definition,arm_circle_definition]))
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=37
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=ANY(ARRAY[shoulder_definition,arm_circle_definition])
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=ANY(ARRAY[shoulder_definition,arm_circle_definition])
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=ANY(ARRAY[shoulder_definition,arm_circle_definition])
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(all_owned_variant_ids) AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1 SET
    source_kind='legacy_migration',
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'sourceDisposition','standing_single_arm_shoulder_car_reauthored_and_arm_circles_split',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation','source 37 detailed text specifies one slow actively rotated arm through available range with quiet ribs spine and pelvis and reverse direction; the slash-label Arm Circles component is a distinct bilateral shoulder-height repeated-circle task and receives a new canonical definition',
        'exactWorkingSpecification','standing_single_arm_active_full_range_shoulder_car',
        'separateDefinitionId',arm_circle_definition,
        'researchSources',jsonb_build_array(
          'https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/',
          'https://mindbodyspine.ca/mobility-for-shoulders-controlled-articular-rotations-cars/',
          'https://extension.missouri.edu/sites/default/files/legacy_media/wysiwyg/Extensiondata/Pub/pdf/n862.pdf',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12398250/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC6368381/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC4932079/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC2841046/',
          'https://pubmed.ncbi.nlm.nih.gov/40165544/',
          'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=37 AND definition_id=shoulder_definition;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-37',
    display_name='Arm Circles / Shoulder CARs Legacy Skeleton — Source 37',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_conflated_source_skeleton',
      'sourceLegacyExerciseId',37,
      'archiveReason','slash label conflated bilateral shoulder-height Arm Circles with a unilateral full-range Shoulder CAR while exact side path rotation count anatomy loading budgets duration constraints substitutions persistence and support were missing',
      'replacementVariantIds',to_jsonb(active_variant_ids),'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','superseded_conflated_source_skeleton','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=source_variant;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at,anatomy_json,athlete_support_json,coach_support_json,
    support_operations_json)
  VALUES(
    shoulder_definition,1,37,'arm-circles','Standing Single-Arm Shoulder CAR',
    'Standing Single-Arm Shoulder CAR',
    ARRAY['Shoulder CAR','Shoulder CARs','Standing Shoulder CAR','Standing Shoulder CARs','Standing Shoulder Controlled Articular Rotation','Single-Arm Shoulder CAR'],
    'Stand with both feet fixed and one long active arm beside the body. Without momentum, move that arm forward and overhead through the largest comfortable controlled path, changing humeral and hand orientation as needed to continue behind and down to the same start. Keep the other arm and the ribs, spine and pelvis comparatively quiet without trying to freeze normal scapular motion. Complete the reverse direction separately. One complete return-to-start loop in one declared direction is one repetition. Side, direction, comfortable range, hand orientation, tempo, pauses, breathing, dose, rest and opposite-hand self-feedback are annotations; changing base, laterality, assistance, load, path, multi-joint sequence or clinical scope changes the task.',
    'standing_single_arm_shoulder_car','2.0.0',2,'review',86,60,50,
    ARRAY['brace','reach','rotate']::TEXT[],
    ARRAY['shoulder','scapula','thoracic_spine','core']::TEXT[],
    ARRAY[]::TEXT[],ARRAY[]::TEXT[],
    jsonb_build_object(
      'surface','flat dry stable nonslip standing surface','stationCapacity',1,
      'space','one standing station with complete unilateral arm-sweep clearance in front overhead behind and to the side and no cross traffic',
      'equipmentKey','none','coachSightline','front-quarter and side views of feet active arm hand shoulder scapula ribs spine pelvis breathing range and symptoms',
      'inspection',jsonb_build_array('floor traction and clutter','full arm path and ceiling clearance','neighbor and cross-traffic separation','coach sightline and communication','safe stop and emergency route'),
      'changeRule','Any base laterality assistance load path sequence purpose dose symptom space or downstream-demand change requires complete revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe unsupported standing','clear full unilateral arm path','comfortable active shoulder motion in the declared direction','understands same-start loop count and stop signal','can avoid momentum and excessive trunk compensation','same-session shoulder scapular trunk and overhead budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma surgery or procedure without applicable clearance','worsening night or post-trauma pain','sharp increasing or unfamiliar pain pinching catching or recurrent instability','new numbness tingling weakness altered circulation or loss of control','dizziness faintness nausea visual change chest pain unusual breathlessness or inability to communicate','standing balance neck back elbow wrist or hand symptoms preventing exact task','clinical restriction conflicting with active shoulder motion','unsafe arm-sweep space or participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal normal path range or scapular rhythm','injury prevention diagnosis treatment structural correction readiness or clearance','isolated muscle activation','one universal dose frequency recovery or progression','performance transfer or participant skill level')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://mindbodyspine.ca/mobility-for-shoulders-controlled-articular-rotations-cars/',
      'legacySources',jsonb_build_array(37),
      'identityContract','standing_fixed_foot_unilateral_active_momentum_free_full_range_shoulder_car_returning_to_same_start',
      'splitDefinitionId',arm_circle_definition,
      'researchSources',jsonb_build_array(
        'https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/',
        'https://mindbodyspine.ca/mobility-for-shoulders-controlled-articular-rotations-cars/',
        'https://extension.missouri.edu/sites/default/files/legacy_media/wysiwyg/Extensiondata/Pub/pdf/n862.pdf',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC12398250/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC6368381/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC4932079/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC2841046/',
        'https://pubmed.ncbi.nlm.nih.gov/40165544/',
        'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
      'confidenceBySection',jsonb_build_object('identity',86,'taxonomy',86,'anatomy',80,'difficulty',60,'load',66,'fatigueRecovery',52,'constraints',84,'dosage',58,'instructions',86,'alternates',90,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal path range rotation timing speed dose frequency recovery progression or outcome','numeric difficulty calibration','media playback exactness captions accessibility quality safety and approval','individual symptom interpretation or clinical eligibility'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('deltoid_anterior_middle_and_posterior','rotator_cuff_infraspinatus_supraspinatus_subscapularis_and_teres_minor'),
      'secondaryMuscles',jsonb_build_array('serratus_anterior','upper_middle_and_lower_trapezius','latissimus_dorsi','pectoralis_major','teres_major','biceps_brachii_and_triceps_long_head'),
      'stabilizers',jsonb_build_array('scapular_stabilizers','forearm_and_wrist_stabilizers','cervical_and_spinal_postural_muscles','abdominal_wall','pelvic_hip_and_lower_limb_postural_muscles'),
      'joints',jsonb_build_array('glenohumeral_joint','scapulothoracic_articulation','sternoclavicular_joint','acromioclavicular_joint','elbow_joint','proximal_and_distal_radioulnar_joints','radiocarpal_wrist','cervical_thoracic_and_lumbar_intervertebral_joints'),
      'jointActions',jsonb_build_array('active_shoulder_flexion_and_elevation','abduction_and_adduction_across_changing_planes','extension','internal_and_external_humeral_rotation','scapular_upward_and_downward_rotation','scapular_protraction_and_retraction','scapular_posterior_and_anterior_tilt','elbow_extension_isometric','wrist_and_trunk_stabilization'),
      'planes',jsonb_build_array('sagittal','frontal','transverse','multi_planar_circumduction'),
      'laterality','unilateral active arm with side and direction recorded separately; the opposite arm remains quiet or provides non-assisting tactile feedback',
      'supportContacts',jsonb_build_array('left_foot','right_foot'),
      'phaseSequence',jsonb_build_array('long_arm_beside_body_start','forward_and_overhead_active_elevation','intentional_humeral_rotation_as_needed','behind_and_downward_sweep','return_to_same_start','reverse_direction_separately'),
      'scapularBoundary','Allow coordinated scapular and clavicular motion; do not pin the scapula. The invalid compensation boundary is excessive rib flare spinal extension lateral bend torso rotation stepping or momentum used to create apparent shoulder range.',
      'evidenceBoundary','Research supports coordinated multi-planar shoulder-complex motion and substantial normal variability but does not validate exact CAR activation universal path treatment effect or Vortex scoring.'),
    jsonb_build_object(
      'whyItMatters','Provides a reproducible unilateral active shoulder-motion task when the workout calls for slow momentum-free circumduction rather than bilateral shoulder-height Arm Circles or a clinical assessment.',
      'primaryCue','Keep your feet and ribs quiet, reach one long arm through your largest comfortable smooth circle, rotate the arm as needed, and return to the same start.',
      'expectedSensations',jsonb_build_array('light active effort around the moving shoulder and shoulder blade','gentle end-range muscular effort without forced stretch','trunk and standing postural effort','differences between sides may be noticed without being diagnosed'),
      'unexpectedSensations',jsonb_build_array('sharp increasing night or post-trauma pain','pinching catching painful clicking or instability','numbness tingling weakness pins and needles or altered circulation','dizziness faintness nausea visual change chest pain unusual breathlessness or disorientation','loss of balance uncontrolled arm drop forced range or trunk-driven motion'),
      'painGuidance','Stop the arm in a controlled position, lower it comfortably, signal the coach, and follow facility escalation policy; do not repeat to test symptoms.',
      'selfChecks',jsonb_build_array('feet_stay_fixed','one_arm_remains_long_and_active','motion_is_slow_and_momentum_free','range_remains_comfortable','arm_rotation_allows_the_path_without_forcing','ribs_spine_and_pelvis_do_not_create_the_circle','loop_returns_to_same_start','side_and_direction_are_recorded','breathing_continues','no_stop_symptom'),
      'accessibility',jsonb_build_array('front-quarter and side demonstration','written six-step path','visual overhead and behind path markers','opposite-hand rib or pelvis feedback','smaller comfortable range','slower pace fewer loops and more rest','written still-image or live instruction instead of video','separately reviewed seated wall-supported quadruped or assisted variant when base or assistance must change'),
      'mediaAlternatives',jsonb_build_array('written sequence','front and side still frames','coach live demonstration','large-print path and stop checklist'),
      'stopSignal','Stop, lower the arm comfortably, and tell the coach what changed.'),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact standing unilateral CAR identity','side and direction','clearance and standing control','long active arm and same-start loop','smooth active shoulder-complex motion','humeral rotation without wrist-only substitution','ribs spine pelvis and feet','comfortable range and pace','breathing symptoms first fault and actual exposure'),
      'faultCorrections',jsonb_build_object('momentum_or_fast_swing','stop_reset_and_slow_the_loop','rib_flare_spinal_extension_lateral_bend_or_rotation','reduce_range_and_use_non_assisting_tactile_feedback','elbow_bends_or_wrist_substitutes','reduce_range_and_restore_long_arm_without_forcing','pain_or_instability','end_set_and_follow_escalation_policy','wrong_bilateral_arm_circle_task','stop_and_select_the_distinct_arm_circle_definition'),
      'demonstrationPlan','Show exact start, side, direction, forward-overhead path, intentional arm rotation, behind-downward return, same-start count, permitted scapular motion, invalid trunk compensation, smaller-range option, stop signal and safe arm lowering.',
      'groupManagement',jsonb_build_array('one participant per full arm-sweep envelope','stagger starts for front-quarter and side observation','declare side direction loops and stop signal before movement','count invalid partial and symptom-limited attempts as exposure'),
      'modificationDecisionTree',jsonb_build_array('urgent symptom stop and facility protocol','reduce range pace or loop count and increase rest first','change base laterality assistance load or path only through a reviewed variant or definition','select bilateral Arm Circles only when workout purpose can change','recompute duration fatigue logistics substitution persistence and rendering after every change'),
      'doNotUseWhen',jsonb_build_array('safe standing or full arm clearance is unavailable','active comfortable shoulder motion is unavailable','symptoms restrictions or clinical instructions conflict','the intended task is assessment treatment passive motion or another identity'),
      'validRepetition','One active long-arm momentum-free loop in one declared direction returns to the same start with fixed feet comfortable range controlled trunk continuous breathing and no stop rule.'),
    jsonb_build_object(
      'selectionInputs',jsonb_build_array('workout purpose','side and direction','standing and arm-path clearance','active comfortable shoulder range','symptoms and restrictions','loop dose tempo rest and duration','cumulative shoulder scapular trunk and overhead exposure','coach sightline and scope'),
      'durationInputs',jsonb_build_array('setup','valid loop seconds','side and direction changes','rest','invalid partial or symptom-limited attempts','substitution','station reset'),
      'persistenceFields',jsonb_build_array('definition variant card and research version','side and direction','planned and actual loops','range path tempo pauses and breathing','valid invalid partial and symptom-limited attempts','first fault and compensation','symptoms stop reason and escalation','duration rest substitution and downstream budget'),
      'renderingRequirements',jsonb_build_array('plain-language identity','side direction and dose','six-step path','quality gate and stop rules','smaller-range option','no diagnosis treatment readiness or outcome claim'),
      'auditState','machine_complete_review_only','humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  )
  ON CONFLICT(id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,legacy_exercise_id=EXCLUDED.legacy_exercise_id,
    slug=EXCLUDED.slug,canonical_name=EXCLUDED.canonical_name,
    display_name=EXCLUDED.display_name,aliases=EXCLUDED.aliases,
    description=EXCLUDED.description,family_key=EXCLUDED.family_key,
    schema_version=EXCLUDED.schema_version,card_version=EXCLUDED.card_version,
    status='review',content_confidence=EXCLUDED.content_confidence,
    scoring_confidence=EXCLUDED.scoring_confidence,media_confidence=EXCLUDED.media_confidence,
    movement_patterns=EXCLUDED.movement_patterns,body_regions=EXCLUDED.body_regions,
    required_equipment=EXCLUDED.required_equipment,optional_equipment=EXCLUDED.optional_equipment,
    environment_json=EXCLUDED.environment_json,population_json=EXCLUDED.population_json,
    provenance_json=EXCLUDED.provenance_json,approved_video_url=NULL,
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    anatomy_json=EXCLUDED.anatomy_json,athlete_support_json=EXCLUDED.athlete_support_json,
    coach_support_json=EXCLUDED.coach_support_json,
    support_operations_json=EXCLUDED.support_operations_json,updated_at=now();

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at,anatomy_json,athlete_support_json,coach_support_json,
    support_operations_json)
  VALUES(
    arm_circle_definition,1,NULL,'standing-bilateral-arm-circles',
    'Standing Bilateral Arm Circles','Standing Bilateral Arm Circles',
    ARRAY['Arm Circles','Standing Arm Circles','Bilateral Arm Circles','Small Arm Circles','Small Forward and Backward Arm Circles','Shoulder-Height Arm Circles'],
    'Stand with both feet fixed and raise both long arms laterally near shoulder height. Make repeated small controlled circles with both arms simultaneously in one declared direction, then reverse only at the declared interval or count. One complete small revolution by both arms is one repetition; time-based delivery records actual seconds in each direction. Circle diameter within the declared small-to-moderate range, exact comfortable arm height, palm orientation, tempo, direction order, dose, rest and breathing cues are annotations. Changing to one full-range Shoulder CAR, unilateral or seated execution, bent elbows, windmill arcs, external load, arm swings, shoulder rolls or a pendulum changes the task.',
    'standing_bilateral_arm_circles','2.0.0',1,'review',84,58,50,
    ARRAY['brace','rotate']::TEXT[],ARRAY['shoulder','scapula','core']::TEXT[],
    ARRAY[]::TEXT[],ARRAY[]::TEXT[],
    jsonb_build_object(
      'surface','flat dry stable nonslip standing surface','stationCapacity',1,
      'space','one standing station with bilateral shoulder-height arm clearance and no cross traffic',
      'equipmentKey','none','coachSightline','front and side views of feet arm height elbow shape circle size direction shoulder position trunk breathing and symptoms',
      'inspection',jsonb_build_array('floor traction and clutter','bilateral arm and neighbor clearance','ceiling and wall distance','coach sightline and communication','safe stop and emergency route'),
      'changeRule','Any base laterality lever external load circle path purpose dose symptom space or downstream-demand change requires complete revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe unsupported standing','clear bilateral arm space','comfortable bilateral arm support near shoulder height','understands circle direction interval or count and stop signal','can maintain small simultaneous circles without uncontrolled shrugging or trunk motion','same-session shoulder scapular and overhead budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma surgery or procedure without applicable clearance','worsening night post-trauma sharp increasing or unfamiliar pain','pinching catching painful clicking recurrent instability or uncontrolled arm drop','new numbness tingling weakness altered circulation or loss of control','dizziness faintness nausea visual change chest pain unusual breathlessness or inability to communicate','standing balance neck back elbow wrist or hand symptoms preventing exact task','clinical restriction conflicting with bilateral shoulder-height motion','unsafe bilateral clearance or participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal ideal arm height circle size or palm orientation','injury prevention diagnosis treatment readiness correction or clearance','isolated muscle activation','one universal dose frequency recovery progression or warm-up outcome','performance transfer age floor or participant skill level')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://extension.missouri.edu/sites/default/files/legacy_media/wysiwyg/Extensiondata/Pub/pdf/n862.pdf',
      'legacySources',jsonb_build_array(),'origin','identity_split_from_source_37_conflated_label',
      'identityContract','standing_fixed_foot_bilateral_shoulder_height_repeated_small_arm_circles',
      'splitFromDefinitionId',shoulder_definition,
      'researchSources',jsonb_build_array(
        'https://extension.missouri.edu/sites/default/files/legacy_media/wysiwyg/Extensiondata/Pub/pdf/n862.pdf',
        'https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC12398250/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC6368381/',
        'https://pubmed.ncbi.nlm.nih.gov/40165544/',
        'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
      'confidenceBySection',jsonb_build_object('identity',84,'taxonomy',84,'anatomy',76,'difficulty',58,'load',62,'fatigueRecovery',50,'constraints',82,'dosage',68,'instructions',84,'alternates',88,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal arm height circle diameter palm orientation tempo dose frequency recovery or outcome','numeric difficulty calibration','media playback exactness captions accessibility quality safety and approval','individual symptom interpretation or clinical eligibility'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('middle_deltoid','anterior_and_posterior_deltoid','rotator_cuff'),
      'secondaryMuscles',jsonb_build_array('serratus_anterior','upper_middle_and_lower_trapezius','pectoralis_major','latissimus_dorsi','biceps_brachii_and_triceps_brachii'),
      'stabilizers',jsonb_build_array('scapular_stabilizers','forearm_and_wrist_stabilizers','cervical_and_spinal_postural_muscles','abdominal_wall','pelvic_hip_and_lower_limb_postural_muscles'),
      'joints',jsonb_build_array('glenohumeral_joints','scapulothoracic_articulations','sternoclavicular_joints','acromioclavicular_joints','elbow_joints','radioulnar_joints','wrists','cervical_thoracic_and_lumbar_intervertebral_joints'),
      'jointActions',jsonb_build_array('bilateral_shoulder_abduction_isometric_near_shoulder_height','repeated_small_multiplanar_glenohumeral_circles','coordinated_scapular_motion','elbow_extension_isometric','wrist_and_trunk_stabilization'),
      'planes',jsonb_build_array('sagittal_and_frontal_components_in_small_circular_path','transverse_stabilization'),
      'laterality','bilateral simultaneous long-arm circles in one declared direction',
      'supportContacts',jsonb_build_array('left_foot','right_foot'),
      'phaseSequence',jsonb_build_array('standing_bilateral_t_position_start','repeated_small_circles_in_declared_direction','controlled_direction_change','repeated_small_circles_opposite_direction','controlled_arm_lowering'),
      'scapularBoundary','Allow coordinated scapular motion; do not prescribe rigid retraction. Invalid compensation is uncontrolled shrugging arm-height collapse rib flare spinal extension torso rotation stepping or momentum that changes the declared circle.',
      'evidenceBoundary','Sources support the bilateral T-position small-circle task and coordinated shoulder-complex loading but do not validate isolated activation universal mechanics warm-up effects or Vortex scoring.'),
    jsonb_build_object(
      'whyItMatters','Provides a simple reproducible equipment-free bilateral shoulder warm-up when repeated small circles fit better than a slow unilateral full-range Shoulder CAR.',
      'primaryCue','Stand tall, hold both long arms near shoulder height, make small smooth circles together, and reverse only when the interval changes.',
      'expectedSensations',jsonb_build_array('light-to-moderate shoulder and upper-arm effort','scapular and postural endurance','increasing local effort with longer intervals','continuous comfortable breathing'),
      'unexpectedSensations',jsonb_build_array('sharp increasing night or post-trauma pain','pinching catching painful clicking or instability','numbness tingling weakness altered circulation or uncontrolled arm drop','dizziness faintness nausea visual change chest pain unusual breathlessness or disorientation','loss of balance forced range or trunk-driven motion'),
      'painGuidance','Stop the circles, lower both arms under control, signal the coach, and follow facility escalation policy; do not continue through symptoms.',
      'selfChecks',jsonb_build_array('feet_stay_fixed','both_arms_remain_long_near_declared_height','circles_are_small_smooth_and_simultaneous','direction_matches_the_interval','trunk_does_not_create_the_circles','breathing_continues','actual_time_or_complete_circles_are_recorded','no_stop_symptom'),
      'accessibility',jsonb_build_array('front and side demonstration','written four-step sequence','visual arm-height and circle-size markers','lower comfortable arm height','smaller diameter slower pace shorter intervals and more rest','written still-image or live instruction instead of video','separately reviewed seated unilateral bent-elbow or loaded variant when those facts must change'),
      'mediaAlternatives',jsonb_build_array('written sequence','front and side still frames','coach live demonstration','large-print direction and stop checklist'),
      'stopSignal','Stop the circles, lower both arms comfortably, and tell the coach what changed.'),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact bilateral Arm Circle identity','standing base and clearance','arm height elbow shape and circle diameter','simultaneous movement and direction','shoulder and scapular control','shrugging rib flare spinal or torso compensation','breathing symptoms first fault and actual exposure'),
      'faultCorrections',jsonb_build_object('circle_too_large_or_windmill_path','stop_reduce_diameter_and_restore_shoulder_height_task','arms_drop_or_elbows_bend','shorten_interval_lower_comfortable_height_or_end_set','shrug_or_trunk_compensation','reduce_height_diameter_or_pace_and_restore_control','pain_or_instability','end_set_and_follow_escalation_policy','wrong_single_arm_full_range_task','stop_and_select_the_Shoulder_CAR_definition'),
      'demonstrationPlan','Show exact stance, bilateral T-position, small circle size, simultaneous direction, declared change point, valid revolution or time, controlled arm lowering, common windmill and trunk faults, stop signal and lower-height option.',
      'groupManagement',jsonb_build_array('one participant per bilateral arm-clearance envelope','stagger rows so arms cannot contact neighbors','declare direction time or count and stop signal before movement','count invalid partial and symptom-limited seconds as exposure'),
      'modificationDecisionTree',jsonb_build_array('urgent symptom stop and facility protocol','reduce height diameter pace or interval and increase rest first','change base laterality lever or load only through a reviewed variant','select Shoulder CAR only when workout purpose can change','recompute duration fatigue logistics substitution persistence and rendering after every change'),
      'doNotUseWhen',jsonb_build_array('safe standing or bilateral clearance is unavailable','comfortable bilateral arm support is unavailable','symptoms restrictions or clinical instructions conflict','the intended task is a CAR assessment treatment pendulum arm swing or another identity'),
      'validRepetition','One complete simultaneous small revolution by both long arms at the declared comfortable height and direction with fixed feet controlled trunk continuous breathing and no stop rule.'),
    jsonb_build_object(
      'selectionInputs',jsonb_build_array('workout purpose','direction and time or count','standing and bilateral clearance','comfortable arm height','symptoms and restrictions','circle size pace rest and duration','cumulative shoulder scapular and overhead exposure','coach sightline and scope'),
      'durationInputs',jsonb_build_array('setup','actual directional work seconds','direction change','rest','invalid partial or symptom-limited seconds','substitution','station reset'),
      'persistenceFields',jsonb_build_array('definition variant card and research version','direction order','planned and actual seconds or complete circles','arm height circle diameter palm orientation and pace','valid invalid partial and symptom-limited exposure','first fault and compensation','symptoms stop reason and escalation','duration rest substitution and downstream budget'),
      'renderingRequirements',jsonb_build_array('plain-language identity','direction and time or count','four-step sequence','quality gate and stop rules','lower-height and smaller-circle options','no diagnosis treatment readiness or outcome claim'),
      'auditState','machine_complete_review_only','humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  )
  ON CONFLICT(id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,legacy_exercise_id=NULL,slug=EXCLUDED.slug,
    canonical_name=EXCLUDED.canonical_name,display_name=EXCLUDED.display_name,
    aliases=EXCLUDED.aliases,description=EXCLUDED.description,
    family_key=EXCLUDED.family_key,schema_version=EXCLUDED.schema_version,
    card_version=EXCLUDED.card_version,status='review',
    content_confidence=EXCLUDED.content_confidence,
    scoring_confidence=EXCLUDED.scoring_confidence,media_confidence=EXCLUDED.media_confidence,
    movement_patterns=EXCLUDED.movement_patterns,body_regions=EXCLUDED.body_regions,
    required_equipment=EXCLUDED.required_equipment,optional_equipment=EXCLUDED.optional_equipment,
    environment_json=EXCLUDED.environment_json,population_json=EXCLUDED.population_json,
    provenance_json=EXCLUDED.provenance_json,approved_video_url=NULL,
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    anatomy_json=EXCLUDED.anatomy_json,athlete_support_json=EXCLUDED.athlete_support_json,
    coach_support_json=EXCLUDED.coach_support_json,
    support_operations_json=EXCLUDED.support_operations_json,updated_at=now();

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  VALUES
  (shoulder_variant,shoulder_definition,'standing-single-arm-full-range-car',
    'Standing Single-Arm Shoulder CAR — Active Full-Range Loop',
    ARRAY['side','direction_order','comfortable_range','hand_orientation','tempo','brief_pause','breathing_prompt','repetitions','sets','rest','opposite_hand_tactile_feedback']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',30,'absoluteLoadDemand',12,'physicalDifficulty',12,
      'mobilityDemand',38,'stabilityDemand',20,'coordinationDemand',32,
      'workCapacityDemand',8,'supervisionDemand',12,'failureConsequence',10,
      'impact',1,'baseOverallDifficulty',greatest(30,12),
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'exerciseDifficultyDescribesTaskOnly',TRUE,'independentCalibrationRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'equipment',jsonb_build_array(),'optionalEquipment',jsonb_build_array(),
      'supportBase','standing_fixed_feet','laterality','unilateral_side_recorded',
      'activeArm','long_arm_beginning_beside_body','motionSource','active_momentum_free_shoulder_complex_motion',
      'exactSequence',jsonb_build_array('long_arm_beside_body_start','forward_and_overhead_elevation','intentional_humeral_rotation_as_needed','behind_and_downward_sweep','return_to_same_start','reverse_direction_separately'),
      'countingRule','one_complete_return_to_start_loop_in_one_declared_direction_is_one_repetition',
      'validCompletion','feet remain fixed one long arm actively traces a slow largest-comfortable loop returns to the same start ribs spine and pelvis do not create the range breathing continues and no stop rule occurs',
      'invalidCompletion',jsonb_build_array('momentum_or_swinging','elbow_bend_used_to_clear_range','wrist_only_rotation','step_or_balance_loss','rib_flare','spinal_extension_or_lateral_bend','torso_rotation','forced_range','incomplete_loop','breath_hold','symptom_stop'),
      'variantBoundaries',jsonb_build_array('base','laterality','assistance','external_load','path','range_contract','multi_joint_sequence','clinical_scope','count'),
      'normalScapularMotionAllowed',TRUE,'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','active_open_chain_arm_mass_against_gravity','externalLoadMethod','none_active_arm_mass_and_gravity_only',
      'gripDemand',1,'jointStress',12,'spinalLoading',1,'eccentricStress',6,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('active_multiplanar_shoulder_circumduction','glenohumeral_and_scapular_coordination','deltoid_rotator_cuff_and_scapular_muscle_coordination','arm_lever_end_range_control','trunk_anti_compensation'),
      'tracking',jsonb_build_array('definition_and_variant','side_and_direction','complete_loops','range_and_path','tempo_and_pauses','first_fault','trunk_compensation','symptoms','actual_work_seconds','rest','duration','same_session_shoulder_and_overhead_exposure')),
    jsonb_build_object(
      'localMuscleFatigue',12,'gripFatigue',1,'technicalFatigueSensitivity',30,
      'impactAccumulation',1,'recoveryHours',8,'recoveryRangeHours',jsonb_build_array(4,16),
      'primaryFatigueSites',jsonb_build_array('deltoids','rotator_cuff','scapular_stabilizers','trunk_postural_stabilizers','attention_and_end_range_control'),
      'cumulativeBudget',jsonb_build_object('completeLoopsPerSide',15,'activeShoulderSecondsPerSide',300,'endRangeControlSeconds',120,'technicalSensitivity',30,'impact',1),
      'interference',jsonb_build_array('later_high_priority_throwing_climbing_hanging_handstand_pressing_or_overhead_work','same_session_end_range_or_rotator_cuff_loading','fatigue_that_increases_momentum_trunk_compensation_or_uncontrolled_range'),
      'recoveryIsPlanningEstimate',TRUE,'tissueThresholdNotEstablished',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('active_multiplanar_shoulder_control','comfortable_end_range_control','shoulder_trunk_dissociation','side_and_direction_specific_motion_exposure'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,2),'completeLoopsPerSidePerDirection',jsonb_build_array(1,5),'secondsPerLoop',jsonb_build_array(5,15),'restSeconds',jsonb_build_array(15,45)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_unsupported_standing','clear_full_arm_path','comfortable_active_shoulder_motion','same_start_loop_and_stop_understood','momentum_and_trunk_compensation_control','same_session_shoulder_and_overhead_budgets_fit'),
      'completionCriteria',jsonb_build_array('fixed_feet','one_long_active_arm','slow_momentum_free_loop','comfortable_range','intentional_humeral_rotation','quiet_ribs_spine_and_pelvis','same_start_return','continuous_breathing','no_stop_symptoms'),
      'sequenceRules',jsonb_build_array('prepare_access_or_restore_context','record_side_and_direction_separately','do_not_freeze_normal_scapular_motion','do_not_convert_to_bilateral_arm_circles_or_passive_pendulum','revalidate_downstream_shoulder_and_overhead_load'),
      'interferenceRules',jsonb_build_array('count_all_overlapping_end_range_shoulder_and_scapular_work','count_later_throwing_climbing_hanging_handstand_pressing_and_overhead_demand','stop_before_momentum_compensation_or_symptoms_change_the_task'),
      'uncertaintyPolicy','When exact base side direction active path count symptoms clearance or available time is uncertain do not select; request clarification or use a separately validated card.',
      'selectionStatus','review_only_machine_complete','publicationQuarantined',TRUE,
      'exerciseDifficultyDescribesTaskOnly',TRUE,'approvalsCreated',FALSE)),
  (arm_circle_variant,arm_circle_definition,'standing-bilateral-small-circles',
    'Standing Bilateral Arm Circles — Shoulder Height, Small Circles',
    ARRAY['circle_diameter','comfortable_arm_height','palm_orientation','direction_order','tempo','seconds_or_repetitions','sets','rest','breathing_prompt']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',16,'absoluteLoadDemand',14,'physicalDifficulty',14,
      'mobilityDemand',16,'stabilityDemand',14,'coordinationDemand',16,
      'workCapacityDemand',14,'supervisionDemand',8,'failureConsequence',8,
      'impact',1,'baseOverallDifficulty',greatest(16,14),
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'exerciseDifficultyDescribesTaskOnly',TRUE,'independentCalibrationRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'equipment',jsonb_build_array(),'optionalEquipment',jsonb_build_array(),
      'supportBase','standing_fixed_feet','laterality','bilateral_simultaneous',
      'armPosition','both_long_arms_laterally_near_declared_comfortable_shoulder_height',
      'exactSequence',jsonb_build_array('standing_bilateral_t_position_start','repeated_small_circles_declared_direction','controlled_direction_change','repeated_small_circles_opposite_direction','controlled_arm_lowering'),
      'countingRule','one_complete_simultaneous_small_revolution_by_both_arms_is_one_repetition_or_record_actual_seconds_per_direction',
      'validCompletion','feet remain fixed both long arms retain declared comfortable height small smooth circles occur simultaneously in the declared direction trunk remains controlled breathing continues and no stop rule occurs',
      'invalidCompletion',jsonb_build_array('large_windmill_path','unilateral_or_alternating_action','elbow_bend_changes_lever','arm_height_collapse','uncontrolled_shrug','step_or_balance_loss','rib_flare_or_trunk_rotation','forced_range','breath_hold','symptom_stop'),
      'variantBoundaries',jsonb_build_array('base','laterality','arm_lever','external_load','large_windmill_range','swing_or_roll_action','pendulum_scope','assessment_scope'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','bilateral_open_chain_arm_mass_held_near_shoulder_height','externalLoadMethod','none_active_bilateral_arm_mass_and_gravity_only',
      'gripDemand',1,'jointStress',12,'spinalLoading',1,'eccentricStress',4,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('bilateral_shoulder_height_arm_support','repeated_small_shoulder_circles','deltoid_and_scapular_endurance','trunk_postural_control'),
      'tracking',jsonb_build_array('definition_and_variant','direction_order','actual_seconds_or_complete_circles','arm_height','circle_diameter','palm_orientation','tempo','first_fault','symptoms','rest','duration','same_session_shoulder_and_overhead_exposure')),
    jsonb_build_object(
      'localMuscleFatigue',14,'gripFatigue',1,'technicalFatigueSensitivity',16,
      'impactAccumulation',1,'recoveryHours',8,'recoveryRangeHours',jsonb_build_array(4,16),
      'primaryFatigueSites',jsonb_build_array('middle_and_anterior_deltoids','rotator_cuff','scapular_stabilizers','upper_arm','trunk_postural_stabilizers'),
      'cumulativeBudget',jsonb_build_object('shoulderHeightArmSeconds',180,'completeCirclesPerDirection',60,'technicalSensitivity',16,'impact',1),
      'interference',jsonb_build_array('later_high_priority_overhead_throwing_hanging_handstand_or_pressing_work','same_session_deltoid_or_scapular_endurance_loading','fatigue_that_drops_arm_height_enlarges_circles_or_increases_trunk_motion'),
      'recoveryIsPlanningEstimate',TRUE,'tissueThresholdNotEstablished',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('simple_bilateral_shoulder_warmup','shoulder_height_arm_endurance','small_circle_coordination','direction_change_control'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,2),'secondsPerDirection',jsonb_build_array(10,30),'completeCirclesPerDirection',jsonb_build_array(5,20),'restSeconds',jsonb_build_array(15,45)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_unsupported_standing','clear_bilateral_arm_space','comfortable_bilateral_shoulder_height_support','direction_interval_or_count_and_stop_understood','same_session_shoulder_and_overhead_budgets_fit'),
      'completionCriteria',jsonb_build_array('fixed_feet','both_arms_long_near_declared_height','small_smooth_simultaneous_circles','correct_direction','controlled_trunk','continuous_breathing','no_stop_symptoms'),
      'sequenceRules',jsonb_build_array('prepare_and_access_context','declare_time_or_count_and_direction_order','do_not_convert_to_full_range_Shoulder_CAR_or_large_windmills','do_not_add_load_or_change_base_laterality_or_lever_silently','revalidate_downstream_shoulder_and_overhead_load'),
      'interferenceRules',jsonb_build_array('count_all_shoulder_height_arm_seconds_and_overlapping_deltoid_scapular_work','count_later_throwing_hanging_handstand_pressing_and_overhead_demand','stop_before_arm_drop_large_circles_trunk_compensation_or_symptoms_change_the_task'),
      'uncertaintyPolicy','When exact base arm position circle size direction time or count symptoms clearance or available time is uncertain do not select; request clarification or use a separately validated card.',
      'selectionStatus','review_only_machine_complete','publicationQuarantined',TRUE,
      'exerciseDifficultyDescribesTaskOnly',TRUE,'approvalsCreated',FALSE))
  ON CONFLICT(id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,requirements_json=EXCLUDED.requirements_json,
    status='review',load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    id,variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT p.id,shoulder_variant,p.profile_key,p.phase_key,'primary',
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Use the exact unilateral Shoulder CAR as a slow active shoulder-motion preparation task only when standing, clearance, symptoms, direction-specific dose, duration, and cumulative shoulder and overhead budgets fit.'
    ELSE
      'Use the exact unilateral Shoulder CAR as low-load active movement practice in Restore without turning it into passive stretching, treatment, assessment, forced range, or fatigue work.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 92 ELSE 84 END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 88 ELSE 82 END,
    jsonb_build_object('active_shoulder_motion',96,'shoulder_trunk_dissociation',90,'direction_specific_control',88,'readiness_scan_without_diagnosis',CASE WHEN p.phase_key='prepare_and_access' THEN 78 ELSE 64 END,'restore_motion_practice',CASE WHEN p.phase_key='restore' THEN 90 ELSE 62 END),
    jsonb_build_object('sets',jsonb_build_array(1,2),'completeLoopsPerSidePerDirection',jsonb_build_array(1,5),'secondsPerLoop',jsonb_build_array(5,15),'restSeconds',jsonb_build_array(15,45),'exampleDoseIsNotUniversal',TRUE),
    'Feet stay fixed; one long arm actively traces a slow momentum-free largest-comfortable loop, rotates as needed, returns to the same start, and is recorded by side and direction while the ribs, spine and pelvis do not create range, breathing continues, and no stop symptom occurs.',
    ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain or participant stop request.',
      'Shoulder pinching, catching, painful clicking, instability, guarding, or uncontrolled arm lowering.',
      'Numbness, tingling, weakness, pins and needles, altered circulation, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'Hand, wrist, elbow, shoulder, neck, back, balance, or standing symptoms prevent the exact task.',
      'Momentum, elbow bending, wrist-only rotation, stepping, rib flare, spinal extension, lateral bend, or torso rotation cannot be corrected by reducing range, loops, or pace.',
      'The participant forces range, holds breath, pins the scapula, uses passive assistance, adds load, or drifts into another task.',
      'Floor, full arm path, neighbor clearance, traffic, sightline, communication, or emergency route becomes unsafe.',
      'The planned side, direction, loop, active-seconds, technical-fatigue, duration, or downstream shoulder and overhead budget is reached.'
    ]::TEXT[],
    'Verify the exact standing unilateral active Shoulder CAR, side, direction, full arm-sweep clearance, symptoms, restrictions, planned loops, actual seconds, and downstream shoulder demand. Demonstrate front-quarter and side views. Count only one active momentum-free same-start loop. Observe the long arm, humeral rotation, scapular motion, ribs, spine, pelvis, feet, range, breathing, first fault, symptoms and duration. Do not diagnose or interpret the movement as clearance.',
    'Stand tall. Keep your feet and ribs quiet while one long arm makes a slow comfortable full circle, rotating as needed, and returns to the same start. Stop for pain, pinching, tingling, weakness, dizziness, or loss of control.',
    'More consistent active control of the exact standing unilateral Shoulder CAR path; no mobility gain, structural change, treatment, readiness, prevention, or performance outcome is guaranteed.',
    ARRAY[]::TEXT[],
    jsonb_build_object('stationCapacity',1,'base','standing_fixed_feet','requiredEquipment','none','space','complete_unilateral_arm_sweep_envelope','setupSeconds',15,'sideChangeSeconds',5,'directionChangeSeconds',5,'coachSightline','front_quarter_and_side','crossTrafficProhibited',TRUE,'revalidateAfterAnyChange',TRUE),
    ARRAY[arm_circle_variant,quadruped_variant,dowel_variant,full_body_variant]::UUID[],
    'review',
    jsonb_build_object('durationFormula','setup_seconds + sum(actual_valid_loops * actual_seconds_per_loop) + side_change_seconds + direction_change_seconds + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + station_reset_seconds','secondsPerLoop',jsonb_build_array(5,15),'minimumSeconds',35,'typicalSeconds',90,'maximumSecondsWithoutReview',300,'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('reduce_comfortable_range','slow_and_smooth_the_path','reduce_to_one_loop_per_side_per_direction','use_opposite_hand_non_assisting_feedback','increase_rest','stop_and_select_a_separately_reviewed_base_or_action'),'progressionOrder',jsonb_build_array('complete_clean_loops_both_directions','increase_within_one_to_five_loops','slow_to_fifteen_seconds_per_loop','add_brief_owned_checkpoints','select_a_distinct_loaded_supported_or_multi_joint_task_only_after_full_revalidation'),'neverScaleByForcingRangeUsingMomentumAddingLoadOrIgnoringSymptoms',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_and_variant','side_and_direction','planned_and_actual_complete_loops','range_path_hand_orientation_tempo_and_pauses','valid_invalid_partial_and_symptom_limited_attempts','feet_long_arm_scapular_trunk_and_breathing_rule','first_fault','symptoms_and_stop_reason','active_seconds','duration','rest','substitution','downstream_budget'),'validUnit','one_active_long_arm_momentum_free_loop_in_one_direction_returning_to_same_start_with_fixed_feet_comfortable_range_controlled_trunk_and_no_stop','partial_loops_do_not_count',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('fixed_feet','one_long_arm','slow_comfortable_loop','rotate_as_needed','same_start_return','side_direction_and_stop'),'coach',jsonb_build_array('identity_and_clearance','side_direction_and_count','active_path_and_humeral_rotation','scapular_motion_without_rigid_pinning','trunk_compensation_and_first_fault','actual_exposure_and_downstream_budget','clinical_scope_logging_and_escalation'),'accessibility',jsonb_build_array('front_quarter_and_side_demonstration','written_six_step_path','visual_path_markers','opposite_hand_non_assisting_feedback','smaller_range_slower_pace_fewer_loops_and_more_rest','separately_reviewed_seated_wall_quadruped_or_assisted_alternative'))
  FROM (VALUES
    ('00481e94-27ee-468b-97ca-283b45b0986a'::UUID,'prepare-standing-single-arm-shoulder-car','prepare_and_access'),
    ('84bf8bec-2631-406a-9117-b7dcf545f34a'::UUID,'restore-standing-single-arm-shoulder-car','restore')
  ) p(id,profile_key,phase_key)
  ON CONFLICT(id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,profile_key=EXCLUDED.profile_key,
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,coach_instructions=EXCLUDED.coach_instructions,
    athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,
    equipment_required=EXCLUDED.equipment_required,logistics_json=EXCLUDED.logistics_json,
    substitution_ids=EXCLUDED.substitution_ids,status='review',
    time_model_json=EXCLUDED.time_model_json,dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    id,variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  VALUES(
    'db782983-d4ae-4c46-858d-39ee0d06c06a',arm_circle_variant,
    'prepare-standing-bilateral-arm-circles','prepare_and_access','primary',
    'Use the exact bilateral shoulder-height small-circle task as a simple warm-up only when standing, bilateral clearance, comfortable arm support, direction and time or count, duration, and cumulative shoulder and overhead budgets fit.',
    88,84,
    jsonb_build_object('simple_shoulder_warmup',94,'bilateral_coordination',84,'shoulder_height_endurance',78,'direction_change_control',82),
    jsonb_build_object('sets',jsonb_build_array(1,2),'secondsPerDirection',jsonb_build_array(10,30),'completeCirclesPerDirection',jsonb_build_array(5,20),'restSeconds',jsonb_build_array(15,45),'exampleDoseIsNotUniversal',TRUE),
    'Feet stay fixed, both long arms remain near the declared comfortable height, small circles stay smooth and simultaneous in the declared direction, the trunk does not create the motion, breathing continues, and no stop symptom occurs.',
    ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain or participant stop request.',
      'Shoulder pinching, catching, painful clicking, instability, guarding, or uncontrolled arm lowering.',
      'Numbness, tingling, weakness, altered circulation, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'Hand, wrist, elbow, shoulder, neck, back, balance, or standing symptoms prevent the exact task.',
      'Arm-height collapse, elbow bending, large windmill circles, asymmetry, shrugging, stepping, rib flare, spinal extension, or torso rotation cannot be corrected safely.',
      'The participant forces range, holds breath, adds weight, changes to unilateral action, or drifts into Shoulder CARs, arm swings, shoulder rolls, or another task.',
      'Floor, bilateral arm clearance, neighbor spacing, traffic, sightline, communication, or emergency route becomes unsafe.',
      'The planned directional seconds or circles, shoulder-height arm time, technical-fatigue, duration, or downstream shoulder and overhead budget is reached.'
    ]::TEXT[],
    'Verify the exact standing bilateral Arm Circle task, direction order, time or count, comfortable arm height, circle size, clearance, symptoms, restrictions, planned and actual exposure, and downstream shoulder demand. Demonstrate front and side views; observe feet, arm height, elbows, simultaneous circles, direction, shrugging, trunk compensation, breathing, first fault, symptoms and duration. Do not diagnose or imply readiness.',
    'Stand tall with both long arms near shoulder height. Make small smooth circles together and reverse when the interval changes. Stop for pain, pinching, tingling, weakness, dizziness, or loss of control.',
    'More consistent execution of the exact bilateral small-circle warm-up; no mobility gain, injury prevention, readiness, structural, treatment, or performance outcome is guaranteed.',
    ARRAY[]::TEXT[],
    jsonb_build_object('stationCapacity',1,'base','standing_fixed_feet','requiredEquipment','none','space','bilateral_shoulder_height_arm_clearance','setupSeconds',10,'directionChangeSeconds',3,'coachSightline','front_and_side','neighborSpacingRequired',TRUE,'crossTrafficProhibited',TRUE,'revalidateAfterAnyChange',TRUE),
    ARRAY[shoulder_variant,wall_slide_variant,band_rotation_variant]::UUID[],
    'review',
    jsonb_build_object('durationFormula','setup_seconds + actual_forward_or_first_direction_seconds + direction_change_seconds + actual_backward_or_second_direction_seconds + rest_seconds + invalid_or_partial_seconds + symptom_response_seconds + substitution_seconds + station_reset_seconds','secondsPerDirection',jsonb_build_array(10,30),'minimumSeconds',30,'typicalSeconds',70,'maximumSecondsWithoutReview',240,'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('reduce_comfortable_arm_height','reduce_circle_diameter','slow_the_circle','shorten_to_ten_seconds_per_direction','increase_rest','stop_and_select_a_separately_reviewed_base_or_action'),'progressionOrder',jsonb_build_array('complete_clean_time_both_directions','increase_within_ten_to_thirty_seconds','increase_circle_count_within_profile','adjust_to_moderate_diameter_without_windmill_path','select_a_distinct_loaded_unilateral_or_large_range_task_only_after_full_revalidation'),'neverScaleByForcingHeightAddingWeightUsingLargeWindmillsOrIgnoringSymptoms',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_and_variant','direction_order','planned_and_actual_seconds_or_complete_circles','arm_height_circle_diameter_palm_orientation_and_tempo','valid_invalid_partial_and_symptom_limited_exposure','feet_elbow_arm_height_symmetry_trunk_and_breathing_rule','first_fault','symptoms_and_stop_reason','duration','rest','substitution','downstream_budget'),'validUnit','one_complete_simultaneous_small_revolution_by_both_long_arms_at_declared_height_and_direction_with_fixed_feet_controlled_trunk_and_no_stop_or_actual_valid_seconds','invalid_seconds_still_count_as_exposure',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('fixed_feet','both_long_arms','comfortable_height','small_smooth_circles','declared_direction','controlled_lower_and_stop'),'coach',jsonb_build_array('identity_and_clearance','direction_time_or_count','arm_height_circle_size_and_symmetry','trunk_compensation_and_first_fault','actual_exposure_and_downstream_budget','clinical_scope_logging_and_escalation'),'accessibility',jsonb_build_array('front_and_side_demonstration','written_four_step_sequence','visual_height_and_circle_markers','lower_height_smaller_diameter_slower_pace_shorter_interval_and_more_rest','separately_reviewed_seated_unilateral_bent_elbow_or_loaded_alternative')))
  ON CONFLICT(id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,profile_key=EXCLUDED.profile_key,
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,coach_instructions=EXCLUDED.coach_instructions,
    athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,
    equipment_required=EXCLUDED.equipment_required,logistics_json=EXCLUDED.logistics_json,
    substitution_ids=EXCLUDED.substitution_ids,status='review',
    time_model_json=EXCLUDED.time_model_json,dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,i.survivor_id,i.resolved_id,'distinct_exercises',i.rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',i.boundary_key,
      'leftContract',i.left_contract,'rightContract',i.right_contract,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (shoulder_definition,arm_circle_definition,'shoulder_car_vs_arm_circles','A unilateral slow active full-range same-start loop with intentional humeral rotation is not a bilateral shoulder-height repeated small-circle interval.','unilateral_active_full_range_shoulder_car','bilateral_shoulder_height_repeated_small_circles'),
    (shoulder_definition,neck_definition,'shoulder_car_vs_neck_cars','A long arm tracing active shoulder-complex circumduction around the glenohumeral joint is not a head-and-neck path through cervical flexion, lateral flexion, extension, and rotation.','upper_limb_shoulder_complex_circumduction','head_and_cervical_spine_circumduction'),
    (shoulder_definition,dowel_definition,'shoulder_car_vs_dowel_pass_through','A dowel pass-through requires bilateral implement grip and an overhead pass arc, changing equipment, laterality, path, range constraint and count.','unilateral_no_equipment_active_car','bilateral_dowel_pass_through'),
    (shoulder_definition,band_rotation_definition,'shoulder_car_vs_band_external_rotation','Band external rotation retains elbows beside the ribs against elastic resistance rather than tracing an unloaded full arm circumduction.','unloaded_full_arm_circumduction','band_resisted_elbows_at_sides_rotation'),
    (arm_circle_definition,quadruped_definition,'standing_arm_circles_vs_quadruped_shoulder_circles','Standing open-chain long-arm circles differ from fixed bilateral hand-and-knee support and a closed-chain scapular circle.','standing_open_chain_bilateral_arm_circles','quadruped_fixed_contact_scapular_circle'),
    (arm_circle_definition,wall_slide_definition,'arm_circles_vs_wall_slide_lift_off','Repeated unsupported small circles differ from wall-supported forearm ascent, terminal full-arm lift-off, replacement and descent.','unsupported_small_circles','wall_supported_slide_lift_off_sequence'),
    (arm_circle_definition,full_body_definition,'arm_circles_vs_full_body_car_flow','A shoulder-only repeated-circle interval is not an ordered eight-region joint CAR flow.','shoulder_only_repeated_circles','complete_eight_region_ordered_flow')
  ) i(survivor_id,resolved_id,boundary_key,rationale,left_contract,right_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT e.definition_id,e.card_version,e.section_key,e.source_url,e.source_title,
    e.publisher,e.source_kind,jsonb_build_array(
      jsonb_build_object('supported',e.supported_claim,'scope',e.scope),
      jsonb_build_object('limitation',e.limitation,
        'noUniversalShapeRangeTechniqueSafetyEligibilityDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    (shoulder_definition,2,'identity','https://mindbodyspine.ca/mobility-for-shoulders-controlled-articular-rotations-cars/','Mobility for Shoulders – Controlled Articular Rotations','Mind Body Spine','expert_instruction','The direct sequence starts with one arm beside the body, moves overhead, intentionally changes hand orientation, continues behind and down to start, reverses direction, and repeats on the other side.','direct exact-task identity and instruction','The source does not define every Vortex base count compensation population or neighbor boundary.',78),
    (shoulder_definition,2,'taxonomy','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','ACE distinguishes slow deliberate momentum-free joint rotation through active pain-free multidirectional range from ordinary arm circles.','movement taxonomy and identity context','ACE does not create Vortex controlled keys or validate outcomes for this card.',88),
    (shoulder_definition,2,'anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC6368381/','Patterns of muscle coordination during dynamic glenohumeral joint elevation','PLOS ONE','peer_reviewed_research','Healthy adults showed coordinated rotator-cuff deltoid and scapulothoracic muscle activity across multiple planes of elevation.','coordinated shoulder-complex anatomy context','The study is not an exact CAR trial and does not establish isolated activation.',88),
    (shoulder_definition,2,'biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC12398250/','Scapular kinematics variability in individuals with and without rotator cuff-related shoulder pain','Brazilian Journal of Physical Therapy','peer_reviewed_research','The systematic review found scapular upward rotation and posterior tilt during elevation with substantial normal variability and no fixed setting phase.','scapular motion and compensation boundary','The review does not validate one CAR path or permit diagnosis from observed movement.',94),
    (shoulder_definition,2,'difficulty','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','A CAR deliberately removes momentum and coordinates intentional active motion through available planes.','exercise-complexity context','The source does not score the task or classify participant proficiency age or readiness.',88),
    (shoulder_definition,2,'load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC4932079/','Analysis of scapular kinematics during active and passive arm elevation','Journal of Physical Therapy Science','peer_reviewed_research','Active and passive elevation produced different scapular and muscle-activity contexts in healthy participants.','active-load and exposure context','The study does not quantify exact CAR fatigue thresholds cumulative limits or recovery hours.',84),
    (shoulder_definition,2,'constraints','https://pubmed.ncbi.nlm.nih.gov/40165544/','Rotator Cuff Tendinopathy Diagnosis, Nonsurgical Medical Care, and Rehabilitation: A Clinical Practice Guideline','Journal of Orthopaedic & Sports Physical Therapy','professional_standard','Diagnosis treatment prognosis and return-to-function decisions require appropriate professional context.','clinical scope boundary','The guideline does not make a workout CAR a diagnosis treatment assessment or clearance tool.',94),
    (shoulder_definition,2,'dosage','https://mindbodyspine.ca/mobility-for-shoulders-controlled-articular-rotations-cars/','Mobility for Shoulders – Controlled Articular Rotations','Mind Body Spine','expert_instruction','The direct instruction calls for slow comfortable motion in both directions and on both shoulders without a universal set or repetition prescription.','direction and side delivery context','The Vortex loop and time ranges remain review-only rather than validated universal doses.',78),
    (shoulder_definition,2,'instructions','https://mindbodyspine.ca/mobility-for-shoulders-controlled-articular-rotations-cars/','Mobility for Shoulders – Controlled Articular Rotations','Mind Body Spine','expert_instruction','The direct path includes forward and overhead travel palm rotation continued backward and downward travel same-start return reverse direction and both sides.','direct instruction sequence','Vortex adds exact base long-arm trunk count stop persistence and duration rules.',78),
    (shoulder_definition,2,'safety_stop_rules','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','ACE frames CARs as controlled and pain-free and separates basic exercise use from individualized assessment and treatment scope.','range symptom and scope context','Facility trauma neurologic cardiopulmonary incident space and emergency rules remain separately required.',88),
    (shoulder_definition,2,'programming','https://pmc.ncbi.nlm.nih.gov/articles/PMC2841046/','In vivo assessment of scapulohumeral rhythm during unconstrained overhead reaching','Journal of Shoulder and Elbow Surgery','peer_reviewed_research','Bone-fixed measurement shows coordinated glenohumeral and scapular motion and direction differences during active raising and lowering.','direction-specific active exposure context','The study does not validate a CAR outcome dose readiness inference or universal path.',88),
    (shoulder_definition,2,'athlete_support','https://mindbodyspine.ca/mobility-for-shoulders-controlled-articular-rotations-cars/','Mobility for Shoulders – Controlled Articular Rotations','Mind Body Spine','expert_instruction','The instruction supplies clear start path hand-turn comfort reverse-direction and other-side checkpoints.','plain-language participant support','It does not establish universal sensations accessibility symptom meaning or eligibility.',78),
    (shoulder_definition,2,'coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC12398250/','Scapular kinematics variability in individuals with and without rotator cuff-related shoulder pain','Brazilian Journal of Physical Therapy','peer_reviewed_research','Normal scapular kinematics vary substantially and do not support one rigid normal-motion template.','observation without diagnosis','The review does not prescribe Vortex layout correction escalation or approval.',94),
    (shoulder_definition,2,'accessibility','https://mindbodyspine.ca/mobility-for-shoulders-controlled-articular-rotations-cars/','Mobility for Shoulders – Controlled Articular Rotations','Mind Body Spine','expert_instruction','The task can be explained with start overhead rotate sweep behind return reverse and other-side checkpoints while range remains comfortable.','communication and range-scaling context','Changing base assistance load or clinical purpose requires another reviewed card.',78),
    (shoulder_definition,2,'alternates','https://extension.missouri.edu/sites/default/files/legacy_media/wysiwyg/Extensiondata/Pub/pdf/n862.pdf','Physical Activity Cards: Arm Circles','University of Missouri Extension','professional_standard','Missouri Arm Circles use both arms in a T and repeated small forward then backward circles for time.','direct distinct-task boundary','The source does not adjudicate every Vortex alternate or approve graph edges.',84),
    (shoulder_definition,2,'media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five Shoulder CAR candidates returned current oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata only','oEmbed does not prove playback exact path count captions accessibility quality safety card match or approval.',82),
    (arm_circle_definition,1,'identity','https://extension.missouri.edu/sites/default/files/legacy_media/wysiwyg/Extensiondata/Pub/pdf/n862.pdf','Physical Activity Cards: Arm Circles','University of Missouri Extension','professional_standard','The direct card uses fixed standing both arms raised to a T small circles forward and backward intervals and time-based dosing.','direct exact-task identity and instruction','The source does not define every Vortex elbow count compensation population or neighbor boundary.',84),
    (arm_circle_definition,1,'taxonomy','https://extension.missouri.edu/sites/default/files/legacy_media/wysiwyg/Extensiondata/Pub/pdf/n862.pdf','Physical Activity Cards: Arm Circles','University of Missouri Extension','professional_standard','The task is an equipment-free standing bilateral shoulder warm-up.','movement and equipment context','The source does not create Vortex controlled keys or guarantee adaptation.',84),
    (arm_circle_definition,1,'anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC6368381/','Patterns of muscle coordination during dynamic glenohumeral joint elevation','PLOS ONE','peer_reviewed_research','Multi-planar shoulder elevation involves coordinated deltoid rotator-cuff and scapulothoracic muscle activity.','coordinated shoulder-complex anatomy context','The study is not an exact Arm Circle trial and does not establish isolated activation.',88),
    (arm_circle_definition,1,'biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC12398250/','Scapular kinematics variability in individuals with and without rotator cuff-related shoulder pain','Brazilian Journal of Physical Therapy','peer_reviewed_research','Scapular motion accompanies arm elevation and shows substantial normal variability.','scapular motion boundary','The review does not define exact Arm Circle kinematics or support diagnosis from motion.',94),
    (arm_circle_definition,1,'difficulty','https://extension.missouri.edu/sites/default/files/legacy_media/wysiwyg/Extensiondata/Pub/pdf/n862.pdf','Physical Activity Cards: Arm Circles','University of Missouri Extension','professional_standard','The direct task maintains both arms near shoulder height while coordinating small repeated circles and a direction change.','exercise-complexity and physical-demand context','The source does not score the task or classify participant proficiency age or readiness.',84),
    (arm_circle_definition,1,'load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC6368381/','Patterns of muscle coordination during dynamic glenohumeral joint elevation','PLOS ONE','peer_reviewed_research','Shoulder elevation recruits coordinated muscle activity without external equipment.','active-load and local-fatigue context','The study does not quantify Arm Circle fatigue thresholds budgets or recovery hours.',88),
    (arm_circle_definition,1,'constraints','https://pubmed.ncbi.nlm.nih.gov/40165544/','Rotator Cuff Tendinopathy Diagnosis, Nonsurgical Medical Care, and Rehabilitation: A Clinical Practice Guideline','Journal of Orthopaedic & Sports Physical Therapy','professional_standard','Shoulder diagnosis treatment prognosis and return-to-function decisions require appropriate clinical context.','clinical scope boundary','The guideline does not make this warm-up a screen treatment or clearance tool.',94),
    (arm_circle_definition,1,'dosage','https://extension.missouri.edu/sites/default/files/legacy_media/wysiwyg/Extensiondata/Pub/pdf/n862.pdf','Physical Activity Cards: Arm Circles','University of Missouri Extension','professional_standard','The source gives a context-specific example of thirty seconds forward thirty seconds backward rest and a second set.','example dose context','The example is not a universal prescription and does not validate Vortex fatigue or recovery limits.',84),
    (arm_circle_definition,1,'instructions','https://extension.missouri.edu/sites/default/files/legacy_media/wysiwyg/Extensiondata/Pub/pdf/n862.pdf','Physical Activity Cards: Arm Circles','University of Missouri Extension','professional_standard','The direct sequence is stable standing arms in a T repeated small circles and direction reversal.','direct instruction sequence','Vortex adds simultaneous action long-arm count stop persistence and duration rules.',84),
    (arm_circle_definition,1,'safety_stop_rules','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','ACE distinguishes deliberate controlled joint motion from swinging and emphasizes pain-free motion and professional scope.','control symptom and scope context','Facility trauma neurologic systemic incident clearance and emergency rules remain separately required.',88),
    (arm_circle_definition,1,'programming','https://extension.missouri.edu/sites/default/files/legacy_media/wysiwyg/Extensiondata/Pub/pdf/n862.pdf','Physical Activity Cards: Arm Circles','University of Missouri Extension','professional_standard','The source places Arm Circles in a limited-space warm-up context.','phase and logistics context','It does not prove readiness performance transfer injury prevention or ideal ordering.',84),
    (arm_circle_definition,1,'athlete_support','https://extension.missouri.edu/sites/default/files/legacy_media/wysiwyg/Extensiondata/Pub/pdf/n862.pdf','Physical Activity Cards: Arm Circles','University of Missouri Extension','professional_standard','The task has simple stance T-position small-circle and direction checkpoints.','plain-language participant support','It does not establish universal sensations access symptom meaning or eligibility.',84),
    (arm_circle_definition,1,'coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC12398250/','Scapular kinematics variability in individuals with and without rotator cuff-related shoulder pain','Brazilian Journal of Physical Therapy','peer_reviewed_research','Normal scapular motion varies and does not justify a rigid normal pattern.','observation without diagnosis','The review does not prescribe Vortex corrections group layout escalation or approval.',94),
    (arm_circle_definition,1,'accessibility','https://extension.missouri.edu/sites/default/files/legacy_media/wysiwyg/Extensiondata/Pub/pdf/n862.pdf','Physical Activity Cards: Arm Circles','University of Missouri Extension','professional_standard','The movement can be taught with visual stance T-position circle-size direction and time cues and needs no equipment.','communication and range-scaling context','Seated unilateral bent-elbow loaded or large-range execution requires another reviewed variant.',84),
    (arm_circle_definition,1,'alternates','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','ACE explicitly distinguishes momentum-free full-joint CARs from ordinary Arm Circles.','direct definition boundary','ACE does not adjudicate every Vortex alternate or approve graph edges.',88),
    (arm_circle_definition,1,'media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Four Arm Circle candidates returned current oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata only','oEmbed does not prove playback exact T-position circle size direction count captions accessibility quality safety card match or approval.',82)
  ) e(definition_id,card_version,section_key,source_url,source_title,publisher,source_kind,supported_claim,scope,limitation,quality)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url) DO UPDATE SET
    source_title=EXCLUDED.source_title,source_publisher=EXCLUDED.source_publisher,
    source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
    evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,duration_seconds,language_code,captions_available,
    embedding_allowed,exact_variant_match,demonstration_quality_score,
    link_status,review_status,discovery_method,source_query,reviewer_user_id,
    reviewed_at,next_review_at,notes)
  SELECT m.definition_id,m.variant_id,m.card_version,
    'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,
    m.video_id,m.title,m.channel,NULL,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',m.query,NULL,NULL,
    '2026-11-09'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Playback exact setup path arm position direction count captions accessibility cue quality safety reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    (shoulder_definition,shoulder_variant,2,'2hyNG1U5wYs','How To Do Shoulder CARS (Controlled Articular Rotations) | Movement Breakdown','LivingFit','Source 37 Shoulder CAR candidate checked by YouTube oEmbed'),
    (shoulder_definition,shoulder_variant,2,'898QrvpmRWc','Functional Range Conditioning - Shoulder CARs','Melissa Ray Fitness','Source 37 Shoulder CAR candidate checked by YouTube oEmbed'),
    (shoulder_definition,shoulder_variant,2,'CLWFwun1BfQ','Controlled Articular Rotations (CARs) - Shoulder','Tangelo - Seattle Chiropractor + Rehab','Source 37 Shoulder CAR candidate checked by YouTube oEmbed'),
    (shoulder_definition,shoulder_variant,2,'P6p0IamojmE','Standing Shoulder CARs','Functional Bodybuilding','Source 37 Shoulder CAR candidate checked by YouTube oEmbed'),
    (shoulder_definition,shoulder_variant,2,'Ag1yVYbPXeg','Shoulder CAR (Controlled Articular Rotations)','Dr. Beau Beard','Source 37 Shoulder CAR candidate checked by YouTube oEmbed'),
    (arm_circle_definition,arm_circle_variant,1,'mwDgFY86zck','Workout WARM-UP | ARM CIRCLES','The Hybrid Athlete','Arm Circle candidate checked by YouTube oEmbed'),
    (arm_circle_definition,arm_circle_variant,1,'ndmSvkEdNQQ','Arm Circles - Shoulder Warm Up','Dr. Christy Lee','Arm Circle candidate checked by YouTube oEmbed'),
    (arm_circle_definition,arm_circle_variant,1,'vTx_ldn6MCA','Arm Circle Exercise Video (Official)','GetFitso','Arm Circle candidate checked by YouTube oEmbed'),
    (arm_circle_definition,arm_circle_variant,1,'hniUI4ykF64','BWS Warm-Up Routine - Arm Circles','Built With Science','Arm Circle candidate checked by YouTube oEmbed')
  ) m(definition_id,variant_id,card_version,video_id,title,channel,query)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,embed_url=EXCLUDED.embed_url,video_id=EXCLUDED.video_id,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,duration_seconds=NULL,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,link_status='healthy',
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,reviewed_at)
  SELECT a.definition_id,a.card_version,a.name,a.classification,a.rationale,
    jsonb_build_object('boundaryKey',a.boundary_key,'factsRequired',a.facts,
      'neverInferFromNameAgeOrParticipantRanking',TRUE),
    jsonb_build_object('status',a.proposed_status,'classificationCandidate',a.classification,
      'humanIdentityContentAndSafetyReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    (shoulder_definition,2,'Standing Single-Arm Shoulder CAR','same_identity','The descriptive label states the exact unilateral fixed-foot slow active full-range shoulder loop.','source_alias',jsonb_build_array('standing','unilateral','active','same_start_loop'),'authored_variant'),
    (shoulder_definition,2,'Standing Shoulder Controlled Articular Rotation','same_identity','The expanded name preserves the same base side path control and count.','expanded_alias',jsonb_build_array('same_base_path_and_count'),'merge_alias'),
    (shoulder_definition,2,'Shoulder CAR','same_identity','The short alias is safe only when the exact standing unilateral active loop is declared.','short_alias',jsonb_build_array('exact_variant_required'),'merge_alias'),
    (shoulder_definition,2,'Left or Right Side','modifier_annotation','Side is recorded separately while the unilateral task remains unchanged.','side_annotation',jsonb_build_array('side'),'delivery_annotation'),
    (shoulder_definition,2,'Forward-First or Reverse-First','modifier_annotation','Direction order changes delivery and logging rather than the complete loop identity.','direction_annotation',jsonb_build_array('direction_order'),'delivery_annotation'),
    (shoulder_definition,2,'Comfortable Active Range','modifier_annotation','Range changes amplitude while active loop base and count remain exact.','range_annotation',jsonb_build_array('comfortable_range'),'delivery_annotation'),
    (shoulder_definition,2,'Hand or Palm Orientation','modifier_annotation','Hand orientation describes humeral-rotation timing without changing the controlled loop.','hand_orientation_annotation',jsonb_build_array('hand_orientation'),'delivery_annotation'),
    (shoulder_definition,2,'Tempo and Brief Pause','modifier_annotation','Speed and short checkpoints change dose without changing identity.','tempo_pause_annotation',jsonb_build_array('tempo','brief_pause'),'delivery_annotation'),
    (shoulder_definition,2,'Opposite Hand on Ribs or Pelvis','modifier_annotation','A self-feedback contact monitors compensation but provides no external assistance.','tactile_feedback_annotation',jsonb_build_array('non_assisting_tactile_feedback'),'delivery_annotation'),
    (shoulder_definition,2,'Repetitions Sets Rest or Breathing Cue','modifier_annotation','These are delivery variables when the task remains active controlled and symptom-limited.','dose_annotation',jsonb_build_array('repetitions','sets','rest','breathing'),'delivery_annotation'),
    (shoulder_definition,2,'Seated Single-Arm Shoulder CAR','new_variant','Seated support changes base transfer balance trunk demand station and accessibility.','seated_variant',jsonb_build_array('seated_base'),'needs_human_review'),
    (shoulder_definition,2,'Half-Kneeling Shoulder CAR','new_variant','Half-kneeling changes floor transfer base laterality hip and trunk demand and logistics.','half_kneeling_variant',jsonb_build_array('half_kneeling_base'),'needs_human_review'),
    (shoulder_definition,2,'Quadruped Shoulder CAR','new_variant','Hand-and-knee support and one moving arm change load distribution orientation and trunk-control demand.','quadruped_variant',jsonb_build_array('quadruped_base'),'needs_human_review'),
    (shoulder_definition,2,'Wall-Supported Shoulder CAR','new_variant','Wall contact changes support feedback clearance and valid compensation rules.','wall_supported_variant',jsonb_build_array('wall_support'),'needs_human_review'),
    (shoulder_definition,2,'Weighted Shoulder CAR','new_variant','External load changes lever stress fatigue stop rules and dose.','weighted_variant',jsonb_build_array('external_load'),'needs_human_review'),
    (shoulder_definition,2,'Assisted Shoulder CAR','new_variant','External or contralateral assistance changes active demand contact and purpose.','assisted_variant',jsonb_build_array('active_assistance'),'needs_human_review'),
    (shoulder_definition,2,'Standing Bilateral Arm Circles','new_definition','Both arms held near shoulder height and repeated small circles for time differ from a unilateral full-range same-start CAR.','arm_circles_distinct',jsonb_build_array('bilateral','shoulder_height','repeated_small_circles'),'existing_distinct_definition'),
    (shoulder_definition,2,'Neck CARs','new_definition','Head and cervical-spine motion through a complete neck path is not long-arm shoulder-complex circumduction.','neck_cars_distinct',jsonb_build_array('cervical_joint','head_path','arms_not_moving'),'existing_distinct_definition'),
    (shoulder_definition,2,'Quadruped Shoulder Circles','new_definition','Closed-chain bilateral hand support and scapular-circle rules change orientation loading and count.','quadruped_distinct',jsonb_build_array('closed_chain','quadruped'),'existing_distinct_definition'),
    (shoulder_definition,2,'Full-Body Joint CARs Flow','new_definition','An ordered multi-region flow cannot be substituted for one shoulder loop without changing sequence and duration.','full_body_flow_distinct',jsonb_build_array('multi_region_flow'),'existing_distinct_definition'),
    (shoulder_definition,2,'Dowel Shoulder Pass-Through','new_definition','Bilateral dowel grip and pass-through arc change equipment laterality path range constraint and count.','dowel_distinct',jsonb_build_array('dowel','bilateral_pass_through'),'existing_distinct_definition'),
    (shoulder_definition,2,'Codman or Shoulder Pendulum','new_definition','A supported hinge and largely passive momentum-driven hanging-arm circle have a different base load and clinical context.','pendulum_distinct',jsonb_build_array('passive_pendulum','supported_hinge'),'research_queue'),
    (shoulder_definition,2,'Clinical Shoulder CAR Assessment','new_definition','Standardized observation measurement interpretation consent and escalation create an assessment rather than a workout exercise.','assessment_distinct',jsonb_build_array('clinical_scope','measurement'),'research_queue'),
    (arm_circle_definition,1,'Standing Bilateral Arm Circles','same_identity','The descriptive name preserves fixed standing shoulder-height bilateral repeated small circles.','descriptive_name',jsonb_build_array('standing','bilateral','small_circles'),'authored_variant'),
    (arm_circle_definition,1,'Small Forward and Backward Arm Circles','same_identity','Direction wording preserves the same simultaneous bilateral task when arm height and circle size remain exact.','direction_alias',jsonb_build_array('forward_and_backward','same_task'),'merge_alias'),
    (arm_circle_definition,1,'Shoulder-Height Arm Circles','same_identity','The alias is exact when it denotes both arms held laterally and repeated small circles rather than full-range loops.','height_alias',jsonb_build_array('shoulder_height','small_repeated_path'),'merge_alias'),
    (arm_circle_definition,1,'Circle Diameter','modifier_annotation','Small-to-moderate diameter is recorded within the reviewed task; full-range windmills change identity.','diameter_annotation',jsonb_build_array('circle_diameter'),'delivery_annotation'),
    (arm_circle_definition,1,'Comfortable Arm Height','modifier_annotation','A modest reduction from shoulder height changes range without changing bilateral repeated circles.','height_annotation',jsonb_build_array('comfortable_arm_height'),'delivery_annotation'),
    (arm_circle_definition,1,'Palm Orientation','modifier_annotation','Palm direction is recorded for delivery and media matching while the circle remains the same.','palm_annotation',jsonb_build_array('palm_orientation'),'delivery_annotation'),
    (arm_circle_definition,1,'Forward-First or Backward-First','modifier_annotation','Direction order changes delivery rather than identity.','direction_order_annotation',jsonb_build_array('direction_order'),'delivery_annotation'),
    (arm_circle_definition,1,'Tempo','modifier_annotation','Controlled pace changes exposure without changing support path or count.','tempo_annotation',jsonb_build_array('tempo'),'delivery_annotation'),
    (arm_circle_definition,1,'Time Repetitions Sets Rest or Breathing','modifier_annotation','These change dosage when exact mechanics remain unchanged.','dose_annotation',jsonb_build_array('time','repetitions','sets','rest','breathing'),'delivery_annotation'),
    (arm_circle_definition,1,'Seated Bilateral Arm Circles','new_variant','Seated support changes base transfer trunk demand station and accessibility.','seated_variant',jsonb_build_array('seated_base'),'needs_human_review'),
    (arm_circle_definition,1,'Unilateral Arm Circles','new_variant','One moving arm changes laterality symmetry trunk demand and logging.','unilateral_variant',jsonb_build_array('unilateral'),'needs_human_review'),
    (arm_circle_definition,1,'Bent-Elbow Arm Circles','new_variant','Shortening the lever changes contact geometry physical demand and circle path.','bent_elbow_variant',jsonb_build_array('bent_elbow_lever'),'needs_human_review'),
    (arm_circle_definition,1,'Weighted Arm Circles','new_variant','External load materially changes joint stress fatigue stop rules and dose.','weighted_variant',jsonb_build_array('external_load'),'needs_human_review'),
    (arm_circle_definition,1,'Large Windmill Arm Circles','new_variant','Large alternating or bilateral vertical arcs change range path trunk demand and clearance.','windmill_variant',jsonb_build_array('large_vertical_arc'),'needs_human_review'),
    (arm_circle_definition,1,'Standing Single-Arm Shoulder CAR','new_definition','One arm tracing a slow full comfortable range with intentional humeral rotation is not a repeated shoulder-height small circle.','shoulder_car_distinct',jsonb_build_array('unilateral','full_range','intentional_rotation'),'existing_distinct_definition'),
    (arm_circle_definition,1,'Arm Swings','new_definition','Reciprocal or bilateral swinging uses a different path momentum range and count.','arm_swing_distinct',jsonb_build_array('swing','momentum'),'research_queue'),
    (arm_circle_definition,1,'Shoulder Rolls','new_definition','Scapular elevation protraction depression and retraction with relaxed arms differs from long-arm shoulder circles.','shoulder_roll_distinct',jsonb_build_array('scapular_roll','relaxed_arms'),'research_queue'),
    (arm_circle_definition,1,'Shoulder Pendulum','new_definition','A supported hinge and largely passive hanging-arm motion change base loading and clinical context.','pendulum_distinct',jsonb_build_array('passive_pendulum'),'research_queue'),
    (arm_circle_definition,1,'Dowel Shoulder Pass-Through','new_definition','A bilateral dowel grip and overhead pass-through arc change equipment hand spacing path and count.','dowel_distinct',jsonb_build_array('dowel','pass_through'),'existing_distinct_definition'),
    (arm_circle_definition,1,'Clinical Shoulder Endurance Test','new_definition','A fixed maximum-duration or exhaustion protocol changes purpose termination validity interpretation and risk.','assessment_distinct',jsonb_build_array('assessment','maximal_duration'),'research_queue')
  ) a(definition_id,card_version,name,classification,rationale,boundary_key,facts,proposed_status)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT r.from_id,r.to_id,r.relationship,r.score,r.dimensions,r.reason,
    jsonb_build_object('migration',migration_key,'reviewOnly',TRUE,'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('identity and workout purpose','base laterality support assistance load path range and count','symptoms and restrictions','dose duration and logistics','shoulder scapular trunk pressing pulling throwing climbing hanging handstand and overhead budgets','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (shoulder_variant,arm_circle_variant,'lateral_substitution',48,ARRAY['range','complexity','fatigue']::TEXT[],'Changes a unilateral slow full-range same-start loop into bilateral shoulder-height repeated small circles; use only when workout purpose may change after full reselection.'),
    (shoulder_variant,quadruped_variant,'lateral_substitution',42,ARRAY['stability','load','complexity']::TEXT[],'Changes open-chain standing motion to fixed-contact quadruped support and a different scapular circle contract.'),
    (shoulder_variant,dowel_variant,'lateral_substitution',38,ARRAY['load','range','complexity']::TEXT[],'Adds a bilateral dowel grip and pass-through arc with different range constraints and equipment logistics.'),
    (arm_circle_variant,shoulder_variant,'progression',54,ARRAY['range','complexity','stability']::TEXT[],'Changes repeated small bilateral circles to a slower unilateral full-range active loop with direction-specific end-range control; it is not automatic.'),
    (arm_circle_variant,wall_slide_variant,'progression',40,ARRAY['load','range','stability']::TEXT[],'Changes to wall-supported forearm ascent and terminal full-arm lift-off with different contacts sequence and shoulder demand.'),
    (arm_circle_variant,band_rotation_variant,'lateral_substitution',30,ARRAY['load','complexity','fatigue']::TEXT[],'Changes to elastic-resisted bilateral external rotation with elbows beside the ribs and different equipment load and count.')
  ) r(from_id,to_id,relationship,score,dimensions,reason)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,c.variant_id,c.dimension,c.score,20,c.rationale||
    ' This score describes the exercise task, not participant proficiency, age, readiness, or skill.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (shoulder_variant,'technicalComplexity',30,'Review-only exercise-complexity anchor based on a fixed standing base, unilateral long-arm active multi-planar path, intentional humeral rotation, momentum exclusion, same-start loop, side and direction logging, trunk compensation boundaries and symptom-limited control.'),
    (shoulder_variant,'absoluteLoadDemand',12,'Review-only physical-difficulty anchor based on moving one unweighted arm through comfortable active range against gravity with low impact and modest local shoulder scapular and postural effort.'),
    (arm_circle_variant,'technicalComplexity',16,'Review-only exercise-complexity anchor based on fixed standing, bilateral shoulder-height long-arm support, small simultaneous circles, declared direction change, count or time validity and simple trunk-control gates.'),
    (arm_circle_variant,'absoluteLoadDemand',14,'Review-only physical-difficulty anchor based on holding both unweighted arms near shoulder height and repeating circles for a short interval with no impact or external load.')
  ) c(variant_id,dimension,score,rationale)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET
    name='Standing Single-Arm Shoulder CAR',slug='arm-circles',
    description='Stand with fixed feet and one long active arm beside the body. Without momentum, move the arm forward and overhead through the largest comfortable controlled path, rotate it as needed to continue behind and down, and return to the same start. Complete and record the reverse direction and other side separately while the ribs, spine and pelvis do not create the range.',
    instructions='Use the exact canonical variant. Confirm full arm-sweep clearance, side and direction. Stand with fixed feet and one long active arm beside the body. Slowly move it forward and overhead, rotate the arm as needed, continue behind and down, and return to the same start for one repetition. Allow coordinated shoulder-blade motion while keeping ribs, spine and pelvis from creating the circle. Complete the reverse direction and other side separately. Stop for pain, pinching, catching, instability, numbness, tingling, weakness, dizziness, loss of balance or control, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=2,default_work_seconds=90,default_rest_seconds=15,
    tempo='slow controlled five to fifteen seconds per complete same-start loop',
    load_note='Track side, direction, complete loops, range and path, hand orientation, tempo, pauses, first fault, trunk compensation, symptoms, active seconds, invalid or partial attempts, rest, duration, substitution, and overlapping shoulder scapular trunk pressing pulling throwing climbing hanging handstand and overhead work.',
    est_seconds_per_set=120,is_published=FALSE,archived=FALSE,
    card_summary='Unilateral standing active shoulder circumduction through the largest comfortable controlled path without momentum, returning to the same start in each declared direction.',
    coach_language='Verify exact Shoulder CAR identity, standing base, side, direction, clearance, active comfortable path, same-start count, symptoms, planned loops, actual seconds, first fault, duration, downstream shoulder budget, persistence and clinical scope.',
    athlete_language='Keep your feet and ribs quiet. Make one slow comfortable full circle with a long arm, rotate it as needed, return to the same start, and stop for pain, pinching, tingling, weakness, dizziness, or loss of control.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',shoulder_definition,'exactVariantIds',jsonb_build_array(shoulder_variant),
      'splitDefinitionId',arm_circle_definition,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','side and direction','safe unsupported standing and full arm path','active comfortable shoulder motion','same-start count and stop comprehension','loop dose active seconds and duration','cumulative shoulder scapular trunk and overhead load','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','base laterality support assistance load path range and count','restrictions and symptoms','purpose','dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['side','direction_order','comfortable_range','hand_orientation','tempo','brief_pause','breathing_prompt','complete_loops','rest_seconds','sets','opposite_hand_tactile_feedback']::TEXT[],
    movement_family='Standing Single-Arm Shoulder CAR',primary_phase_key=NULL,
    phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,'impactLevel',0,
      'balanceDemand','stable_unsupported_standing','breathingDemand','continuous_no_breath_hold',
      'actions',jsonb_build_array('active_multi_planar_shoulder_circumduction','intentional_humeral_rotation','coordinated_scapular_motion','elbow_extension_isometric','trunk_anti_compensation'),
      'planes',jsonb_build_array('sagittal','frontal','transverse'),
      'mustMaintain',jsonb_build_array('fixed_feet','one_long_active_arm','slow_momentum_free_motion','comfortable_range','intentional_arm_rotation','same_start_return','quiet_ribs_spine_and_pelvis','continuous_breathing','communication'),
      'mustNotAdd',jsonb_build_array('bilateral_shoulder_height_small_circles','external_load','passive_assistance','pendulum_momentum','forced_range','rigid_scapular_pinning','changed_base','multi_joint_flow','clinical_assessment'),
      'validCompletion','one_active_long_arm_momentum_free_loop_in_one_declared_direction_returns_to_same_start_with_fixed_feet_comfortable_range_controlled_trunk_and_no_stop_rule'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('variant_side_and_direction_exact','standing_and_clearance_safe','active_comfortable_range_tolerated','same_start_count_understood','one_long_arm','slow_momentum_free_path','intentional_humeral_rotation','coordinated_scapular_motion','quiet_ribs_spine_pelvis_and_feet','continuous_breathing_and_no_stop_symptoms'),
      'stopRules',jsonb_build_array('sharp_increasing_night_post_trauma_or_unfamiliar_pain','pinching_catching_painful_clicking_instability_or_uncontrolled_lowering','neurologic_or_circulation_change','dizziness_faintness_nausea_visual_change_chest_pain_unusual_breathlessness_or_disorientation','hand_wrist_elbow_shoulder_neck_back_balance_or_standing_pain','momentum_elbow_wrist_trunk_or_foot_compensation','forced_range_passive_assistance_load_scapular_pinning_or_wrong_task','unsafe_floor_clearance_traffic_sightline_or_emergency_route','side_direction_loop_active_seconds_budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_variant_card_and_research_version','side_and_direction','planned_and_actual_complete_loops','range_path_hand_orientation_tempo_pauses_and_breathing','valid_invalid_partial_and_symptom_limited_attempts','feet_arm_scapular_trunk_and_first_fault','symptoms_stop_reason_and_escalation','active_seconds_duration_rest_substitution_and_downstream_budget')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_loops_per_side_and_direction','active_shoulder_seconds','end_range_control','deltoid_rotator_cuff_and_scapular_load','trunk_postural_load','technical_fatigue','downstream_press_pull_throw_climb_hang_handstand_and_overhead_work','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_end_range_or_rotator_cuff_work_before_priority_overhead_skill','symptom_provoking_shoulder_work','same_session_shoulder_or_overhead_loading_exceeding_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('2hyNG1U5wYs','898QrvpmRWc','CLWFwun1BfQ','P6p0IamojmE','Ag1yVYbPXeg'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactnessSetupPathRotationCountCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    participant_structure='individual',programming_kind='exercise',linked_skill_id=NULL,
    why_publish_ready=FALSE,updated_at=now()
  WHERE id=37;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=1,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness uses safe unsupported standing, full arm clearance, comfortable active shoulder motion, exact side direction and count comprehension, current symptoms, communication, workout dose, and downstream shoulder and overhead loading; never participant proficiency or age.',
    readiness_checks=ARRAY[
      'Confirm exact Shoulder CAR variant, side, direction, stable nonslip floor, complete arm-sweep clearance, sightline, communication, and emergency route.',
      'Confirm hand wrist elbow shoulder neck back balance and standing tolerance and no current symptom or restriction conflict.',
      'Confirm the participant understands one long active arm, slow momentum-free path, intentional rotation, same-start count, normal scapular motion, smaller-range option, and stop signal.',
      'Review cumulative loops, active shoulder seconds, end-range control, deltoid rotator-cuff scapular and trunk load, technical fatigue, and later pressing pulling throwing climbing hanging handstand or overhead demand.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain, guarding, or participant stop request.',
      'Shoulder pinching, catching, painful clicking, instability, or uncontrolled arm lowering.',
      'Numbness, tingling, weakness, pins and needles, altered circulation, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'Hand, wrist, elbow, shoulder, neck, back, balance, or standing symptoms prevent the exact task.',
      'Momentum, elbow bending, wrist substitution, stepping, rib flare, spinal extension, lateral bend, torso rotation, forced range, rigid scapular pinning, or breath hold cannot be corrected safely.',
      'Floor, arm-sweep space, neighbor clearance, traffic, sightline, communication, duration, budget, or emergency route becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms, trauma, procedure, instability, or clinical restrictions conflict with active unilateral shoulder circumduction or standing.',
      'No safe standing station, full arm clearance, sightline, communication, controlled lowering, or emergency route.',
      'The intended service is diagnosis, treatment, readiness clearance, passive assistance, maximal assessment, or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use Standing Bilateral Arm Circles only when a simple repeated shoulder-height warm-up fits and all checks are rerun.',
      'Use Quadruped Shoulder Circles only when the fixed-contact closed-chain task fits and all checks are rerun.',
      'Use Dowel Shoulder Pass-Through only when bilateral dowel grip and changed range constraints fit and all checks are rerun.',
      'Author and review seated, half-kneeling, wall-supported, assisted, or weighted Shoulder CAR variants before selection.'
    ]::TEXT[]
  WHERE exercise_id=37;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=30,absolute_load_demand=12,coordination_demand=32,
    impact=1,supervision_demand=12,base_overall_difficulty=greatest(30,12),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','standing_fixed_foot_single_arm_active_full_range_shoulder_car_exact_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object('standingSingleArmShoulderCar',jsonb_build_object('complexity',30,'physicalDifficulty',12,'overall',30)),
      'separateArmCircleDefinitionId',arm_circle_definition,
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant proficiency, age, readiness, or skill. Exact identity, mechanics and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=37;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=3.0,complexity=3.0,load=1.2,overall=3.0,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='moderate',
    notes='Candidate projection from the exact standing single-arm active full-range Shoulder CAR. Complexity is 30/100, physical difficulty 12/100, and overall 30/100 by maximum. This is not participant proficiency, readiness, age, or a skill-library classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=37;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES
  (shoulder_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','standing_fixed_foot_unilateral_active_full_range_shoulder_car','legacySources',1,'activeVariants',1,'archivedConflatedSourceSkeleton',TRUE,'splitDefinitionId',arm_circle_definition,'existingNeighborBoundariesPreserved',2,'newNeighborBoundaries',4),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('brace','reach','rotate'),'bodyRegions',jsonb_build_array('shoulder','scapula','thoracic_spine','core'),'equipment',jsonb_build_array()),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsSequenceScapularAndTrunkBoundaries',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('30/12/30'),'participantSkillAgeAndReadinessClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualLoopsSideDirectionRangeTempoFaultSymptomsActiveSecondsAndOverlappingShoulderExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'standingClearanceSymptomsRestrictionsSpaceTrafficScopeAndEmergencyRoute',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'prepareAndRestore',TRUE,'durationDoseRestSideDirectionStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'basePathRotationScapularTrunkCountSymptomsAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directAndIndirectEvidenceBoundariesExplicit',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactVariantReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',23,'sameIdentity',3,'modifierAnnotations',7,'newVariants',6,'newDefinitions',7,'singleExactVariant',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'spaceAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, exact standing unilateral Shoulder CAR setup, path, rotation, count, range, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all four relationships; no automatic substitution to Arm Circles, Quadruped Shoulder Circles, Dowel Pass-Through, or another task is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity 30 and physical difficulty 12. Scores do not classify a participant or create age, readiness, or proficiency levels.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity split, anatomy, scapular and trunk boundaries, loading, clinical scope, dose, stop, accessibility, persistence, and support rules remain quarantined.')),
    TRUE,now()),
  (arm_circle_definition,1,1,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','standing_fixed_foot_bilateral_shoulder_height_repeated_small_arm_circles','legacySources',0,'origin','source_37_identity_split','activeVariants',1,'neighborBoundaries',4),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('brace','rotate'),'bodyRegions',jsonb_build_array('shoulder','scapula','core'),'equipment',jsonb_build_array()),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsSequenceScapularAndTrunkBoundaries',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('16/14/16'),'participantSkillAgeAndReadinessClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualSecondsOrCirclesHeightDiameterDirectionFaultSymptomsAndOverlappingShoulderExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'standingBilateralClearanceSymptomsRestrictionsSpaceTrafficScopeAndEmergencyRoute',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',1,'prepareOnly',TRUE,'durationDoseRestDirectionStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'baseHeightDiameterDirectionCountSymptomsAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'exampleDoseNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',4,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactVariantReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',20,'sameIdentity',3,'modifierAnnotations',6,'newVariants',5,'newDefinitions',6,'singleExactVariant',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'spaceAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all four candidates in full and verify playback, exact standing bilateral shoulder-height setup, circle size, direction, time or count, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all four relationships; no automatic substitution to Shoulder CAR, Wall Slide with Lift-Off, Band External Rotation, or another task is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity 16 and physical difficulty 14. Scores do not classify a participant or create age, readiness, or proficiency levels.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. New-card identity, anatomy, loading, clinical scope, dose, stop, accessibility, persistence, and support rules remain quarantined.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=shoulder_definition AND legacy_exercise_id=37 AND status='review'
        AND card_version=2 AND schema_version='2.0.0' AND canonical_name='Standing Single-Arm Shoulder CAR'
        AND approved_video_url IS NULL AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL AND movement_patterns=ARRAY['brace','reach','rotate']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=arm_circle_definition AND legacy_exercise_id IS NULL AND status='review'
        AND card_version=1 AND schema_version='2.0.0' AND canonical_name='Standing Bilateral Arm Circles'
        AND approved_video_url IS NULL AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL AND movement_patterns=ARRAY['brace','rotate']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='superseded_conflated_source_skeleton')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=shoulder_variant AND definition_id=shoulder_definition AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER=30
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=12
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(30,12)
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND programming_profile_json->>'publicationQuarantined'='true')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=arm_circle_variant AND definition_id=arm_circle_definition AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER=16
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=14
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(16,14)
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND programming_profile_json->>'publicationQuarantined'='true') THEN
    RAISE EXCEPTION '% definition variant or source quarantine assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=shoulder_variant AND status='review'
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND dose_scaling_json<>'{}'::JSONB AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 320
        AND cardinality(stop_rules)>=8)<>2
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=arm_circle_variant AND status='review'
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND dose_scaling_json<>'{}'::JSONB AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 320
        AND cardinality(stop_rules)>=8)<>1
    OR (SELECT count(DISTINCT section_key) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=shoulder_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(DISTINCT section_key) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=arm_circle_definition AND reviewed_card_version=1
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=shoulder_definition AND reviewed_card_version=2
        AND link_status='healthy' AND review_status='candidate' AND embedding_allowed
        AND captions_available IS NULL AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL AND reviewer_user_id IS NULL
        AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=arm_circle_definition AND reviewed_card_version=1
        AND link_status='healthy' AND review_status='candidate' AND embedding_allowed
        AND captions_available IS NULL AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL AND reviewer_user_id IS NULL
        AND reviewed_at IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=shoulder_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>23
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=arm_circle_definition AND reviewed_card_version=1
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>20
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=shoulder_variant OR to_variant_id=shoulder_variant)
        AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=arm_circle_variant OR to_variant_id=arm_circle_variant)
        AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=shoulder_variant AND status='review' AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=arm_circle_variant AND status='review' AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=shoulder_definition
        AND resolved_definition_id=ANY(ARRAY[arm_circle_definition,neck_definition,dowel_definition,band_rotation_definition])
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=arm_circle_definition
        AND resolved_definition_id=ANY(ARRAY[quadruped_definition,wall_slide_definition,full_body_definition])
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>3 THEN
    RAISE EXCEPTION '% authored row-count or quarantine assertion failed: %',migration_key,
      jsonb_build_object(
        'shoulderProfiles',(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 WHERE variant_id=shoulder_variant AND status='review'),
        'armProfiles',(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 WHERE variant_id=arm_circle_variant AND status='review'),
        'shoulderEvidence',(SELECT count(DISTINCT section_key) FROM coaching.exercise_section_evidence_v1 WHERE definition_id=shoulder_definition AND reviewed_card_version=2 AND review_status='candidate' AND reviewer_user_id IS NULL),
        'armEvidence',(SELECT count(DISTINCT section_key) FROM coaching.exercise_section_evidence_v1 WHERE definition_id=arm_circle_definition AND reviewed_card_version=1 AND review_status='candidate' AND reviewer_user_id IS NULL),
        'shoulderMedia',(SELECT count(*) FROM coaching.exercise_media_candidate_v1 WHERE definition_id=shoulder_definition AND reviewed_card_version=2 AND link_status='healthy' AND review_status='candidate' AND embedding_allowed AND captions_available IS NULL AND exact_variant_match IS NULL AND demonstration_quality_score IS NULL AND reviewer_user_id IS NULL AND reviewed_at IS NULL),
        'armMedia',(SELECT count(*) FROM coaching.exercise_media_candidate_v1 WHERE definition_id=arm_circle_definition AND reviewed_card_version=1 AND link_status='healthy' AND review_status='candidate' AND embedding_allowed AND captions_available IS NULL AND exact_variant_match IS NULL AND demonstration_quality_score IS NULL AND reviewer_user_id IS NULL AND reviewed_at IS NULL),
        'shoulderAlternates',(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 WHERE definition_id=shoulder_definition AND reviewed_card_version=2 AND review_status='candidate' AND reviewer_user_id IS NULL),
        'armAlternates',(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 WHERE definition_id=arm_circle_definition AND reviewed_card_version=1 AND review_status='candidate' AND reviewer_user_id IS NULL),
        'shoulderRelationships',(SELECT count(*) FROM coaching.exercise_relationship_v1 WHERE (from_variant_id=shoulder_variant OR to_variant_id=shoulder_variant) AND review_status='review' AND reviewed_by IS NULL),
        'armRelationships',(SELECT count(*) FROM coaching.exercise_relationship_v1 WHERE (from_variant_id=arm_circle_variant OR to_variant_id=arm_circle_variant) AND review_status='review' AND reviewed_by IS NULL),
        'shoulderCalibration',(SELECT count(*) FROM coaching.exercise_score_calibration_v1 WHERE variant_id=shoulder_variant AND status='review' AND reviewed_by IS NULL),
        'armCalibration',(SELECT count(*) FROM coaching.exercise_score_calibration_v1 WHERE variant_id=arm_circle_variant AND status='review' AND reviewed_by IS NULL),
        'shoulderNewIdentities',(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 WHERE survivor_definition_id=shoulder_definition AND resolved_definition_id=ANY(ARRAY[arm_circle_definition,neck_definition,dowel_definition,band_rotation_definition]) AND decision='distinct_exercises' AND reviewed_by IS NULL),
        'armNewIdentities',(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 WHERE survivor_definition_id=arm_circle_definition AND resolved_definition_id=ANY(ARRAY[quadruped_definition,wall_slide_definition,full_body_definition]) AND decision='distinct_exercises' AND reviewed_by IS NULL));
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.movement_patterns) key
      WHERE d.id=ANY(ARRAY[shoulder_definition,arm_circle_definition])
        AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.body_regions) key
      WHERE d.id=ANY(ARRAY[shoulder_definition,arm_circle_definition])
        AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 v
      CROSS JOIN LATERAL jsonb_array_elements_text(v.requirements_json->'equipment') key
      WHERE v.id=ANY(active_variant_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% uncontrolled taxonomy was authored',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 r
      CROSS JOIN LATERAL unnest(r.dimensions) dimension
      WHERE (r.from_variant_id=ANY(active_variant_ids) OR r.to_variant_id=ANY(active_variant_ids))
        AND dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(active_variant_ids) OR to_variant_id=ANY(active_variant_ids))
        AND review_status='approved') THEN
    RAISE EXCEPTION '% relationship dimension or approval assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=37
      AND name='Standing Single-Arm Shoulder CAR'
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=FALSE
      AND programming_kind='exercise' AND why_publish_ready=FALSE)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=37 AND technical_complexity=30
        AND absolute_load_demand=12 AND base_overall_difficulty=30
        AND human_review_status='queued' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=ANY(ARRAY[shoulder_definition,arm_circle_definition])
        AND status='quarantined' AND human_review_required=TRUE
        AND jsonb_array_length(blocking_issues_json)=4)<>2 THEN
    RAISE EXCEPTION '% legacy projection or packet assertion failed',migration_key;
  END IF;
END
$migration$;
