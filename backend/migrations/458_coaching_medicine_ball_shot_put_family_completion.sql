-- Complete the Medicine Ball Shot-Put Throw family without treating generic,
-- rotational, partner, split-stance, wall-return, or forward-facing labels as
-- interchangeable executable prescriptions. All approvals remain human.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '458_coaching_medicine_ball_shot_put_family_completion';
  research_version CONSTANT TEXT := '2026-08-02.70';
  canonical_id UUID;
  active_variant UUID;
  two_hand_rotational_throw UUID;
  chest_pass_variant UUID;
  rollout_definition UUID;
  source_ids CONSTANT BIGINT[] := ARRAY[154,357,1002,1197,1270,1318,1478];
  source_variant_ids UUID[];
  current_video_ids CONSTANT TEXT[] := ARRAY[
    'KtzuEYn0DmY','WBUDq_5DGG0','EXV9UhUMTiY','wX4tcyR-61w','GTK8P0IOCTI'];
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/39589937/","sourceTitle":"Criterion Validity and Reliability of a New Medicine Ball Rotational Power Test","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["The study tests dominant and nondominant rotational medicine-ball pushes under a standardized protocol.","Shot-put-family identity requires a unilateral shoulder-level push; stance, orientation, entry, pivot, ball position, target, return, catch, receiver, and finish remain exact variant or delivery facts."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37833510/","sourceTitle":"Effects of Upper-Body Plyometric Training on Physical Fitness in Healthy Youth and Young Adult Participants: A Systematic Review with Meta-Analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Upper-body plyometric programs include varied ballistic throwing tasks and protocols.","Controlled taxonomy is push, rotate, brace, and throw; unilateral shot-put release stays distinct from bilateral chest, scoop, overhead, and slam actions."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/39589937/","sourceTitle":"Criterion Validity and Reliability of a New Medicine Ball Rotational Power Test","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Rotational medicine-ball power is a whole-body task rather than an arm-only press.","The card represents feet, lower limbs, hips, pelvis, trunk, scapula, shoulder, elbow, wrist, and hand while avoiding a universal prime-mover claim."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/39589937/","sourceTitle":"Criterion Validity and Reliability of a New Medicine Ball Rotational Power Test","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Release velocity can validly measure a standardized rotational medicine-ball push.","The working specification uses a static side-on start, rear-hip load, ground-up rotation, unilateral shoulder-level push, natural declared pivot, controlled finish, retrieval, and full reset."]},
    {"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22744301/","sourceTitle":"Reliability of seated and standing throwing velocity using differently weighted medicine balls","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":81,"claims":["Position, technique, and medicine-ball mass affect measured throwing performance.","Difficulty stores exercise complexity and physical difficulty only; overall is their maximum and athlete readiness remains selection context."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41460695/","sourceTitle":"Validation of a Supine Upper-Body Power Test in Physically Active Male and Female Adults Using a Medicine Ball With Accelerometer","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":82,"claims":["Medicine-ball output is sensitive to test protocol and neuromuscular state, although the cited task is supine and adjacent rather than the exact standing variant.","Track ball mass/type, throws per side, velocity or distance when measured, target accuracy, shoulder/trunk fatigue, speed loss, recovery, and overlapping press/throw volume."]},
    {"sectionKey":"constraints","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22744301/","sourceTitle":"Reliability of seated and standing throwing velocity using differently weighted medicine balls","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":81,"claims":["Reliable comparison requires consistent technique and ball mass.","Require an intact medicine ball, rated wall, non-slip surface, marked stance and target, clear flight/rebound/retrieval zones, safe separation, and an explicit no-catch return contract."]},
    {"sectionKey":"dosage","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37833510/","sourceTitle":"Effects of Upper-Body Plyometric Training on Physical Fitness in Healthy Youth and Young Adult Participants: A Systematic Review with Meta-Analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Upper-body plyometric studies use varied doses, so no single prescription fits every objective or population.","Profiles declare low per-side repetition counts, high intent, full reset, long recovery, speed/accuracy stops, duration, and cumulative weekly throwing exposure."]},
    {"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/39589937/","sourceTitle":"Criterion Validity and Reliability of a New Medicine Ball Rotational Power Test","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Measurement is interpretable only when the throwing task remains standardized.","Instructions state side-on stance, throwing side, ball position, rear-hip load, permitted pivot, release vector, wall target, no-catch retrieval, finish, reset, side order, ball mass, dose, rest, and rep-quality rule."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Youth resistance and power training should use qualified supervision, appropriate progression, safe equipment, and safe space.","Stop for symptoms, unsafe wall/ball/lane/rebound, loss of grip or balance, lumbar-dominant rotation, shoulder/elbow compensation, accuracy or output collapse, wrong-side execution, or failure to reset."]},
    {"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37833510/","sourceTitle":"Effects of Upper-Body Plyometric Training on Physical Fitness in Healthy Youth and Young Adult Participants: A Systematic Review with Meta-Analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Upper-body plyometric training can improve throwing-related performance, with transfer depending on task and population.","Place high-intent shot-put throws early in Output work, budget both sides and all other throws/presses, and never turn the power profile into fatigue conditioning."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/21572350/","sourceTitle":"The seated medicine ball throw as a test of upper body power in older adults","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":80,"claims":["A medicine-ball task can be repeatable when position, load, trials, and measurement are standardized; the seated test is adjacent, not an exact match.","Athlete support shows the exact start, side, load, target, release, finish, retrieval, reset, side change, expected sensations, and stop signal in video and nonvideo formats."]},
    {"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/39589937/","sourceTitle":"Criterion Validity and Reliability of a New Medicine Ball Rotational Power Test","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Velocity is a useful field measure only under a controlled rotational push protocol.","Coach support includes ball selection, wall/lane inspection, side balance, foot/pivot/hip-trunk-arm sequencing, target accuracy, speed-loss rules, camera views, total throw budget, and substitution revalidation."]},
    {"sectionKey":"accessibility","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/21572350/","sourceTitle":"The seated medicine ball throw as a test of upper body power in older adults","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":80,"claims":["A seated throw intentionally changes lower-body contribution and is a separate reviewed variant rather than a silent modification.","Accessibility may reduce ball mass, distance, velocity intent, repetition count, or visual complexity, or use a reviewed kneeling/seated substitute; every identity-changing change requires a new prescription."]},
    {"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22744301/","sourceTitle":"Reliability of seated and standing throwing velocity using differently weighted medicine balls","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":81,"claims":["Standing versus seated position, ball mass, and throw technique materially change the tested task.","Static, stepping, kneeling, seated, partner, wall-catch, open-lane, forward-facing, and measured versions require explicit variant or delivery review; bilateral release patterns remain distinct definitions."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates have current oEmbed metadata only; playback, exact static side-on variant, captions, accessibility, safety, quality, reviewer identity, and approval remain unresolved."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"videoId":"KtzuEYn0DmY","title":"Medicine Ball Rotational Shot-Put Throw","channel":"Simone Sports Performance","query":"rotational medicine ball shot put static side on"},
    {"videoId":"WBUDq_5DGG0","title":"Medicine Ball Rotational Shot-Put Throw","channel":"Simone Sports Performance","query":"rotational medicine ball shot put static side on"},
    {"videoId":"EXV9UhUMTiY","title":"Med Ball Rotational Shotput","channel":"Champion Physical Therapy and Performance","query":"static side on rotational medicine ball shot put throw"},
    {"videoId":"wX4tcyR-61w","title":"Rotational Medicine Ball Shotput","channel":"Synchronicity Health","query":"static side on rotational medicine ball shot put throw"},
    {"videoId":"GTK8P0IOCTI","title":"CresseySportsPerformance.com: Rotational Medicine Ball Shotput","channel":"Eric Cressey","query":"static side on rotational medicine ball shot put throw"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"name":"Forward-Facing Medicine Ball Shot-Put Throw","class":"new_variant","why":"Forward-facing anti-rotation execution removes the side-on preload and changes stance, counterpressure, and trunk demand while retaining a unilateral shoulder-level push.","dimensions":{"orientation":"forward_facing","rotation":"minimized"}},
    {"name":"Step-Behind Rotational Shot-Put Throw","class":"new_variant","why":"A step-behind adds locomotor entry, momentum, timing, contacts, and clearance before the same release.","dimensions":{"entry":"step_behind"}},
    {"name":"Shuffle Rotational Shot-Put Throw","class":"new_variant","why":"A shuffle adds repeated lateral footwork and approach momentum.","dimensions":{"entry":"lateral_shuffle"}},
    {"name":"Half-Kneeling Medicine Ball Shot-Put Throw","class":"new_variant","why":"Half-kneeling constrains lower-body contribution and changes support, balance, pelvis control, and safe exit.","dimensions":{"support":"half_kneeling"}},
    {"name":"Static Split-Stance Shot-Put Throw","class":"new_variant","why":"A fixed staggered base requires declared lead leg, throwing-side relation, and finish.","dimensions":{"stance":"split","leadLeg":"declared"}},
    {"name":"Partner Medicine Ball Shot-Put Pass","class":"new_variant","why":"A live receiver adds exact partner roles, distance, catch, return, communication, and participant constraints.","dimensions":{"receiver":"partner","participantCount":2}},
    {"name":"Wall-Rebound Shot-Put Catch","class":"new_variant","why":"Required rebound catch adds incoming-ball perception, deceleration, catch exposure, and a different repetition end.","dimensions":{"return":"wall_rebound_catch"}},
    {"name":"Open-Lane Distance Shot Put","class":"new_variant","why":"Free flight and measured distance replace the wall target and require a protected landing/retrieval sector.","dimensions":{"target":"open_lane","measurement":"distance"}},
    {"name":"Velocity-Measured Static Shot Put","class":"modifier_annotation","why":"Radar or sensor measurement changes setup and reporting while preserving the exact throw.","dimensions":{"measurement":"release_velocity"}},
    {"name":"Medicine-Ball Mass Change","class":"modifier_annotation","why":"Ball mass is a declared load variable unless it changes release mechanics or speed enough to fail the variant.","dimensions":{"ballMass":"declared"}},
    {"name":"Alternating-Side Shot-Put Sequence","class":"modifier_annotation","why":"Alternating side order changes density and logistics while preserving each exact unilateral repetition.","dimensions":{"sideOrder":"alternating"}},
    {"name":"Two-Hand Medicine Ball Rotational Throw","class":"new_definition","why":"A bilateral grip and release differ from the unilateral shoulder-level shot-put push.","dimensions":{"armUse":"bilateral"}},
    {"name":"Medicine Ball Chest Pass","class":"new_definition","why":"A bilateral forward chest release removes the side-on unilateral shot-put contract.","dimensions":{"release":"bilateral_chest_pass"}},
    {"name":"Medicine Ball Rotational Scoop Toss","class":"new_definition","why":"A two-hand low scoop path changes grip, start height, arm path, and release.","dimensions":{"release":"bilateral_low_scoop"}},
    {"name":"Cable Shot-Put Press","class":"new_definition","why":"A tethered cable press has continuous resistance and no ballistic free release.","dimensions":{"implement":"cable","release":"none"}},
    {"name":"Track-and-Field Shot Put","class":"new_definition","why":"The competition implement, circle, glide or full rotational entry, sector, rules, and maximal throwing task are materially different.","dimensions":{"sportTask":"competition_shot_put"}},
    {"name":"Source 154 Generic Shot-Put Throw","class":"reject","why":"The source mentions trunk rotation but omits orientation, ball position, pivot, target, return, catch, and exact repetition contract.","dimensions":{"sourceId":154,"identityQuarantine":true}},
    {"name":"Sources 357, 1002, 1197, 1270, 1318, and 1478","class":"reject","why":"These rows each omit or permit alternatives for ball position, foot/pivot policy, stance-side mapping, receiver, catch/return, release completion, or entry; none is an exact selectable variant as authored.","dimensions":{"sourceIds":[357,1002,1197,1270,1318,1478],"identityQuarantine":true}}
  ]
  $json$::JSONB;
BEGIN
  -- Source IDs and exact lineage keys are stable; generated UUIDs are not.
  -- The active working specification is intentionally research-authored and
  -- must never reuse a generic legacy-source variant.
  SELECT definition_id INTO canonical_id
  FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=154;
  SELECT id INTO active_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND variant_key='static-side-on-wall-throw-only';
  IF active_variant IS NULL THEN active_variant := gen_random_uuid(); END IF;
  SELECT variant.id INTO two_hand_rotational_throw FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  WHERE definition.facility_id=1 AND definition.slug='medicine-ball-rotational-throw'
    AND variant.variant_key='static-side-on-two-hand-rotational-scoop-throw-only';
  SELECT variant.id INTO chest_pass_variant FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition ON definition.id=variant.definition_id
  WHERE definition.facility_id=1 AND definition.slug='medicine-ball-chest-pass'
    AND variant.variant_key='shallow-countermovement-wall-pass';
  SELECT id INTO rollout_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='medicine-ball-rollout';
  SELECT ARRAY[
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='baseline'),
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-1002-baseline-source-357'),
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-1002-baseline'),
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-1197-baseline'),
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-1270-baseline'),
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-1318-baseline'),
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='baseline-source-1478')]
  INTO source_variant_ids;
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND facility_id=1 AND slug='medicine-ball-shot-put-throw')<>1
    OR (SELECT count(*) FROM coaching.exercise WHERE id=ANY(source_ids))<>7
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE definition_id=canonical_id AND legacy_exercise_id=ANY(source_ids))<>7
    OR two_hand_rotational_throw IS NULL OR chest_pass_variant IS NULL OR rollout_definition IS NULL
    OR (SELECT count(*) FROM coaching.exercise_variant_v1 WHERE id=ANY(source_variant_ids))<>7
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_id AND
      (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% refuses missing lineage or human-reviewed state',migration_key;
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
      'representedBySelectableVariant',FALSE,'missingExactExecutionFacts',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE definition_id=canonical_id AND legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_variant_v1 SET
    definition_id=canonical_id,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','identity_quarantine',
      'sourceLegacyExerciseId',CASE id
        WHEN source_variant_ids[1] THEN 154
        WHEN source_variant_ids[2] THEN 357
        WHEN source_variant_ids[3] THEN 1002
        WHEN source_variant_ids[4] THEN 1197
        WHEN source_variant_ids[5] THEN 1270
        WHEN source_variant_ids[6] THEN 1318 ELSE 1478 END,
      'archiveReason',CASE id
        WHEN source_variant_ids[1] THEN 'generic_record_omits_orientation_ball_position_pivot_target_return_and_catch'
        WHEN source_variant_ids[2] THEN 'side_on_record_permits_back_hip_or_chest_ball_start_and_omits_pivot_and_return'
        WHEN source_variant_ids[3] THEN 'side_on_record_omits_ball_start_foot_pivot_and_rebound_or_retrieval_contract'
        WHEN source_variant_ids[4] THEN 'partner_record_omits_ball_start_lead_leg_to_arm_mapping_partner_return_and_catch_contract'
        WHEN source_variant_ids[5] THEN 'wall_record_permits_catch_or_no_catch_and_omits_exact_stance_and_pivot'
        WHEN source_variant_ids[6] THEN 'split_stance_record_does_not_define_full_release_receiver_lead_leg_or_return'
        ELSE 'rotational_record_omits_stance_entry_ball_position_pivot_target_and_catch_or_retrieval' END,
      'originalAuthoritativeEvidenceRequired',TRUE,'humanReviewRequired',TRUE),
    load_profile_json=coalesce(load_profile_json,'{}'::JSONB)||jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=coalesce(fatigue_profile_json,'{}'::JSONB)||jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
      'publicationQuarantined',TRUE,'neverRestoreFromLabelOrMediaMetadata',TRUE),
    updated_at=now()
  WHERE id=ANY(source_variant_ids);

  UPDATE coaching.exercise_definition_v1 SET
    canonical_name='Medicine Ball Shot-Put Throw',display_name='Medicine Ball Shot-Put Throw',
    aliases=ARRAY['Med Ball Shot-Put Throw','Medicine Ball Rotational Shot Put',
      'Med Ball Rotational Shot Put','Rotational Medicine Ball Shotput',
      'Wall Ball Shot-Put Throw to Wall','Partner Medicine Ball Shot-Put Pass',
      'Split-Stance Medicine Ball Shot-Put Pass']::TEXT[],
    description='A unilateral ballistic medicine-ball push from a declared shoulder-level start. The selectable working specification begins static and side-on to a rated wall, loads the rear hip, rotates from the ground up, releases without a required catch, finishes under control, retrieves the ball, resets, and balances both sides.',
    family_key='medicine_ball_shot_put_family',schema_version='2.0.0',card_version=2,
    status='review',content_confidence=82,scoring_confidence=62,media_confidence=48,
    movement_patterns=ARRAY['push','rotate','brace','throw']::TEXT[],
    body_regions=ARRAY['foot','ankle','knee','hip','pelvis','spine','core','shoulder','elbow','wrist','hand']::TEXT[],
    required_equipment=ARRAY['medicine_ball']::TEXT[],
    optional_equipment=ARRAY['wall','open_space','cones','timer']::TEXT[],
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('pectoralis_major','triceps_brachii','anterior_deltoid','serratus_anterior','obliques','gluteals'),
      'secondaryMuscles',jsonb_build_array('rotator_cuff','trapezius','latissimus_dorsi','spinal_stabilizers','quadriceps','hamstrings','calves','forearm_and_hand_muscles'),
      'joints',jsonb_build_array('foot','ankle','knee','hip','pelvis','lumbar_spine','thoracic_spine','scapulothoracic_articulation','shoulder','elbow','wrist','hand'),
      'jointActions',jsonb_build_array('rear_side_hip_and_knee_flexion_during_load','ground_pressure_and_lower_limb_extension','hip_and_pelvic_rotation','thoracic_rotation_with_lumbar_control','scapular_protraction','shoulder_horizontal_adduction','elbow_extension','wrist_and_hand_ball_control','controlled_pivot_and_finish'),
      'planes',jsonb_build_array('transverse','sagittal','frontal'),
      'laterality','unilateral_execution_balanced_both_sides',
      'lateralityDetail','Each repetition uses one throwing arm and one declared rear-to-front rotational direction; valid throws and exposure are stored separately for each side.',
      'evidenceLimit','Direct research validates a standardized rotational medicine-ball power test in a small sample of professional female cricketers. Adjacent throwing studies do not establish one universal stance, pivot, muscle ranking, ball mass, cue, dose, or clinical suitability.'),
    environment_json=jsonb_build_object(
      'surface','level_non_slip','wall','rated_for_selected_ball_and_high_intent_impact',
      'station','marked_static_side_on_start_target_finish_retrieval_and_exit_zones',
      'flightAndRebound','no_person_equipment_or_cross_traffic_in_throw_rebound_or_retrieval_path',
      'traffic','one_thrower_per_controlled_lane','lighting','ball_feet_target_and_rebound_visible',
      'ballInspection','intact_surface_known_mass_size_and_rebound_behavior',
      'retrieval','thrower_or_declared retriever_enters_only_after_ball_is_still_and_lane_is_released'),
    population_json=jsonb_build_object(
      'defaultPopulation','healthy_athletes_with_pain_free_unilateral_push_rotation_and_ball_control',
      'individualizationRequired',TRUE,
      'prerequisites',jsonb_build_array('understands_side_stance_ball_target_release_and_no_catch_contract','pain_free_shoulder_elbow_wrist_trunk_hip_and_lower_limb_action','can_rotate_without_lumbar_dominant_compensation','can_follow_stop_command_and_wait_for_safe_retrieval','can_balance_valid_dose_on_both_sides'),
      'cautions',jsonb_build_array('current_throwing_side_symptoms','recent_upper_extremity_trunk_or_lower_limb_injury_or_surgery','uncontrolled_balance_or_rotation','poor_grip_or_ball_control','pregnancy_or_pressure_symptoms_requiring_clearance','uncontrolled_cardiopulmonary_or_neurologic_symptoms','youth_or_other_population_requiring_qualified_supervision'),
      'notClinicalClearance',TRUE,'neverInferReadinessFromExerciseDifficulty',TRUE),
    athlete_support_json=jsonb_build_object(
      'whatItIs','Start side-on with the ball at your rear shoulder, load the rear hip, rotate from the floor up, and push the ball into the assigned wall target. Do not catch this version; finish balanced, wait, retrieve, and reset.',
      'before',jsonb_build_array('Confirm throwing side, stance marks, ball mass/type, shoulder-level ball position, wall target, pivot rule, no-catch return, repetitions, rest, and stop signal.','Inspect the ball, wall, floor, throw lane, rebound zone, and retrieval route.','Report pain, numbness, dizziness, breathing or pressure symptoms, unsafe grip, or uncertainty before throwing.'),
      'during',jsonb_build_array('Keep pressure through the marked stance and load the rear hip without forcing range.','Let the rear foot turn naturally within the assigned mark as hips and trunk lead the shoulder-level push.','Release through the target, finish under control, and keep out of the rebound path.','Wait for the ball and lane to be safe before retrieval; reset fully and balance both sides.'),
      'expectedSensations',jsonb_build_array('fast_whole_body_rotational_effort','working_chest_triceps_shoulder_and_trunk_effort','rear_hip_and_lower_body_force_transfer'),
      'notExpected',jsonb_build_array('sharp_or_increasing_shoulder_elbow_wrist_back_hip_knee_or_ankle_pain','numbness_weakness_or_loss_of_grip','lumbar_twist_or_uncontrolled_spin','unsafe_rebound_or_ball_near_people','dizziness_panic_breathing_or_pressure_symptom'),
      'selfChecks',jsonb_build_array('correct_side_and_static_start','ball_at_rear_shoulder','ground_up_rotation_not_arm_only','declared_pivot_and_target','fast_accurate_release','balanced_finish','no_catch_safe_retrieval_full_reset','equal_valid_side_dose'),
      'accessibility',jsonb_build_array('lighter_or_larger_soft_ball_after_review','shorter_target_distance','submaximal_familiarization','fewer_throws_and_more_rest','high_contrast_marks','written_still_or_captioned_instruction','reviewed_kneeling_seated_or_two_hand_substitution'),
      'stopSignal','Stop immediately, stay out of the ball path, secure the lane when safe, and tell the coach what changed.'),
    coach_support_json=jsonb_build_object(
      'setupChecklist',jsonb_build_array('verify_exact_static_side_on_no_catch_variant','declare_side_stance_ball_position_pivot_target_finish_retrieval_and_reset','record_ball_mass_size_and_rebound_type','inspect_wall_surface_lane_spacing_and_cross_traffic','rehearse stop and retrieval commands','declare dose rest output threshold and side order'),
      'observeFromTargetSide',jsonb_build_array('stance_and_side','ball_at_rear_shoulder','target_line','shoulder_elbow_wrist_path','release_accuracy','finish_and_rebound_clearance'),
      'observeFromSideOrRear',jsonb_build_array('rear_hip_load','foot_pressure_and_declared_pivot','hip_trunk_arm_sequence','lumbar_and_rib_control','ball_speed','balance_and_full_reset'),
      'correctionOrder',jsonb_build_array('wrong_identity_side_return_or_lane','symptom_or_medical_stop','ball_wall_rebound_or_traffic_hazard','stance_ball_position_and_grip','foot_hip_trunk_arm_sequence','release_and_target','finish_retrieval_reset','side_balance_output_and_fatigue'),
      'countingRule','Count only throws that start at the declared side-on marks with the assigned ball at the rear shoulder, use the allowed pivot and ground-up sequence, release to the target, finish balanced, avoid a catch, retrieve safely, and fully reset. Store invalid attempts separately by side.',
      'groupManagement',jsonb_build_array('one_live_thrower_per_lane','no_retrieval_until_ball_is_still_and_lane_released','no_station_cross_traffic','use barriers_or_cones_for_flight_and_rebound_space','coach_controls_side_switch_and_ball_change'),
      'escalation','Quarantine the prescription when identity, source facts, symptoms, ball/wall compatibility, pivot, rebound, recovery, side balance, or safe retrieval is uncertain.'),
    support_operations_json=jsonb_build_object(
      'selectionInputs',jsonb_build_array('definition_variant_profile_and_card_version','objective_and_phase','throwing_side_order','stance_and_pivot','ball_mass_size_and_rebound_type','wall_target_and_distance','sets_and_valid_throws_per_side','velocity_distance_or_accuracy_if_measured','output_loss_threshold','rest_and_weekly_throw_budget','recent_press_throw_rotate_andsport_volume','symptoms_and_recovery','lane_wall_and_supervision','population_constraints','duration_budget'),
      'persistence',jsonb_build_array('workout_and_item_id','definition_variant_profile_card_and_research_version','side_order','stance_marks_and_pivot','ball_mass_size_type','target_distance','sets','valid_and_invalid_throws_per_side','velocity_distance_accuracy','rest','faults','symptoms','duration','substitution_reason','rendered_athlete_and_coach_instruction_versions'),
      'memberSupport',jsonb_build_array('show_static_side_on_start_and_rear_shoulder_ball_position','show_both_sides_pivot_release_finish_and_safe_retrieval','define_valid_throw_expected_sensation_and_stop','provide_nonvideo_equivalent','display_no_catch_badge_and_ball_path warning'),
      'coachSupport',jsonb_build_array('show_target_side_and rear_observation_points','show_side_balance_output_loss_and cumulative_throw_budget','surface_source_identity_and return quarantines','require substitution revalidation','retain invalid_throw symptom incident and escalation logs'),
      'incidentPath',jsonb_build_array('stop_throwing_and_secure_ball_wall_and_lane','record_variant_side_ball_target_dose_output_fault_and_symptom','follow_facility_emergency_or_clinical_referral_policy','quarantine_uncertain_card_source_or_media','do_not_diagnose_or_clear_in_product'),
      'changeImpact','Any stance, orientation, entry, pivot, side, ball, target, wall, return/catch, receiver, dose, output threshold, fatigue, recovery, equipment, space, population, or media change invalidates cached selection, duration, rendering, and approval assumptions.'),
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'shotPutCompletionMigration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,'closestLegacySource',1002,
      'closestLegacySourceStillQuarantined',TRUE,
      'primaryResearchSource','https://pubmed.ncbi.nlm.nih.gov/39589937/',
      'researchSources',jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/','https://pubmed.ncbi.nlm.nih.gov/37833510/','https://pubmed.ncbi.nlm.nih.gov/22744301/','https://pubmed.ncbi.nlm.nih.gov/41460695/','https://pubmed.ncbi.nlm.nih.gov/21572350/','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf'),
      'identityDecision','one_unilateral_shoulder_level_shot_put_family_with_exact_orientation_entry_stance_pivot_target_return_receiver_and_side_variants',
      'activeVariants',1,'deliveryProfiles',2,'legacySourcesQuarantined',jsonb_build_array(154,357,1002,1197,1270,1318,1478),
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
  VALUES(active_variant,canonical_id,'static-side-on-wall-throw-only',
    'Medicine Ball Shot-Put Throw — Static Side-On, Wall, No Catch',
    ARRAY['static','side_on','wall','throw_only','balanced_sides']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',60,'absoluteLoadDemand',56,'physicalDifficulty',56,
      'baseOverallDifficulty',60,'coordinationDemand',68,'supervisionDemand',64,
      'failureConsequence',58,'impact',12,'workCapacityDemand',42,'provisional',TRUE,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'athleteReadinessStoredHere',FALSE),
    jsonb_build_object(
      'actionIdentity','static_side_on_ground_up_rotational_unilateral_shoulder_level_ballistic_push_to_wall',
      'orientation','side_on_to_wall','entry','static_no_approach_step','stance','marked_athletic_base',
      'throwingSide','rear_side_declared','ballStart','rear_shoulder_or_upper_chest_with_throwing_hand_behind_ball_and_support_hand_under_ball',
      'load','controlled_rear_hip_load','pivotPolicy','rear_foot_may_turn_naturally_within_declared_mark_front_foot_remains_controlled',
      'release','unilateral_shot_put_push_to_marked_wall_target','returnPolicy','throw_only_no_catch_wait_retrieve_and_full_reset',
      'terminalAction','balanced_finish_outside_rebound_path','sideDose','both_sides_declared_and_recorded',
      'surface','level_non_slip','selectable',TRUE,'identityQuarantine',FALSE,
      'workingSpecificationRequiresHumanContentReview',TRUE),
    'review',
    jsonb_build_object(
      'gripDemand',38,'spinalLoading',32,'eccentricStress',18,'landingContactsPerRep',0,
      'externalLoadMethod','medicine_ball_ballistic_release','externalLoadDescription','Assigned intact medicine ball light enough to preserve fast accurate pain-free unilateral release on both sides.',
      'impactClass','low_body_impact_with_high_speed_upper_body_release_and_wall_rebound_hazard',
      'throwingShoulderLoad',56,'elbowWristHandLoad',44,'rotationalTrunkLoad',58,'hipLowerBodyLoad',48,
      'loadTracking',jsonb_build_array('ball_mass','ball_size','ball_type_and_rebound','throwing_side','target_distance','valid_and_invalid_throws','velocity_or_distance_if_measured','rest'),
      'effectiveLoadDrivers',jsonb_build_array('ball_mass_and_diameter','release_velocity','side','range_of_hip_trunk_rotation','target_distance','throw_count','recent_press_and_throw_volume','fatigue_and_recovery')),
    jsonb_build_object(
      'localMuscleFatigue',50,'gripFatigue',36,'technicalFatigueSensitivity',82,
      'neuralOutputDemand',74,'impactAccumulation',12,'recoveryHours','24_to_48_context_dependent',
      'primaryFatigueSites',jsonb_build_array('throwing_side_pectorals_triceps_and_anterior_shoulder','scapular_stabilizers','obliques_and_trunk_stabilizers','rear_hip_and_lower_limb','grip'),
      'earlyFatigueSignals',jsonb_build_array('ball_speed_or_distance_loss','target_drift','arm_first_release','shoulder_shrug_or_elbow_drop','lumbar_dominant_rotation','foot_pivot_or_balance_change','slow_retrieval_or_incomplete_reset','side_asymmetry'),
      'downstreamConflicts',jsonb_build_array('high_intent_throwing_pitching_serving_or_hitting','heavy_or_high_volume_pressing','rotational_power_work','shoulder_elbow_wrist_or trunk rehabilitation exposure')),
    jsonb_build_object(
      'primaryIntent','high_quality_side_balanced_unilateral_rotational_ballistic_power',
      'selectionStatus','candidate_requires_human_review','appropriatePhases',jsonb_build_array('output'),
      'prerequisites',jsonb_build_array('pain_free_unilateral_push_and_rotation','repeatable_static_side_on_stance_and_declared_pivot','safe_ball_wall_lane_and_retrieval','balanced_side_exposure','can_stop_before_output_or_accuracy_loss'),
      'completionCriteria',jsonb_build_array('all_valid_throws_match_exact_identity','both_sides_meet_declared_dose','output_accuracy_and_finish_thresholds_met','safe_no_catch_retrieval_and_reset','duration_and_recovery_recorded'),
      'avoidUse',jsonb_build_array('unknown_orientation_entry_pivot_ball_position_return_or_receiver','pain_or_guarding','unsafe_wall_ball_lane_rebound_or_retrieval','unbalanced_side_dose','fatigue_degraded_speed_accuracy_sequence_or_finish'),
      'cumulativeBudget',jsonb_build_object('highIntentThrowsPerSide',1,'unilateralPressLoad',56,'rotationalTrunkLoad',58,'throwingShoulderLoad',56,'gripStress',36,'technicalSensitivity',82,'athleteLandingImpactContacts',0),
      'weeklyExposureGuidance','Combine with every medicine-ball throw, sport throw, serve, hit, rotational power drill, and press. Progress only one of ball mass, release intent, target distance, throws, or entry complexity after pain-free recovery and stable bilateral quality.',
      'sequencing','Place early in Output after specific preparation and before fatigue work. Preserve priority sport-skill quality and honor sport throwing-volume plans.',
      'pairingCompatibility',jsonb_build_array('low_fatigue_lower_body_access_or_balance_work_during_full_rest','reviewed_noncompeting_mobility_or_breathing'),
      'interferenceRules',jsonb_build_array('do_not_pre_fatigue_throwing_shoulder_trunk_grip_or_rotation_before_priority_skill','do_not_convert_power_profile_to_conditioning','recompute_identity_side_ball_target_return_fatigue_recovery_duration_equipment_space_and_rendering_after_substitution'),
      'uncertaintyPolicy',jsonb_build_object('unknownIdentityBallWallReturnSymptomsOrRecovery','fail_closed_and_request_coach_review','neverInferMissingSourceMechanics',TRUE,'neverAutoApproveMediaGraphCalibrationOrPublication',TRUE)))
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
  SELECT active_variant,profile.profile_key,'output',profile.role,profile.purpose,
    profile.suitability,profile.alignment,
    jsonb_build_object('rotationalPower',5,'unilateralPressPower',5,'sideBalance',5,
      'targetAccuracy',4,'assessmentStandardization',profile.assessment,'athleteLandingImpact',0),
    jsonb_build_object('doseType','valid_throws_per_side','sets',profile.sets,
      'repetitions',profile.repetitions,'sideDose','equal_valid_throws_per_side',
      'ballMass','assigned_and_recorded','intent',profile.intent,'restSeconds',profile.rest_seconds,
      'qualityThreshold','stop_before_velocity_distance_accuracy_sequence_balance_or_safe_retrieval_materially_changes'),
    'Every counted throw starts static at the declared side-on marks with the assigned ball at the rear shoulder, uses the declared pivot and ground-up sequence, releases to the target, finishes balanced, avoids a catch, waits for safe retrieval, resets fully, and stays within the side-specific output and accuracy threshold.',
    ARRAY['pain_numbness_weakness_or_neurologic_symptom','dizziness_breathing_or_pressure_symptom','wrong_variant_side_stance_ball_position_pivot_target_or_return','unsafe_ball_wall_surface_lane_rebound_traffic_or_retrieval','loss_of_grip_or_ball_control','lumbar_dominant_rotation_or_arm_only_release','shoulder_shrug_elbow_drop_or_joint_compensation','target_accuracy_or_output_threshold_failed','loss_of_balance_or_uncontrolled_spin','side_asymmetry_outside_declared_limit','incomplete_reset_or_rushed_repetition','unsafe_finish_retrieval_or_exit'],
    'Verify exact static side-on wall/no-catch identity, throwing side, marks, ball mass/type, rear-shoulder start, pivot, target, retrieval, dose, output threshold, rest, stop command, wall, floor, traffic, and exit. Observe ground-up sequencing, lumbar/rib control, shoulder-elbow-wrist path, release, accuracy, finish, rebound clearance, reset, side difference, symptoms, fatigue, and cumulative throw exposure.',
    'Start side-on at your marks with the ball at the rear shoulder. Load the rear hip, turn from the floor up with the allowed pivot, and push the ball through the wall target. Finish balanced and stay out of the rebound path. Do not catch it; wait, retrieve safely, reset fully, and match the other side.',
    CASE WHEN profile.assessment=TRUE THEN
      'A standardized review-only bilateral profile of rotational medicine-ball release output and asymmetry; results are protocol-specific and not a diagnosis.'
      ELSE 'Improved high-intent unilateral rotational force transfer, shoulder-level ballistic pushing, target accuracy, and side-balanced power quality.' END,
    ARRAY['medicine_ball','wall','open_space','cones','timer']::TEXT[],
    jsonb_build_object('athletesPerStation',1,'setupSeconds',120,'transitionSeconds',30,
      'equipmentCheck','intact_known_mass_ball_rated_wall_non_slip_floor_marks_cones_timer_and_clear_rebound_retrieval_zone',
      'lane','marked_static_start_target_rebound_retrieval_and_exit_zones',
      'trafficRule','no_entry_or_retrieval_until_ball_is_still_and_coach_releases_lane',
      'substitutionRevalidation',jsonb_build_array('identity','variant','orientation','entry','stance','pivot','side','ball','target','return_or_catch','receiver','dose','fatigue','recovery','duration','equipment','space','population_constraints','rendering')),
    ARRAY[]::UUID[],'review',
    jsonb_build_object('setupSeconds',120,'secondsPerThrow',profile.seconds_per_throw,
      'retrievalAndResetSeconds',profile.retrieval_seconds,'transitionSeconds',30,
      'durationFormula','setup + sets * (two_sides * repetitions_per_side * (seconds_per_throw + retrieval_and_reset_seconds) + rest) + transition',
      'equipmentAdjustmentSeconds','recompute whenever ball, wall distance, target, retriever, or lane changes'),
    jsonb_build_object('reduce',jsonb_build_array('reduce_ball_mass','reduce_intent_or_target_distance','reduce_throws_per_side','increase_rest','use_reviewed_kneeling_seated_or_bilateral_substitution'),'increase',jsonb_build_array('increase_release_intent_with_same_ball','add_one_throw_per_side_within_output_threshold','increase_target_distance','use_reviewed_step_entry_variant'),'revalidateAfterChange',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_id','variant_id','profile_key','side_order','stance_and_pivot','ball_mass_size_type','wall_target_distance','sets','valid_and_invalid_throws_per_side','velocity_distance_or_accuracy','rest','faults','symptoms','duration','substitution'),'validity','all exact identity, lane, side, ball, target, return, reset, output, accuracy, safety, and quality gates pass'),
    jsonb_build_object('before','Which side, stance, pivot, ball, target, return, dose, rest, and output threshold are assigned?','during','Are sequence, release, target, finish, rebound clearance, side balance, output, and reset still valid?','after','Store valid and invalid throws by side, ball, output/accuracy, rest, faults, symptoms, duration, retrieval, and substitution.')
  FROM (VALUES
    ('output-power','primary','Develop high-quality bilateral rotational shot-put power without fatigue leakage.',90,94,FALSE,4,3,3,120,'maximal_crisp_intent',3,12),
    ('output-assessment','conditional','Standardize the exact variant for protocol-specific velocity, distance-proxy, accuracy, and side-asymmetry review.',86,92,TRUE,3,1,3,120,'maximal_after_familiarization',3,15)
  ) profile(profile_key,role,purpose,suitability,alignment,assessment,sets,
    repetitions,unused_repetitions,rest_seconds,intent,seconds_per_throw,retrieval_seconds)
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
  SELECT canonical_id,active_variant,2,
    'https://www.youtube.com/watch?v='||(item->>'videoId'),
    'https://www.youtube-nocookie.com/embed/'||(item->>'videoId'),
    item->>'videoId',item->>'title',item->>'channel','en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',item->>'query',NULL,NULL,
    '2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'YouTube oEmbed link, title, channel, and iframe metadata returned HTTP 200 on 2026-08-02. Full playback and exact static side-on stance, ball position, foot and pivot policy, wall target, release, no-catch return, finish, side balance, cue safety, conflicts, captions, accessibility, quality, reviewer, and approval remain unresolved.'
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
    (active_variant,two_hand_rotational_throw,'lateral_substitution',82,ARRAY['complexity','load','fatigue'],'The two-hand rotational wall throw retains a static rotational projection but changes grip, arm count, ball start, shoulder asymmetry, release path, and side dose.',$json$ {"revalidate":["identity","arm_count","ball_position","side_dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (two_hand_rotational_throw,active_variant,'lateral_substitution',82,ARRAY['complexity','load','fatigue'],'The shot-put version changes a bilateral projection to a unilateral shoulder-level push and requires an exact throwing-side contract.',$json$ {"revalidate":["identity","arm_count","ball_position","side_dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (active_variant,chest_pass_variant,'lateral_substitution',76,ARRAY['complexity','load','stability'],'The chest pass removes the side-on unilateral rotational release and uses a bilateral forward push.',$json$ {"revalidate":["orientation","rotation","arm_count","target","return","side_dose","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (chest_pass_variant,active_variant,'lateral_substitution',76,ARRAY['complexity','load','stability'],'The shot-put adds side-on orientation, unilateral release, pivot, rotational sequencing, and bilateral side management.',$json$ {"revalidate":["orientation","rotation","arm_count","pivot","target","return","side_dose","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  -- Historical UUID-only definition records are absent in a fresh bootstrap.
  -- The durable source mappings and archived variants above retain every
  -- quarantine without manufacturing a foreign-key identity target.
  SELECT 1,canonical_id,historical.definition_id,'needs_human_review',
    'Historical UUID-only identity boundary is retained by quarantined source lineage; no foreign-key target is fabricated during clean bootstrap.',
    jsonb_build_object('migration',migration_key,'historicalBoundaryNotReplayed',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL
  FROM (SELECT NULL::UUID AS definition_id) historical
  WHERE FALSE
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision='needs_human_review',rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
    AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  VALUES(1,canonical_id,rollout_definition,'distinct_exercises',
    'Medicine Ball Shot-Put Throw is a standing side-on unilateral ballistic projection with free ball release. Rollout is an anti-extension trunk exercise that moves the hands and implement away from and back toward the body without a throw. Orientation, support, joint actions, release, equipment path, intent, failure response, and dose differ.',
    jsonb_build_object('migration',migration_key,
      'identityBoundary','unilateral_ballistic_free_release_vs_supported_anti_extension_rollout',
      'changedAttributes',jsonb_build_array('orientation','support','joint_actions','release','equipment_path','intent','failure_response','dose'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision='distinct_exercises',rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
    AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,active_variant,dimension.key,
    CASE dimension.key WHEN 'technicalComplexity' THEN 60 ELSE 56 END,60,
    CASE dimension.key WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor for exact side-on stance, side, rear-shoulder ball position, rear-hip load, foot pivot, ground-up sequence, target release, balanced finish, no-catch retrieval, reset, and bilateral side management.'
      ELSE 'Review-only physical-difficulty anchor for ball mass/size, high release intent, unilateral shoulder and trunk demand, throws per side, overlapping press and sport throws, output loss, symptoms, and recovery.' END
      ||' No athlete proficiency classification is represented.',
    'review',1,NULL,NULL,NULL,NULL
  FROM (VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(key)
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
      'identity',jsonb_build_object('passed',TRUE,'legacySources',7,'activeWorkingSpecifications',1,'sourceDerivedSelectableVariants',0,'identityQuarantinedSources',source_ids),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLaterality',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','athleteProficiency',NULL,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'ballSideThrowAndCumulativeOverlap',TRUE,'bodyImpactSeparated',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'ballWallSurfaceLaneReboundRetrievalSupervisionAndPopulation',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'durationScalingSideDoseOutputAndRetrieval',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachSupport',TRUE,'stanceLoadReleaseFinishRetrievalResetAndStopRules',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directVsAdjacentEvidenceSeparated',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'oEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',18,'sourceIdentityQuarantines',7),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndThrowBudget',TRUE,'duration',TRUE,'equipmentWallLaneAndRetrieval',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch every candidate in full and verify exact static side-on stance, ball position, foot/pivot policy, wall target, release, no-catch return, finish, side balance, captions, safety, accessibility, conflicts, and demonstration quality.'),
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
      WHERE id=active_variant AND definition_id=canonical_id AND status='review'
        AND requirements_json->>'selectable'='true'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=
          GREATEST((difficulty_json->>'technicalComplexity')::INTEGER,(difficulty_json->>'physicalDifficulty')::INTEGER)
        AND load_profile_json<>'{}'::JSONB AND fatigue_profile_json<>'{}'::JSONB
        AND programming_profile_json<>'{}'::JSONB)<>1 THEN
    RAISE EXCEPTION '% found invalid source quarantine or active working specification',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=active_variant AND status='review'
        AND coalesce(dosage_json->>'repetitions','')<>'' AND cardinality(equipment_required)>=5
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND length(coach_instructions)>=100 AND length(athlete_instructions)>=100
        AND cardinality(stop_rules)>=10)<>2
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
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>18 THEN
    RAISE EXCEPTION '% found incomplete profiles, evidence, media, or alternates',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=active_variant OR to_variant_id=active_variant)
        AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=active_variant AND status='review'
        AND version=1 AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE definition_id=canonical_id AND legacy_exercise_id=ANY(source_ids)
        AND provenance_json->>'sourceDisposition'='identity_quarantine')<>7
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_id AND resolved_definition_id=rollout_definition
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>1 THEN
    RAISE EXCEPTION '% found incomplete graph, calibration, or identity quarantine',migration_key;
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
      WHERE (relationship.from_variant_id=active_variant OR relationship.to_variant_id=active_variant)
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
