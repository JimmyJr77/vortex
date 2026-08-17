-- Correct inherited row-family source assignments and complete One-Arm Row.
-- Bilateral T-bar and Meadows sources are remapped to their existing stable
-- identities. Internally inconsistent legacy rows remain archived rather than
-- becoming fabricated selectable variants. No human approval is created.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '453_coaching_one_arm_row_family_completion';
  research_version CONSTANT TEXT := '2026-08-02.67';
  canonical_id UUID; meadows_target_id UUID; two_hand_target_id UUID;
  db_variant UUID; kb_variant UUID; landmine_variant UUID; suitcase_variant UUID;
  moved_meadows_variant UUID; moved_tbar_v_variant UUID; moved_tbar_neutral_variant UUID;
  invalid_gorilla_variant UUID; invalid_ball_grip_variant UUID;
  invalid_gorilla_definition_id UUID; invalid_ball_grip_definition_id UUID;
  active_variant_ids UUID[]; all_variant_ids UUID[];
  canonical_source_ids CONSTANT BIGINT[] := ARRAY[195,496,1436,1438];
  involved_source_ids CONSTANT BIGINT[] := ARRAY[195,496,1434,1435,1436,1438,1441,1448,1450];
  archived_definition_ids UUID[];
  current_video_ids CONSTANT TEXT[] := ARRAY[
    'KRN38chlkds','k2kVniB5eQI','zvATS076NVA','TKmtHtY7yNo','2bjH8LMo6DM'];
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/","sourceTitle":"Single-arm Row","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":78,"claims":["ACE defines a bench-supported unilateral dumbbell row with a braced torso, elbow flexion, upper-arm movement toward the trunk, and controlled lowering.","Implement and supported-versus-hinged base are exact variants; bilateral rows, deliberate rotation, plank rows, isometric holds, and combined hinge-row cycles remain separate identities."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://www.nsca.com/contentassets/8323553f698a466a98220b21d9eb9a65/foundationsoffitnessprogramming_201508.pdf","sourceTitle":"Foundations of Fitness Programming","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["NSCA classifies dumbbell row and bent-over row within horizontal pulling progressions.","Controlled taxonomy is unilateral horizontal pull, shoulder extension, elbow flexion, scapular control, brace, and optional isometric hinge support; athlete proficiency labels are not exercise-card fields."]},
    {"sectionKey":"anatomy","sourceUrl":"https://doi.org/10.1519/SSC.0000000000000751","sourceTitle":"Exercise Technique: The Landmine Row","sourcePublisher":"Strength and Conditioning Journal","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["The technique article identifies latissimus dorsi, trapezius, teres major, posterior deltoid, rhomboids, elbow flexors, grip, spinal erectors, obliques, and hip extensors as row agonists or stabilizers.","The card separates dynamic shoulder, scapular, and elbow actions from isometric trunk, hip, knee, wrist, and grip demands."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/19620925/","sourceTitle":"Comparison of different rowing exercises: trunk muscle activation and lumbar spine motion, load, and stiffness","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["The study compared inverted, standing bent-over, and standing one-arm cable rows and found materially different trunk activation and spine-loading patterns.","It is adjacent rather than direct dumbbell or landmine evidence; support, hinge demand, resistance path, and anti-rotation load must therefore remain explicit rather than treated as interchangeable."]},
    {"sectionKey":"difficulty","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/","sourceTitle":"Single-arm Row","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":78,"claims":["Bench support reduces base-control demand while the unilateral load still requires repeatable bracing, shoulder path, grip, and side accounting.","Scores represent exercise complexity and physical difficulty only; overall is their maximum and no consumer experience label is copied into exercise or safety skill fields."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://www.nsca.com/education/podcasts/nsca-coaching-podcast/season-6/season-6-episode-6/","sourceTitle":"NSCA Coaching Podcast, Season 6 Episode 6","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The coach specifically notes that heavy one-arm landmine and dumbbell rows can materially tax grip and forearm capacity.","The card records implement mass, support, grip, range, repetitions per side, valid and failed repetitions, pickup and set-down, local pulling fatigue, trunk fatigue, grip fatigue, rest, and recovery."]},
    {"sectionKey":"constraints","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/","sourceTitle":"Single-arm Row","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":78,"claims":["ACE requires stable bench support, a braced aligned trunk, and a range that does not require torso rotation.","Delivery must verify bench or landmine stability, attachment retention, plate and sleeve clearance, load pickup and set-down, floor traction, side lane, and symptom-free owned range."]},
    {"sectionKey":"dosage","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews","sourcePublisher":"American College of Sports Medicine","sourceKind":"professional_standard","evidenceQuality":94,"claims":["Resistance-training prescription should be individualized by outcome and is not reduced to one universal set, repetition, load, or failure rule.","Profiles expose sets, repetitions per side, load or effort target, range, tempo, rest, reserve, duration, weekly exposure, and quality-loss stops."]},
    {"sectionKey":"instructions","sourceUrl":"https://www.nsca.com/education/videos/exercise-technique-bent-over-rowsingle-arm/","sourceTitle":"Exercise Technique: Bent-Over Row—Single-Arm","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["NSCA provides a direct single-arm bent-over-row technique demonstration.","Instructions declare exact implement, stance and support contacts, spine and pelvis position, working side, pull target, scapular policy, range, controlled eccentric, side change, and safe finish."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/","sourceTitle":"Single-arm Row","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":78,"claims":["ACE instructs the athlete not to rotate the torso or change spinal position to extend the pull.","Stop rules include pain, neurologic or cardiopulmonary symptoms, unsafe grip, unstable support or anchor, uncontrolled implement path, repeated trunk or shoulder compensation, range loss, or unsafe pickup and set-down."]},
    {"sectionKey":"programming","sourceUrl":"https://www.nsca.com/contentassets/8323553f698a466a98220b21d9eb9a65/foundationsoffitnessprogramming_201508.pdf","sourceTitle":"Foundations of Fitness Programming","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["NSCA places dumbbell row and bent-over row in a horizontal-pull progression and treats sets, repetitions, load, and rest as outcome-dependent variables.","Selection and substitution must recompute support, implement, grip, side dose, fatigue, duration, equipment, lane, and rendered instructions."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/","sourceTitle":"Single-arm Row","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":78,"claims":["The direct guide uses a stable supported setup, brace, trunkward pull, and controlled return.","Athlete rendering adds exact side, contacts, implement, handle, target, range, tempo, repetitions, rest, reserve, self-checks, stop signal, side switch, and safe set-down."]},
    {"sectionKey":"coach_support","sourceUrl":"https://doi.org/10.1519/SSC.0000000000000751","sourceTitle":"Exercise Technique: The Landmine Row","sourcePublisher":"Strength and Conditioning Journal","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Landmine resistance follows a constrained arc around a secured pivot and varies with bar angle and load placement.","Coach support verifies anchor, collar, attachment, plates, stance orientation, support pressure, trunk and pelvis, shoulder and elbow path, range, eccentric, both sides, fatigue, and set-down."]},
    {"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/education/tsac-report/tsac-report-74.pdf","sourceTitle":"On-Duty Strength and Conditioning Programming Considerations for Police Officers","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":80,"claims":["NSCA material lists single-arm dumbbell rows among unilateral-biased pulling options and emphasizes individualized exercise selection based on history, experience, and technical ability.","Accessible delivery can reduce load or range, add stable hand or knee support, elevate the implement, change grip or handle, use written or still-frame cues, or substitute another reviewed horizontal pull."]},
    {"sectionKey":"alternates","sourceUrl":"https://www.onnit.com/blogs/the-edge/3-killer-chest-back-workouts-for-building-muscle","sourceTitle":"3 Killer Chest and Back Workouts for Building Muscle","sourcePublisher":"Onnit Academy","sourceKind":"expert_instruction","evidenceQuality":72,"claims":["The direct suitcase-row guide uses one hand, a secured landmine, both feet on one side of the bar, a hip hinge, trunk brace, and controlled row.","Support, stance orientation, implement, and grip can be variants; bilateral T-bar, Meadows, Gorilla, cable, suspension, renegade, rotational, isometric, and compound rows retain separate identities."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five title and channel candidates have current oEmbed health only; playback, exact identity and variant, captions, safety, accessibility, quality, reviewer identity, and approval remain unresolved."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"videoId":"KRN38chlkds","title":"How To: Dumbbell Single-Arm Row (On Bench)","channel":"ScottHermanFitness","query":"bench supported one arm dumbbell row"},
    {"videoId":"k2kVniB5eQI","title":"RP 1-Arm Dumbbell Row","channel":"Renaissance Periodization","query":"one arm dumbbell row"},
    {"videoId":"zvATS076NVA","title":"Bent Over One Arm Kettlebell Row","channel":"Movement As Medicine","query":"bent over one arm kettlebell row"},
    {"videoId":"TKmtHtY7yNo","title":"Single Arm Landmine Rows | SFS Exercise Library","channel":"SET FOR SET","query":"single arm landmine row"},
    {"videoId":"2bjH8LMo6DM","title":"Landmine Row Variations (KNOW THE DIFFERENCE!)","channel":"Andrew Kwong (DeltaBolic)","query":"landmine single arm and T bar row differences"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"name":"Three-Point Supported One-Arm Dumbbell Row","class":"new_variant","why":"One hand on a bench with both feet on the floor changes support contacts and trunk demand while preserving a braced unilateral pull.","dimensions":{"support":"one_hand_on_bench","stance":"split_or_square"}},
    {"name":"Unsupported Split-Stance One-Arm Dumbbell Row","class":"new_variant","why":"Removing external hand or knee support materially raises hinge and anti-rotation demand without changing the unilateral row action.","dimensions":{"support":"none","stance":"split_stance_hinge"}},
    {"name":"One-Arm Chest-Supported Row","class":"new_definition","why":"Torso support on an inclined bench changes body orientation, setup, range, load tolerance, and failure response and already has a stable neighboring identity.","dimensions":{"torsoSupport":"incline_bench"}},
    {"name":"Kroc Row","class":"new_variant","why":"Deliberately permitted leg and torso contribution, heavier loading, and high-repetition intent require a separate exact variant and cannot be silently substituted for the strict card.","dimensions":{"trunkMotion":"declared_controlled_contribution","intent":"heavy_high_repetition"}},
    {"name":"Towel, Fat-Grip, or Strap-Assisted Grip","class":"modifier_annotation","why":"Grip interface changes hand and forearm demand and safety but not the row identity when support and pull path are unchanged.","dimensions":{"gripInterface":"declared","strapPolicy":"declared"}},
    {"name":"Pause, Tempo, and Range-Limited One-Arm Row","class":"modifier_annotation","why":"Pause, eccentric duration, and pain-free range are dosage controls rather than new identities.","dimensions":{"tempo":"declared","pause":"declared","range":"declared"}},
    {"name":"Single-Arm Cable Row","class":"new_definition","why":"An anchored cable supplies a different resistance vector and support setup and may be upright rather than hinge-supported.","dimensions":{"implement":"cable","anchor":"declared"}},
    {"name":"TRX Single-Arm Row","class":"new_definition","why":"Suspended bodyweight resistance reverses what moves, adds body-angle leverage, and changes support and failure behavior.","dimensions":{"implement":"suspension_trainer","resistance":"bodyweight_leverage"}},
    {"name":"Renegade Row","class":"new_definition","why":"A high plank with contralateral hand and both feet as required supports adds a closed-chain anti-rotation task.","dimensions":{"base":"high_plank","support":"hand_and_feet"}},
    {"name":"Rear-Delt Row","class":"new_definition","why":"A deliberately flared elbow and horizontal-abduction bias changes the shoulder path and target emphasis.","dimensions":{"elbowPath":"flared","shoulderAction":"horizontal_abduction_bias"}},
    {"name":"Landmine Rotational Row","class":"new_definition","why":"Deliberate trunk and hip rotation is the training objective rather than a fault to constrain.","dimensions":{"rotation":"required","barPath":"rotational_arc"}},
    {"name":"Bilateral T-Bar, Meadows, Gorilla, Isometric, and Hinge-to-Row Exercises","class":"new_definition","why":"Hand count, staggered sleeve setup, alternating dual-load sequence, contraction mode, or added hip-hinge cycle changes the repetition contract.","dimensions":{"identityBoundary":"hand_count_support_action_order_or_contraction_mode"}}
  ]
  $json$::JSONB;
BEGIN
  -- Source IDs and controlled keys survive bootstrap history; UUIDs do not.
  SELECT id INTO canonical_id FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=195;
  SELECT id INTO meadows_target_id FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug='meadows-row';
  SELECT id INTO two_hand_target_id FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug='two-hand-landmine-bent-over-row';
  SELECT id INTO db_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='baseline';
  SELECT id INTO kb_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-496-baseline';
  SELECT id INTO landmine_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-1436-baseline';
  SELECT id INTO suitcase_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-1436-legacy-source-1438-baseline';
  SELECT id INTO moved_meadows_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-1436-legacy-source-1434-baseline';
  SELECT id INTO moved_tbar_v_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-1436-legacy-source-1435-baseline';
  SELECT id INTO moved_tbar_neutral_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-1436-legacy-source-1450-baseline';
  SELECT id INTO invalid_gorilla_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-1436-legacy-source-1441-baseline';
  SELECT id INTO invalid_ball_grip_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='legacy-source-1436-legacy-source-1448-baseline';
  SELECT id INTO invalid_gorilla_definition_id FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=1441;
  SELECT id INTO invalid_ball_grip_definition_id FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=1448;
  active_variant_ids:=ARRAY[db_variant,kb_variant,landmine_variant,suitcase_variant];
  all_variant_ids:=ARRAY[db_variant,kb_variant,landmine_variant,suitcase_variant,moved_meadows_variant,moved_tbar_v_variant,moved_tbar_neutral_variant,invalid_gorilla_variant,invalid_ball_grip_variant];
  SELECT array_agg(id ORDER BY legacy_exercise_id) INTO archived_definition_ids FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=ANY(involved_source_ids) AND legacy_exercise_id<>195;

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(archived_definition_ids||ARRAY[canonical_id,meadows_target_id,two_hand_target_id]))
      <>cardinality(archived_definition_ids)+3
    OR (SELECT count(*) FROM coaching.exercise_variant_v1 WHERE id=ANY(all_variant_ids))<>cardinality(all_variant_ids)
    OR (SELECT count(*) FROM coaching.exercise WHERE id=ANY(involved_source_ids))<>cardinality(involved_source_ids) THEN
    RAISE EXCEPTION '% requires the protected definitions, variants, and legacy rows',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ANY(archived_definition_ids||ARRAY[canonical_id,meadows_target_id,two_hand_target_id])
        AND (status='published' OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND NOT (card_version=1 OR
        (card_version=2 AND provenance_json->>'oneArmRowCompletionMigration'=migration_key)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE reviewed_by IS NOT NULL AND
        (survivor_definition_id=ANY(archived_definition_ids||ARRAY[canonical_id,meadows_target_id,two_hand_target_id])
          OR resolved_definition_id=ANY(archived_definition_ids||ARRAY[canonical_id,meadows_target_id,two_hand_target_id])))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_variant_ids) AND reviewed_by IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_variant_ids) OR to_variant_id=ANY(all_variant_ids))
        AND reviewed_by IS NOT NULL) THEN
    RAISE EXCEPTION '% refuses to overwrite human-reviewed or approved row state',migration_key;
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
        'oneArmRowCompletionMigration',migration_key,
        'correctedIdentity','strict_unilateral_row','humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(canonical_source_ids);

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id=meadows_target_id,source_kind='duplicate_consolidation',
      provenance_json=provenance_json||jsonb_build_object(
        'oneArmRowCompletionMigration',migration_key,
        'correctedFromDefinitionId',canonical_id,
        'correctedIdentity','meadows_row','humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=1434;

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id=two_hand_target_id,source_kind='duplicate_consolidation',
      provenance_json=provenance_json||jsonb_build_object(
        'oneArmRowCompletionMigration',migration_key,
        'correctedFromDefinitionId',canonical_id,
        'correctedIdentity','bilateral_landmine_t_bar_row','humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(ARRAY[1435,1450]::BIGINT[]);

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id=invalid_gorilla_definition_id,source_kind='legacy_migration',
      provenance_json=provenance_json||jsonb_build_object(
        'oneArmRowCompletionMigration',migration_key,
        'quarantineReason','source_claims_alternating_row_but_declares_one_fixed_landmine_and_double_handle_without_executable_hand_or_load_sequence',
        'selectable',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=1441;

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id=invalid_ball_grip_definition_id,source_kind='legacy_migration',
      provenance_json=provenance_json||jsonb_build_object(
        'oneArmRowCompletionMigration',migration_key,
        'quarantineReason','source_does_not_declare_hand_count_support_orientation_or_attachment_geometry',
        'selectable',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=1448;

  UPDATE coaching.exercise_definition_v1
  SET canonical_name='One-Arm Row',display_name='One-Arm Row',slug='one-arm-dumbbell-row',
    aliases=(SELECT array_agg(DISTINCT alias ORDER BY alias)
      FROM unnest(aliases||ARRAY['One-Arm Row','One Arm Row','One-Arm Dumbbell Row','One Arm Dumbbell Row','One-Arm Kettlebell Row','One Arm Kettlebell Row','One-Arm Landmine Row','One Arm Landmine Row','Landmine Suitcase Row']) alias
      WHERE alias !~* '(meadows|gorilla|ball.?grip|t.?bar)'),
    description='A unilateral external-load horizontal pull performed from an exact supported or hinge-held base. The working shoulder and elbow draw the declared implement toward a declared trunk or hip target while the pelvis and spine remain within the variant movement policy, followed by a controlled return and safe side change.',
    card_version=2,status='review',family_key='horizontal_pull',
    movement_patterns=ARRAY['pull','brace','hinge'],
    body_regions=ARRAY['hand','wrist','elbow','shoulder','scapula','rib_cage','core','spine','thoracic_spine','pelvis','hip','knee','glutes','hamstrings'],
    required_equipment=ARRAY['open_space'],
    optional_equipment=ARRAY['dumbbell','kettlebell','bench','landmine','barbell','plates','handle_grip_attachment'],
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('latissimus_dorsi','middle_trapezius','rhomboids','posterior_deltoid','teres_major'),
      'secondaryMuscles',jsonb_build_array('lower_trapezius','biceps_brachii','brachialis','brachioradialis','rotator_cuff','forearm_flexors','spinal_erectors','external_oblique','internal_oblique','transversus_abdominis','gluteus_maximus','hamstrings'),
      'joints',jsonb_build_array('glenohumeral','scapulothoracic','elbow','radioulnar','wrist','thoracic_spine','lumbar_spine','hip','knee'),
      'jointActions',jsonb_build_array('shoulder_extension','scapular_retraction_with_declared_controlled_excursion','elbow_flexion','forearm_and_wrist_isometric_grip','anti_rotation','anti_lateral_flexion','spinal_isometric_extension','hip_hinge_isometric','knee_isometric_support'),
      'planes',jsonb_build_array('sagittal','transverse','frontal'),
      'laterality','unilateral',
      'lateralityDetail',jsonb_build_object('workingSide','declared','dose','equal_repetitions_and_exposure_per_side_unless_documented_clinical_exception','stanceAndSupportSide','variant_declared')),
    environment_json=jsonb_build_object(
      'surface','level_non_slip_load_tolerant','clearance',jsonb_build_array('implement_path','plate_and_sleeve_arc','bench_and_hand_support','pickup_and_set_down_zone','coach_sightline'),
      'benchPolicy','Stable, load-rated, non-sliding bench with clear hand and knee placement when required.',
      'landminePolicy','Purpose-built secured pivot, intact bar and collar, retained plates and attachment, tested empty-bar arc, and no body part in the pinch or drop zone.',
      'groupPolicy','One active athlete per marked row and set-down lane; no one crosses behind the load or landmine arc.'),
    population_json=jsonb_build_object(
      'screen',jsonb_build_array('shoulder_elbow_wrist_hand_or_grip_symptoms','neck_thoracic_or_low_back_symptoms','hip_knee_or_balance_limits_for_hinge_base','recent_surgery_or_unhealed_tissue','neurologic_cardiopulmonary_or_pressure_symptoms','pregnancy_or_postpartum_position_breathing_balance_or_pressure_tolerance'),
      'modify',jsonb_build_array('reduce_load_or_range','add_or_raise_stable_support','use_neutral_or_larger_handle','elevate_pickup_height','increase_rest','use_simpler_reviewed_horizontal_pull'),
      'exclude',jsonb_build_array('unsafe_or_unstable_support_anchor_attachment_or_floor','cannot_control_pickup_set_down_or_grip','pain_or_neurologic_symptom','cannot_maintain_variant_trunk_pelvis_or_should_path','medical_restriction_not_cleared')),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','Builds unilateral upper-back and arm pulling capacity while teaching the trunk and pelvis to resist unwanted motion and exposing side-to-side differences.',
      'primaryCue','Set the support and brace first; draw the working elbow toward the assigned target, then lower the implement without twisting or dropping.',
      'expectedSensations',jsonb_build_array('working-side_lat_and_upper_back_effort','elbow_flexor_and_grip_effort','abdominal_and_hip_bracing','support_pressure_without_joint_pain'),
      'unexpectedSensations',jsonb_build_array('sharp_shoulder_elbow_wrist_hand_neck_or_back_pain','numbness_or_tingling','joint_pinching','dizziness_or_breathing_or_pressure_symptom','grip_slip_or_uncontrolled_load'),
      'painGuidance','Stop the repetition and tell the coach immediately for pain, neurologic symptoms, dizziness, breathing or pressure symptoms, grip loss, or equipment movement; do not push through or self-diagnose.',
      'beforeYouStart',jsonb_build_array('Confirm exact variant, implement, load, handle, support contacts, stance, working side, pull target, range, tempo, repetitions, rest, reserve, and stop signal.','Test the bench or landmine, clear the lane, rehearse pickup and set-down, and perform one light repetition on each side.'),
      'selfChecks',jsonb_build_array('Support stays secure and pressure is comfortable.','Trunk and pelvis stay inside the assigned movement policy.','Wrist stays owned and the implement follows the assigned path.','The working shoulder does not dump forward or shrug to create range.','Both sides receive the assigned valid dose.'),
      'stopAndTellCoach',jsonb_build_array('pain','numbness_or_tingling','dizziness_or_breathing_or_pressure_symptom','grip_slip','support_anchor_attachment_or_plate_shift','uncontrolled_path_or_set_down','repeated_trunk_pelvis_or_shoulder_fault'),
      'accessibility',jsonb_build_array('written_steps','still_frames','front_oblique_and_side_view','captioned_video_after_review','stable_support_option','lighter_load_and_shorter_range','larger_or_neutral_handle'),
      'mediaAlternatives',jsonb_build_array('written_step_sequence','setup_and_finish_still_frames','coach_demonstration_from_front_oblique_and_side','tactile_cue_only_with_consent_and_policy')),
    coach_support_json=jsonb_build_object(
      'setupChecklist',jsonb_build_array('Verify variant, implement, load, attachment, collar, support contacts, stance, side order, target, range, tempo, dose, rest, reserve, and stop rule.','Inspect bench, floor, landmine anchor, bar, sleeve, plates, handle, grip surface, lane, pickup and set-down.','Review cumulative pulling, grip, shoulder, trunk, hinge, and low-back fatigue and recovery.'),
      'observationChecklist',jsonb_build_array('support_pressure_and_stability','foot_knee_hip_pelvis_and_spine','working_shoulder_and_scapula','elbow_and_wrist_path','implement_target_and_range','eccentric_and_bottom_control','breathing_and_brace','both_sides','pickup_set_down_and_exit'),
      'faultCorrections',jsonb_build_object('support_or_anchor_shift','stop_and_rebuild_or_substitute','trunk_rotation_or_side_bend','reduce_load_or_range_and_restore_brace','shrug_or_anterior_shoulder_dump','reduce_range_and_recue_scapular_control','grip_or_wrist_change','reduce_load_or_change_reviewed_handle','eccentric_drop','reduce_load_and_reestablish_control'),
      'demonstrationPlan',jsonb_build_array('show_exact_variant_setup_support_stance_side_and_handle','show_one_valid_repetition_from_front_oblique_and_side','contrast_trunk_rotation_shrug_and_dropped_eccentric_faults','show_side_change_and_safe_set_down'),
      'groupManagement',jsonb_build_object('athletesPerStation',1,'traffic','keep all people outside the load, sleeve, plate, bench, pickup, and set-down lane','recording','record exact variant, side, support, implement, load, handle, valid and failed repetitions, range, tempo, reserve, faults, symptoms, duration, and substitution'),
      'modificationDecisionTree',jsonb_build_array('stop_for_symptom_or_equipment_risk','stabilize_support_anchor_and_lane','reduce_load_or_range','restore_brace_and_pull_path','change_to_reviewed_handle_or_support','substitute_and_revalidate'),
      'doNotUseWhen',jsonb_build_array('pain_or_neurologic_or_cardiopulmonary_symptom','unsafe_bench_anchor_attachment_plate_floor_or_clearance','uncontrolled_grip_pickup_or_set_down','cannot_hold_required_support_hinge_or_trunk_policy','medical_restriction_not_cleared')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_variant_or_side_mismatch','bench_anchor_attachment_plate_or_equipment_problem','load_grip_range_tempo_or_dose_mismatch','fatigue_recovery_duration_or_space_mismatch','symptom_or_control_event','media_caption_or_accessibility_issue','rendering_validation_or_persistence_issue'),
      'supportEscalation',jsonb_build_object('immediate',jsonb_build_array('pain','neurologic_or_cardiopulmonary_symptom','grip_loss_or_dropped_load','support_anchor_attachment_or_plate_failure','collision_or_uncontrolled_set_down'),'coachReview',jsonb_build_array('repeated_path_brace_or_side_failure','load_support_or_handle_change','fatigue_or_recovery_conflict','substitution_request'),'contentReview',jsonb_build_array('identity_or_variant_confusion','legacy_landmine_gorilla_or_ball_grip_source_claim','media_mismatch','caption_or_accessibility_gap')),
      'retentionPolicy',jsonb_build_object('store',jsonb_build_array('definition_id','variant_id','profile_key','support','implement','load','handle','side','sets','repetitions','range','tempo','rest','reserve','valid_and_failed_repetitions','faults','symptoms','duration','substitution','rendered_instructions'),'preserveHumanReviewHistory',TRUE,'neverOverwriteApprovedReview',TRUE),
      'changeImpactPolicy',jsonb_build_object('onVariantSupportImplementLoadHandleSideRangeTempoDoseRestOrProfileChange',jsonb_build_array('revalidate_selection','recompute_load_fatigue_and_recovery','recompute_duration','recheck_equipment_space_and_traffic','rerender_coach_and_athlete_instructions','persist_new_validation'),'neverSilent',TRUE),
      'legacyQuarantine',jsonb_build_object('landmineGorillaRow','archived_internal_contradiction','landmineBallGripRow','archived_missing_hand_count_support_and_attachment_geometry')),
    provenance_json=provenance_json||jsonb_build_object(
      'oneArmRowCompletionMigration',migration_key,'canonicalResearchVersion',research_version,
      'identityCorrection',jsonb_build_object('retainedLegacyIds',canonical_source_ids,'meadowsRemappedTo',meadows_target_id,'bilateralTBarRemappedTo',two_hand_target_id,'invalidLegacyIds',jsonb_build_array(1441,1448)),
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'overallDifficultyFormula','max(exercise_complexity,physical_difficulty)',
      'directResearchBoundary','Direct technique sources support movement identity and candidate execution; PMID 19620925 studies other row variants and is adjacent, not direct One-Arm Dumbbell or Landmine Row validation.',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,updated_at=now()
  WHERE id=canonical_id;

  UPDATE coaching.exercise_definition_v1
  SET aliases=(SELECT array_agg(DISTINCT alias ORDER BY alias)
      FROM unnest(aliases||ARRAY['Landmine Meadows Row','Landmine Meadows Rows']) alias),
      provenance_json=provenance_json||jsonb_build_object(
        'oneArmRowCompletionMigration',migration_key,'correctedLegacySourceId',1434,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=meadows_target_id;

  UPDATE coaching.exercise_definition_v1
  SET aliases=(SELECT array_agg(DISTINCT alias ORDER BY alias)
      FROM unnest(aliases||ARRAY['Landmine T-Bar Row with V-Handle','Landmine T Bar Row with V Handle','Landmine Neutral-Handle T-Bar Row','Landmine Neutral Handle T Bar Row']) alias),
      provenance_json=provenance_json||jsonb_build_object(
        'oneArmRowCompletionMigration',migration_key,'correctedLegacySourceIds',jsonb_build_array(1435,1450),
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=two_hand_target_id;

  UPDATE coaching.exercise_definition_v1
  SET status='archived',provenance_json=provenance_json||jsonb_build_object(
      'oneArmRowCompletionMigration',migration_key,'consolidatedIntoDefinitionId',
      CASE legacy_exercise_id WHEN 496 THEN canonical_id WHEN 1434 THEN meadows_target_id
        WHEN 1435 THEN two_hand_target_id WHEN 1436 THEN canonical_id WHEN 1438 THEN canonical_id
        WHEN 1450 THEN two_hand_target_id ELSE NULL END,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=ANY(archived_definition_ids)
    AND legacy_exercise_id NOT IN (1441,1448);

  UPDATE coaching.exercise_definition_v1
  SET status='archived',provenance_json=provenance_json||jsonb_build_object(
      'oneArmRowCompletionMigration',migration_key,'invalidLegacyCard',TRUE,'selectable',FALSE,
      'quarantineReason',CASE legacy_exercise_id WHEN 1441 THEN
        'alternating row claim conflicts with a single fixed landmine and double-handle description; executable hand and load sequence is absent'
        ELSE 'hand count, support orientation, and ball-grip attachment geometry are absent' END,
      'requiredHumanEvidence',CASE legacy_exercise_id WHEN 1441 THEN
        jsonb_build_array('original_authoritative_demo_or_specification','implement_count','hand_sequence','handle_geometry','support_and_repetition_boundary')
        ELSE jsonb_build_array('original_authoritative_demo_or_specification','hand_count','support','stance_orientation','attachment_geometry','repetition_boundary') END,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=ANY(ARRAY[invalid_gorilla_definition_id,invalid_ball_grip_definition_id]);

  UPDATE coaching.exercise_variant_v1 variant SET
    definition_id=canonical_id,variant_key=spec.variant_key,display_name=spec.display_name,
    modifier_keys=spec.modifier_keys,
    difficulty_json=jsonb_build_object(
      'technicalComplexity',spec.technical,'absoluteLoadDemand',spec.physical,
      'physicalDifficulty',spec.physical,'coordinationDemand',spec.coordination,
      'supervisionDemand',spec.supervision,'failureConsequence',spec.failure,
      'impact',1,'athleteLandingImpact',0,'workCapacityDemand',spec.work_capacity,
      'baseOverallDifficulty',GREATEST(spec.technical,spec.physical),
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'overallFormula','max(exercise_complexity,physical_difficulty)'),
    requirements_json=jsonb_build_object(
      'selectable',TRUE,'implement',spec.implement,'support',spec.support,'stance',spec.stance,
      'orientation',spec.orientation,'workingSide','declared','sideDose','equal_valid_repetitions_per_side',
      'gripAndHandle','declared_and_pain_free','pullTarget',spec.pull_target,
      'trunkPolicy',spec.trunk_policy,'scapularPolicy','controlled_excursion_without_shrug_or_anterior_dump',
      'range','owned_range_without_support_shift_or_compensation','eccentric','controlled_to_declared_bottom',
      'pickupAndSetDown','declared_rehearsed_and_controlled','surface','level_non_slip_load_tolerant',
      'invalid',jsonb_build_array('wrong_variant_implement_support_side_handle_target_or_sequence','support_anchor_attachment_plate_or_grip_shift','pain_or_neurologic_symptom','unplanned_trunk_rotation_side_bend_or_spinal_motion','shoulder_dump_shrug_or_elbow_path_change','range_or_eccentric_control_loss','failed_side_balance','unsafe_pickup_set_down_or_lane')),
    load_profile_json=jsonb_build_object(
      'loadingType','external_resistance','externalLoadMethod','fixed_external','implement',spec.implement,
      'externalLoadRecorded',TRUE,'gripDemand',spec.grip,'spinalLoading',spec.spinal,
      'eccentricStress',spec.eccentric,'landingContactsPerRep',0,'athleteLandingImpact',0,
      'primaryStress',jsonb_build_array('unilateral_horizontal_pull','shoulder_and_scapular_control','elbow_flexion','grip','trunk_and_pelvis_stabilization','support_or_hinge_endurance'),
      'loadAccounting',jsonb_build_object('recordImplementMassAndAttachment',TRUE,'recordSupportStanceAndOrientation',TRUE,'recordWorkingSide',TRUE,'recordValidAndFailedRepetitionsPerSide',TRUE,'recordRangeTempoRestAndReserve',TRUE,'recordPickupSetDownAndStraps',TRUE)),
    fatigue_profile_json=jsonb_build_object(
      'localMuscleFatigue',spec.local_fatigue,'gripFatigue',spec.grip,
      'technicalFatigueSensitivity',spec.technical_fatigue,'impactAccumulation',1,'athleteLandingImpact',0,
      'recoveryHours',spec.recovery_hours,
      'qualityLossSignals',jsonb_build_array('grip_or_wrist_change','shortened_or_shifted_path','shrug_or_anterior_shoulder_dump','trunk_rotation_side_bend_or_spine_change','support_pressure_or_stance_shift','eccentric_drop','side_asymmetry','unsafe_pickup_or_set_down'),
      'cumulativeRules',jsonb_build_array('count_valid_and_failed_repetitions_for_each_side','include_implement_mass_support_handle_range_tempo_and_reserve','include_same_session_rows_pulls_carries_hangs_grip_hinges_and_low_back_loading','include_pickup_set_down_and_landmine_setup_effort','increase_recovery_after_high_load_high_volume_grip_loss_or_trunk_fatigue')),
    programming_profile_json=jsonb_build_object(
      'preferredBlock','capacity_or_resilience_after_priority_speed_power_and_high_skill_work',
      'primaryObjectives',jsonb_build_array('unilateral_horizontal_pull_strength','left_right_exposure_balance','upper_back_and_lat_capacity','grip_capacity','trunk_control'),
      'trainingStimuli',jsonb_build_array('unilateral_horizontal_pull','upper_back_and_lat_strength','elbow_flexor_and_grip_capacity','anti_rotation_and_hinge_control'),
      'stimulusDose',jsonb_build_object('unit','valid_repetitions_per_side','load','declared_external_load','range','owned','effort','submaximal_with_declared_reserve','sideBalance','required'),
      'cumulativeFatigueBudget','sum valid and failed repetitions per side, implement mass, support and hinge demand, range, tempo, reserve, grip, pickup and set-down, overlapping pulls carries hangs and hinges, symptoms, and recovery',
      'impactBudget','zero athlete landing contacts and no planned external impact',
      'weeklyExposure',jsonb_build_object('frequency','individualized_from_goal_load_volume_side_balance_grip_trunk_fatigue_symptoms_and_recovery','minimumRecoveryHours',spec.recovery_hours),
      'prerequisites',jsonb_build_array('exact_variant_equipment_and_lane_available','safe_pickup_and_set_down_rehearsed','pain_free_owned_range','support_or_hinge_base_is_repeatable','light_repetition_each_side_meets_quality_gate'),
      'completionCriteria',jsonb_build_array('assigned_valid_repetitions_completed_each_side','reserve_and_quality_threshold_maintained','no_stop_rule_triggered','load_and_set_down_controlled','actual_duration_and_faults_recorded'),
      'sequenceRules',jsonb_build_array('verify_support_implement_side_handle_target_and_set_down','perform_after_priority_output_when_strength_or_capacity_is_the_goal','balance_valid_side_dose','stop_before_grip_path_brace_or_support_changes_repeat'),
      'pairingCompatibility',jsonb_build_array('reviewed_upper_body_push','low_fatigue_mobility_or_breathing_during_rest'),
      'interferenceRules',jsonb_build_array('do_not_pre_fatigue_grip_upper_back_or_hinge_before_priority_pull','do_not_convert_strength_profile_to_unbounded_conditioning','recompute_load_fatigue_recovery_duration_equipment_space_and_rendering_after_substitution'),
      'uncertaintyPolicy',jsonb_build_object('unknownIdentitySupportHandleLoadRangePainOrRecovery','fail_closed_and_request_coach_review','neverInferMissingLegacyMechanics',TRUE,'neverAutoApproveMediaGraphCalibrationOrPublication',TRUE)),
    status='review',updated_at=now()
  FROM (VALUES
    (db_variant,'bench-supported-dumbbell','One-Arm Row — Bench-Supported Dumbbell',ARRAY['dumbbell','bench_supported']::TEXT[],42,48,46,40,34,48,'dumbbell','contralateral_hand_and_knee_on_bench','bench_supported_tripod','parallel_to_bench','hip_or_lower_rib','strict_no_deliberate_rotation',46,30,24,48,58,30),
    (kb_variant,'hinged-kettlebell','One-Arm Row — Hinged Kettlebell',ARRAY['kettlebell','unsupported_hinge']::TEXT[],48,52,54,44,40,54,'kettlebell','no_external_support','bilateral_hinge','free_space','hip_or_lower_rib','strict_no_deliberate_rotation',52,34,28,54,64,36),
    (landmine_variant,'one-arm-landmine','One-Arm Row — Landmine',ARRAY['landmine','fixed_arc','one_arm']::TEXT[],52,58,58,50,48,58,'landmine_barbell','none_or_declared_nonworking_hand_support','staggered_hinge','beside_or_in_line_with_bar_as_declared','hip_or_lower_rib_along_bar_arc','strict_no_deliberate_rotation',56,38,30,58,68,36),
    (suitcase_variant,'landmine-suitcase','One-Arm Row — Landmine Suitcase',ARRAY['landmine','suitcase_handle','one_arm']::TEXT[],56,60,62,52,50,60,'landmine_barbell_with_single_handle','none','both_feet_on_one_side_of_bar_hinge','behind_loaded_end_with_body_on_declared_side','mid_torso_along_bar_arc','strict_anti_rotation_and_anti_lateral_flexion',60,42,32,62,72,36)
  ) AS spec(id,variant_key,display_name,modifier_keys,technical,physical,
    coordination,supervision,failure,work_capacity,implement,support,stance,
    orientation,pull_target,trunk_policy,grip,spinal,eccentric,local_fatigue,
    technical_fatigue,recovery_hours)
  WHERE variant.id=spec.id;

  UPDATE coaching.exercise_variant_v1 SET definition_id=meadows_target_id,status='archived',
    requirements_json=jsonb_build_object('selectable',FALSE,'archiveReason','legacy_landmine_meadows_source_remapped_to_existing_meadows_row_identity','preservedLegacySource',TRUE,'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object('selectable',FALSE,'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=moved_meadows_variant;

  UPDATE coaching.exercise_variant_v1 SET definition_id=two_hand_target_id,status='archived',
    requirements_json=jsonb_build_object('selectable',FALSE,'archiveReason','bilateral_t_bar_source_remapped_to_existing_two_hand_landmine_bent_over_row_identity','preservedLegacySource',TRUE,'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object('selectable',FALSE,'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=ANY(ARRAY[moved_tbar_v_variant,moved_tbar_neutral_variant]);

  UPDATE coaching.exercise_variant_v1 SET definition_id=invalid_gorilla_definition_id,status='archived',
    requirements_json=jsonb_build_object('selectable',FALSE,'archiveReason','internally_inconsistent_landmine_gorilla_source_requires_original_authoritative_specification','preservedLegacySource',TRUE,'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object('selectable',FALSE,'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=invalid_gorilla_variant;

  UPDATE coaching.exercise_variant_v1 SET definition_id=invalid_ball_grip_definition_id,status='archived',
    requirements_json=jsonb_build_object('selectable',FALSE,'archiveReason','ball_grip_source_lacks_hand_count_support_orientation_and_attachment_geometry','preservedLegacySource',TRUE,'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object('selectable',FALSE,'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=invalid_ball_grip_variant;

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT variant.id,profile.profile_key,profile.phase_key,profile.role,
    profile.purpose,profile.suitability,profile.alignment,
    jsonb_build_object('unilateralPullStrength',profile.strength,'upperBackAndLatCapacity',5,
      'gripCapacity',profile.grip,'trunkControl',5,'athleteLandingImpact',0),
    jsonb_build_object('doseType','repetitions_per_side','sets',profile.sets,
      'repetitionsPerSide',profile.repetitions,'startSide','declared_and_rotated_between_sets',
      'load','declared','range','owned','tempo',profile.tempo,'reserveRepetitions',profile.reserve,
      'restSeconds',profile.rest_seconds,'sideRestSeconds',20,
      'qualityThreshold','end_before_grip_support_path_range_brace_or_eccentric_materially_changes'),
    'Every counted repetition uses the exact support, stance, implement, load, handle, working side, pull target, range, tempo, and trunk policy; keeps support and equipment stable; controls shoulder, elbow, wrist, pelvis, spine, and return; and finishes with a safe set-down and balanced side dose.',
    ARRAY['pain_or_neurologic_symptom','dizziness_breathing_or_pressure_symptom','wrong_variant_implement_load_handle_support_side_or_target','bench_landmine_anchor_attachment_collar_plate_or_floor_shift','grip_or_wrist_control_loss','repeated_trunk_pelvis_or_spine_compensation','shoulder_dump_shrug_or_elbow_path_change','range_or_eccentric_control_loss','side_dose_cannot_be_balanced','unsafe_pickup_set_down_lane_or_traffic','reserve_or_effort_ceiling_exceeded'],
    ARRAY['Verify exact support, stance, implement, load, handle, side order, target, range, tempo, dose, rest, reserve, and stop command.','Observe bench or landmine stability, trunk and pelvis, working shoulder, elbow and wrist path, implement target, range, eccentric, breath, and both sides.','Count valid and failed repetitions separately for each side.','End the set before grip, path, brace, support, range, eccentric, or set-down quality changes.'],
    ARRAY['Set the support and your body before touching the load.','Brace, then draw the elbow and implement toward the assigned target.','Keep the wrist owned and the shoulder away from the ear.','Lower through the assigned range without dropping or twisting.','Finish both sides and set the load down under control.'],
    CASE profile.phase_key WHEN 'capacity' THEN
      'Improved unilateral horizontal pulling strength, upper-back and lat capacity, grip, and repeatable side-balanced loading.'
      ELSE 'Improved controlled pulling tolerance, scapular coordination, grip ownership, and trunk stability at a submaximal dose.' END,
    CASE variant.id
      WHEN db_variant THEN ARRAY['dumbbell','bench','timer']::TEXT[]
      WHEN kb_variant THEN ARRAY['kettlebell','open_space','timer']::TEXT[]
      WHEN landmine_variant THEN ARRAY['landmine','barbell','plates','timer']::TEXT[]
      ELSE ARRAY['landmine','barbell','plates','handle_grip_attachment','timer']::TEXT[] END,
    jsonb_build_object('athletesPerStation',1,'setupSeconds',75,'transitionSeconds',45,
      'sideChangeSeconds',20,'support',variant.requirements_json->>'support',
      'equipmentCheck','bench_or_landmine_bar_attachment_collar_plates_handle_floor_and_clearance_as_applicable',
      'lane','marked_implement_pickup_set_down_bench_or_bar_arc_and_coach_sightline',
      'trafficRule','no_entry_into_load_bench_bar_plate_attachment_pickup_or_set_down_zone',
      'substitutionRevalidation',jsonb_build_array('identity','variant','support','stance','implement','load','handle','side_dose','range','tempo','reserve','fatigue','recovery','duration','equipment','space','population_constraints','rendering')),
    ARRAY[]::UUID[],'review',
    jsonb_build_object('setupSeconds',75,'secondsPerRepetition',profile.seconds_per_rep,
      'sideChangeSeconds',20,'transitionSeconds',45,'countBothSides',TRUE,
      'durationFormula','setup + sets * (repetitions_per_side * 2 * seconds_per_repetition + side_change + rest) + transition',
      'landmineAdjustmentSeconds','add_45_seconds_for_anchor_attachment_plate_and_collar_setup'),
    jsonb_build_object('reduce',jsonb_build_array('reduce_load','reduce_range','add_or_raise_stable_support','use_neutral_or_larger_handle','reduce_repetitions_per_side','increase_rest','slow_setup_and_set_down'),'increase',jsonb_build_array('increase_load_within_reserve','increase_owned_range','add_one_repetition_per_side','reduce_support_only_as_reviewed_variant','change_implement_only_as_reviewed_variant'),'revalidateAfterChange',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_id','variant_id','profile_key','support','stance','orientation','implement','load','handle','start_side','sets','repetitions_per_side','valid_and_failed_repetitions_per_side','range','tempo','rest','reserve','faults','symptoms','duration','substitution'),'validity','all exact variant, equipment, support, side, path, range, tempo, reserve, set-down, and quality gates pass'),
    jsonb_build_object('before','Which support, stance, implement, load, handle, side order, target, range, tempo, dose, rest, and reserve were assigned?','during','Are equipment, grip, support, trunk, shoulder, elbow, wrist, path, range, tempo, and both sides still valid?','after','Store each side, valid and failed repetitions, load, range, tempo, reserve, faults, symptoms, duration, set-down, and substitution.')
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN (VALUES
    ('capacity-strength','capacity','primary',4,6,120,72,90,5,4,'controlled','2','Build side-balanced unilateral pulling strength with complete rest and repeatable load path.',5),
    ('resilience-control','resilience','secondary',3,8,75,74,86,4,3,'3_second_eccentric','3','Build submaximal upper-back, grip, and trunk-control tolerance without technical failure.',4)
  ) profile(profile_key,phase_key,role,sets,repetitions,rest_seconds,
    suitability,alignment,strength,grip,tempo,reserve,purpose,seconds_per_rep)
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
    'Public YouTube oEmbed link, title, channel, and iframe health rechecked 2026-08-02. Full playback must verify exact One-Arm Row identity and variant, support, stance, implement, load, grip or handle, working side, pull target, range, torso policy, shoulder and elbow path, eccentric, pickup and set-down, cue safety, captions, accessibility, demonstration quality, and conflicts. No content verification, exact match, reviewer, or approval is inferred.'
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
    (db_variant,kb_variant,'equipment_equivalent',88,ARRAY['implement','support','stance','grip'],'Changing from bench-supported dumbbell to unsupported hinged kettlebell changes support, hinge endurance, grip geometry, and trunk demand despite the same unilateral pull.',$json$ {"revalidate":["support","hinge","implement","grip","load","range","side_dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (kb_variant,db_variant,'equipment_equivalent',88,ARRAY['implement','support','stance','grip'],'Bench-supported dumbbell delivery reduces hinge and base demand but changes support contacts, setup, and load path.',$json$ {"revalidate":["support","bench","implement","grip","load","range","side_dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (db_variant,landmine_variant,'lateral_substitution',82,ARRAY['implement','fixed_arc','support','setup'],'A fixed landmine arc and secured pivot replace the free dumbbell path and bench-supported base.',$json$ {"revalidate":["anchor","bar_arc","support","stance","handle","load","range","side_dose","space","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (landmine_variant,db_variant,'lateral_substitution',82,ARRAY['implement','fixed_arc','support','setup'],'A free dumbbell and bench support replace the landmine pivot, bar arc, plate clearance, and landmine setup.',$json$ {"revalidate":["bench","support","free_load_path","grip","load","range","side_dose","space","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (landmine_variant,suitcase_variant,'progression',80,ARRAY['stability','complexity'],'The suitcase setup places both feet on one side of the bar and adds declared anti-lateral-flexion and attachment-control demands.',$json$ {"changedDetails":["stance","orientation","handle","trunk_demand"],"requires":["landmine_anchor_and_arc_are_controlled","single_handle_is_secure","unsupported_hinge_is_repeatable"],"recompute":["difficulty","load","fatigue","duration","space","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (suitcase_variant,landmine_variant,'regression',80,ARRAY['stability','complexity'],'The standard one-arm landmine setup can reduce offset stance and handle-specific demand while preserving the fixed-arc unilateral pull.',$json$ {"changedDetails":["stance","orientation","handle","trunk_demand"],"useWhen":["suitcase_orientation_or_anti_lateral_flexion_exceeds_objective"],"recompute":["difficulty","load","fatigue","duration","space","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (kb_variant,landmine_variant,'lateral_substitution',76,ARRAY['implement','resistance_path','setup','space'],'The kettlebell has a free path while the landmine follows a fixed arc and requires anchor and plate clearance.',$json$ {"revalidate":["implement","anchor","resistance_path","stance","load","grip","range","side_dose","space","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (landmine_variant,kb_variant,'lateral_substitution',76,ARRAY['implement','resistance_path','setup','space'],'Replacing the fixed bar with a kettlebell removes the anchor and arc but changes grip, free-load control, pickup, set-down, and hinge demand.',$json$ {"revalidate":["implement","free_load_path","stance","load","grip","range","side_dose","space","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL)
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
  -- Only persist boundary rows whose referenced identities exist in this
  -- bootstrap. Historical UUID-only candidates remain represented in the
  -- alternate packet until an exact stable target can be resolved.
  SELECT boundary.facility_id,boundary.survivor_definition_id::UUID,
    boundary.resolved_definition_id::UUID,boundary.decision,boundary.rationale,
    boundary.evidence_json,boundary.resolution_source,boundary.reviewed_by::BIGINT
  FROM (VALUES
    (1,canonical_id,'d8aa1cc5-dbe4-44a1-86e4-69722e94e4b5','duplicate_consolidated','One-Arm Kettlebell Row preserves the same unilateral pull and differs by implement, grip, support, stance, load, range, and dose.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"same_unilateral_row_with_kettlebell_variant","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'03cbc1d9-dd25-4cec-9370-642019632c6c','duplicate_consolidated','One-Arm Landmine Row preserves a braced unilateral pull while the pivot creates a fixed resistance arc and equipment-specific setup.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"same_unilateral_row_with_fixed_arc_implement_variant","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'301a5fed-10f6-41e9-8daa-d7dca7f260d3','duplicate_consolidated','Landmine Suitcase Row remains a one-hand landmine row with exact offset stance, handle, orientation, and anti-lateral-flexion demands.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"same_unilateral_landmine_row_with_suitcase_orientation_variant","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,meadows_target_id,'b9401a1d-554b-4770-b63d-a0db215f95ad','duplicate_consolidated','Landmine Meadows Row is an alias/source duplicate of the existing stable Meadows Row identity, not a generic One-Arm Row variant.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"same_named_meadows_row_identity","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,two_hand_target_id,'46f2426b-281c-422a-969f-db314969be21','duplicate_consolidated','Landmine T-Bar Row with V-Handle is a bilateral fixed-arc bent-over row and belongs under Two-Hand Landmine Bent-Over Row.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"same_bilateral_landmine_row_with_v_handle_variant","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,two_hand_target_id,'77815cfd-2450-4cce-a1ac-ce898bce7a71','duplicate_consolidated','Landmine Neutral-Handle T-Bar Row is a bilateral fixed-arc bent-over row and belongs under Two-Hand Landmine Bent-Over Row.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"same_bilateral_landmine_row_with_neutral_handle_variant","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,meadows_target_id,'distinct_exercises','Meadows Row uses a named staggered perpendicular sleeve-grip landmine setup and remains its own stable identity; One-Arm Row uses the exact supported, hinged, or in-line variant contract declared on its card.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"generic_unilateral_row_vs_named_meadows_setup","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,two_hand_target_id,'distinct_exercises','Two-Hand Landmine Bent-Over Row requires bilateral hand contact and one shared repetition; One-Arm Row requires a declared working side and separately balanced side dose.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"bilateral_shared_repetition_vs_unilateral_side_dosed_row","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'89db97dc-d56d-4fe5-ae5d-ce2b4a5dd49d','distinct_exercises','Kettlebell Gorilla Row uses two independent implements with an alternating low-stance repetition sequence; One-Arm Row completes one declared side and uses one loaded implement.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"dual_implement_alternating_gorilla_sequence_vs_single_implement_unilateral_row","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'15fc5409-ccbc-4382-a17e-0a9dcaf9bd13','distinct_exercises','Chest-Supported Dumbbell Row requires the torso to rest on an inclined support and usually rows bilaterally; One-Arm Row uses unilateral side dose and a hand/knee support or hinge base.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"incline_torso_supported_row_vs_unilateral_hand_or_hinge_supported_row","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'48779c51-63b1-4b57-864d-fd0210fcf4ce','distinct_exercises','Band or Cable Row uses anchored elastic or cable resistance with anchor-height and resistance-curve requirements; One-Arm Row uses a free implement or landmine arc.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"anchored_cable_or_elastic_row_vs_free_or_landmine_external_load","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'27e9ee67-81cf-4b0d-afeb-33a07a49551e','distinct_exercises','Landmine Rotational Row requires hip and trunk rotation; strict One-Arm Row constrains deliberate rotation.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"required_rotation_vs_strict_braced_unilateral_pull","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'bdbdbe70-eed8-4031-ade3-f74a1970b851','distinct_exercises','Landmine Isometric Row Hold terminates in a timed static contraction; One-Arm Row requires concentric and eccentric repetitions.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"timed_isometric_hold_vs_dynamic_repetition","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'8013af70-a402-48c3-9d05-5dd608f0b132','distinct_exercises','Landmine Romanian Deadlift to Row contains an ordered hip-hinge cycle and row; One-Arm Row holds its support or hinge base during the pull.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"dynamic_hinge_then_row_combination_vs_isometric_base_row","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'107b4ae7-418e-490c-abd5-5d2e844a4924','distinct_exercises','Bent-Over Row uses bilateral hand loading and one shared repetition; One-Arm Row uses a single loaded hand and separately accounted side dose.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"bilateral_row_vs_unilateral_side_dosed_row","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,'4b3ecfa5-9d81-446e-b85a-e64d7d219f53',two_hand_target_id,'distinct_exercises','Landmine Press moves the loaded sleeve away from a shoulder through a fixed diagonal pressing arc; Two-Hand Landmine Bent-Over Row pulls the loaded sleeve toward the torso from a held hip hinge. Force direction, joint actions, body orientation, endpoints, and repetition contracts differ.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"fixed_diagonal_press_vs_bilateral_fixed_arc_row","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL),
    (1,'8013af70-a402-48c3-9d05-5dd608f0b132',meadows_target_id,'distinct_exercises','Landmine Romanian Deadlift to Row requires an ordered dynamic hip-hinge excursion followed by a row; Meadows Row holds a staggered perpendicular hinge base while performing the named unilateral sleeve-grip pull. Sequence, stance, orientation, hand count, and repetition contract differ.',$json$ {"migration":"453_coaching_one_arm_row_family_completion","identityBoundary":"dynamic_romanian_deadlift_then_row_sequence_vs_static_base_named_meadows_row","humanReviewRequired":true,"approvalsCreated":false} $json$::JSONB,'deterministic_identity_equivalence',NULL)
  ) AS boundary(facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,evidence_json,resolution_source,reviewed_by)
  JOIN coaching.exercise_definition_v1 survivor ON survivor.id=boundary.survivor_definition_id::UUID
  JOIN coaching.exercise_definition_v1 resolved ON resolved.id=boundary.resolved_definition_id::UUID
  WHERE TRUE
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
      WHEN 'technicalComplexity' THEN 'Review-only exercise-complexity anchor for exact support, stance, implement, handle, side, pull target, shoulder and elbow path, trunk policy, range, eccentric, pickup, and set-down of '
      ELSE 'Review-only physical-difficulty anchor for external load, unilateral pulling effort, grip, support or hinge endurance, trunk stabilization, side dose, local fatigue, and recovery of ' END
      ||variant.display_name||'. No athlete proficiency classification is represented.',
    'review',1,NULL,NULL,NULL,NULL
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(key)
  WHERE variant.id=ANY(active_variant_ids)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=NULL,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET skill_level=NULL,updated_at=now()
  WHERE id=ANY(involved_source_ids);
  UPDATE coaching.exercise_safety_profile SET minimum_skill_level=NULL
  WHERE exercise_id=ANY(involved_source_ids);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_id,1,2,'1.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'legacySources',4,'activeVariants',4,'correctedMappings',jsonb_build_object('meadows',1434,'bilateralTBar',jsonb_build_array(1435,1450),'invalidArchived',jsonb_build_array(1441,1448)),'aliasesPreserved',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLaterality',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','athleteSkillLevel',NULL,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'externalLoadRecorded',TRUE,'gripAndHingeAccumulation',TRUE,'impactSeparated',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'benchLandmineAttachmentAndPopulation',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',8,'durationAndScaling',TRUE,'sideDoseAndReserve',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachSupport',TRUE,'pickupSetDownAndStopRules',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'oEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',8,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',8,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',12,'invalidLegacySourcesArchived',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigue',TRUE,'duration',TRUE,'equipmentAndLane',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch every candidate in full and verify exact One-Arm Row identity and variant, support, stance, implement, load, handle, side, target, range, trunk policy, shoulder and elbow path, eccentric, pickup and set-down, captions, safety, accessibility, conflicts, and demonstration quality.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all progression, regression, substitution, and equipment-equivalence proposals.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty for every active variant; these scores are not athlete proficiency.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete card review before publication. Archived inconsistent legacy rows require original authoritative specifications before any restoration.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(canonical_source_ids) AND definition_id=canonical_id)<>4
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=1434 AND definition_id=meadows_target_id)<>1
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(ARRAY[1435,1450]::BIGINT[]) AND definition_id=two_hand_target_id)<>2
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=1441 AND definition_id=invalid_gorilla_definition_id)<>1
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=1448 AND definition_id=invalid_ball_grip_definition_id)<>1 THEN
    RAISE EXCEPTION '% found incorrect post-correction source mappings',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_id AND status='review'
        AND requirements_json->>'selectable'='true'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=
          GREATEST((difficulty_json->>'technicalComplexity')::INTEGER,(difficulty_json->>'physicalDifficulty')::INTEGER)
        AND load_profile_json<>'{}'::jsonb AND fatigue_profile_json<>'{}'::jsonb
        AND programming_profile_json<>'{}'::jsonb)<>4 THEN
    RAISE EXCEPTION '% requires four complete active variants',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND profile_key IN ('capacity-strength','resilience-control')
        AND cardinality(equipment_required)>=3
        AND coalesce(dosage_json->>'repetitionsPerSide','')<>''
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND length(coach_instructions)>=100
        AND length(athlete_instructions)>=100
        AND cardinality(stop_rules)>=8)<>8 THEN
    RAISE EXCEPTION '% requires eight complete contextual delivery profiles',migration_key;
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
        AND review_status='review' AND reviewed_by IS NULL)<>8
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND version=1 AND reviewed_by IS NULL)<>8 THEN
    RAISE EXCEPTION '% found incomplete graph or calibration review queues',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=ANY(involved_source_ids) AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(involved_source_ids) AND minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% found an exercise or safety skill classification',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND (
        cardinality(movement_patterns)<3 OR cardinality(body_regions)<12
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
