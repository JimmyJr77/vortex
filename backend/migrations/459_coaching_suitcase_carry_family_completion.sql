-- Complete Suitcase Carry as one-sided loaded locomotion. Implement swaps stay
-- explicit variants; static holds, bilateral carries, line walking, marching,
-- turns, and unclear sandbag positions are never inferred from a shared label.
-- All content, media, graph, calibration, and publication approvals stay human.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '459_coaching_suitcase_carry_family_completion';
  research_version CONSTANT TEXT := '2026-08-02.71';
  canonical_id UUID;
  dumbbell_variant UUID;
  kettlebell_variant UUID;
  line_walk_variant UUID;
  farmer_definition UUID;
  farmer_variant UUID;
  hold_definition UUID;
  hold_variant UUID;
  source_ids CONSTANT BIGINT[] := ARRAY[204,452,504,559,1028,1340,1470];
  source_variant_ids UUID[];
  active_variant_ids UUID[];
  current_video_ids CONSTANT TEXT[] := ARRAY[
    'zFje79PZsxQ','IZ0aGhu24c8','z4WJXcx19WQ','LJaq4BS7KpE','Fko5Hp537us'];
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/38665162/","sourceTitle":"The Quantification of Muscle Activation During the Loaded Carry Movement Pattern","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["The study explicitly distinguishes bilateral farmer carry, unilateral suitcase carry, farmer hold, and suitcase hold under time- and intensity-matched conditions.","Suitcase Carry identity is one implement in one hand during locomotion; hand, implement, route, pace, turn, pickup, set-down, side order, and dose remain exact delivery facts."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/38665162/","sourceTitle":"The Quantification of Muscle Activation During the Loaded Carry Movement Pattern","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Loaded carry and loaded hold conditions are different tasks, and unilateral and bilateral conditions are separately named.","Controlled taxonomy is carry, locomote, and brace; static holds, bilateral farmer carries, front-rack carries, overhead carries, and compound step tasks remain distinct definitions."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/38665162/","sourceTitle":"The Quantification of Muscle Activation During the Loaded Carry Movement Pattern","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Suitcase carry produced trunk-muscle activation in the studied healthy college-aged sample, with condition- and side-specific findings for longissimus, multifidus, rectus abdominis, and external oblique.","The card also represents grip, shoulder-girdle support, pelvis, hip, knee, ankle, and foot demands of carrying while walking without claiming one universal prime-mover ranking."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/34051700/","sourceTitle":"Hip and Trunk Muscle Activity and Mechanics During Walking With and Without Unilateral Weight","sourcePublisher":"Journal of Applied Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Walking with unilateral weight changed hip-abductor and trunk muscle activity and gait mechanics in the studied participants.","Load side, stance phase, pelvic control, route, speed, footwear, surface, and external mass affect the task and must be recorded rather than reduced to a generic core label."]},
    {"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/34051700/","sourceTitle":"Hip and Trunk Muscle Activity and Mechanics During Walking With and Without Unilateral Weight","sourcePublisher":"Journal of Applied Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Unilateral load changes the control problem of otherwise ordinary walking, while a single-line route further narrows the base of support.","Difficulty stores exercise complexity and physical difficulty only; overall is their maximum, and athlete readiness is evaluated separately during workout selection."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/38665162/","sourceTitle":"The Quantification of Muscle Activation During the Loaded Carry Movement Pattern","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["The study matched loaded conditions by intensity and time, demonstrating that implement mass alone does not describe the exposure.","Track implement type and mass, loaded hand, distance, work time, pace, steps, pickup and set-down, posture faults, grip and trunk fatigue, other carries and pulls, symptoms, and recovery."]},
    {"sectionKey":"constraints","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36557001/","sourceTitle":"Changes in Trunk Muscle Activity during Unilateral Weight Bearing and Abnormal Postural Gait in Healthy Individuals","sourcePublisher":"Medicina","sourceKind":"peer_reviewed_research","evidenceQuality":78,"claims":["Unilateral weight bearing and deliberately altered gait posture changed measured trunk-muscle activity in a small healthy sample.","Require a controllable intact implement, clear straight lane, non-slip level surface, safe pickup and set-down zones, no cross-traffic, declared footwear, both-side delivery, and a grip-safe early exit."]},
    {"sectionKey":"dosage","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews","sourcePublisher":"American College of Sports Medicine","sourceKind":"professional_standard","evidenceQuality":96,"claims":["Resistance-training prescription depends on objective, volume, load, effort, frequency, and individual response.","Profiles declare sets, distance and time ceilings per side, pace, rest, effort reserve, quality stops, estimated duration, and cumulative weekly carry, grip, trunk, and gait exposure rather than one universal dose."]},
    {"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/38665162/","sourceTitle":"The Quantification of Muscle Activation During the Loaded Carry Movement Pattern","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["The experimental distinction between carry and hold depends on whether the participant walks while supporting the load.","Instructions state implement, hand, pickup, standing start, straight route, pace, trunk and pelvis policy, free-arm policy, no-turn rule, finish, set-down, side switch, dose, rest, valid distance, and stop criteria."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Youth resistance training should use qualified supervision, safe equipment and space, appropriate technique, and gradual progression.","Stop for pain or neurologic, cardiopulmonary, pressure, grip, implement, lane, balance, posture, gait, foot-placement, pickup, set-down, side-dose, or recovery failures; the card is not clinical clearance."]},
    {"sectionKey":"programming","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews","sourcePublisher":"American College of Sports Medicine","sourceKind":"professional_standard","evidenceQuality":96,"claims":["Programming variables should reflect the training objective, exercise dose, effort, frequency, and observed response.","Selection and substitution recompute unilateral versus bilateral identity, implement, route, balance, load, side dose, fatigue, recovery, duration, space, population constraints, persistence, and both rendered instruction views."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/34051700/","sourceTitle":"Hip and Trunk Muscle Activity and Mechanics During Walking With and Without Unilateral Weight","sourcePublisher":"Journal of Applied Biomechanics","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Unilateral load creates side-specific hip and trunk demands during walking.","Athlete support names the loaded hand, exact route, distance or time ceiling, expected grip, trunk, hip and gait effort, visible self-checks, side change, stop signal, and a safe set-down plan."]},
    {"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/38665162/","sourceTitle":"The Quantification of Muscle Activation During the Loaded Carry Movement Pattern","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Carry and hold conditions can be compared only when load, time, laterality, and locomotion are explicit.","Coach support verifies the implement and hand, lane, pickup, upright start, shoulder and trunk behavior, pelvis, step path, pace, grip, finish, set-down, valid distance, bilateral dose, faults, symptoms, duration, and cumulative overlap."]},
    {"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Load, volume, exercise selection, instruction, and supervision should be appropriate to the participant and progress gradually.","Accessible delivery may reduce mass, distance, work time, or pace; increase lane width or rest; use high-contrast marks or nonvideo instruction; or select a separately reviewed static hold or bilateral carry."]},
    {"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/31820223/","sourceTitle":"The Biomechanics and Applications of Strongman Exercises: a Systematic Review","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["The review distinguishes strongman carrying tasks and identifies limited quantitative evidence for unilateral load carriage.","Implement, load position, hand count, static versus locomotor action, route, turn, base width, direction, step height, pace, and compound actions require explicit modifier, variant, or new-definition decisions."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates have current oEmbed link, title, channel, and iframe metadata only; playback, exact variant, captions, accessibility, safety, quality, reviewer identity, and approval remain unresolved."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"videoId":"zFje79PZsxQ","title":"Suitcase Carry Exercise","channel":"TheProactiveAthlete","query":"suitcase carry exact exercise"},
    {"videoId":"IZ0aGhu24c8","title":"How To Do Suitcase Carry | Exercise Demo","channel":"OriGym","query":"dumbbell suitcase carry exercise demo"},
    {"videoId":"z4WJXcx19WQ","title":"Core Exercise : Single Arm Farmers Carry","channel":"RushFit","query":"single arm farmer carry suitcase carry"},
    {"videoId":"LJaq4BS7KpE","title":"The Best Core Exercise You're Not Doing","channel":"Squat University","query":"suitcase carry coaching"},
    {"videoId":"Fko5Hp537us","title":"Single Arm Farmer Carry","channel":"Jason Brown","query":"single arm farmer carry exercise"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"name":"Dumbbell Straight-Lane Suitcase Carry","class":"new_variant","why":"One dumbbell in one hand on a straight no-turn lane is an exact working specification for the canonical unilateral carry.","dimensions":{"variantKey":"straight-lane-dumbbell","implement":"one_dumbbell"}},
    {"name":"Kettlebell Straight-Lane Suitcase Carry","class":"new_variant","why":"One kettlebell preserves the action but changes handle and load geometry, pickup, swing control, and set-down.","dimensions":{"variantKey":"straight-lane-kettlebell","implement":"one_kettlebell"}},
    {"name":"Suitcase Carry Line Walk","class":"new_variant","why":"Centering both feet on one line narrows the base and increases foot-placement and balance demand while retaining one-sided loaded locomotion.","dimensions":{"variantKey":"single-line-dumbbell","route":"foot_centers_on_single_line"}},
    {"name":"Implement Mass Change","class":"modifier_annotation","why":"Mass changes physical difficulty, fatigue, pace, and recovery without changing identity when implement, hand, route, and execution remain fixed.","dimensions":{"loadMass":"declared"}},
    {"name":"Distance or Work-Time Change","class":"modifier_annotation","why":"Distance and time are dose variables unless fatigue changes the gait, route, or terminal action.","dimensions":{"distanceOrTime":"declared"}},
    {"name":"Pace Change","class":"modifier_annotation","why":"A controlled pace change is dosage metadata; fast racing or running creates a different task and risk profile.","dimensions":{"pace":"declared_controlled"}},
    {"name":"Shuttle Suitcase Carry with Turn","class":"new_variant","why":"A turn adds deceleration, footwork, implement control, direction, space, and repetition-boundary requirements.","dimensions":{"turn":"declared","direction":"declared"}},
    {"name":"In-Place Suitcase March","class":"new_variant","why":"Marching without forward travel changes locomotion, balance, hip-flexion amplitude, cadence, and space.","dimensions":{"travel":"none","stepPattern":"alternating_march"}},
    {"name":"Traveling High-Knee Suitcase March","class":"new_variant","why":"A required high-knee action changes gait mechanics, balance, cadence, and valid-step criteria.","dimensions":{"travel":"forward","stepPattern":"high_knee_march"}},
    {"name":"Backward Suitcase Carry","class":"new_variant","why":"Backward travel changes visual, gait, clearance, supervision, and stopping requirements.","dimensions":{"travelDirection":"backward"}},
    {"name":"Lateral Suitcase Carry","class":"new_variant","why":"Side-stepping changes direction, foot sequence, hip demand, lane width, and lead-side management.","dimensions":{"travelDirection":"lateral"}},
    {"name":"Incline, Stairs, or Step-Over Suitcase Carry","class":"new_variant","why":"Grade or obstacles add vertical displacement, foot-clearance, lower-limb, fall, and logistics demands.","dimensions":{"surfaceOrObstacle":"declared"}},
    {"name":"Compliant or Uneven-Surface Suitcase Carry","class":"new_variant","why":"Surface instability changes balance, foot and ankle demands, implement control, and failure consequence.","dimensions":{"surface":"compliant_or_uneven"}},
    {"name":"Sandbag Suitcase Carry","class":"new_variant","why":"A sandbag can be valid only after exact handle, grip, load position, deformation, pickup, clearance, and set-down are declared.","dimensions":{"implement":"sandbag","reviewGate":"exact_grip_and_position"}},
    {"name":"Farmer Carry","class":"new_definition","why":"Matched loads in two hands are bilateral locomotion and remove the unilateral side-dose and asymmetrical loading contract.","dimensions":{"handCount":2,"loading":"bilateral"}},
    {"name":"Suitcase Hold","class":"new_definition","why":"A static one-sided hold removes locomotion, step contacts, pace, route, and gait-control demands.","dimensions":{"locomotion":"none"}},
    {"name":"Single-Arm Front-Rack Carry","class":"new_definition","why":"Supporting the implement at the shoulder changes load position, grip, rack mobility, breathing, and shoulder demand.","dimensions":{"loadPosition":"front_rack"}},
    {"name":"Single-Arm Overhead Carry","class":"new_definition","why":"Overhead support changes shoulder range, scapular control, balance, failure management, and equipment clearance.","dimensions":{"loadPosition":"overhead"}},
    {"name":"Suitcase Deadlift","class":"new_definition","why":"Picking a side load up and returning it without a prescribed carry is a loaded hinge rather than locomotion.","dimensions":{"primaryAction":"hinge","locomotion":"none"}},
    {"name":"Suitcase Carry with Step-Up or Lunge","class":"new_definition","why":"A required step-up or lunge adds an ordered lower-body task and different completion and stop rules.","dimensions":{"compoundAction":"step_up_or_lunge"}},
    {"name":"Legacy Sandbag, Throwing, and March Sources","class":"reject","why":"Sources 1028, 1340, and 1470 omit exact grip or position, executable carry mechanics, or whether marching travels; they remain nonselectable until original facts are reviewed.","dimensions":{"sourceIds":[1028,1340,1470],"identityQuarantine":true}}
  ]
  $json$::JSONB;
