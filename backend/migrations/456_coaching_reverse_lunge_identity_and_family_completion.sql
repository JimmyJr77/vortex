-- Complete Reverse Lunge without inferring missing rack or carry positions.
-- Candidate evidence, media, relationships, calibration, and publication all
-- remain quarantined for qualified human review.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '456_coaching_reverse_lunge_identity_and_family_completion';
  research_version CONSTANT TEXT := '2026-08-02.69';
  canonical_id UUID;
  bodyweight_variant UUID;
  bodyweight_duplicate UUID;
  barbell_ambiguous UUID;
  front_rack_barbell_variant UUID;
  dumbbell_ambiguous UUID;
  kettlebell_ambiguous UUID;
  tempo_annotation UUID;
  sandbag_ambiguous UUID;
  med_ball_variant UUID;
  active_variant_ids UUID[];
  ambiguous_variant_ids UUID[];
  all_variant_ids UUID[];
  source_ids CONSTANT BIGINT[] := ARRAY[172,380,381,421,473,565,753,1009,1301];
  current_video_ids CONSTANT TEXT[] := ARRAY[
    'v791YUqiE-o','xrPteyQLGAo','1cXnW986vqU','Vlgh0ImT5oU','RZKXLMxPF_I'];
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4641539/","sourceTitle":"Joint Kinetics and Kinematics During Common Lower Limb Rehabilitation Exercises","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["The study directly distinguishes reverse lunge, forward lunge, and single-leg squat conditions.","Reverse Lunge identity requires a step backward, controlled lowering on a stable front foot, and return to the declared stance; load position, range, side order, and tempo remain explicit variant or delivery facts."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4641539/","sourceTitle":"Joint Kinetics and Kinematics During Common Lower Limb Rehabilitation Exercises","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Reverse lunge is a unilateral lower-limb task with distinct joint moments and angles.","The controlled card taxonomy is squat plus brace; backward step, front-leg loading, support contacts, rack or hold, side sequence, range, and return are detailed facts rather than uncontrolled taxonomy labels."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/30676181/","sourceTitle":"Effect of Loading Devices on Muscle Activation in Squat and Lunge","sourcePublisher":"Journal of Sport Rehabilitation","sourceKind":"peer_reviewed_research","evidenceQuality":83,"claims":["Loaded lunge conditions produced greater activation than unloaded conditions in the studied lower-limb muscles.","The card records hip, knee, ankle, foot, pelvis, and trunk actions plus upper-body support demands for loaded variants."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4641539/","sourceTitle":"Joint Kinetics and Kinematics During Common Lower Limb Rehabilitation Exercises","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["The reverse lunge demonstrated different knee, hip, and ankle moment relationships from the comparison exercises in this small laboratory sample.","Selection must record step direction, front and rear contacts, owned range, front-leg contribution, controlled return, and individual symptom response rather than claim universal knee friendliness."]},
    {"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36981573/","sourceTitle":"Effect of Load Distribution on Trunk Muscle Activity with Lunge Exercises in Amateur Athletes: Cross-Sectional Study","sourcePublisher":"Healthcare","sourceKind":"peer_reviewed_research","evidenceQuality":80,"claims":["Load distribution changes trunk-muscle activity during lunge exercise.","Difficulty scores exercise complexity and physical difficulty only; overall is their maximum and does not classify athlete skill or proficiency."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews","sourcePublisher":"American College of Sports Medicine","sourceKind":"professional_standard","evidenceQuality":96,"claims":["Resistance-training prescription depends on goal, dose, effort, frequency, and individual response.","The card budgets front-leg repetitions, both-side exposure, external load and position, eccentric tempo, grip/rack/trunk demand, overlapping squat/lunge/sprint/jump load, symptoms, and recovery."]},
    {"sectionKey":"constraints","sourceUrl":"https://www.acefitness.org/resources/pros/expert-articles/3718/total-body-dumbbell-workout/","sourceTitle":"Total-body Dumbbell Workout","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":72,"claims":["ACE instruction describes reaching one leg backward, lowering into a reverse lunge, and controlling the standing return.","Delivery verifies a non-slip level lane, backward-step and return clearance, stable front foot, exact implement and load position, safe rack or pickup, pain-free range, and controlled exit."]},
    {"sectionKey":"dosage","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews","sourcePublisher":"American College of Sports Medicine","sourceKind":"professional_standard","evidenceQuality":96,"claims":["Resistance exercise variables are prescribed from the desired adaptation and individual context.","Profiles expose sets, valid repetitions per side, load and position, range, tempo, rest, reserve, weekly exposure, duration, scaling, and quality-loss stops."]},
    {"sectionKey":"instructions","sourceUrl":"https://www.acefitness.org/resources/pros/expert-articles/3718/total-body-dumbbell-workout/","sourceTitle":"Total-body Dumbbell Workout","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":72,"claims":["The instruction supports a backward reach, controlled lowering, and return through the standing leg.","Instructions must name exact implement and position, working/front side, step lane, range, rear-knee target, front-foot pressure, torso policy, repetitions, tempo, rest, reserve, breathing, reset, and exit."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4641539/","sourceTitle":"Joint Kinetics and Kinematics During Common Lower Limb Rehabilitation Exercises","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Reverse lunge produces meaningful lower-limb joint loading that must be selected and progressed in context.","Stop for pain or neurologic/cardiopulmonary symptoms, unsafe lane or implement movement, lost balance, uncontrolled rear-foot landing, repeated foot/knee/hip/pelvis/trunk change, failed side balance, tempo loss, unsafe rack or set-down, or recovery concern."]},
    {"sectionKey":"programming","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews","sourcePublisher":"American College of Sports Medicine","sourceKind":"professional_standard","evidenceQuality":96,"claims":["Resistance-training variables should be selected from objective and individual response.","Selection and substitution recompute exact identity, load position, side dose, range, tempo, fatigue, recovery, duration, equipment, space, population constraints, and rendered instructions."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://www.acefitness.org/resources/pros/expert-articles/3718/total-body-dumbbell-workout/","sourceTitle":"Total-body Dumbbell Workout","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":72,"claims":["The reverse-step instruction is understandable to an athlete when step direction and return are explicit.","Athlete rendering adds exact variant, load position, side order, foot target, range, tempo, repetitions, reserve, rest, expected sensations, self-checks, stop signal, and safe finish."]},
    {"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/36981573/","sourceTitle":"Effect of Load Distribution on Trunk Muscle Activity with Lunge Exercises in Amateur Athletes: Cross-Sectional Study","sourcePublisher":"Healthcare","sourceKind":"peer_reviewed_research","evidenceQuality":80,"claims":["Load placement changes trunk demand in lunge exercise and must not be treated as a cosmetic detail.","Coach support verifies implement count and position, rack or hold, front/rear side, step lane, foot pressure, knee/hip/pelvis/trunk behavior, range, tempo, return, side balance, fatigue, and exit."]},
    {"sectionKey":"accessibility","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC4641539/","sourceTitle":"Joint Kinetics and Kinematics During Common Lower Limb Rehabilitation Exercises","sourcePublisher":"Journal of Athletic Training","sourceKind":"peer_reviewed_research","evidenceQuality":89,"claims":["Reverse lunge had lower knee and ankle moments than some comparison tasks in the studied sample, but individual response still governs use.","Accessible delivery can use reviewed stable hand support, reduce range or repetitions, remove load, slow rehearsal, add visual foot targets, increase rest, provide written or still instruction, or substitute another reviewed unilateral task."]},
    {"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/30676181/","sourceTitle":"Effect of Loading Devices on Muscle Activation in Squat and Lunge","sourcePublisher":"Journal of Sport Rehabilitation","sourceKind":"peer_reviewed_research","evidenceQuality":83,"claims":["Loading devices materially affect muscular demand, so implement and load position require exact declaration.","Support, slider, deficit, landmine, ipsilateral, contralateral, goblet, front-rack, and compound return variants require separate review; tempo remains an annotation and forward, walking, lateral, jumping, pressing, throwing, and mobility tasks remain distinct."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates have current oEmbed title, channel, and iframe metadata only; playback, exact identity and variant, captions, safety, accessibility, quality, reviewer identity, and approval remain unresolved."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"variantKey":"bodyweight","videoId":"v791YUqiE-o","title":"How To Reverse Lunge With Krissy Cela","channel":"EvolveYou","query":"bodyweight reverse lunge technique"},
    {"variantKey":"bodyweight","videoId":"xrPteyQLGAo","title":"How To Reverse Lunge","channel":"PureGym","query":"reverse lunge technique"},
    {"variantKey":"front-rack","videoId":"1cXnW986vqU","title":"How to Do a Barbell Front Rack Reverse Lunge","channel":"Peak Functional","query":"barbell front rack reverse lunge technique"},
    {"variantKey":"front-rack","videoId":"Vlgh0ImT5oU","title":"Barbell Front Rack Reverse Lunge","channel":"Functional Bodybuilding","query":"front rack reverse lunge"},
    {"variantKey":"dumbbell-quarantine","videoId":"RZKXLMxPF_I","title":"Dumbbell Reverse Lunges | How To | Proper Form & Technique","channel":"FITTR","query":"dumbbell reverse lunge carry position review"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"name":"Slow-Eccentric Reverse Lunge","class":"modifier_annotation","why":"A four-to-six-second lowering phase changes time under tension and fatigue while retaining the full step-back, descent, standing return, and side-dose contract.","dimensions":{"tempo":"declared","eccentricSeconds":"declared"}},
    {"name":"Paused Reverse Lunge","class":"modifier_annotation","why":"An owned bottom pause changes duration without changing the movement sequence.","dimensions":{"pausePosition":"bottom","pauseSeconds":"declared"}},
    {"name":"Supported Reverse Lunge","class":"new_variant","why":"Stable hand support changes balance and upper-body contact while preserving the reverse-step lunge.","dimensions":{"handSupport":"declared","supportSide":"declared"}},
    {"name":"Slider Reverse Lunge","class":"new_variant","why":"A rear-foot slider preserves continuous contact and changes eccentric, friction, and return behavior.","dimensions":{"rearFootInterface":"slider","return":"continuous_contact"}},
    {"name":"Front-Foot-Elevated Deficit Reverse Lunge","class":"new_variant","why":"A stable elevated front foot deliberately changes available range, step geometry, and loading.","dimensions":{"frontFootSupport":"elevated","range":"deficit"}},
    {"name":"Goblet Reverse Lunge","class":"new_variant","why":"A single declared implement held at the chest creates an exact anterior-load position.","dimensions":{"implement":"dumbbell_or_kettlebell_declared","position":"goblet"}},
    {"name":"Ipsilateral Suitcase Reverse Lunge","class":"new_variant","why":"A declared same-side hanging load changes frontal-plane and grip demand.","dimensions":{"loadSide":"ipsilateral","position":"suitcase"}},
    {"name":"Contralateral Suitcase Reverse Lunge","class":"new_variant","why":"A declared opposite-side hanging load changes trunk and pelvic control relative to ipsilateral loading.","dimensions":{"loadSide":"contralateral","position":"suitcase"}},
    {"name":"Double-Dumbbell Front-Rack Reverse Lunge","class":"new_variant","why":"Two dumbbells in a declared front rack create distinct grip, shoulder, trunk, pickup, and set-down demands.","dimensions":{"implement":"two_dumbbells","position":"front_rack"}},
    {"name":"Landmine Reverse Lunge","class":"new_variant","why":"An anchored bar creates a fixed arc and declared hand/shoulder load position while retaining the reverse lunge.","dimensions":{"implement":"landmine","handAndShoulder":"declared"}},
    {"name":"Forward Lunge","class":"new_definition","why":"The athlete steps forward and absorbs forward travel rather than stepping backward from a stable front foot.","dimensions":{"stepDirection":"forward","momentum":"forward_acceptance"}},
    {"name":"Walking Lunge","class":"new_definition","why":"Repeated traveling steps and alternating gait-like advancement create a locomotor sequence.","dimensions":{"travel":"continuous_forward","returnToStart":"false"}},
    {"name":"Split Squat","class":"new_definition","why":"The feet remain in split stance rather than stepping back and returning each repetition.","dimensions":{"footSequence":"stationary_split_stance"}},
    {"name":"Crossover or Curtsy Lunge","class":"new_definition","why":"The rear foot crosses the midline and changes transverse/frontal-plane mechanics.","dimensions":{"rearStep":"cross_body"}},
    {"name":"Reverse Lunge to Knee Drive","class":"new_definition","why":"A required terminal knee drive and single-leg balance changes the repetition sequence and finish.","dimensions":{"terminalAction":"knee_drive_balance"}},
    {"name":"Reverse Lunge to Press, Throw, or Sprint","class":"new_definition","why":"An added upper-body projection or acceleration action creates a compound sequence with separate load, impact, space, and completion rules.","dimensions":{"terminalAction":"press_throw_or_sprint_declared"}}
  ]
  $json$::JSONB;
BEGIN
  -- Fresh bootstraps generate UUIDs. The legacy exercise IDs and the exact
  -- variant lineage keys below are the durable identity anchors.
  SELECT definition_id INTO canonical_id
  FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=172;
  SELECT id INTO bodyweight_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND variant_key='baseline';
  SELECT id INTO bodyweight_duplicate FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND variant_key='legacy-source-565-baseline';
  SELECT id INTO barbell_ambiguous FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND variant_key='legacy-source-380-baseline';
  SELECT id INTO front_rack_barbell_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND variant_key='legacy-source-381-baseline';
  SELECT id INTO dumbbell_ambiguous FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND variant_key='legacy-source-421-baseline';
  SELECT id INTO kettlebell_ambiguous FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND variant_key='legacy-source-473-baseline';
  SELECT id INTO tempo_annotation FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND variant_key='legacy-source-753-baseline';
  SELECT id INTO sandbag_ambiguous FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND variant_key='legacy-source-1009-baseline';
  SELECT id INTO med_ball_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND variant_key='legacy-source-1301-baseline';
  active_variant_ids := ARRAY[bodyweight_variant,front_rack_barbell_variant,med_ball_variant];
  ambiguous_variant_ids := ARRAY[barbell_ambiguous,dumbbell_ambiguous,kettlebell_ambiguous,sandbag_ambiguous];
  all_variant_ids := active_variant_ids||ambiguous_variant_ids||ARRAY[bodyweight_duplicate,tempo_annotation];

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=canonical_id)<>9
    OR (SELECT count(*) FROM coaching.exercise_variant_v1 WHERE id=ANY(all_variant_ids))<>9
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_id)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND NOT (card_version=1 OR
        (card_version=2 AND provenance_json->>'reverseLungeCompletionMigration'=migration_key)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE reviewed_by IS NOT NULL AND
        (survivor_definition_id=canonical_id OR resolved_definition_id=canonical_id))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_variant_ids) AND reviewed_by IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_variant_ids) OR to_variant_id=ANY(all_variant_ids))
        AND reviewed_by IS NOT NULL) THEN
    RAISE EXCEPTION '% refuses missing lineage or reviewed/approved state',migration_key;
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

  UPDATE coaching.exercise_definition_source_v1 SET
    source_kind=CASE WHEN legacy_exercise_id=172 THEN 'legacy_migration'
      ELSE 'duplicate_consolidation' END,
    provenance_json=(provenance_json-'researchSources')||jsonb_build_object(
      'reverseLungeCompletionMigration',migration_key,
      'canonicalResearchVersion',research_version,
      'researchSources',jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC4641539/',
        'https://pubmed.ncbi.nlm.nih.gov/30676181/',
        'https://pubmed.ncbi.nlm.nih.gov/36981573/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC8136561/',
        'https://www.acefitness.org/resources/pros/expert-articles/3718/total-body-dumbbell-workout/'),
      'identityDisposition',CASE legacy_exercise_id
        WHEN 565 THEN 'duplicate_bodyweight_source'
        WHEN 753 THEN 'full_cycle_slow_eccentric_modifier_annotation'
        WHEN 380 THEN 'archived_missing_barbell_rack_position'
        WHEN 421 THEN 'archived_missing_dumbbell_count_and_carry_position'
        WHEN 473 THEN 'archived_missing_kettlebell_count_and_carry_position'
        WHEN 1009 THEN 'archived_missing_sandbag_hold_position'
        ELSE 'selectable_exact_reverse_lunge_variant' END,
      'directEvidenceBoundary','PMC4641539 directly includes reverse lunge; the other lunge studies are adjacent evidence only.',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_definition_v1 SET
    canonical_name='Reverse Lunge',display_name='Reverse Lunge',slug='reverse-lunge',
    aliases=(SELECT array_agg(DISTINCT alias ORDER BY alias) FROM unnest(aliases||ARRAY[
      'Reverse Lunge','Backward Lunge','Step-Back Lunge','Bodyweight Reverse Lunge',
      'Front-Rack Barbell Reverse Lunge','Medicine-Ball Chest-Hold Reverse Lunge']) alias),
    description='From a declared standing stance, step one foot backward into a controlled split position, lower through an owned range while the front foot remains stable, then return to the declared stance through a balanced, repeatable front-leg-dominant effort.',
    family_key='reverse_lunge',schema_version='1.0.0',card_version=2,status='review',
    content_confidence=82,scoring_confidence=72,media_confidence=40,
    movement_patterns=ARRAY['squat','brace'],
    body_regions=ARRAY['hip','knee','ankle','foot','glutes','hamstrings','calf','pelvis','core','spine','shoulder','hand'],
    required_equipment=ARRAY['open_space'],
    optional_equipment=ARRAY['mat','barbell','rack','plates','medicine_ball','timer'],
    environment_json=jsonb_build_object(
      'surface','level_dry_non_slip_load_tolerant','stepLane','marked_clear_behind_each_athlete',
      'returnLane','clear_to_declared_stance','ceiling','sufficient_for_front_rack_and_standing_return',
      'lighting','front_rear_foot_and_implement_visible','traffic','one_direction_per_station_no_crossing',
      'rack','stable_height_and_clear_approach_when_used','medicineBall','intact_nonshifting_surface',
      'stopFor',jsonb_build_array('surface_or_lane_change','rack_or_implement_movement','person_enters_step_or_return_lane')),
    population_json=jsonb_build_object(
      'selection','current pain-free reverse-step, balance, range, load-position, breathing, and return capacity',
      'individualize',jsonb_build_array('step_length','stance_width','range','rear_knee_target','hand_support_if_reviewed','load','load_position','sets','repetitions_per_side','tempo','rest','reserve'),
      'doNotInfer',jsonb_build_array('barbell_rack_position','dumbbell_count_or_carry','kettlebell_count_or_carry','sandbag_hold','diagnosis','athlete_proficiency'),
      'clinicalEscalation',jsonb_build_array('unexplained_or_increasing_pain','giving_way_or_locking','neurologic_symptom','cardiopulmonary_or_pressure_symptom','abnormal_swelling','recovery_outside_expected_response')),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('quadriceps','gluteus_maximus','gluteus_medius_and_minimus','adductors'),
      'secondaryMuscles',jsonb_build_array('hamstrings','soleus','gastrocnemius','foot_intrinsics','deep_hip_rotators','obliques','spinal_stabilizers','upper_back_and_anterior_trunk_for_front_load'),
      'joints',jsonb_build_array('foot','ankle','knee','hip','pelvis','lumbar_spine','thoracic_spine','shoulder_and_elbow_when_loaded'),
      'jointActions',jsonb_build_array('rear_hip_extension_during_step','front_hip_flexion_then_extension','front_knee_flexion_then_extension','front_ankle_dorsiflexion_then_plantarflexion_control','rear_ankle_plantarflexed_support','pelvic_and_trunk_stabilization','scapular_shoulder_and_elbow_isometric_support_when_loaded'),
      'planes',jsonb_build_array('sagittal_primary','frontal_and_transverse_stabilization'),
      'laterality','alternating_unilateral','sideDose','equal_valid_repetitions_and_exposure_per_side_unless_clinically_prescribed_otherwise'),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','Builds repeatable unilateral lower-body strength, controlled backward stepping, balance, and front-leg force production for training and sport support.',
      'primaryCue','Step back quietly, own the front foot and bottom, then return tall without pushing or twisting out of position.',
      'expectedSensations',jsonb_build_array('front_thigh_and_glute_effort','controlled_balance_demand','trunk_bracing','rear_hip_stretch_within_owned_range'),
      'unexpectedSensations',jsonb_build_array('sharp_or_increasing_joint_pain','giving_way_or_locking','numbness_or_tingling','dizziness_or_pressure_symptom','unusual_swelling_or_persistent_recovery_change'),
      'painGuidance','Stop the set, secure or set down the load, and tell the coach; do not diagnose or push through changing symptoms.',
      'selfChecks',jsonb_build_array('assigned_implement_and_position_match','step_lane_is_clear','front_foot_stays_stable','knee_hip_pelvis_and_trunk_path_repeat','both_sides_receive_declared_dose','return_is_balanced_and_quiet'),
      'accessibility',jsonb_build_array('reduce_owned_range','remove_external_load','use_visual_foot_targets','increase_stance_width_or_step_rehearsal','increase_rest','use_written_or_still_frame_instruction','use_reviewed_stable_hand_support_or_substitution'),
      'mediaAlternatives',jsonb_build_array('written_step_sequence','front_and_side_still_frames','coach_mirror_demonstration','tactile_floor_targets_with_consent')),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact_variant_implement_count_and_position','front_and_rear_side_order','start_stance_and_step_lane','front_foot_pressure','rear_foot_contact','knee_hip_pelvis_and_trunk_path','range_and_rear_knee_target','tempo_and_pause','front_leg_contribution','balanced_return','side_dose','breathing_reserve_and_exit'),
      'faultCorrections',jsonb_build_object('rear_step_unstable','reduce_range, rehearse marked step, widen stance only as needed, or use reviewed stable support','front_foot_or_knee_path_changes','reduce load/range and restore owned tripod and joint path','back_leg_push_dominates','reduce range/load and cue quiet rear foot plus front-leg return','trunk_or_load_position_changes','reduce load and restore exact rack/hold and brace','side_difference_repeats','reduce dose and use the weaker-side valid dose as the cap'),
      'demonstrationPlan',jsonb_build_array('show_exact_implement_and_position','show_start_step_bottom_return_and_finish_from_front_and_side','show_valid_and_invalid_rear_step','show_stop_command_and_safe_load_exit'),
      'groupManagement',jsonb_build_array('mark_separate_backward_step_lanes','face_athletes_one_direction','stage_loads_outside_step_and_return_lanes','one_active_athlete_per_rack_station','count_sides_and_faults_separately'),
      'modificationDecisionTree',jsonb_build_array('symptom_or_unsafe_environment_stop_and_escalate','wrong_or_unknown_load_position_fail_closed','balance_or_step_fault_reduce_range_load_or_use_reviewed_support','side_difference_reduce_to_repeatable_bilateral_exposure','variant_change_revalidate_all_constraints_duration_and_rendering'),
      'doNotUseWhen',jsonb_build_array('exact_variant_or_load_position_unknown','unsafe_surface_lane_rack_pickup_or_setdown','pain_neurologic_cardiopulmonary_or_pressure_symptom','front_foot_balance_or_controlled_return_not_repeatable','fresh_sprint_jump_or_change_of_direction_priority_would_be_compromised')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_load_position','equipment_or_lane','pain_or_symptom','technique_or_side_balance','dose_fatigue_or_recovery','media_accessibility_or_instruction','substitution_or_rendering'),
      'supportEscalation',jsonb_build_object('urgent','stop, secure load and environment, follow emergency plan for acute neurologic cardiopulmonary severe pain or injury concern','clinical','route persistent pain giving-way locking swelling neurologic or abnormal recovery to qualified clinician','content','route identity evidence media or instruction conflicts to library review'),
      'retentionPolicy','Store canonical definition/variant/profile IDs, exact load position, sides, dose, faults, symptoms, duration, substitution, reviewer actions, and version; avoid diagnostic narrative and unnecessary personal data.',
      'changeImpactPolicy','Any identity, implement, load-position, range, side, dose, equipment, safety, graph, media, or score change invalidates stale generation and requires revalidation and rerendering.',
      'feedbackFields',jsonb_build_array('variant_match','load_position_match','side_balance','pain_or_symptom','fault_code','dose_and_reserve','duration','substitution_reason','media_or_accessibility_issue'),
      'auditability','Preserve source lineage, candidate status, validation results, generated workout linkage, coach edits, reviewer identity, reason, timestamp, and superseded versions.'),
    provenance_json=provenance_json||jsonb_build_object(
      'reverseLungeCompletionMigration',migration_key,'canonicalResearchVersion',research_version,
      'canonicalLegacySourceIds',to_jsonb(source_ids),'activeVariants',3,
      'ambiguousLoadedSources',jsonb_build_array(380,421,473,1009),
      'tempoSourceIsAnnotation',753,'duplicateBodyweightSource',565,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'externalVerification','youtube_oembed_metadata_only_2026_08_02',
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,'approvalsCreated',FALSE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,updated_at=now()
  WHERE id=canonical_id;

  UPDATE coaching.exercise_variant_v1 variant SET
    definition_id=canonical_id,variant_key=spec.variant_key,display_name=spec.display_name,
    modifier_keys=spec.modifier_keys,
    difficulty_json=jsonb_build_object(
      'technicalComplexity',spec.technical,'absoluteLoadDemand',spec.physical,
      'physicalDifficulty',spec.physical,'coordinationDemand',spec.coordination,
      'supervisionDemand',spec.supervision,'failureConsequence',spec.failure,
      'impact',8,'athleteLandingImpact',0,'workCapacityDemand',spec.work_capacity,
      'baseOverallDifficulty',GREATEST(spec.technical,spec.physical),
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'overallFormula','max(exercise_complexity,physical_difficulty)'),
    requirements_json=jsonb_build_object(
      'selectable',TRUE,'implement',spec.implement,'implementCount',spec.implement_count,
      'loadPosition',spec.load_position,'startStance','declared_symmetric_standing',
      'workingPattern','alternating_unilateral','sideDose','equal_valid_repetitions_per_side',
      'stepDirection','backward','stepLane','declared_non_crossing_lane',
      'frontFoot','stable_full_contact_owned_pressure','rearFoot','forefoot_contact_with_controlled_landing',
      'range','declared_pain_free_owned_range','rearKneeTarget','declared_hover_pad_or_light_touch_without_impact',
      'contractionSequence','controlled_eccentric_then_concentric_return',
      'returnStrategy','front_leg_dominant_return_to_declared_stance_without_twist_or_extra_step',
      'trunkPolicy',spec.trunk_policy,'exit',spec.exit_policy,
      'invalid',jsonb_build_array('wrong_implement_count_load_position_side_range_tempo_or_return','unsafe_surface_lane_rack_pickup_setdown_or_implement','pain_neurologic_cardiopulmonary_or_pressure_symptom','front_foot_or_rear_step_loss','repeated_knee_hip_pelvis_or_trunk_path_change','uncontrolled_rear_knee_contact_or_return','side_dose_or_reserve_failure','unsafe_exit')),
    load_profile_json=jsonb_build_object(
      'loadingType',CASE WHEN spec.implement='none' THEN 'bodyweight' ELSE 'bodyweight_plus_external_resistance' END,
      'externalLoadMethod',CASE WHEN spec.implement='none' THEN 'bodyweight_leverage' ELSE 'fixed_external' END,
      'implement',spec.implement,'implementCount',spec.implement_count,'loadPosition',spec.load_position,
      'externalLoadRecorded',spec.implement<>'none','gripDemand',spec.grip_demand,
      'spinalLoading',spec.spinal_loading,'eccentricStress',spec.eccentric_stress,
      'frontLegLoadDemand',spec.front_leg_load,'trunkDemand',spec.trunk_demand,
      'landingContactsPerRep',0,'athleteLandingImpact',0,
      'loadAccounting',jsonb_build_object('recordBodyMass',TRUE,'recordExternalMass',spec.implement<>'none','recordImplementCountAndPosition',TRUE,'recordSideRangeTempoRestReserve',TRUE,'recordValidFailedAndAssistedRepetitionsPerSide',TRUE)),
    fatigue_profile_json=jsonb_build_object(
      'localMuscleFatigue',spec.local_fatigue,'gripFatigue',spec.grip_demand,
      'trunkFatigue',spec.trunk_demand,'technicalFatigueSensitivity',spec.technical_fatigue,
      'impactAccumulation',8,'athleteLandingImpact',0,'recoveryHours',spec.recovery_hours,
      'qualityLossSignals',jsonb_build_array('rear_step_or_front_foot_change','knee_hip_pelvis_or_trunk_path_change','range_or_tempo_loss','back_leg_push_or_extra_step','load_position_or_grip_change','side_difference','unsafe_rack_setdown_or_exit'),
      'cumulativeRules',jsonb_build_array('sum_valid_failed_and_assisted_repetitions_per_side','include_load_position_range_tempo_reserve_and_local_grip_trunk_demand','include_same_session_squat_lunge_step_up_sprint_jump_cut_and_carry_load','increase_recovery_after_high_load_eccentric_soreness_symptoms_or_abnormal_response')),
    programming_profile_json=jsonb_build_object(
      'preferredBlock','capacity_or_resilience_after_priority_speed_jump_cut_and_high_skill_work',
      'primaryObjectives',jsonb_build_array('unilateral_lower_body_strength','controlled_backward_step_and_return','front_leg_force_and_tissue_capacity','pelvic_and_trunk_control','side_balanced_exposure'),
      'trainingStimuli',jsonb_build_array('unilateral_knee_and_hip_extension','controlled_eccentric_force_acceptance','dynamic_balance','front_foot_ankle_and_foot_control','load_position_specific_trunk_support'),
      'stimulusDose',jsonb_build_object('unit','valid_repetition_per_side','loadPosition',spec.load_position,'range','owned','tempo','declared','effort','submaximal_with_declared_reserve','sideBalance','required'),
      'cumulativeFatigueBudget','sum valid, failed, and assisted repetitions per side; external load and position; range, tempo, reserve, local, grip and trunk demand; overlapping squat, lunge, step-up, sprint, jump, cut and carry work; symptoms and recovery',
      'impactBudget','zero athlete landing contacts; rear-foot placement and rear-knee target must remain controlled without impact',
      'weeklyExposure',jsonb_build_object('frequency','individualized_from_goal_load_position_volume_side_balance_fatigue_symptoms_and_recovery','minimumRecoveryHours',spec.recovery_hours),
      'prerequisites',jsonb_build_array('exact_variant_load_position_and_equipment_available','clear_step_and_return_lane','pain_free_owned_reverse_step_range','stable_front_foot_and_repeatable_return','easy_rehearsal_meets_quality_gate'),
      'completionCriteria',jsonb_build_array('assigned_valid_repetitions_per_side_completed','reserve_and_quality_threshold_maintained','no_stop_rule_triggered','side_dose_balanced','actual_duration_faults_symptoms_and_substitution_recorded'),
      'sequenceRules',jsonb_build_array('verify_implement_count_position_side_range_tempo_return_and_exit','perform_after_priority_output_when_strength_or_capacity_is_goal','balance_side_order_and_dose','stop_before_step_foot_joint_trunk_load_position_or_return_changes_repeat'),
      'pairingCompatibility',jsonb_build_array('reviewed_upper_body_pull_or_push','low_fatigue_mobility_or_breathing_during_rest'),
      'interferenceRules',jsonb_build_array('do_not_pre_fatigue_lower_body_balance_or_trunk_before_priority_sprint_jump_cut_or_skill','do_not_convert_strength_profile_to_unbounded_conditioning','recompute_load_fatigue_recovery_duration_equipment_space_and_rendering_after_substitution'),
      'uncertaintyPolicy',jsonb_build_object('unknownIdentityLoadPositionSideRangePainOrRecovery','fail_closed_and_request_coach_review','neverInferMissingRackCarryOrHold',TRUE,'neverAutoApproveMediaGraphCalibrationOrPublication',TRUE)),
    status='review',updated_at=now()
  FROM (VALUES
    (bodyweight_variant,'bodyweight-full-cycle','Reverse Lunge — Bodyweight',ARRAY['bodyweight','full_cycle']::TEXT[],42,46,48,32,28,52,'none','bodyweight','none','stacked_or_individually_declared_small_forward_inclination_without_pelvic_loss','step_to_stable_stance_or_controlled_knee_down',12,24,44,40,48,58,62,24),
    (front_rack_barbell_variant,'barbell-front-rack','Reverse Lunge — Barbell Front Rack',ARRAY['barbell','front_rack','full_cycle']::TEXT[],58,68,60,58,56,66,'barbell','one','bilateral_front_rack','upright_front_rack_trunk_with_elbows_and_bar_path_owned','controlled_return_then_safe_rerack_or_spotter_assisted_exit',46,68,66,64,72,78,82,48),
    (med_ball_variant,'medicine-ball-chest-hold','Reverse Lunge — Medicine-Ball Chest Hold',ARRAY['medicine_ball','chest_hold','full_cycle']::TEXT[],48,54,52,38,34,58,'medicine_ball','one','two_hand_chest_hold','stacked_trunk_with_ball_close_and_nonshifting','controlled_return_then_secure_ball_setdown',28,38,52,48,58,66,70,30)
  ) AS spec(id,variant_key,display_name,modifier_keys,technical,physical,
    coordination,supervision,failure,work_capacity,implement,implement_count,
    load_position,trunk_policy,exit_policy,grip_demand,spinal_loading,
    eccentric_stress,front_leg_load,trunk_demand,local_fatigue,
    technical_fatigue,recovery_hours)
  WHERE variant.id=spec.id;

  UPDATE coaching.exercise_variant_v1 SET
    definition_id=canonical_id,status='archived',
    requirements_json=jsonb_build_object('selectable',FALSE,'representation','duplicate_source_variant',
      'archiveReason','source_565_duplicates_the_bodyweight_full_cycle_variant',
      'representedByVariantId',bodyweight_variant,'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object('selectable',FALSE,'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=bodyweight_duplicate;

  UPDATE coaching.exercise_variant_v1 SET
    definition_id=canonical_id,status='archived',
    requirements_json=jsonb_build_object('selectable',FALSE,'representation','modifier_annotation',
      'annotationType','slow_eccentric_full_cycle','eccentricSeconds','4_to_6',
      'archiveReason','source_753_returns_to_standing_and_changes_tempo_not_repetition_identity',
      'applyToVariantId',bodyweight_variant,'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object('selectable',FALSE,'applyAs','tempo_and_dose_annotation','publicationQuarantined',TRUE),updated_at=now()
  WHERE id=tempo_annotation;

  UPDATE coaching.exercise_variant_v1 SET
    definition_id=canonical_id,status='archived',
    requirements_json=jsonb_build_object('selectable',FALSE,'representation','identity_quarantine',
      'archiveReason',CASE id
        WHEN barbell_ambiguous THEN 'barbell_reverse_lunge_omits_rack_or_carry_position'
        WHEN dumbbell_ambiguous THEN 'dumbbell_reverse_lunge_omits_implement_count_and_carry_position'
        WHEN kettlebell_ambiguous THEN 'kettlebell_reverse_lunge_omits_implement_count_and_carry_position'
        ELSE 'sandbag_reverse_lunge_omits_exact_hold_position' END,
      'requiredHumanEvidence',CASE id
        WHEN barbell_ambiguous THEN jsonb_build_array('barbell_rack_or_carry_position','pickup_and_rerack_contract')
        WHEN sandbag_ambiguous THEN jsonb_build_array('sandbag_hold_position','hand_count','pickup_and_setdown_contract')
        ELSE jsonb_build_array('implement_count','carry_or_rack_position','load_side','pickup_and_setdown_contract') END,
      'neverInferMissingLoadPosition',TRUE,'humanReviewRequired',TRUE),
    programming_profile_json=jsonb_build_object('selectable',FALSE,'publicationQuarantined',TRUE,'restoreOnlyAfterOriginalEvidence',TRUE),updated_at=now()
  WHERE id=ANY(ambiguous_variant_ids);

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT variant.id,profile.profile_key,profile.phase_key,profile.role,profile.purpose,
    profile.suitability,profile.alignment,
    jsonb_build_object('unilateralStrength',profile.strength,'dynamicBalance',5,'trunkControl',5,'sideBalancedExposure',5,'athleteLandingImpact',0),
    jsonb_build_object('doseType','valid_repetitions_per_side','sets',profile.sets,'repetitions',profile.repetitions,
      'sideDose','equal_valid_repetitions_per_side','loadPosition',variant.requirements_json->>'loadPosition',
      'range','owned','tempo',profile.tempo,'reserveRepetitions',profile.reserve,'restSeconds',profile.rest_seconds,
      'qualityThreshold','end_before_step_front_foot_joint_path_trunk_load_position_range_tempo_return_or_exit_materially_changes'),
    'Every counted repetition uses the exact implement, count, load position, start stance, side order, backward step lane, front and rear contacts, owned range, rear-knee target, tempo, front-leg-dominant return, breathing, reserve, and safe finish without pain or repeated foot, knee, hip, pelvis, trunk, balance, or implement change.',
    ARRAY['pain_or_neurologic_symptom','dizziness_breathing_or_pressure_symptom','wrong_variant_implement_count_position_side_range_tempo_or_return','unsafe_surface_lane_rack_pickup_setdown_or_implement','front_foot_or_rear_step_control_loss','repeated_knee_hip_pelvis_or_trunk_path_change','uncontrolled_rear_knee_contact_or_back_leg_push','load_position_grip_or_bar_path_change','asymmetric_side_dose_cannot_be_balanced','reserve_or_effort_ceiling_exceeded','unsafe_return_rerack_setdown_or_exit'],
    'Verify exact variant, implement count and position, rack/pickup, working side and order, step and return lanes, range, rear-knee target, tempo, repetitions, rest, reserve, stop command, and exit. Observe front and rear contacts, knee/hip/pelvis/trunk path, load position, breathing, side difference, return, fatigue, and safe finish. Count valid and failed repetitions per side and stop before a repeated fault.',
    'Set the assigned implement and load position, stand in the marked start, and brace. Step one foot backward quietly, keep the front foot owned, lower to the assigned target, then drive through the front leg to return without twisting or extra steps. Match both sides and stop before your balance, joint path, load position, breath, or range changes.',
    CASE profile.phase_key WHEN 'capacity' THEN 'Improved side-balanced reverse-lunge strength, dynamic balance, lower-body tissue capacity, and load-position-specific trunk support.' ELSE 'Improved submaximal reverse-step control, eccentric tolerance, foot-knee-hip-pelvis alignment, and repeatable recovery.' END,
    CASE variant.id
      WHEN bodyweight_variant THEN ARRAY['none','open_space','timer']::TEXT[]
      WHEN front_rack_barbell_variant THEN ARRAY['barbell','rack','plates','open_space','timer']::TEXT[]
      ELSE ARRAY['medicine_ball','open_space','timer']::TEXT[] END,
    jsonb_build_object('athletesPerStation',1,'setupSeconds',75,'transitionSeconds',30,
      'equipmentCheck','surface_lane_barbell_rack_plates_or_medicine_ball_as_applicable',
      'lane','marked_start_backward_step_return_and_exit_lane','trafficRule','no_entry_into_step_return_rack_or_setdown_zone',
      'substitutionRevalidation',jsonb_build_array('identity','variant','implement','count','load_position','side','range','tempo','return','fatigue','recovery','duration','equipment','space','population_constraints','rendering')),
    ARRAY[]::UUID[],'review',
    jsonb_build_object('setupSeconds',75,'secondsPerRepetition',profile.seconds_per_rep,'transitionSeconds',30,
      'durationFormula','setup + sets * (two_sides * repetitions_per_side * seconds_per_repetition + rest) + transition',
      'equipmentAdjustmentSeconds','add 45 seconds for barbell rack/loading check or 20 seconds for medicine-ball selection'),
    jsonb_build_object('reduce',jsonb_build_array('remove_external_load','reduce_owned_range','reduce_repetitions_per_side','slow_rehearsal','increase_rest','use_reviewed_stable_support_or_substitution'),'increase',jsonb_build_array('add_small_external_load_with_same_exact_position','increase_owned_range','add_one_repetition_per_side_within_reserve','use_reviewed_exact_variant'),'revalidateAfterChange',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_id','variant_id','profile_key','implement_count_position','side_order','range','rear_knee_target','sets','repetitions_per_side','valid_and_failed_repetitions_per_side','tempo','rest','reserve','faults','symptoms','duration','substitution'),'validity','all exact identity, equipment, lane, side, contact, joint-path, load-position, range, reserve, return, exit, and quality gates pass'),
    jsonb_build_object('before','Which exact variant, implement count and position, side order, range, target, tempo, dose, rest, and reserve are assigned?','during','Are lane, contacts, joint path, pelvis, trunk, load position, range, sides, reserve, return, and exit still valid?','after','Store valid and failed repetitions by side, load position, range, tempo, reserve, faults, symptoms, duration, exit, and substitution.')
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN (VALUES
    ('capacity-strength','capacity','primary','Build side-balanced unilateral strength through a repeatable reverse step and front-leg-dominant return.',84,92,5,3,6,120,'3_second_controlled_eccentric_then_controlled_return','2',6),
    ('resilience-control','resilience','secondary','Build submaximal reverse-step, joint, balance, and load-position tolerance without technical failure.',86,90,4,3,5,90,'4_second_controlled_eccentric_then_controlled_return','3',7)
  ) profile(profile_key,phase_key,role,purpose,suitability,alignment,strength,sets,
    repetitions,rest_seconds,tempo,reserve,seconds_per_rep)
  WHERE variant.id=ANY(active_variant_ids)
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
  SELECT canonical_id,
    CASE item->>'variantKey'
      WHEN 'bodyweight' THEN bodyweight_variant
      WHEN 'front-rack' THEN front_rack_barbell_variant
      WHEN 'dumbbell-quarantine' THEN dumbbell_ambiguous END,2,
    'https://www.youtube.com/watch?v='||(item->>'videoId'),
    'https://www.youtube-nocookie.com/embed/'||(item->>'videoId'),
    item->>'videoId',item->>'title',item->>'channel','en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',item->>'query',NULL,NULL,
    '2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'YouTube oEmbed link, title, channel, and iframe metadata returned HTTP 200 on 2026-08-02. Full playback and exact Reverse Lunge variant, implement count and position, side, step, contacts, range, trunk, joint path, return, cue safety, conflicts, captions, accessibility, quality, reviewer, and approval all remain unresolved.'
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
    (bodyweight_variant,med_ball_variant,'progression',88,ARRAY['load','complexity','fatigue'],'A declared two-hand medicine-ball chest hold adds measurable anterior load, trunk support, grip, pickup, and set-down demands.',$json$ {"requires":["bodyweight_repetitions_meet_quality_gate","ball_mass_and_hold_are_repeatable"],"recompute":["load","fatigue","recovery","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (med_ball_variant,bodyweight_variant,'regression',88,ARRAY['load','complexity','fatigue'],'Removing the medicine ball returns the task to bodyweight while preserving the reverse-step and standing-return contract.',$json$ {"useWhen":["anterior_load_hold_or_pickup_exceeds_objective"],"recompute":["load","fatigue","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (bodyweight_variant,front_rack_barbell_variant,'progression',86,ARRAY['load','complexity','fatigue'],'A barbell front rack adds high external load capacity, rack setup, front-rack mobility, trunk support, rerack, and failure-response requirements.',$json$ {"requires":["bodyweight_repetitions_meet_quality_gate","front_rack_and_rerack_are_safe","spotter_or_safety_plan_is_declared"],"recompute":["load","grip","trunk","fatigue","recovery","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (front_rack_barbell_variant,bodyweight_variant,'regression',86,ARRAY['load','complexity','fatigue'],'Removing the front-rack barbell eliminates rack, grip, upper-back, and rerack demands while preserving the reverse-lunge sequence.',$json$ {"useWhen":["barbell_load_front_rack_or_rerack_exceeds_objective"],"recompute":["load","fatigue","duration","equipment","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (med_ball_variant,front_rack_barbell_variant,'lateral_substitution',80,ARRAY['load','complexity','fatigue'],'Barbell front-rack loading changes implement, mass capacity, rack setup, grip, trunk demand, rerack, and failure response and is not an automatic progression for every athlete.',$json$ {"revalidate":["implement","mass","front_rack","rack","spotting","range","dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL),
    (front_rack_barbell_variant,med_ball_variant,'lateral_substitution',80,ARRAY['load','complexity','fatigue'],'A medicine-ball chest hold changes mass, hand/shoulder interface, pickup, set-down, and trunk demand and requires a complete prescription rewrite.',$json$ {"revalidate":["implement","mass","chest_hold","pickup_setdown","range","dose","fatigue","duration","rendering"]} $json$::JSONB,'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  -- Earlier non-replayable UUID-only records are not recreated against a
  -- clean bootstrap: no distinct resolved definition exists to reference.
  -- The durable source lineage and archived exact variants above retain the
  -- quarantine without inventing a foreign-key identity boundary.
  SELECT 1,canonical_id,historical.definition_id,'needs_human_review',
    'Historical UUID-only identity boundary is retained in source lineage; no foreign-key target is fabricated during clean bootstrap.',
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

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,variant.id,dimension.key,(variant.difficulty_json->>dimension.key)::SMALLINT,
    CASE WHEN (variant.difficulty_json->>dimension.key)::INTEGER<50 THEN 40
      WHEN (variant.difficulty_json->>dimension.key)::INTEGER<70 THEN 60 ELSE 80 END,
    CASE dimension.key WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor for exact implement, load position, side order, step lane, contacts, range, joint path, trunk, return, balance, rack/set-down, and exit of '
      ELSE 'Review-only physical-difficulty anchor for body mass, external load and position, range, eccentric demand, repetitions per side, reserve, local/grip/trunk fatigue, and recovery of ' END
      ||variant.display_name||'. No athlete proficiency classification is represented.',
    'review',1,NULL,NULL,NULL,NULL
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(key)
  WHERE variant.id=ANY(active_variant_ids)
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
      'identity',jsonb_build_object('passed',TRUE,'legacySources',9,'activeVariants',3,'duplicateBodyweight',565,'tempoModifier',753,'ambiguousLoadedSources',jsonb_build_array(380,421,473,1009)),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLaterality',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','athleteProficiency',NULL,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'loadPositionAndSideRecorded',TRUE,'cumulativeOverlap',TRUE,'impactSeparated',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'laneSurfaceRackLoadPositionAndPopulation',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',6,'durationScalingSideDoseAndExit',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachSupport',TRUE,'setupStepBottomReturnAndStopRules',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directVsAdjacentEvidenceSeparated',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'oEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',6,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',6,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',16,'missingLoadPositionsArchived',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigue',TRUE,'duration',TRUE,'equipmentAndLane',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch every candidate in full and verify exact Reverse Lunge variant, implement count and position, side, step, contacts, range, joint path, trunk, return, captions, safety, accessibility, conflicts, and demonstration quality.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every progression, regression, substitution, and equipment proposal.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty for every active variant; these scores are not athlete proficiency.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete card review before publication. Four loaded source labels require original exact position evidence before restoration.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,human_review_required=TRUE,checked_at=now();

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=canonical_id)<>9
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND status='review' AND definition_id=canonical_id
        AND requirements_json->>'selectable'='true'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=
          GREATEST((difficulty_json->>'technicalComplexity')::INTEGER,(difficulty_json->>'physicalDifficulty')::INTEGER)
        AND load_profile_json<>'{}'::JSONB AND fatigue_profile_json<>'{}'::JSONB
        AND programming_profile_json<>'{}'::JSONB)<>3
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(ambiguous_variant_ids) AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine')<>4
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=tempo_annotation AND status='archived'
        AND requirements_json->>'representation'='modifier_annotation')<>1 THEN
    RAISE EXCEPTION '% found invalid source or variant completion',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND coalesce(dosage_json->>'repetitions','')<>'' AND cardinality(equipment_required)>=3
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
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16 THEN
    RAISE EXCEPTION '% found incomplete profiles, evidence, media, or alternates',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids) AND to_variant_id=ANY(active_variant_ids)
        AND review_status='review' AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND version=1 AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(ARRAY[380,421,473,1009]::BIGINT[])
        AND provenance_json->>'identityDisposition' LIKE 'archived_missing_%')<>4 THEN
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
      WHERE relationship.from_variant_id=ANY(active_variant_ids)
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise WHERE id=ANY(source_ids) AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(source_ids) AND minimum_skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_id AND (
      anatomy_json='{}'::JSONB OR environment_json='{}'::JSONB OR population_json='{}'::JSONB
      OR athlete_support_json='{}'::JSONB OR coach_support_json='{}'::JSONB
      OR support_operations_json='{}'::JSONB OR provenance_json->>'approvalsCreated'<>'false'
      OR approved_video_url IS NOT NULL OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL
      OR last_reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% found incomplete support, exercise proficiency, or fabricated approval',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_id AND card_version=2 AND audit_version=migration_key
        AND status='quarantined' AND human_review_required
        AND (SELECT array_agg(item->>'code' ORDER BY item->>'code')
          FROM jsonb_array_elements(blocking_issues_json) item)=
          ARRAY['CARD-CALIBRATION-01','CARD-GRAPH-03','CARD-MEDIA-01','CARD-PUBLISH-01'])<>1 THEN
    RAISE EXCEPTION '% requires exactly the four protected human gates',migration_key;
  END IF;
END $$;
