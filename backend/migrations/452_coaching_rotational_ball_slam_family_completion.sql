-- Complete five legacy rotational ball-slam cards as one stable definition,
-- three exact trajectory/entry variants, and contextual laterality profiles.
-- Link/embed checks do not establish playback, exact-match, caption, quality,
-- graph, calibration, card, or publication approval.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '452_coaching_rotational_ball_slam_family_completion';
  research_version CONSTANT TEXT := '2026-08-02.66';
  canonical_id CONSTANT UUID := '1af84588-3b81-4008-be73-e2995280769f';
  stationary_variant CONSTANT UUID := '28e6ff39-a1a1-4681-aedc-4f1dcc76908d';
  rainbow_variant CONSTANT UUID := 'd6e0e934-d72f-4d1b-938c-c4c6302c75be';
  step_behind_variant CONSTANT UUID := 'ef71984a-761a-4d52-a284-ab0e3d020bd0';
  delivery_only_variant CONSTANT UUID := '0c469928-da22-4cf4-8ef4-05aed3f248d1';
  duplicate_variant CONSTANT UUID := 'b2e8d89b-f77b-4877-884e-9d23533fec2b';
  active_variant_ids CONSTANT UUID[] := ARRAY[
    stationary_variant,rainbow_variant,step_behind_variant];
  all_variant_ids CONSTANT UUID[] := ARRAY[
    stationary_variant,rainbow_variant,step_behind_variant,
    delivery_only_variant,duplicate_variant];
  source_ids CONSTANT BIGINT[] := ARRAY[1162,1163,1165,1168,1483];
  archive_definition_ids CONSTANT UUID[] := ARRAY[
    'f7aa86a1-0ea9-42d9-ae87-c68def651ac9'::UUID,
    'c44ed0a5-d643-43a8-b88d-de531fc332d7'::UUID,
    'f86fdd4b-7c77-4a05-85a1-ef379f54a311'::UUID,
    'd6f5a754-7722-4a8c-8bf7-e9094cee25ae'::UUID];
  current_video_ids CONSTANT TEXT[] := ARRAY[
    'xYANsh80ErM','wK9DwFTt1YQ','vf61IsovxKo','eZ0I7FmJ1A0','9CKf3Yc2FMk'];
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/287/rotational-slam/","sourceTitle":"Rotational Slam","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":77,"claims":["ACE defines an overhead ball path followed by a squat-and-twist side-directed floor slam and alternating rebound sequence.","A side-directed floor release is identity-defining; larger arc and step-behind entry are variants, while side alternation is delivery and laterality."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://www.acefitness.org/resources/pros/expert-articles/5289/8-creative-ways-to-use-a-medicine-ball/","sourceTitle":"8 Creative Ways to Use a Medicine Ball","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["The direct guide describes whole-body extension, trunk rotation, and a slam outside the foot.","Controlled taxonomy is rotate, throw/slam, squat or hinge, brace, and optional pivot; wall throws, straight overhead slams, catches, and combined drills remain separate."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37721721/","sourceTitle":"Influence of trunk rotator strength on rotational medicine ball throwing performance","sourcePublisher":"Journal of Sports Medicine and Physical Fitness","sourceKind":"peer_reviewed_research","evidenceQuality":81,"claims":["Trunk rotational strength correlated with rotational medicine-ball throw velocity and distance in 30 active college participants.","The study concerns throws, not floor slams, and supports only adjacent rotational-demand context rather than a universal activation or transfer claim."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/39589937/","sourceTitle":"Criterion Validity and Reliability of a New Medicine Ball Rotational Power Test","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Radar velocity showed high accuracy and reliability for a rotational medicine-ball push test in 15 professional female cricketers.","The task and population differ from a rotational floor slam, so velocity is an optional output measure and distance conversions are not inferred."]},
    {"sectionKey":"difficulty","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/287/rotational-slam/","sourceTitle":"Rotational Slam","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":77,"claims":["ACE labels the movement advanced, but that consumer experience label is not copied into an exercise-card skill field.","Scores represent exercise complexity and physical difficulty only; overall equals their maximum and step-behind entry raises coordination and failure-consequence demands."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37833510/","sourceTitle":"Effects of Upper-Body Plyometric Training on Physical Fitness in Healthy Youth and Young Adult Participants: A Systematic Review with Meta-Analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Upper-body plyometric interventions improved several performance measures, but certainty was low or very low and optimal dose remains unclear.","The card therefore records exact ball mass/type, high-intent attempts, both sides, failed repetitions, ball impacts, fatigue, rest, and recovery without claiming one universal dose."]},
    {"sectionKey":"constraints","sourceUrl":"https://www.acefitness.org/continuing-education/certified/june-2019/7306/medicine-balls-an-ace-integrated-fitness-training-reg-model-workout/","sourceTitle":"Medicine Balls: An ACE Integrated Fitness Training Model Workout","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":78,"claims":["ACE distinguishes wall balls, dead-weight balls, and rebound-capable slam balls and warns that equipment is not interchangeable for every action.","Delivery must declare ball construction, slam rating, mass, rebound behavior, floor, clearance, retrieval or catch policy, side pattern, and traffic controls."]},
    {"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/contentassets/574ab3a9e81e4063a759c38f29a717f8/land-based_strength_and_conditioning_-for_swimming.pdf","sourceTitle":"Land-Based Strength and Conditioning for Swimming","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["NSCA material gives low-repetition medicine-ball starting examples but does not establish a universal rotational-slam prescription.","Profiles expose sets, repetitions per side, side order, ball mass, intent, rest, quality loss, duration, and recovery."]},
    {"sectionKey":"instructions","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/287/rotational-slam/","sourceTitle":"Rotational Slam","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":77,"claims":["The direct sequence moves from overhead into coordinated squat and rotation before a side-directed floor slam.","Instructions add a declared stance, trajectory, side, foot pivot, release zone, rebound or retrieval rule, complete reset, and safe stop command."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://www.acefitness.org/continuing-education/certified/june-2019/7306/medicine-balls-an-ace-integrated-fitness-training-reg-model-workout/","sourceTitle":"Medicine Balls: An ACE Integrated Fitness Training Model Workout","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":78,"claims":["Ball construction determines whether rebound catching is appropriate and whether repeated slamming can damage equipment.","Stop for pain, neurologic or cardiopulmonary symptoms, loss of grip or footing, forced lumbar twisting, unpredictable rebound, unsafe catch or retrieval, wrong release zone, collision risk, or meaningful speed/accuracy decline."]},
    {"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37833510/","sourceTitle":"Effects of Upper-Body Plyometric Training on Physical Fitness in Healthy Youth and Young Adult Participants: A Systematic Review with Meta-Analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Upper-body plyometric training may improve medicine-ball and sport-specific throwing performance, with limited certainty and heterogeneous protocols.","Use the slam early enough to preserve output when power is the objective; substitutions recompute load, ball impacts, fatigue, duration, space, equipment, and rendering."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://www.acefitness.org/resources/pros/expert-articles/5289/8-creative-ways-to-use-a-medicine-ball/","sourceTitle":"8 Creative Ways to Use a Medicine Ball","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["ACE provides a concise whole-body alternating rotational-slam sequence.","Athlete rendering must also show exact variant, ball and rebound rule, start side, side dose, release zone, reset, rest, valid-attempt standard, and stop signal."]},
    {"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/39589937/","sourceTitle":"Criterion Validity and Reliability of a New Medicine Ball Rotational Power Test","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Rotational medicine-ball performance can be side-specific and measured with validated methods under a defined test protocol.","Coach support records each side, ball speed when available, release accuracy, foot and hip sequencing, trunk control, ball behavior, failed attempts, and the effect of any substitution."]},
    {"sectionKey":"accessibility","sourceUrl":"https://co.ng.mil/Portals/25/H2F/ATP%207-22.02%20AT%20Training.pdf","sourceTitle":"ATP 7-22.02 Holistic Health and Fitness Drills and Exercises","sourcePublisher":"United States Army","sourceKind":"professional_standard","evidenceQuality":82,"claims":["The professional guide documents the Rainbow Slam as a named exercise with a defined start and alternating-direction retrieval sequence.","Accessible delivery can slow rehearsal, reduce mass and arc, remove step-behind entry, provide written or still-frame instruction, allow dead-ball retrieval, or substitute a nonball rotational task when safe slamming is unavailable."]},
    {"sectionKey":"alternates","sourceUrl":"https://www.acefitness.org/resources/pros/expert-articles/5289/8-creative-ways-to-use-a-medicine-ball/","sourceTitle":"8 Creative Ways to Use a Medicine Ball","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["Rotational slam, lateral wall ball, reverse slam, and burpee slam have different targets, release paths, catches, or added actions.","Fixed or rainbow trajectories and step-behind entry stay variants; wall throws, rebound-catch tests, straight overhead slams, kneeling slams, scoop slams, and slam-to-sprint or sprawl combinations remain separate definitions."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five title/channel candidates have current oEmbed health only; playback, identity/variant exactness, ball behavior, captions, safety, quality, reviewer identity, and approval remain unresolved."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"videoId":"xYANsh80ErM","title":"Alternating Rotational Slam with Medicine Ball | Exercise Demo","channel":"Red Dot Fitness","query":"alternating rotational medicine ball slam"},
    {"videoId":"wK9DwFTt1YQ","title":"Single-Sided Rotational Slam with Medicine Ball | Exercise Demo","channel":"Red Dot Fitness","query":"single sided rotational medicine ball slam"},
    {"videoId":"vf61IsovxKo","title":"How To Do Medicine Ball Side to Side (Rainbow Slams) | Exercise Demo","channel":"OriGym","query":"medicine ball rainbow slam"},
    {"videoId":"eZ0I7FmJ1A0","title":"Rainbow Slam - Medicine Ball Exercise","channel":"NAKOA Fitness and Physical Therapy","query":"rainbow medicine ball slam"},
    {"videoId":"9CKf3Yc2FMk","title":"Medicine Ball Rotational Slam","channel":"24Life","query":"medicine ball rotational slam"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"name":"Stationary Single-Side Rotational Slam","class":"new_variant","why":"A fixed base and repeated declared side preserve the floor-slam identity while setting exact laterality and reset demands.","dimensions":{"entry":"stationary","sidePattern":"single_side_then_balanced_other_side"}},
    {"name":"Alternating Side-to-Side Rotational Slam","class":"modifier_annotation","why":"Alternation changes side order, rebound or retrieval timing, and duration but not the trajectory identity; it belongs in contextual delivery.","dimensions":{"sidePattern":"alternating","sideDose":"equal_and_declared"}},
    {"name":"Rainbow Rotational Slam","class":"new_variant","why":"The larger overhead arc materially changes trajectory, shoulder range, timing, and space while retaining the side-directed floor slam.","dimensions":{"trajectory":"large_overhead_rainbow_arc"}},
    {"name":"Step-Behind Rotational Slam","class":"new_variant","why":"Step-behind entry adds approach momentum, crossover footwork, deceleration, and a larger clearance requirement.","dimensions":{"entry":"step_behind","finish":"controlled"}},
    {"name":"Dead-Ball Retrieval versus Rebound Catch","class":"modifier_annotation","why":"Ball behavior changes catch, pickup, cadence, impact, and traffic rules and must be declared in delivery rather than guessed from the name.","dimensions":{"reboundBehavior":"declared","reset":"catch_or_retrieve"}},
    {"name":"Ball Mass and Release-Zone Scaling","class":"modifier_annotation","why":"Mass and target distance change velocity, accuracy, fatigue, and rebound without changing the exercise when the same trajectory remains.","dimensions":{"ballMass":"recorded","releaseZone":"marked"}},
    {"name":"Medicine Ball Rotational Wall Throw","class":"new_definition","why":"A wall-directed free release and return path replaces the side-directed floor impact.","dimensions":{"target":"wall","release":"horizontal_or_diagonal_free_throw"}},
    {"name":"Medicine Ball Overhead Slam","class":"new_definition","why":"A bilateral straight-ahead overhead-to-floor path lacks the required side-directed rotation.","dimensions":{"trajectory":"sagittal_straight_ahead"}},
    {"name":"Medicine Ball Rebound Slam to Catch","class":"new_definition","why":"Reactive rebound catching is the defining objective rather than an optional reset rule.","dimensions":{"objective":"reactive_rebound_catch"}},
    {"name":"Tall-Kneeling Overhead Medicine Ball Slam","class":"new_definition","why":"Tall kneeling removes foot pivot and lower-body drive and changes the support and trunk contract.","dimensions":{"stance":"tall_kneeling"}},
    {"name":"Slam Ball Scoop Slam","class":"new_definition","why":"The scoop start and upward-to-downward path differ from an overhead rotational side slam.","dimensions":{"start":"low_scoop","trajectory":"scoop_to_floor"}},
    {"name":"Slam-to-Sprint, Sprawl-to-Slam, and Slam-to-Rotational-Throw","class":"new_definition","why":"Each adds an ordered locomotor, ground-contact, or second-release task with distinct fatigue, validity, and space rules.","dimensions":{"identityBoundary":"combined_ordered_task"}}
  ]
  $json$::JSONB;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1 WHERE id=canonical_id)<>1
    OR (SELECT count(*) FROM coaching.exercise_definition_v1 WHERE id=ANY(archive_definition_ids))<>cardinality(archive_definition_ids)
    OR (SELECT count(*) FROM coaching.exercise_variant_v1 WHERE id=ANY(all_variant_ids))<>cardinality(all_variant_ids)
    OR (SELECT count(*) FROM coaching.exercise WHERE id=ANY(source_ids))<>cardinality(source_ids) THEN
    RAISE EXCEPTION '% requires the protected definitions, variants, and legacy rows',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ANY(archive_definition_ids||ARRAY[canonical_id])
        AND ((id=canonical_id AND NOT (card_version=1 OR
              (card_version=2 AND provenance_json->>'rotationalSlamCompletionMigration'=migration_key)))
          OR (id=ANY(archive_definition_ids) AND card_version<>1)
          OR status NOT IN ('review','archived')
          OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE reviewed_by IS NOT NULL AND
        (survivor_definition_id=ANY(archive_definition_ids||ARRAY[canonical_id])
          OR resolved_definition_id=ANY(archive_definition_ids||ARRAY[canonical_id])))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_variant_ids) AND reviewed_by IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_variant_ids) OR to_variant_id=ANY(all_variant_ids))
        AND reviewed_by IS NOT NULL) THEN
    RAISE EXCEPTION '% refuses to overwrite human-reviewed or approved rotational-slam state',migration_key;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND reviewed_card_version<2
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND reviewed_card_version<2
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND reviewed_card_version<2
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=ANY(all_variant_ids);

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id=canonical_id,source_kind='legacy_migration',
      provenance_json=provenance_json||jsonb_build_object(
        'rotationalSlamCompletionMigration',migration_key,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_definition_v1
  SET canonical_name='Rotational Ball Slam',display_name='Rotational Ball Slam',
    aliases=ARRAY['Med Ball Overhead to Side Slam','Medicine Ball Overhead-to-Side Slam','Medicine Ball Rotational Slam','Rotational Medicine Ball Slam','Rotational Slam','Slam Ball Rainbow Slam','Slam Ball Rotational Slam','Slam Ball Side-to-Side Slam','Side-to-Side Medicine Ball Slam','Step-Behind Rotational Slam Ball Slam'],
    description='A standing ballistic ball exercise that uses a declared stationary or step-behind entry, coordinated foot and hip pivot, trunk rotation, and an overhead or large-arc path to drive a slam-rated ball into a marked floor zone outside one foot, followed by the declared rebound catch or controlled retrieval and reset.',
    family_key='side_directed_rotational_ball_slam',schema_version='2.0.0',
    card_version=2,status='review',content_confidence=82,
    scoring_confidence=54,media_confidence=32,
    movement_patterns=ARRAY['rotate','throw','squat','hinge','brace'],
    body_regions=ARRAY['foot','ankle','knee','hip','core','spine','shoulder','elbow','wrist','hand'],
    required_equipment=ARRAY['medicine_ball'],
    optional_equipment=ARRAY['slam_ball','floor_markers','mat'],
    environment_json=jsonb_build_object(
      'surface','level_non_slip_slam_tolerant_floor',
      'space',jsonb_build_array('marked_side_release_zone','clear_overhead_and_arc_space','clear_rebound_or_retrieval_zone','clear_step_behind_entry_when_used','no_cross_traffic'),
      'ballPolicy','Use only an intact ball rated for the assigned slam and floor. Declare mass and rebound behavior; do not assume a medicine ball can be slammed or a dead ball will rebound.',
      'floorPolicy','Confirm the surface tolerates repeated ball impacts without slip, damage, unpredictable rebound, or conflict with adjacent athletes.',
      'lighting','feet_knees_hips_trunk_ball_release_zone_and_rebound_visible',
      'coachSightline',jsonb_build_array('front_oblique_for_release_zone_and_trunk','side_oblique_for_arc_squat_hinge_and_reset'),
      'equipmentChecks',jsonb_build_array('ball_type_mass_and_slam_rating_match','cover_and_seams_intact','rebound_test_completed','release_zone_marked','floor_and_clearance_safe')),
    population_json=jsonb_build_object(
      'screen',jsonb_build_array('pain_free_overhead_and_rotational_range','controlled_squat_or_hinge','safe_grip_release_and_retrieval','controlled_foot_pivot','tolerates_ballistic_intent','no_unresolved_neurologic_dizziness_breathing_or_pressure_symptoms'),
      'individualize',jsonb_build_array('variant','ball_type_and_mass','rebound_behavior','arc_and_range','start_side','side_pattern','sets','repetitions_per_side','rest','release_zone','session_and_weekly_ballistic_volume'),
      'referOrModify',jsonb_build_array('acute_shoulder_elbow_wrist_hand_back_hip_knee_ankle_or_foot_symptoms','unexplained_neurologic_or_cardiopulmonary_symptoms','pregnancy_or_postpartum_pressure_balance_or_impact_symptoms','unsafe_overhead_range_rotation_floor_pickup_or_rebound_control','recent_concussion_or_visual_tracking_issue')),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('gluteus_maximus','quadriceps','hamstrings','obliques','rectus_abdominis','latissimus_dorsi','deltoids'),
      'secondaryMuscles',jsonb_build_array('calf_complex','hip_rotators','adductors','spinal_stabilizers','serratus_anterior','rotator_cuff','triceps_brachii','forearm_and_hand_muscles'),
      'joints',jsonb_build_array('foot_and_ankle','knee','hip','pelvis_and_spine','glenohumeral_joint','scapulothoracic_articulation','elbow','wrist_and_hand'),
      'jointActions',jsonb_build_array('foot_pivot_and_ankle_stabilization','knee_and_hip_extension_during_lift','knee_and_hip_flexion_during_slam_and_retrieval','hip_and_thoracic_rotation','trunk_bracing_with_controlled_flexion','shoulder_flexion_then_extension_and_adduction','elbow_and_wrist_stabilization','grip_then_release_or_catch'),
      'planes',jsonb_build_array('transverse_primary','frontal_and_sagittal_coupling'),
      'laterality','right_left_single_side_or_alternating_as_declared_with_balanced_side_dose',
      'repetitionBoundary',jsonb_build_array('declared_start_with_ball_controlled','assigned_stationary_or_step_behind_entry','ball_reaches_declared_overhead_or_rainbow_arc','coordinated_pivot_rotation_and_side_directed_floor_release','ball_hits_marked_zone_outside_declared_foot','assigned_rebound_catch_or_controlled_retrieval','stable_reset_before_next_attempt'),
      'validitySignals',jsonb_build_array('correct_variant_ball_mass_and_behavior','safe_overhead_and_arc clearance','rotation_shared_by_feet_hips_and_thorax','no_forced_lumbar_twist','release_zone_accuracy','controlled_finish','correct_side_order','safe_catch_or_retrieval','speed_and_quality_preserved'),
      'evidenceLimit','Direct rotational floor-slam trials are sparse. Rotational throw tests and upper-body plyometric studies are adjacent evidence and do not prove universal load, dose, muscle ranking, transfer, or clinical benefit.'),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','Trains coordinated ground-up rotational power and an accurate side-directed ball release without requiring a wall target.',
      'beforeYouStart',jsonb_build_array('Confirm the exact path and entry, ball type and mass, rebound rule, start side, side order, repetitions, rest, marked release zone, and stop command.','Clear overhead, side, rebound, retrieval, and step-behind space; test one controlled ball impact before the work set.'),
      'steps',jsonb_build_array('Set the assigned stance with the ball controlled and eyes on the clear release zone.','Lift through the declared overhead or rainbow path while keeping ribs and pelvis organized.','Pivot through the feet and hips, rotate, and drive the ball into the marked zone outside the assigned foot.','Catch only when the ball and profile explicitly allow it; otherwise let it settle and retrieve with a controlled squat or hinge.','Own the finish, reset, and complete the balanced side dose without rushing.'),
      'primaryCue','Turn from the floor up, hit the side mark, own the reset.',
      'expectedSensations',jsonb_build_array('fast_whole_body_effort','feet_hips_and_trunk_working_together','shoulder_and_lat_effort','brief_brace_and_exhale','rising_power_fatigue_without_joint_symptoms'),
      'unexpectedSensations',jsonb_build_array('sharp_or_increasing_pain','low_back_twisting_or_pinching','numbness_or_tingling','dizziness','breathing_or_pressure_symptoms','loss_of_grip_footing_or_ball_control'),
      'painGuidance','Stop, clear the ball and lane, and report the symptom; do not chase another fast repetition or catch an unsafe rebound.',
      'accessibility',jsonb_build_array('lighter_ball','smaller_arc','stationary_entry','single_side_sets_with_full_reset','dead_ball_retrieval_instead_of_rebound_catch','longer_rest','written_steps','still_frames','coach_rehearsal','nonball_rotational_substitute_when_slamming_is_not_safe'),
      'reportImmediately',jsonb_build_array('pain','numbness_or_tingling','dizziness','breathing_or_pressure_symptoms','unsafe_rebound_or_collision','loss_of_grip_or_footing','damaged_ball_or_floor')),
    coach_support_json=jsonb_build_object(
      'setupChecklist',jsonb_build_array('Confirm exact variant, ball construction/rating/mass, rebound rule, entry, start side, side pattern, arc, release zone, sets, repetitions per side, rest, and stop rule.','Inspect ball, seams, floor, overhead and lateral clearance, rebound/retrieval lane, markers, and adjacent traffic.','Confirm cumulative ballistic throws/slams, overhead volume, trunk rotation, ball impacts, fatigue, symptoms, and recovery.'),
      'observationChecklist',jsonb_build_array('ball_control_at_start','foot_pressure_and_pivot','hip_then_trunk_sequence','lumbar_control','overhead_or_rainbow_path','release_zone_accuracy','finish_balance','side_order','ball_speed_or_visible_intent','rebound_catch_or_retrieval','reset_time','symptoms_and_fatigue'),
      'observationViews',jsonb_build_array('front_oblique_for_release_accuracy_rotation_and_side','side_oblique_for_arc_squat_hinge_and_reset','wide_view_for_entry_rebound_retrieval_and_traffic'),
      'validRep',jsonb_build_array('correct_variant_ball_and_side','clear_entry_and_arc','ground_up_rotation','marked_side_release','controlled_finish','safe_declared_ball recovery','stable_reset','quality_within_threshold'),
      'faultCorrections',jsonb_build_object('lumbarTwist','Reduce range and speed; restore foot and hip pivot or substitute.','missedReleaseZone','Reduce mass or arc and remark the target.','unsafeRebound','Stop catching, change ball/profile, and clear the lane.','rushedRetrieval','Require ball-settle and full reset.','speedLoss','End the set or increase rest; do not convert priority power into conditioning.','stepBehindFault','Regress to stationary entry and rebuild foot order.'),
      'groupManagement',jsonb_build_object('station','one active athlete per marked arc-impact-rebound lane','traffic','no one enters another athlete overhead arc release rebound or retrieval zone','ballReturn','collect only after the ball settles or assigned catch is secured','recording','record variant, ball, side, valid and failed attempts, release accuracy, speed if measured, fault, symptom, duration, and substitution'),
      'record',jsonb_build_array('definition_id','variant_id','profile_key','ball_type_mass_and_rebound','entry','trajectory','start_side','side_pattern','sets','repetitions_per_side','rest','release_zone','valid_and_failed_attempts','speed_or_quality','ball_impacts','faults','symptoms','duration','substitution')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_variant_or_side_mismatch','ball_rating_mass_rebound_or_equipment_mismatch','lane_floor_clearance_or_traffic_problem','dose_duration_fatigue_recovery_or_impact_mismatch','symptom_collision_or_ball_control_event','media_caption_or_accessibility_issue','rendering_validation_or_persistence_issue'),
      'supportEscalation',jsonb_build_object('immediate',jsonb_build_array('pain','numbness_or_tingling','dizziness','breathing_or_pressure_symptoms','head_or_body_ball_strike','uncontrolled_rebound_or_collision','damaged_ball_floor_or_unsafe_lane'),'coachReview',jsonb_build_array('repeated_rotation_release_or_reset_failure','step_behind_or_catch_difficulty','substitution_request','fatigue_or_recovery_conflict'),'contentReview',jsonb_build_array('identity_or_variant_confusion','media_mismatch','caption_or_accessibility_gap')),
      'retentionPolicy',jsonb_build_object('store',jsonb_build_array('definition_id','variant_id','profile_key','ball_and_rebound','entry','trajectory','side','dose','rest','release_zone','duration','quality_result','stop_reason','symptoms','ball_impacts','substitution','rendered_instructions'),'preserveHumanReviewHistory',TRUE,'neverOverwriteApprovedReview',TRUE),
      'changeImpactPolicy',jsonb_build_object('onVariantBallEntryTrajectorySideDoseRestReleaseZoneOrProfileChange',jsonb_build_array('revalidate_selection','recompute_fatigue_recovery_and_ball_impact','recompute_duration','recheck_lane_floor_equipment_and_traffic','rerender_coach_and_athlete_instructions','persist_new_validation'),'neverSilent',TRUE)),
    provenance_json=(provenance_json-'researchSource'-'researchSources')||jsonb_build_object(
      'rotationalSlamCompletionMigration',migration_key,'researchVersion',research_version,
      'canonicalAuditContract','canonical-card-audit-v1','canonicalAuthoredFromResearch',TRUE,
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'overallDifficultyFormula','max(exercise_complexity,physical_difficulty)',
      'primaryIdentitySource','https://www.acefitness.org/resources/everyone/exercise-library/287/rotational-slam/',
      'directDynamicResearchLimit','sparse','mediaVerificationScope','youtube_oembed_link_and_embed_health_only',
      'legacyCardsAudited',5,'activeVariantsAuthored',3,'deliveryOnlyLegacyVariantsArchived',2,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,updated_at=now()
  WHERE id=canonical_id;

  UPDATE coaching.exercise_definition_v1
  SET status='archived',updated_at=now(),
      provenance_json=provenance_json||jsonb_build_object(
        'consolidatedIntoDefinitionId',canonical_id,
        'rotationalSlamCompletionMigration',migration_key,
        'identityDecision','duplicate_consolidated',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE id=ANY(archive_definition_ids);

  UPDATE coaching.exercise_variant_v1 variant SET
    definition_id=canonical_id,variant_key=spec.variant_key,
    display_name=spec.display_name,modifier_keys=spec.modifier_keys,
    difficulty_json=jsonb_build_object(
      'technicalComplexity',spec.technical,'absoluteLoadDemand',spec.physical,
      'physicalDifficulty',spec.physical,'coordinationDemand',spec.coordination,
      'supervisionDemand',spec.supervision,'failureConsequence',spec.failure,
      'impact',2,'athleteLandingImpact',0,
      'workCapacityDemand',spec.work_capacity,
      'baseOverallDifficulty',GREATEST(spec.technical,spec.physical),
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'overallFormula','max(exercise_complexity,physical_difficulty)'),
    requirements_json=jsonb_build_object(
      'selectable',TRUE,'stance',spec.stance,'entry',spec.entry,
      'trajectory',spec.trajectory,'implement','slam_rated_ball',
      'ballTypeMassAndRebound','required_and_declared','startSide','declared',
      'sidePattern','single_side_or_alternating_in_delivery_profile',
      'sideDose','equal_repetitions_per_side','releaseTarget','marked_floor_zone_outside_working_foot',
      'rotationSource','feet_hips_pelvis_and_thorax_not_forced_lumbar_twist',
      'reset','declared_rebound_catch_or_ball_settle_and_controlled_retrieval',
      'surface','level_non_slip_slam_tolerant','clearance',spec.clearance,
      'invalid',jsonb_build_array('wrong_variant_ball_entry_trajectory_side_or_sequence','unsafe_overhead_arc_or_lane','forced_lumbar_twist','missed_release_zone','loss_of_footing_or_finish','unplanned_or_uncontrolled_rebound','unsafe_catch_or_retrieval','speed_or_accuracy_below_threshold','rushed_reset_or_traffic_conflict')),
    load_profile_json=jsonb_build_object(
      'loadingType','ballistic_external_load','externalLoadMethod','ball_mass',
      'externalLoadRecorded',TRUE,'gripDemand',spec.grip,'spinalLoading',spec.spinal,
      'eccentricStress',spec.eccentric,'landingContactsPerRep',0,
      'ballFloorImpactsPerRep',1,'primaryStress',jsonb_build_array('ground_up_rotational_power','overhead_ball_acceleration','side_directed_release','ballistic_trunk_and_shoulder_demand','grip_release_and_optional_catch'),
      'loadAccounting',jsonb_build_object('recordBallTypeMassAndRating',TRUE,'recordReboundBehavior',TRUE,'recordEntryTrajectoryAndSide',TRUE,'recordValidAndFailedAttemptsPerSide',TRUE,'recordBallFloorImpacts',TRUE,'recordSpeedAccuracyRestAndEffort',TRUE,'recordCatchOrRetrieval',TRUE)),
    fatigue_profile_json=jsonb_build_object(
      'localMuscleFatigue',spec.local_fatigue,'gripFatigue',spec.grip,
      'technicalFatigueSensitivity',spec.technical_fatigue,
      'impactAccumulation',2,'athleteLandingImpact',0,
      'recoveryHours',spec.recovery_hours,
      'qualityLossSignals',jsonb_build_array('slower_ball_or_visible_intent','release_zone_miss','late_or_forced_rotation','lumbar_twist','footwork_or_finish_error','side_sequence_error','unsafe_rebound_catch_or_retrieval','grip_loss','rushed_reset'),
      'cumulativeRules',jsonb_build_array('count_valid_and_failed_attempts_for_each_side','count_every_ball_floor_impact_separately_from_athlete_landing_contacts','include_ball_mass_entry_arc_rebound_catch_retrieval_effort_and_rest','include_same_session_throws_slams_sprints_overhead_work_rotation_and grip','increase_recovery_after_high_volume_high_mass_or_quality_loss')),
    programming_profile_json=jsonb_build_object(
      'preferredBlock','output_before_material_throw_slam_strength_or_conditioning_fatigue',
      'primaryObjectives',jsonb_build_array('rotational_power','ground_up_force_transfer','side_release_accuracy','controlled_ballistic_reset'),
      'cumulativeFatigueBudget','sum valid and failed attempts per side, ball mass and impacts, entry and arc, rebound catches or retrievals, speed/accuracy loss, overlapping throws/slams/overhead/rotation work, symptoms, and recovery',
      'impactBudget','zero athlete landing contacts; one equipment-to-floor impact per attempt plus any unintended rebound event',
      'weeklyExposure',jsonb_build_object('frequency','individualized_from_objective_mass_speed_accuracy_symptoms_recovery_and_total_ballistic_plan','minimumRecoveryHours',spec.recovery_hours),
      'sequenceRules',jsonb_build_array('verify_ball_lane_variant_side_and_stop_command','perform_before_fatigue_changes_speed_sequence_release_or_reset','balance side dose','stop before missed targets or unsafe ball behavior repeat'),
      'pairingCompatibility',jsonb_build_array('low_fatigue_mobility_or_breathing_during_full_rest'),
      'interferenceRules',jsonb_build_array('do_not_pre_fatigue_grip_shoulders_trunk_or_footwork_before_priority_slam','do_not_convert_output_profile_to_unbounded_conditioning','recompute_load_fatigue_ball_impact_duration_lane_equipment_and_rendering_after_substitution')),
    status='review',updated_at=now()
  FROM (VALUES
    (stationary_variant,'stationary-diagonal','Rotational Ball Slam — Stationary Diagonal',ARRAY['stationary','diagonal_side_slam']::TEXT[],58,50,66,54,48,54,'bilateral_stance','stationary','overhead_to_side_diagonal','overhead_arc_and_side_release_zone',48,24,22,54,68,24),
    (rainbow_variant,'stationary-rainbow','Rotational Ball Slam — Stationary Rainbow Arc',ARRAY['stationary','rainbow_arc']::TEXT[],64,56,72,58,52,58,'bilateral_stance','stationary','large_overhead_rainbow_arc','large_overhead_and_bilateral_side_release_zones',52,26,24,58,74,24),
    (step_behind_variant,'step-behind-diagonal','Rotational Ball Slam — Step-Behind Entry',ARRAY['step_behind','diagonal_side_slam']::TEXT[],70,62,80,66,62,64,'athletic_stance','step_behind_crossover','overhead_to_side_diagonal','entry_arc_release_rebound_and_deceleration_zone',54,30,26,62,82,30)
  ) AS spec(id,variant_key,display_name,modifier_keys,technical,physical,
    coordination,supervision,failure,work_capacity,stance,entry,trajectory,
    clearance,grip,spinal,eccentric,local_fatigue,technical_fatigue,recovery_hours)
  WHERE variant.id=spec.id;

  UPDATE coaching.exercise_variant_v1
  SET definition_id=canonical_id,status='archived',updated_at=now(),
      requirements_json=jsonb_build_object('selectable',FALSE,
        'archiveReason',CASE id
          WHEN delivery_only_variant THEN 'side_to_side_alternation_is_a_delivery_laterality_annotation_not_an_exact_variant'
          ELSE 'overhead_to_side_source_duplicates_stationary_diagonal_and_does_not_declare_ball_rebound_or_side_pattern' END,
        'preservedLegacySource',TRUE,'humanReviewRequired',TRUE),
      programming_profile_json=jsonb_build_object('selectable',FALSE,'publicationQuarantined',TRUE)
  WHERE id=ANY(ARRAY[delivery_only_variant,duplicate_variant]);

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT variant.id,profile.profile_key,profile.phase_key,profile.role,
    profile.purpose,profile.suitability,profile.alignment,
    jsonb_build_object('rotationalPower',5,'groundUpSequencing',5,
      'releaseAccuracy',5,'powerEndurance',profile.power_endurance,
      'athleteLandingImpact',0,'ballFloorImpact',1),
    jsonb_build_object('doseType','repetitions_per_side','sets',profile.sets,
      'repetitionsPerSide',profile.repetitions,'sidePattern',profile.side_pattern,
      'startSide','declared_and_rotated_between_sets','ballMass','declared',
      'intent',profile.intent,'restSeconds',profile.rest_seconds,
      'qualityThreshold','end_before_speed_accuracy_sequence_or_ball_control_materially_declines'),
    'Every counted attempt uses the assigned variant, intact slam-rated ball, mass, entry, trajectory, side and order; shares rotation through feet, hips and thorax; hits the marked floor zone; finishes under control; follows the declared rebound or retrieval rule; and resets without a repeated speed, accuracy, posture, footwork, grip, or traffic fault.',
    ARRAY['pain_or_neurologic_symptom','dizziness_breathing_or_pressure_symptom','wrong_or_damaged_ball','unsafe_floor_lane_overhead_or_traffic_condition','forced_lumbar_twist','loss_of_grip_or_footing','missed_release_zone_twice','unsafe_rebound_catch_or_retrieval','step_behind_or_finish_control_loss','meaningful_speed_or_intent_drop','cannot_reset_before_next_attempt'],
    ARRAY['Verify exact ball, mass, slam rating, rebound, variant, side pattern, release mark, lane, dose, rest, and stop command.','Observe the full feet-to-ball sequence and ball recovery from a clear wide angle.','Count valid and failed attempts and impacts for each side.','End the set before speed, target accuracy, posture, footwork, finish, or ball control changes.'],
    ARRAY['Use the assigned ball, path, start side, and release mark.','Turn from the floor through the hips and trunk.','Drive the ball to the side mark and keep your finish.','Catch only if assigned; otherwise let the ball settle and retrieve it safely.','Reset before the next fast attempt.'],
    CASE profile.phase_key WHEN 'output' THEN
      'Improved high-intent rotational force transfer, side-release accuracy, and repeatable ballistic coordination.'
      ELSE 'Improved repeatability of accurate rotational slams under a tightly capped submaximal power-endurance dose.' END,
    ARRAY['medicine_ball','clear_level_non_slip_surface','safe_ball_retrieval_zone']::TEXT[],
    jsonb_build_object('athletesPerStation',1,'clearance',variant.requirements_json->>'clearance',
      'setupSeconds',60,'transitionSeconds',45,'sideChangeSeconds',20,
      'ballPolicy','intact_slam_rated_ball_with_declared_mass_and_rebound',
      'releaseZone','marked_outside_working_foot','reboundOrRetrieval','declared_and_rehearsed',
      'coachSightline',jsonb_build_array('front_oblique','side_oblique','wide_lane_view'),
      'trafficRule','no_entry_into_arc_impact_rebound_retrieval_or_step_behind_zone',
      'substitutionRevalidation',jsonb_build_array('identity','variant','ball_type_mass_rating_and_rebound','entry','trajectory','side_pattern','dose','fatigue','ball_impact','duration','lane_and_traffic','population_constraints','rendering')),
    ARRAY[]::UUID[],'review',
    jsonb_build_object('setupSeconds',60,'secondsPerAttempt',7,
      'sideChangeSeconds',20,'transitionSeconds',45,'countBothSides',TRUE,
      'durationFormula','setup + sets * (repetitions_per_side * 2 * seconds_per_attempt + side_change + rest) + transition',
      'retrievalAdjustmentSeconds','add_per_attempt_when_ball_does_not_rebound_or_catch_is_not_assigned'),
    jsonb_build_object('reduce',jsonb_build_array('reduce_ball_mass','reduce_repetitions_per_side','increase_rest','use_stationary_entry','reduce_arc','use_single_side_sets','use_dead_ball_retrieval_instead_of_catch'),'increase',jsonb_build_array('increase_speed_or_release_accuracy_standard_before_mass','add_one_repetition_within_cap','progress_to_rainbow_or_step_behind_only_as_reviewed_variant'),'revalidateAfterChange',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_id','variant_id','profile_key','ball_type_mass_rating_and_rebound','entry','trajectory','start_side','side_pattern','sets','repetitions_per_side','valid_and_failed_attempts','ball_floor_impacts','release_accuracy','speed_if_available','rest','faults','symptoms','duration'),'validity','all exact variant, lane, side, sequence, release, finish, recovery, and quality gates pass'),
    jsonb_build_object('before','Which variant, ball, mass, rebound rule, side pattern, release zone, dose, rest, and lane were assigned?','during','Are ground-up rotation, release accuracy, finish, speed, rebound or retrieval, and traffic still valid?','after','Store each side, valid and failed attempts, ball impacts, accuracy or speed, stop reason, symptoms, duration, and any substitution.')
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN (VALUES
    ('output-single-side','output','primary','single_side_sets_then_balanced_other_side',3,3,90,94,94,1,'Express maximal rotational slam intent with full reset and separately counted side sets.','maximal_safe_speed_and_accuracy'),
    ('output-alternating','output','primary','alternating_sides',3,3,105,92,92,1,'Express rotational power while alternating sides without sacrificing release accuracy, finish, or reset.','maximal_safe_speed_and_accuracy'),
    ('capacity-quality-volume','capacity','secondary','single_side_sets_or_alternating_as_declared',4,3,75,82,86,4,'Build tightly capped rotational power endurance while every attempt still meets the first-attempt standard.','submaximal_mass_with_fast_intent_and_quality_reserve')
  ) profile(profile_key,phase_key,role,side_pattern,repetitions,sets,
    rest_seconds,suitability,alignment,power_endurance,purpose,intent)
  WHERE variant.id=ANY(active_variant_ids)
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
    logistics_json=EXCLUDED.logistics_json,substitution_ids=EXCLUDED.substitution_ids,
    status='review',time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_id,2,item->>'sectionKey',item->>'sourceUrl',
    item->>'sourceTitle',item->>'sourcePublisher',item->>'sourceKind',
    item->'claims'||jsonb_build_array(jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)),
    (item->>'evidenceQuality')::SMALLINT,'candidate',NULL,NULL
  FROM jsonb_array_elements(evidence_payload) item
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,
    claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,language_code,captions_available,embedding_allowed,
    exact_variant_match,demonstration_quality_score,link_status,review_status,
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,notes)
  SELECT canonical_id,NULL,2,'https://www.youtube.com/watch?v='||(item->>'videoId'),
    'https://www.youtube-nocookie.com/embed/'||(item->>'videoId'),
    item->>'videoId',item->>'title',item->>'channel','en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',item->>'query',NULL,NULL,
    '2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'Public YouTube oEmbed link, title, channel, and iframe health rechecked 2026-08-02. Full playback must verify exact Rotational Ball Slam identity and variant, ball construction and rebound, entry, trajectory, side pattern, release zone, finish, catch or retrieval, cue safety, captions, accessibility, demonstration quality, and conflicts. No content verification, exact match, reviewer, or approval is inferred.'
  FROM jsonb_array_elements(media_payload) item
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,language_code='en',
    captions_available=NULL,embedding_allowed=TRUE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='healthy',
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_id,2,item->>'name',item->>'class',item->>'why',
    item->'dimensions',NULL,'candidate',NULL,NULL
  FROM jsonb_array_elements(alternate_payload) item
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (stationary_variant,rainbow_variant,'progression',84,ARRAY['complexity','mobility','space'],'The larger rainbow arc adds overhead range, trajectory control, bilateral side-space demand, and timing while preserving the side-directed floor slam.',$json$ {"requires":["stationary_diagonal_release_is_accurate","overhead_arc_is_pain_free","larger_lane_is_clear"],"recompute":["difficulty","fatigue","duration","space","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (rainbow_variant,stationary_variant,'regression',84,ARRAY['complexity','mobility','space'],'The shorter stationary diagonal path reduces arc and timing demand while retaining rotational release and floor target.',$json$ {"useWhen":["rainbow_arc_or_timing_exceeds_objective"],"recompute":["difficulty","fatigue","duration","space","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (stationary_variant,step_behind_variant,'progression',78,ARRAY['complexity','balance','space','speed'],'Step-behind entry adds foot order, momentum, balance, deceleration, and a longer lane.',$json$ {"requires":["stationary_release_and_finish_are_repeatable","step_behind_rehearsal_is_controlled","entry_lane_is_clear"],"recompute":["difficulty","fatigue","duration","lane","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (step_behind_variant,stationary_variant,'regression',78,ARRAY['complexity','balance','space','speed'],'Stationary entry removes crossover momentum and reduces lane and deceleration demand.',$json$ {"useWhen":["entry_footwork_finish_or_space_is_limiting"],"recompute":["difficulty","fatigue","duration","lane","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (rainbow_variant,step_behind_variant,'lateral_substitution',72,ARRAY['trajectory','entry','complexity','space'],'Rainbow arc and step-behind entry emphasize different complexity and space demands and are not silent equivalents.',$json$ {"revalidate":["entry","trajectory","overhead_range","footwork","lane","side_dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (step_behind_variant,rainbow_variant,'lateral_substitution',72,ARRAY['trajectory','entry','complexity','space'],'Replacing step-behind entry with a stationary rainbow arc changes momentum, footwork, overhead path, and lane demand.',$json$ {"revalidate":["entry","trajectory","overhead_range","footwork","lane","side_dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  SELECT 1,canonical_id,archived_id,'duplicate_consolidated',
    'The source preserves the same standing side-directed rotational floor slam. Implement/rebound, side alternation, larger arc, or step-behind entry belongs to exact delivery or variant data rather than another exercise identity.',
    jsonb_build_object('migration',migration_key,
      'resolution','same_side_directed_rotational_floor_slam_with_variant_or_delivery_dimension',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL
  FROM unnest(archive_definition_ids) archived_id
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
    AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  VALUES
    (1,canonical_id,'52f9a2fe-f605-4396-8b84-cf1d9302e82d','distinct_exercises','Medicine Ball Overhead Slam uses a bilateral straight-ahead sagittal release; Rotational Ball Slam requires a side-directed floor target and coordinated transverse rotation.',jsonb_build_object('migration',migration_key,'identityBoundary','straight_overhead_slam_vs_side_directed_rotational_slam','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'4aab75e6-c3d8-4b2c-a523-35f9b85f0199','distinct_exercises','Medicine Ball Rotational Throw releases toward a wall, partner, or free-flight target; Rotational Ball Slam releases into a marked floor zone.',jsonb_build_object('migration',migration_key,'identityBoundary','free_or_wall_throw_vs_floor_slam','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'8dc91b17-d8b4-485a-8848-1c16145f4bf9','distinct_exercises','Medicine Ball Rebound Slam to Catch makes reactive rebound reception the defining task; rebound catch is optional delivery in Rotational Ball Slam and dead-ball retrieval is valid.',jsonb_build_object('migration',migration_key,'identityBoundary','reactive_catch_objective_vs_optional_recovery_method','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'b9cd38d8-604b-4ac5-903d-c2a4118382cd','distinct_exercises','Med Ball Slam Reset Interval is interval-defined conditioning; Rotational Ball Slam profiles preserve an exact side-directed ballistic repetition and capped quality dose.',jsonb_build_object('migration',migration_key,'identityBoundary','interval_conditioning_contract_vs_exact_rotational_power_repetition','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'95e65ef9-c8a2-4cae-8aa9-48e818f55304','distinct_exercises','Slam Ball Scoop Slam begins from a low scoop and uses a different load path; Rotational Ball Slam travels overhead or through a rainbow arc before side release.',jsonb_build_object('migration',migration_key,'identityBoundary','low_scoop_path_vs_overhead_rotational_path','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'e6a281e9-c03f-489d-97ba-9aad26684314','distinct_exercises','Med Ball Slam to Rotational Throw contains two ordered releases; Rotational Ball Slam contains one side-directed floor release per repetition.',jsonb_build_object('migration',migration_key,'identityBoundary','two_release_combination_vs_single_floor_release','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'a991e011-7e99-4995-8567-10d35631f4e8','distinct_exercises','Tall-Kneeling Overhead Medicine Ball Slam removes foot pivot and lower-body drive and uses a straight overhead path; Rotational Ball Slam is standing and side-directed.',jsonb_build_object('migration',migration_key,'identityBoundary','tall_kneeling_straight_slam_vs_standing_rotational_slam','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'5716ac60-c945-419c-b454-3d6a9e0eddbc','distinct_exercises','Slam Ball Slam to Sprint Start adds an ordered acceleration start and run-out lane after the slam.',jsonb_build_object('migration',migration_key,'identityBoundary','slam_plus_sprint_combination_vs_slam_only','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'79f96f21-12ec-49f6-913c-3bb480a8b6d8','distinct_exercises','Slam Ball Sprawl to Slam adds a prone ground-contact transition and conditioning sequence that the rotational slam does not require.',jsonb_build_object('migration',migration_key,'identityBoundary','sprawl_combination_vs_rotational_slam_only','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'5beb30c6-84d5-4210-8eee-ea29e7032e4e','distinct_exercises','Medicine Ball Shot-Put Throw is a unilateral horizontal free projection driven from one shoulder; Rotational Ball Slam is a two-hand overhead-to-side floor release.',jsonb_build_object('migration',migration_key,'identityBoundary','single_arm_horizontal_shot_put_vs_two_hand_side_directed_floor_slam','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'7d20c7b3-b37d-4ad8-a2da-eee07d67aaa3','distinct_exercises','Forward Overhead Medicine-Ball Throw projects the ball forward through free flight; Rotational Ball Slam rotates and drives it into a side floor zone.',jsonb_build_object('migration',migration_key,'identityBoundary','forward_overhead_free_projection_vs_rotational_side_floor_slam','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'4d9050ce-3554-4ee8-beaa-eeb79b476912','distinct_exercises','Medicine Ball Rotational Catch-and-Stick receives and decelerates an incoming ball before a terminal hold; Rotational Ball Slam accelerates and releases the ball to the floor.',jsonb_build_object('migration',migration_key,'identityBoundary','incoming_rotational_catch_deceleration_vs_outgoing_floor_slam','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'11cb66a9-be13-492b-bb19-3025a7f3251d','distinct_exercises','Shuffle-to-Rotational Medicine Ball Throw uses lateral approach steps and a wall/free-flight projection; step-behind Rotational Ball Slam still terminates in a side floor impact.',jsonb_build_object('migration',migration_key,'identityBoundary','shuffle_to_wall_projection_vs_step_behind_floor_slam','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'8a22285b-b363-4b49-80f5-b9f6917fea79','distinct_exercises','Medicine Ball Rotational Toss to Lateral Bound combines a free toss with an athlete flight and landing; Rotational Ball Slam has no required athlete flight or bound.',jsonb_build_object('migration',migration_key,'identityBoundary','free_toss_plus_lateral_bound_vs_floor_slam_without_athlete_flight','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'6a256c5b-fc5d-4c45-bd9a-601eb7249c6b','distinct_exercises','Medicine Ball Side Toss with Step uses a step-in free or wall projection; Rotational Ball Slam uses an overhead or rainbow path to a floor impact zone.',jsonb_build_object('migration',migration_key,'identityBoundary','step_in_side_projection_vs_overhead_rotational_floor_slam','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
    AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,variant.id,dimension.key,
    (variant.difficulty_json->>dimension.key)::SMALLINT,
    CASE WHEN (variant.difficulty_json->>dimension.key)::INTEGER<50 THEN 40
      WHEN (variant.difficulty_json->>dimension.key)::INTEGER<70 THEN 60 ELSE 80 END,
    CASE dimension.key
      WHEN 'technicalComplexity' THEN 'Review-only exercise-complexity anchor for exact ball and rebound, entry, overhead or rainbow trajectory, side pattern, foot and hip pivot, release accuracy, finish, recovery, reset, and lane control of '
      ELSE 'Review-only physical-difficulty anchor for ball mass, ballistic intent, overhead and rotational volume, side dose, grip, repeated ball recovery, local fatigue, and recovery of ' END
      ||variant.display_name||'. No athlete proficiency classification is represented.',
    'review',1,NULL,NULL,NULL,NULL
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(key)
  WHERE variant.id=ANY(active_variant_ids)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_id,1,2,'1.0.0',migration_key,'quarantined',
    jsonb_build_object('identityKnown',TRUE,'selectableVariant',TRUE,
      'taxonomyControlled',TRUE,'anatomyComplete',TRUE,
      'difficultyComplete',TRUE,'loadComplete',TRUE,
      'fatigueRecoveryComplete',TRUE,'constraintsComplete',TRUE,
      'deliveryComplete',TRUE,'durationComplete',TRUE,
      'cumulativeFatigueAndImpactBudgetComplete',TRUE,
      'logisticsAndBallSafetyComplete',TRUE,
      'measurementAndValidityComplete',TRUE,
      'substitutionValidationComplete',TRUE,'athleteSupportComplete',TRUE,
      'coachSupportComplete',TRUE,'supportOperationsComplete',TRUE,
      'stopRulesComplete',TRUE,'evidenceCandidateSetComplete',TRUE,
      'mediaCandidateSetComplete',TRUE,'mediaApprovalComplete',FALSE,
      'graphReviewComplete',FALSE,'calibrationReviewComplete',FALSE,
      'exerciseSkillLevelAbsent',TRUE,'publicationApproved',FALSE),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must review full playback for exact Rotational Ball Slam identity and variant, ball type/mass/rating/rebound, entry, trajectory, side pattern, release zone, finish, catch or retrieval, captions, safety, accessibility, conflicts, and demonstration quality.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must review every progression, regression, substitution, and equipment/delivery-equivalence proposal.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','Independent calibration and review are required for exercise complexity and physical difficulty.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Publication remains blocked until evidence, media, graph, calibration, and card-review gates pass.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=1,card_version=2,
    schema_version='1.0.0',audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  UPDATE coaching.exercise SET skill_level=NULL WHERE id=ANY(source_ids);
  UPDATE coaching.exercise_safety_profile SET minimum_skill_level=NULL
  WHERE exercise_id=ANY(source_ids);

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND card_version=2 AND status='review'
        AND schema_version='2.0.0'
        AND provenance_json->>'rotationalSlamCompletionMigration'=migration_key
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL AND approved_video_url IS NULL)<>1
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(archive_definition_ids) AND status='archived')<>4 THEN
    RAISE EXCEPTION '% found invalid final definition states',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_id
        AND status='review' AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=
          GREATEST((difficulty_json->>'technicalComplexity')::INTEGER,
            (difficulty_json->>'physicalDifficulty')::INTEGER)
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty')<>3
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(ARRAY[delivery_only_variant,duplicate_variant])
        AND status='archived' AND requirements_json->>'selectable'='false')<>2 THEN
    RAISE EXCEPTION '% found invalid active or archived variant state',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND profile_key IN ('output-single-side','output-alternating','capacity-quality-volume')
        AND cardinality(equipment_required)>=3
        AND coalesce(dosage_json->>'repetitionsPerSide','')<>''
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND length(coach_instructions)>=100
        AND length(athlete_instructions)>=100
        AND cardinality(stop_rules)>=8)<>9 THEN
    RAISE EXCEPTION '% requires nine complete contextual delivery profiles',migration_key;
  END IF;

  IF (SELECT count(DISTINCT section_key)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND video_id=ANY(current_video_ids) AND link_status='healthy'
        AND review_status='candidate' AND embedding_allowed
        AND captions_available IS NULL AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL AND reviewer_user_id IS NULL
        AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>12 THEN
    RAISE EXCEPTION '% found incomplete evidence, media, or alternate packets',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND to_variant_id=ANY(active_variant_ids)
        AND review_status='review' AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND version=1 AND reviewed_by IS NULL)<>6 THEN
    RAISE EXCEPTION '% found incomplete graph or calibration review queues',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=canonical_id)<>5
    OR EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=ANY(source_ids) AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(source_ids) AND minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% found invalid source mapping or exercise skill state',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND (
        cardinality(movement_patterns)<5 OR cardinality(body_regions)<10
        OR anatomy_json='{}'::jsonb OR environment_json='{}'::jsonb
        OR population_json='{}'::jsonb OR athlete_support_json='{}'::jsonb
        OR coach_support_json='{}'::jsonb OR support_operations_json='{}'::jsonb
        OR provenance_json->>'approvalsCreated'<>'false')) THEN
    RAISE EXCEPTION '% found an incomplete canonical support packet',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_id AND card_version=2
        AND audit_version=migration_key AND status='quarantined'
        AND human_review_required
        AND (SELECT array_agg(item->>'code' ORDER BY item->>'code')
          FROM jsonb_array_elements(blocking_issues_json) item)=
          ARRAY['CARD-CALIBRATION-01','CARD-GRAPH-03','CARD-MEDIA-01','CARD-PUBLISH-01'])<>1 THEN
    RAISE EXCEPTION '% requires exactly the four protected human gates',migration_key;
  END IF;
END $$;