BEGIN
  -- Fresh library bootstraps generate UUIDs. Source IDs and exact lineage
  -- keys carry the durable identity, including the distinct Carry/Hold
  -- anchors below.
  SELECT definition_id INTO canonical_id
  FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=204;
  SELECT id INTO dumbbell_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND variant_key='straight-lane-dumbbell';
  IF dumbbell_variant IS NULL THEN dumbbell_variant := gen_random_uuid(); END IF;
  SELECT id INTO kettlebell_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND variant_key='straight-lane-kettlebell';
  IF kettlebell_variant IS NULL THEN kettlebell_variant := gen_random_uuid(); END IF;
  SELECT id INTO line_walk_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND variant_key='single-line-dumbbell';
  IF line_walk_variant IS NULL THEN line_walk_variant := gen_random_uuid(); END IF;
  SELECT id INTO farmer_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='farmer-carry';
  SELECT id INTO farmer_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=farmer_definition AND variant_key='baseline';
  SELECT id INTO hold_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='suitcase-hold';
  SELECT id INTO hold_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=hold_definition AND variant_key='baseline';
  SELECT ARRAY[
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='baseline'),
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-452-baseline'),
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-504-baseline'),
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-559-baseline'),
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-1028-baseline'),
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='baseline-source-1340'),
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-1470-baseline')]
  INTO source_variant_ids;
  active_variant_ids := ARRAY[dumbbell_variant,kettlebell_variant,line_walk_variant];
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND facility_id=1 AND slug='suitcase-carry')<>1
    OR (SELECT count(*) FROM coaching.exercise WHERE id=ANY(source_ids))<>7
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE definition_id=canonical_id AND legacy_exercise_id=ANY(source_ids))<>7
    OR canonical_id IS NULL OR farmer_definition IS NULL OR hold_definition IS NULL
    OR farmer_variant IS NULL OR hold_variant IS NULL
    OR (SELECT count(*) FROM coaching.exercise_variant_v1 WHERE id=ANY(source_variant_ids))<>7
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id IN (farmer_definition,hold_definition) AND status<>'archived')<>2
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id IN (farmer_variant,hold_variant) AND status<>'archived')<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND
        (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE reviewed_by IS NOT NULL AND survivor_definition_id=canonical_id) THEN
    RAISE EXCEPTION '% refuses missing lineage, related anchors, or human-reviewed state',migration_key;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND review_status='candidate' AND reviewer_user_id IS NULL;

  UPDATE coaching.exercise_definition_source_v1 SET
    source_kind='legacy_migration',
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'sourceDisposition','identity_quarantine',
      'representedBySelectableSourceVariant',FALSE,
      'representedByResearchWorkingSpecification',legacy_exercise_id IN (204,452,504,559),
      'missingExactExecutionFacts',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE)
  WHERE definition_id=canonical_id AND legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_variant_v1 SET
    definition_id=canonical_id,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','identity_quarantine',
      'sourceLegacyExerciseId',CASE id
        WHEN source_variant_ids[1] THEN 204
        WHEN source_variant_ids[2] THEN 452
        WHEN source_variant_ids[3] THEN 504
        WHEN source_variant_ids[4] THEN 559
        WHEN source_variant_ids[5] THEN 1028
        WHEN source_variant_ids[6] THEN 1340 ELSE 1470 END,
      'archiveReason',CASE id
        WHEN source_variant_ids[1] THEN 'generic_db_or_kb_record_omits_exact_implement_route_turn_distance_pace_pickup_and_setdown_contract'
        WHEN source_variant_ids[2] THEN 'dumbbell_record_omits_exact_route_turn_distance_pace_hand_order_and_terminal_contract'
        WHEN source_variant_ids[3] THEN 'kettlebell_record_omits_exact_route_turn_distance_pace_hand_order_and_terminal_contract'
        WHEN source_variant_ids[4] THEN 'line_walk_record_omits_exact_foot_on_line_rule_turn_finish_and_setdown_contract'
        WHEN source_variant_ids[5] THEN 'sandbag_record_omits_exact_grip_handle_position_clearance_pickup_and_setdown_contract'
        WHEN source_variant_ids[6] THEN 'throwing_record_has_no_executable_carry_route_position_pace_pickup_or_setdown_contract'
        ELSE 'march_record_omits_in_place_or_traveling_identity_step_height_cadence_route_and_terminal_contract' END,
      'originalAuthoritativeEvidenceRequired',TRUE,'humanReviewRequired',TRUE),
    load_profile_json=coalesce(load_profile_json,'{}'::JSONB)||jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=coalesce(fatigue_profile_json,'{}'::JSONB)||jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
      'publicationQuarantined',TRUE,'neverRestoreFromLabelOrMediaMetadata',TRUE),
    updated_at=now()
  WHERE id=ANY(source_variant_ids);

  UPDATE coaching.exercise_definition_v1 SET
    canonical_name='Suitcase Carry',display_name='Suitcase Carry',
    aliases=ARRAY['Single-Arm Loaded Carry','One-Arm Loaded Carry',
      'Single-Arm Farmer Carry','One-Arm Farmer Walk','Unilateral Loaded Carry']::TEXT[],
    description='Carry one declared implement in one hand while walking through an exact lane and resisting unwanted side bend or rotation. Each working specification declares implement, loaded hand, route, pace, pickup, finish, set-down, side order, distance or time, rest, and quality stops.',
    family_key='unilateral_suitcase_carry_family',schema_version='2.0.0',card_version=2,
    status='review',content_confidence=88,scoring_confidence=64,media_confidence=48,
    movement_patterns=ARRAY['carry','locomote','brace']::TEXT[],
    body_regions=ARRAY['hand','wrist','elbow','shoulder','scapula','rib_cage','core','spine','pelvis','hip','knee','ankle','foot']::TEXT[],
    required_equipment=ARRAY[]::TEXT[],
    optional_equipment=ARRAY['dumbbell','kettlebell','open_space','timer']::TEXT[],
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('obliques','quadratus_lumborum','multifidus','erector_spinae','forearm_and_hand_flexors','gluteus_medius'),
      'secondaryMuscles',jsonb_build_array('rectus_abdominis','transversus_abdominis','trapezius','rotator_cuff','latissimus_dorsi','gluteus_maximus','quadriceps','hamstrings','calves','foot_intrinsics'),
      'joints',jsonb_build_array('hand','wrist','elbow','glenohumeral','scapulothoracic_articulation','thoracic_spine','lumbar_spine','pelvis','hip','knee','ankle','foot'),
      'jointActions',jsonb_build_array('isometric_grip','shoulder_girdle_load_support','trunk_anti_lateral_flexion','trunk_anti_rotation','pelvic_control','alternating_hip_flexion_and_extension','alternating_knee_flexion_and_extension','ankle_rocker_and_plantar_flexion','foot_pressure_and_gait_control'),
      'planes',jsonb_build_array('sagittal_locomotion','frontal_anti_lateral_flexion','transverse_anti_rotation'),
      'laterality','unilateral_external_load_with_bilateral_gait_and_balanced_hand_exposure',
      'lateralityDetail','Load hand is declared and valid distance, time, steps, faults, symptoms, and recovery are stored separately for each side.',
      'evidenceLimit','Direct studies use small healthy samples and selected loads. They do not establish one universal muscle ranking, load, posture cue, distance, pace, recovery interval, clinical indication, or safe threshold.'),
    environment_json=jsonb_build_object(
      'surface','level_dry_non_slip_and_free_of_trip_hazards','lane','straight_marked_start_travel_finish_setdown_and_exit_zones',
      'turnPolicy','no_turn_in_active_working_specifications','traffic','one_active_carrier_per_lane_with_no_cross_traffic',
      'clearance','implement_body_feet_and_free_arm_clear_through_full_lane','lighting','implement_feet_marks_and_exit_visible',
      'equipmentInspection','handle_body_and_load_secure_with_known_mass','pickupSetdown','stable_marked_zones_with_space_to_hinge_or_squat_and_exit'),
    population_json=jsonb_build_object(
      'defaultPopulation','healthy_participants_with_pain_free_loaded_gait_and_safe_grip',
      'individualizationRequired',TRUE,
      'prerequisites',jsonb_build_array('can_pick_up_hold_walk_with_and_set_down_selected_implement_under_control','can_follow_loaded_hand_lane_pace_side_switch_and_stop_command','can_breathe_while_maintaining_owned_trunk_pelvis_and_gait','can_report_symptoms_and_exit_before_grip_failure'),
      'cautions',jsonb_build_array('current_hand_wrist_elbow_shoulder_spine_hip_knee_ankle_or_foot_symptoms','recent_injury_or_surgery','balance_or_gait_impairment','uncontrolled_cardiopulmonary_neurologic_or_pressure_symptoms','pregnancy_or_postpartum_status_requiring_individualized_loading','youth_or_other_population_requiring_qualified_supervision'),
      'notClinicalClearance',TRUE,'neverInferReadinessFromExerciseDifficulty',TRUE),
    athlete_support_json=jsonb_build_object(
      'whatItIs','Pick up one assigned weight, stand still and tall, then walk the exact marked lane without letting the load change your owned trunk, pelvis, step path, or pace. Finish, set it down safely, recover, and repeat with the other hand.',
      'before',jsonb_build_array('Confirm implement and mass, loaded hand, lane type, distance or time ceiling, pace, side order, rest, and stop signal.','Inspect the handle, load, floor, start, travel, finish, set-down, and exit zones.','Report pain, numbness, dizziness, unusual breathlessness, pressure symptoms, unsafe grip, balance concern, or uncertainty before pickup.'),
      'during',jsonb_build_array('Own the pickup and stand still before the first step.','Walk at the assigned pace with the load quiet beside the thigh and the free arm in its declared natural position.','Keep trunk and pelvis within the assigned posture window without forcing rigid stillness or exaggerating a lean.','End before grip, step path, pace, breathing, posture, or clearance changes; set down only in the marked zone.'),
      'expectedSensations',jsonb_build_array('working_grip_and_forearm','side_specific_trunk_and_hip_effort','whole_body_loaded_walking_effort'),
      'notExpected',jsonb_build_array('sharp_or_increasing_joint_or_back_pain','numbness_tingling_or_weakness','dizziness_faintness_unusual_breathlessness_or_pressure_symptoms','grip_slip_uncontrolled_swing_or_impact_with_body','stumble_cross_step_or_unplanned_lean'),
      'selfChecks',jsonb_build_array('correct_implement_mass_and_hand','safe_pickup_and_still_start','correct_lane_and_pace','quiet_load_and_owned_trunk_pelvis','valid_finish_and_setdown','balanced_recorded_side_dose'),
      'accessibility',jsonb_build_array('lighter_implement','shorter_distance_or_time','wider_straight_lane','slower_pace','more_rest','high_contrast_marks','written_still_or_captioned_instruction','reviewed_static_hold_or_bilateral_carry_substitution'),
      'stopSignal','Stop walking, keep control of the implement, use the nearest safe set-down zone, clear the lane, and tell the coach what changed.'),
    coach_support_json=jsonb_build_object(
      'setupChecklist',jsonb_build_array('verify_exact_variant_implement_mass_handle_and_loaded_hand','declare_lane_foot_rule_distance_time_pace_side_order_rest_and_stop','inspect_pickup_travel_finish_setdown_and_exit_zones','rehearse pickup_early_setdown_and_side_switch','check recent carry_pull_grip_trunk_and_gait_load'),
      'observeFromFrontOrRear',jsonb_build_array('lane_and_foot_path','trunk_and_pelvic_excursion','shoulder_height_without_forced_depression','implement_clearance_and_swing','step_width_and_side_difference'),
      'observeFromSide',jsonb_build_array('pickup_and_still_start','head_ribcage_pelvis_relationship','pace_and_step_length','implement_position','finish_setdown_and_exit'),
      'correctionOrder',jsonb_build_array('wrong_identity_implement_hand_lane_or_turn','symptom_or_medical_stop','grip_implement_surface_traffic_or_clearance_hazard','pickup_and_still_start','trunk_pelvis_and_gait_path','pace_distance_and_side_balance','finish_setdown_recovery_and_persistence'),
      'countingRule','Count only distance or time completed with the assigned implement and hand, exact lane and foot rule, controlled pickup and still start, declared pace, owned trunk-pelvis and gait, safe finish and set-down, and no stop-rule failure. Record failed distance, time, or steps separately by side.',
      'groupManagement',jsonb_build_array('one_live_carrier_per_lane','no_cross_traffic_or_loose_equipment','separate_pickup_setdown_and_waiting_zones','coach_controls_loading_side_switch_and_lane_release','provide_nearest_safe_early_setdown_zone'),
      'escalation','Quarantine selection when implement, grip, route, turn, foot rule, symptoms, dose, recovery, supervision, or safe pickup and set-down is uncertain.'),
    support_operations_json=jsonb_build_object(
      'selectionInputs',jsonb_build_array('definition_variant_profile_and_card_version','objective_and_phase','implement_type_mass_handle_and_loaded_hand','route_foot_rule_distance_time_and_pace','side_order_sets_rest_and_effort_reserve','recent_carry_pull_grip_trunk_gait_and_sport_load','symptoms_recovery_and_population_constraints','lane_surface_traffic_supervision_and_duration_budget'),
      'persistence',jsonb_build_array('workout_and_item_id','definition_variant_profile_card_and_research_version','implement_type_mass_handle','loaded_hand_and_side_order','route_foot_rule_distance_time_pace_and_steps','sets_valid_and_failed_exposure_by_side','rest_effort_reserve_faults_symptoms_and_stop_reason','actual_duration_and_recovery','substitution_reason','rendered_athlete_and_coach_instruction_versions'),
      'memberSupport',jsonb_build_array('show_pickup_still_start_mid_lane_finish_setdown_and_exit','label_loaded_hand_lane_foot_rule_distance_time_pace_and_side_change','define_valid_distance_expected_sensations_and_stop','provide_captioned_and_nonvideo_equivalents','show_nearest_safe_early_setdown'),
      'coachSupport',jsonb_build_array('show_front_rear_and_side_observation_points','surface_implement_mass_side_distance_time_pace_and_fault_log','surface_cumulative_carry_grip_trunk_and_gait_budgets','require_substitution_revalidation','retain_symptom_incident_and_escalation_logs'),
      'incidentPath',jsonb_build_array('stop_and_control_implement','use_nearest_safe_setdown_and_secure_lane','record_variant_hand_load_route_dose_fault_symptom_and_context','follow_facility_emergency_or_clinical_referral_policy','quarantine_uncertain_card_source_or_media','do_not_diagnose_or_clear_in_product'),
      'changeImpact','Any implement, handle, mass, hand, route, foot rule, turn, direction, surface, pace, distance, work time, side order, fatigue, recovery, population, space, or media change invalidates cached selection, duration, logistics, rendering, and approval assumptions.'),
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'suitcaseCarryCompletionMigration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,'legacySourcesQuarantined',source_ids,
      'activeWorkingSpecifications',jsonb_build_array('straight-lane-dumbbell','straight-lane-kettlebell','single-line-dumbbell'),
      'primaryResearchSource','https://pubmed.ncbi.nlm.nih.gov/38665162/',
      'researchSources',jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/38665162/','https://pubmed.ncbi.nlm.nih.gov/34051700/','https://pubmed.ncbi.nlm.nih.gov/36557001/','https://pubmed.ncbi.nlm.nih.gov/31820223/','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf'),
      'identityDecision','unilateral_loaded_locomotion_with_implement_route_turn_foot_rule_pickup_setdown_and_side_as_explicit_dimensions',
      'mediaState','five_current_oembed_healthy_candidates_unreviewed','oembedCheckedAt','2026-08-02',
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
      'approvalsCreated',FALSE,'mediaApprovalCreated',FALSE,'graphApprovalCreated',FALSE,
      'calibrationApprovalCreated',FALSE,'cardApprovalCreated',FALSE,
      'publicationQuarantined',TRUE,'humanReviewRequired',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,updated_at=now()
  WHERE id=canonical_id;

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,programming_profile_json)
  SELECT variant.id,canonical_id,variant.variant_key,variant.display_name,variant.modifier_keys,
    jsonb_build_object(
      'technicalComplexity',variant.complexity,'absoluteLoadDemand',variant.physical,
      'physicalDifficulty',variant.physical,'baseOverallDifficulty',GREATEST(variant.complexity,variant.physical),
      'coordinationDemand',variant.coordination,'supervisionDemand',variant.supervision,
      'failureConsequence',variant.failure,'impact',8,'workCapacityDemand',variant.work_capacity,
      'provisional',TRUE,'difficultyModel','max_exercise_complexity_physical_difficulty',
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'athleteReadinessStoredHere',FALSE),
    jsonb_build_object(
      'actionIdentity','one_hand_side_loaded_controlled_walking_without_planned_turn',
      'implement',variant.implement,'implementQuantity',1,'loadPosition','hanging_beside_thigh',
      'loadedHand','declared_and_logged','freeArm','natural_declared_position_without_external_support',
      'pickup','controlled_hinge_or_squat_in_marked_start_zone','start','stand_still_under_control_before_first_step',
      'route',variant.route,'footRule',variant.foot_rule,'turnPolicy','none',
      'pace','controlled_and_declared','terminalAction','stop_in_finish_zone_then_controlled_setdown',
      'sideDose','both_hands_declared_and_recorded','surface','level_non_slip',
      'selectable',TRUE,'identityQuarantine',FALSE,'workingSpecificationRequiresHumanContentReview',TRUE),
    'review',
    jsonb_build_object(
      'gripDemand',variant.grip,'spinalLoading',variant.spinal,'eccentricStress',18,
      'landingContactsPerRep',0,'walkingContactsTrackedSeparately',TRUE,
      'externalLoadMethod',variant.implement,'externalLoadDescription','One assigned intact implement with known mass, secure handle, and enough clearance for pain-free controlled walking and set-down on both sides.',
      'impactClass','low_impact_loaded_walking_with_repeated_gait_contacts',
      'loadedShoulderSupport',46,'antiLateralTrunkLoad',variant.trunk,'hipPelvicGaitLoad',variant.hip,
      'loadTracking',jsonb_build_array('implement_type','implement_mass','handle','loaded_hand','distance','work_time','pace','steps','pickup_and_setdown','valid_and_failed_exposure_by_side'),
      'effectiveLoadDrivers',jsonb_build_array('implement_mass_and_geometry','loaded_side','distance_and_work_time','pace','step_count_and_route_width','grip_and_shoulder_support','recent_carry_pull_trunk_gait_and_sport_volume','fatigue_and_recovery')),
    jsonb_build_object(
      'localMuscleFatigue',variant.local_fatigue,'gripFatigue',variant.grip,
      'technicalFatigueSensitivity',variant.sensitivity,'neuralOutputDemand',34,
      'impactAccumulation',8,'recoveryHours','24_to_48_context_dependent',
      'primaryFatigueSites',jsonb_build_array('loaded_hand_forearm_and_grip','side_specific_trunk_stabilizers','loaded_shoulder_girdle','hip_abductors_and_pelvic_stabilizers','lower_limb_gait_muscles'),
      'earlyFatigueSignals',jsonb_build_array('grip_or_wrist_change','implement_swing_or_contact','shoulder_hike_or_collapse','trunk_lean_or_rotation_change','pelvic_drop_or_step_width_change','pace_or_step_length_drift','stumble_or_line_departure','breathing_or_side_asymmetry'),
      'downstreamConflicts',jsonb_build_array('heavy_pull_or_grip_work','priority_sprint_jump_cut_balance_or_gait_skill','other_loaded_carries','high_volume_trunk_or_hip_stabilization','symptomatic_upper_extremity_spine_or_lower_limb_loading')),
    jsonb_build_object(
      'primaryIntent',CASE WHEN variant.route='straight_marked_lane' THEN 'side_balanced_loaded_gait_grip_and_trunk_capacity' ELSE 'side_balanced_narrow_base_loaded_gait_precision' END,
      'selectionStatus','candidate_requires_human_review','appropriatePhases',CASE WHEN variant.route='straight_marked_lane' THEN jsonb_build_array('capacity','resilience') ELSE jsonb_build_array('resilience') END,
      'prerequisites',jsonb_build_array('pain_free_safe_pickup_carry_and_setdown','repeatable_unloaded_or_light_gait_on_exact_route','safe_grip_and_implement_clearance','can_breathe_and_stop_before_posture_or_gait_change','can_balance_both_hand_exposures'),
      'completionCriteria',jsonb_build_array('all_valid_exposure_matches_exact_identity','both_hands_meet_declared_dose','pace_route_posture_and_clearance_thresholds_met','safe_pickup_finish_setdown_and_exit','duration_faults_symptoms_and_recovery_recorded'),
      'avoidUse',jsonb_build_array('unknown_implement_hand_route_turn_foot_rule_or_terminal_action','pain_guarding_neurologic_cardiopulmonary_or_pressure_symptom','unsafe_grip_load_surface_lane_traffic_or_setdown','cannot_balance_hand_exposure','fatigue_degraded_posture_gait_pace_or_clearance'),
      'cumulativeBudget',jsonb_build_object('unilateralCarryMetersPerSide',1,'loadedWalkingSecondsPerSide',1,'walkingStepsPerSide',1,'gripStress',variant.grip,'antiLateralTrunkLoad',variant.trunk,'hipPelvicGaitLoad',variant.hip,'loadedShoulderSupport',46,'athleteLandingImpactContacts',0),
      'weeklyExposureGuidance','Combine every loaded carry, hold, pull, grip task, trunk stabilization exposure, gait task, and relevant sport volume. Progress only one of mass, distance, work time, pace, route precision, or turn complexity after stable bilateral quality and recovery.',
      'sequencing','Place after freshness-sensitive speed, jump, balance, or sport skill when the carry is challenging; a low-fatigue control profile may follow specific preparation when it does not impair the priority task.',
      'pairingCompatibility',jsonb_build_array('noncompeting_upper_body_mobility_or_breathing_during_full_rest','reviewed_low_fatigue_task_that_preserves_grip_gait_and_lane_safety'),
      'interferenceRules',jsonb_build_array('do_not_pre_fatigue_grip_trunk_hip_or_gait_before_priority_skill','do_not_convert_strength_or_precision_profile_to_unbounded_conditioning','recompute_identity_load_side_route_balance_fatigue_recovery_duration_equipment_space_and_rendering_after_substitution'),
      'uncertaintyPolicy',jsonb_build_object('unknownIdentityGripRouteTurnSymptomsOrRecovery','fail_closed_and_request_coach_review','neverInferMissingSourceMechanics',TRUE,'neverAutoApproveMediaGraphCalibrationOrPublication',TRUE))
  FROM (VALUES
    (dumbbell_variant,'straight-lane-dumbbell','Suitcase Carry — Dumbbell, Straight Lane',ARRAY['dumbbell','straight_lane','no_turn','balanced_sides']::TEXT[],'dumbbell','straight_marked_lane','natural_width_no_cross_step',40,50,46,44,44,52,58,50,58,46,54,58),
    (kettlebell_variant,'straight-lane-kettlebell','Suitcase Carry — Kettlebell, Straight Lane',ARRAY['kettlebell','straight_lane','no_turn','balanced_sides']::TEXT[],'kettlebell','straight_marked_lane','natural_width_no_cross_step',42,50,48,46,46,52,60,50,58,46,56,60),
    (line_walk_variant,'single-line-dumbbell','Suitcase Carry — Dumbbell, Single-Line Walk',ARRAY['dumbbell','single_line','no_turn','balanced_sides']::TEXT[],'dumbbell','straight_marked_single_line','center_each_foot_on_same_line_without_crossing',54,46,62,54,42,42,64,46,66,52,48,68)
  ) variant(id,variant_key,display_name,modifier_keys,implement,route,foot_rule,
    complexity,physical,coordination,supervision,failure,work_capacity,grip,spinal,trunk,hip,
    local_fatigue,sensitivity)
  ON CONFLICT(id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,requirements_json=EXCLUDED.requirements_json,
    status='review',load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT profile.variant_id,profile.profile_key,profile.phase_key,profile.role,profile.purpose,
    profile.suitability,profile.alignment,
    jsonb_build_object('unilateralLoadedGait',5,'gripCapacity',profile.grip_relevance,
      'antiLateralTrunkControl',5,'hipPelvicGaitControl',5,
      'routePrecision',CASE WHEN profile.line_walk THEN 5 ELSE 3 END,
      'sideBalancedExposure',5,'athleteLandingImpact',0),
    jsonb_build_object('doseType','valid_distance_per_side_with_time_ceiling','sets',profile.sets,
      'distanceMetersPerSide',profile.distance_m,'maximumWorkSecondsPerSide',profile.max_seconds,
      'sideDose','equal_valid_exposure_per_loaded_hand','pace',profile.pace,
      'effortReserve','stop_with_owned_grip_posture_and_gait_in_reserve','restSeconds',profile.rest_seconds,
      'qualityThreshold','end_before_grip_implement_clearance_trunk_pelvis_foot_path_pace_finish_or_setdown_materially_changes'),
    CASE WHEN profile.line_walk THEN
      'Every counted metre uses the assigned dumbbell and hand, controlled pickup and still start, centers each foot on the marked line without crossing, keeps the load clear and trunk-pelvis path owned at the declared pace, reaches the finish without turning, and ends with a controlled set-down.'
    ELSE
      'Every counted metre uses the assigned implement and hand, controlled pickup and still start, natural-width straight walking without crossing or turning, a quiet load beside the thigh, owned trunk-pelvis and pace, exact finish, and controlled set-down.' END,
    ARRAY['pain_or_neurologic_symptom','dizziness_faintness_unusual_breathlessness_or_pressure_symptom','wrong_variant_implement_mass_hand_lane_foot_rule_pace_or_turn','damaged_or_uncontrolled_implement_or_grip_slip','unsafe_surface_clearance_traffic_pickup_setdown_or_exit','trunk_lean_rotation_or_rib_pelvis_control_materially_changes','shoulder_wrist_or_free_arm_position_becomes_unsafe','pelvic_drop_step_width_cross_step_stumble_or_line_departure','pace_step_length_or_distance_accuracy_breaks','side_exposure_cannot_be_balanced','effort_reserve_or_time_ceiling_exceeded','unsafe_finish_setdown_or_recovery'],
    CASE WHEN profile.line_walk THEN
      'Verify single-line dumbbell identity, mass, hand order, line and foot-centering rule, distance and time ceiling, pace, sets, rest, stop command, and early set-down zone. Observe pickup, still start, grip, load clearance, trunk and pelvis, each line contact, pace, finish, set-down, faults and symptoms by side.'
    ELSE
      'Verify straight-lane suitcase identity, exact implement and mass, loaded-hand order, natural-width no-cross-step route, distance and time ceiling, pace, sets, rest, stop command, and early set-down zone. Observe pickup, still start, grip, load clearance, trunk, pelvis, gait, finish, set-down, faults and symptoms by side.' END,
    CASE WHEN profile.line_walk THEN
      'Pick up the assigned dumbbell in the marked zone and stand still. Walk forward without turning, placing the center of each foot on the same line without crossing. Keep the weight quiet beside your thigh and your trunk and pelvis owned. Stop in the finish zone, set down safely, rest, and match the other hand.'
    ELSE
      'Pick up the assigned weight in the marked zone and stand still. Walk straight at the assigned pace with natural-width steps, no crossing and no turn. Keep the weight quiet beside your thigh and do not let it change your owned trunk or pelvis. Stop in the finish zone, set down safely, rest, and match the other hand.' END,
    CASE WHEN profile.line_walk THEN 'Improved side-balanced narrow-base loaded gait precision, grip, hip-pelvic control, and anti-lateral trunk capacity.' ELSE 'Improved side-balanced loaded gait, grip, shoulder support, hip-pelvic control, and anti-lateral trunk capacity.' END,
    ARRAY[profile.implement,'open_space','timer']::TEXT[],
    jsonb_build_object('athletesPerStation',1,'setupSeconds',75,'transitionSeconds',25,
      'equipmentCheck','intact_known_mass_implement_secure_handle_clearance_level_surface_marks_timer_and_safe_setdown',
      'lane',CASE WHEN profile.line_walk THEN 'straight_marked_single_line_with_start_finish_early_setdown_and_exit' ELSE 'straight_marked_natural_width_lane_with_start_finish_early_setdown_and_exit' END,
      'trafficRule','no_person_or_equipment_enters_pickup_travel_finish_setdown_or_exit_zone',
      'substitutionRevalidation',jsonb_build_array('identity','implement','mass','hand','route','foot_rule','turn','pace','distance','time','fatigue','recovery','duration','space','population_constraints','rendering')),
    CASE WHEN profile.variant_id=dumbbell_variant THEN ARRAY[kettlebell_variant,farmer_variant,hold_variant]::UUID[]
      WHEN profile.variant_id=kettlebell_variant THEN ARRAY[dumbbell_variant,farmer_variant,hold_variant]::UUID[]
      ELSE ARRAY[dumbbell_variant]::UUID[] END,'review',
    jsonb_build_object('setupSeconds',75,'secondsPerMeter',profile.seconds_per_meter,
      'pickupStandSetdownSecondsPerSide',18,'transitionSeconds',25,
      'durationFormula','setup + sets * (two_sides * (distance_meters * seconds_per_meter + pickup_stand_setdown) + rest) + transition',
      'timeCeilingRule','stop each side at the earlier of completed valid distance or maximum work seconds'),
    jsonb_build_object('reduce',jsonb_build_array('reduce_implement_mass','reduce_distance_or_time','slow_to_controlled_pace','increase_lane_width_if_not_line_profile','increase_rest','use_reviewed_static_hold_or_bilateral_carry_substitution'),'increase',jsonb_build_array('increase_mass','increase_distance_within_time_ceiling','increase_work_time','use_reviewed_single_line_or_turn_variant'),'revalidateAfterChange',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_id','variant_id','profile_key','implement_type_mass_and_handle','loaded_hand_and_side_order','route_foot_rule_and_turn','sets','valid_and_failed_meters_time_and_steps_per_side','pace','rest','effort_reserve','faults','symptoms','duration','substitution'),'validity','all exact implement, hand, route, foot, pace, posture, clearance, finish, setdown, side, reserve, duration, and stop gates pass'),
    jsonb_build_object('before','Which implement, mass, hand order, lane, foot rule, distance, time ceiling, pace, sets, rest, and stop are assigned?','during','Are grip, load clearance, trunk, pelvis, feet, pace, lane, side dose, and early-setdown access still valid?','after','Store valid and failed exposure by side, load, route, pace, faults, symptoms, actual duration, recovery, and substitution.')
  FROM (VALUES
    (dumbbell_variant,'capacity-strength','capacity','primary','Build unilateral loaded-gait, grip, trunk, hip, and postural capacity without racing or technical failure.',88,92,'dumbbell',FALSE,5,3,10,30,90,'controlled_walk',1.4),
    (dumbbell_variant,'resilience-control','resilience','secondary','Build repeatable submaximal side-balanced carrying tolerance with conservative load and exact gait quality.',86,90,'dumbbell',FALSE,4,2,15,40,75,'controlled_walk',1.5),
    (kettlebell_variant,'capacity-strength','capacity','primary','Build unilateral loaded-gait, grip, trunk, hip, and postural capacity with a controlled kettlebell at the side.',88,92,'kettlebell',FALSE,5,3,10,30,90,'controlled_walk',1.4),
    (kettlebell_variant,'resilience-control','resilience','secondary','Build repeatable submaximal side-balanced kettlebell carrying tolerance with exact gait quality.',86,90,'kettlebell',FALSE,4,2,15,40,75,'controlled_walk',1.5),
    (line_walk_variant,'resilience-line-control','resilience','secondary','Build narrow-base loaded gait precision and side-balanced trunk-pelvic control without fatigue chasing.',90,92,'dumbbell',TRUE,4,3,6,30,75,'slow_controlled_walk',2.0),
    (line_walk_variant,'resilience-line-precision','resilience','secondary','Rehearse exact single-line foot placement under conservative unilateral load and full recovery.',92,94,'dumbbell',TRUE,3,2,8,35,60,'slow_precision_walk',2.2)
  ) profile(variant_id,profile_key,phase_key,role,purpose,suitability,alignment,
    implement,line_walk,grip_relevance,sets,distance_m,max_seconds,rest_seconds,pace,seconds_per_meter)
  ON CONFLICT(variant_id,profile_key) DO UPDATE SET
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,dosage_json=EXCLUDED.dosage_json,
    quality_gate=EXCLUDED.quality_gate,stop_rules=EXCLUDED.stop_rules,
    coach_instructions=EXCLUDED.coach_instructions,athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,substitution_ids=EXCLUDED.substitution_ids,status='review',
    time_model_json=EXCLUDED.time_model_json,dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_id,2,item->>'sectionKey',item->>'sourceUrl',item->>'sourceTitle',
    item->>'sourcePublisher',item->>'sourceKind',
    item->'claims'||jsonb_build_array(jsonb_build_object('migration',migration_key,
      'researchVersion',research_version,'humanReviewRequired',TRUE,'approvalsCreated',FALSE)),
    (item->>'evidenceQuality')::SMALLINT,'candidate',NULL,NULL
  FROM jsonb_array_elements(evidence_payload) item
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,source_publisher=EXCLUDED.source_publisher,
    source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
    evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,language_code,captions_available,embedding_allowed,
    exact_variant_match,demonstration_quality_score,link_status,review_status,
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,notes)
  SELECT canonical_id,dumbbell_variant,2,
    'https://www.youtube.com/watch?v='||(item->>'videoId'),
    'https://www.youtube-nocookie.com/embed/'||(item->>'videoId'),
    item->>'videoId',item->>'title',item->>'channel','en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',item->>'query',NULL,NULL,
    '2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'YouTube oEmbed link, title, channel, and iframe metadata returned HTTP 200 on 2026-08-02. Full playback and exact one-implement, one-hand, side position, pickup, straight no-turn route, pace, posture, finish, set-down, side balance, cue safety, conflicts, captions, accessibility, quality, reviewer, and approval remain unresolved.'
  FROM jsonb_array_elements(media_payload) item
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,language_code='en',
    captions_available=NULL,embedding_allowed=TRUE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='healthy',review_status='candidate',
    discovery_method='manual_research',source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=EXCLUDED.next_review_at,
    notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,reviewed_at)
  SELECT canonical_id,2,item->>'name',item->>'class',item->>'why',item->'dimensions',
    NULL,'candidate',NULL,NULL FROM jsonb_array_elements(alternate_payload) item
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,proposed_card_json=NULL,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (dumbbell_variant,kettlebell_variant,'lateral_substitution',94,ARRAY['load','stability'],'Kettlebell substitution preserves the straight one-hand carry but changes handle, load geometry, pickup, swing behavior, and set-down.',$json$ {"revalidate":["implement","mass","grip","clearance","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (kettlebell_variant,dumbbell_variant,'lateral_substitution',94,ARRAY['load','stability'],'Dumbbell substitution preserves the straight one-hand carry but changes handle, load geometry, pickup, clearance, and set-down.',$json$ {"revalidate":["implement","mass","grip","clearance","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (dumbbell_variant,line_walk_variant,'progression',86,ARRAY['stability','complexity'],'Centering both feet on one line narrows the base and adds exact foot-placement and balance criteria under the same side load.',$json$ {"requires":["straight_lane_carry_is_repeatable","conservative_load","line_lane_is_safe"],"recompute":["route","foot_rule","difficulty","dose","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (line_walk_variant,dumbbell_variant,'regression',86,ARRAY['stability','complexity'],'Natural-width straight walking removes the single-line foot-placement constraint while preserving unilateral loaded locomotion.',$json$ {"useWhen":["line_precision_or_balance_exceeds_objective"],"recompute":["route","foot_rule","dose","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (dumbbell_variant,farmer_variant,'lateral_substitution',82,ARRAY['load','stability','fatigue'],'Farmer Carry adds a matched second implement and bilateral grip, changing asymmetry, hand count, total load, side dose, fatigue, and logistics.',$json$ {"revalidate":["identity","hand_count","implement_count","load","side_dose","fatigue","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (farmer_variant,dumbbell_variant,'lateral_substitution',82,ARRAY['load','stability','fatigue'],'Suitcase Carry removes one implement and creates unilateral side-specific trunk, hip, grip, dose, and recovery requirements.',$json$ {"revalidate":["identity","hand_count","implement_count","loaded_side","side_dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (dumbbell_variant,hold_variant,'regression',78,ARRAY['complexity','fatigue'],'Suitcase Hold removes locomotion, route, pace, step, and gait-control demands while retaining a one-sided supported load.',$json$ {"useWhen":["locomotion_is_not_required_or_not_repeatable"],"recompute":["identity","dose_unit","gait_contacts","duration","instructions"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (hold_variant,dumbbell_variant,'progression',78,ARRAY['complexity','fatigue'],'Adding straight walking introduces repeated gait contacts, route, pace, foot path, finish, and moving-clearance requirements.',$json$ {"requires":["static_hold_and_safe_pickup_are_repeatable","straight_lane_is_safe"],"recompute":["identity","dose_unit","gait_contacts","fatigue","duration","instructions"]} $json$::JSONB,'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  -- Historical UUID-only definition records cannot be safely replayed in a
  -- clean bootstrap. Quarantined source lineage and archived variants retain
  -- the evidence without inventing foreign-key identity targets.
  SELECT 1,canonical_id,historical.definition_id,'needs_human_review',
    'Historical UUID-only identity boundary is retained by quarantined source lineage; no foreign-key target is fabricated during clean bootstrap.',
    jsonb_build_object('migration',migration_key,'historicalBoundaryNotReplayed',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL
  FROM (SELECT NULL::UUID AS definition_id) historical
  WHERE FALSE
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
    AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  VALUES
    (1,canonical_id,farmer_definition,'distinct_exercises','Suitcase Carry uses one implement in one loaded hand and requires balanced side-specific exposure. Farmer Carry uses matched implements in both hands. Hand and implement count, load symmetry, total load, side dose, trunk strategy, grip fatigue, equipment, and logistics differ.',jsonb_build_object('migration',migration_key,'identityBoundary','unilateral_asymmetric_loaded_locomotion_vs_bilateral_symmetric_loaded_locomotion','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,hold_definition,'distinct_exercises','Suitcase Carry requires locomotion through a declared route. Suitcase Hold is static and has no walking steps, route, pace, moving clearance, gait-control exposure, or locomotor finish. Action, dose unit, fatigue, space, and completion criteria differ.',jsonb_build_object('migration',migration_key,'identityBoundary','one_sided_loaded_locomotion_vs_one_sided_static_hold','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision='distinct_exercises',rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
    AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,variant.id,dimension.key,
    CASE dimension.key WHEN 'technicalComplexity' THEN variant.complexity ELSE variant.physical END,
    CASE WHEN GREATEST(variant.complexity,variant.physical)<50 THEN 40 ELSE 60 END,
    CASE dimension.key WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor for exact implement and hand, safe pickup, still start, route and foot rule, no-turn policy, controlled pace, trunk-pelvis and gait control, finish, set-down, side switch, and bilateral recording.'
      ELSE 'Review-only physical-difficulty anchor for implement mass and geometry, distance and time, pace and steps, grip, shoulder support, trunk and hip-gait load, cumulative carry and pull overlap, symptoms, and recovery.' END
      ||' No athlete proficiency classification is represented. Variant: '||variant.variant_key||'.',
    'review',1,NULL,NULL,NULL,NULL
  FROM (VALUES
    (dumbbell_variant,'straight-lane-dumbbell',40,50),
    (kettlebell_variant,'straight-lane-kettlebell',42,50),
    (line_walk_variant,'single-line-dumbbell',54,46)
  ) variant(id,variant_key,complexity,physical)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(key)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=NULL,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET skill_level=NULL,updated_at=now() WHERE id=ANY(source_ids);
  UPDATE coaching.exercise_safety_profile SET minimum_skill_level=NULL WHERE exercise_id=ANY(source_ids);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_id,1,2,'1.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'legacySources',7,'activeWorkingSpecifications',3,'sourceDerivedSelectableVariants',0,'identityQuarantinedSources',source_ids),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLaterality',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','athleteProficiency',NULL,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'implementHandDistanceTimePaceStepAndCumulativeOverlap',TRUE,'walkingContactsSeparatedFromLandingImpact',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'implementGripSurfaceLaneTrafficPickupSetdownExitSupervisionAndPopulation',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',6,'durationScalingSideDoseRouteAndLogistics',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachSupport',TRUE,'pickupCarryFinishSetdownSideSwitchAndStopRules',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directVsAdjacentEvidenceSeparated',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'oEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',8,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',6,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',21,'sourceIdentityQuarantines',7),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueGripTrunkGaitBudget',TRUE,'duration',TRUE,'equipmentLaneTrafficAndSetdown',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch every candidate in full and verify exact implement, hand, pickup, start, route, foot rule, no-turn action, pace, posture, finish, set-down, bilateral delivery, captions, safety, accessibility, conflicts, and demonstration quality.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every progression, regression, substitution, and equipment proposal.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty; these scores are not athlete proficiency.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. All seven source rows require exact original specifications before any source-derived variant is restored.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,human_review_required=TRUE,checked_at=now();

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE definition_id=canonical_id AND legacy_exercise_id=ANY(source_ids)
        AND provenance_json->>'sourceDisposition'='identity_quarantine')<>7
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(source_variant_ids) AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine')<>7
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_id AND status='review'
        AND requirements_json->>'selectable'='true'
        AND requirements_json->>'turnPolicy'='none'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=
          GREATEST((difficulty_json->>'technicalComplexity')::INTEGER,(difficulty_json->>'physicalDifficulty')::INTEGER)
        AND load_profile_json<>'{}'::JSONB AND fatigue_profile_json<>'{}'::JSONB
        AND programming_profile_json<>'{}'::JSONB)<>3 THEN
    RAISE EXCEPTION '% found invalid source quarantine or active working specifications',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND coalesce(dosage_json->>'distanceMetersPerSide','')<>''
        AND coalesce(dosage_json->>'maximumWorkSecondsPerSide','')<>''
        AND cardinality(equipment_required)=3
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND length(coach_instructions)>=100 AND length(athlete_instructions)>=100
        AND cardinality(stop_rules)>=10)<>6
    OR (SELECT count(DISTINCT section_key) FROM coaching.exercise_section_evidence_v1
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
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>21 THEN
    RAISE EXCEPTION '% found incomplete profiles, evidence, media, or alternates',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(active_variant_ids) OR to_variant_id=ANY(active_variant_ids))
        AND review_status='review' AND reviewed_by IS NULL)<>8
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND version=1 AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE definition_id=canonical_id AND legacy_exercise_id=ANY(source_ids)
        AND provenance_json->>'sourceDisposition'='identity_quarantine')<>7
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_id
        AND resolved_definition_id IN (farmer_definition,hold_definition)
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>2 THEN
    RAISE EXCEPTION '% found incomplete graph, calibration, or identity resolution',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=canonical_id AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=canonical_id AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.required_equipment||definition.optional_equipment) key
      WHERE definition.id=canonical_id AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      WHERE (relationship.from_variant_id=ANY(active_variant_ids) OR relationship.to_variant_id=ANY(active_variant_ids))
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise WHERE id=ANY(source_ids) AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(source_ids) AND minimum_skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_id AND
      (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2 AND
        (review_status IN ('approved') OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR captions_available IS NOT NULL OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_id AND (status<>'quarantined' OR human_review_required<>TRUE
        OR jsonb_array_length(blocking_issues_json)<>4)) THEN
    RAISE EXCEPTION '% fabricated proficiency, approval, or publication state',migration_key;
  END IF;
END;
$$;
