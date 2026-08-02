-- Complete nine legacy Floor Press cards as one stable exercise definition,
-- nine exact implement/action variants, and contextual delivery profiles.
-- YouTube oEmbed checks establish current link/embed health only. Playback,
-- captions, exact-match quality, graph/calibration review, card approval, and
-- publication remain protected human decisions.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '451_coaching_floor_press_family_completion';
  research_version CONSTANT TEXT := '2026-08-02.65';
  canonical_id CONSTANT UUID := '243e3f71-47ec-4b6a-ac52-3cc68b120f36';
  db_pair_variant CONSTANT UUID := '224a396f-6446-488a-ac28-e9e055d4062d';
  kb_single_variant CONSTANT UUID := 'a553c2af-ae31-409f-8a7f-ef6fefd4303b';
  db_single_variant CONSTANT UUID := 'd21ea816-1b68-454b-9042-938a31a71c80';
  db_close_variant CONSTANT UUID := 'cc3892a9-e2ba-4694-8d13-a8f6f625f35b';
  kb_pair_variant CONSTANT UUID := '679a0585-965e-4f00-a021-230628956c1d';
  kb_alternating_variant CONSTANT UUID := '0898be40-b908-4c3d-8f0e-b98306860b7f';
  kb_crush_variant CONSTANT UUID := '24b2bab7-d01f-4fc3-a542-80d6ea1c096a';
  barbell_variant CONSTANT UUID := '327b77fe-ada1-447b-948e-fe45f08fd82a';
  sandbag_variant CONSTANT UUID := 'ac5ef4bd-6e97-4ba4-a35c-d422af840881';
  variant_ids CONSTANT UUID[] := ARRAY[
    db_pair_variant,kb_single_variant,db_single_variant,db_close_variant,
    kb_pair_variant,kb_alternating_variant,kb_crush_variant,
    barbell_variant,sandbag_variant];
  source_ids CONSTANT BIGINT[] := ARRAY[188,402,433,435,487,488,489,495,1021];
  archive_definition_ids CONSTANT UUID[] := ARRAY[
    '943ff689-69b4-470f-b6ba-510ab8352237'::UUID,
    '7c4c75bc-692c-4dae-9775-f3c683f49f22'::UUID,
    'af7ad406-018e-4a62-a159-ebcdee2459bf'::UUID,
    'f3be53c7-81d7-46a4-bc0a-f9dcd5a8ba5b'::UUID,
    '421a5d53-4873-414c-a279-5c2cac77ba32'::UUID,
    '270439b8-8393-45f1-89f6-9044b6708bb1'::UUID,
    'e63530ff-a005-4c87-96eb-b852370e4345'::UUID,
    '3953ca6c-3083-4488-8cb9-db86c0fbd053'::UUID];
  current_video_ids CONSTANT TEXT[] := ARRAY[
    '9vcKpv45aeE','77gWg_ZA8Kg','T0Y3OBF1bNI','uUGDRwge4F8','i1yoygDuZlA'];
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://barbend.com/floor-press/","sourceTitle":"How to Do the Floor Press — Benefits, Variations, and More","sourcePublisher":"BarBend","sourceKind":"expert_instruction","evidenceQuality":72,"claims":["The direct technique source defines a supine external-load press whose eccentric travel ends when the upper arms contact the floor.","Dumbbell, kettlebell, barbell, sandbag, implement count, arm pattern, and grip preserve the floor-limited press identity when the repetition boundary remains explicit."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://blog.nasm.org/how-kettlebell-workouts-can-take-your-fitness-to-the-next-level","sourceTitle":"How Kettlebell Workouts Can Take Your Fitness to the Next Level","sourcePublisher":"National Academy of Sports Medicine","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["NASM describes a kettlebell floor press from supine with knees bent, controlled lowering, and pressing toward the ceiling.","The controlled taxonomy is push plus brace; bench-supported presses, closed-chain push-ups, overhead presses, fixed-arc landmine presses, flies, and combined bridge or dead-bug tasks remain distinct identities."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12019332/","sourceTitle":"Acute muscle excitation response across various bench press ranges of motion","sourcePublisher":"Scientific Reports","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["The adjacent bench-press experiment measured pectoralis major, triceps brachii, and anterior deltoid excitation across ranges of motion.","The Floor Press card names those press contributors plus scapular, rotator-cuff, wrist, hand, and trunk stabilizers without claiming that bench data proves a universal Floor Press activation ranking."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/31827348/","sourceTitle":"Range of Motion and Sticking Region Effects on the Bench Press Load-Velocity Relationship","sourcePublisher":"Journal of Sports Science and Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Bench-press range of motion changed load-velocity and sticking-region behavior in trained men.","This is adjacent evidence, not a direct dynamic Floor Press trial; floor contact is therefore modeled as an exercise-defining range boundary and loads are not converted from bench-press percentages without individual measurement."]},
    {"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/42367017/","sourceTitle":"Isometric Floor Press: A Valid, Reliable, and Practical Field-Based Assessment of Upper-Body Strength","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["A fixed-angle isometric floor-press assessment showed strong association with bench-press strength and good repeatability in a small recreationally trained sample.","The isometric test is not the dynamic exercise and does not supply difficulty scores; proposed scores use exercise complexity and physical difficulty only, with overall difficulty equal to their maximum and no athlete proficiency label."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","sourceTitle":"American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews","sourcePublisher":"Medicine and Science in Sports and Exercise","sourceKind":"professional_standard","evidenceQuality":96,"claims":["Resistance-training outcomes depend on load, volume, effort, frequency, and the training objective rather than one universal prescription.","Cumulative accounting records implement and quantity, external load, arm pattern and side dose, valid and failed repetitions, eccentric time, effort, grip, pressing volume, symptoms, and recovery before another high-demand upper-body press."]},
    {"sectionKey":"constraints","sourceUrl":"https://barbend.com/floor-press/","sourceTitle":"How to Do the Floor Press — Benefits, Variations, and More","sourcePublisher":"BarBend","sourceKind":"expert_instruction","evidenceQuality":72,"claims":["The direct guide distinguishes barbell, dumbbell, kettlebell, band or chain, and concentric setups and places the athlete supine in a clear floor or rack station.","Delivery must declare implement and count, rack and safety setup when applicable, pickup and set-down, floor surface, clearance, lower-body setup, grip, arm pattern, load, range, tempo, rest, and coach sightline."]},
    {"sectionKey":"dosage","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10579494/","sourceTitle":"Resistance training prescription for muscle strength and hypertrophy in healthy adults: a systematic review and Bayesian network meta-analysis","sourcePublisher":"British Journal of Sports Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":94,"claims":["Many resistance-training prescriptions improved strength and hypertrophy, with effects varying by load, sets, frequency, and outcome.","Floor Press profiles expose sets, repetitions or repetitions per side, external load or effort, tempo, rest, quality reserve, duration, and recovery instead of presenting one dose as universal."]},
    {"sectionKey":"instructions","sourceUrl":"https://barbend.com/floor-press/","sourceTitle":"How to Do the Floor Press — Benefits, Variations, and More","sourcePublisher":"BarBend","sourceKind":"expert_instruction","evidenceQuality":72,"claims":["The guide describes a stable supine setup, controlled descent until the upper arms meet the floor, maintained tension, and pressing to elbow extension.","Athlete instructions additionally require an exact implement, arm pattern, grip, lower-body setup, safe start and finish, load, dose, rest, and stop signal."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://barbend.com/floor-press/","sourceTitle":"How to Do the Floor Press — Benefits, Variations, and More","sourcePublisher":"BarBend","sourceKind":"expert_instruction","evidenceQuality":72,"claims":["Floor contact limits shoulder-extension travel but does not make every load, grip, setup, or symptom safe for every person.","Stop for pain, numbness or tingling, dizziness, breathing or pressure symptoms, uncontrolled upper-arm impact, wrist collapse, load drift, asymmetric lockout, unsafe pickup or set-down, rack or spotter failure, grinding, or loss of the declared repetition boundary."]},
    {"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/31827348/","sourceTitle":"Range of Motion and Sticking Region Effects on the Bench Press Load-Velocity Relationship","sourcePublisher":"Journal of Sports Science and Medicine","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Partial and full bench-press ranges had different load-velocity and sticking-region characteristics.","Floor Press is scheduled as a measured floor-limited horizontal press, not an automatic bench-press equivalent; substitutions must recompute load, fatigue, duration, logistics, equipment, range, and rendered instructions."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://blog.nasm.org/how-kettlebell-workouts-can-take-your-fitness-to-the-next-level","sourceTitle":"How Kettlebell Workouts Can Take Your Fitness to the Next Level","sourcePublisher":"National Academy of Sports Medicine","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["NASM provides a short kettlebell Floor Press sequence that can be rendered in plain language.","Athlete support must also show exact equipment, side or arm pattern, setup, load, repetitions, tempo, rest, expected effort, valid-repetition standard, stop signal, and what changed after a substitution."]},
    {"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/34198674/","sourceTitle":"The Effect of Grip Width on Muscle Strength and Electromyographic Activity in Bench Press among Novice- and Resistance-Trained Men","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Grip width changed six-repetition maximum loads and some measured muscle activity in adjacent bench-press conditions.","Grip cannot be a hidden detail; coach support records grip, wrist and elbow stacking, upper-arm contact, press path, symmetry, load, fatigue, symptoms, setup safety, and the exact effect of any change."]},
    {"sectionKey":"accessibility","sourceUrl":"https://blog.nasm.org/how-kettlebell-workouts-can-take-your-fitness-to-the-next-level","sourceTitle":"How Kettlebell Workouts Can Take Your Fitness to the Next Level","sourcePublisher":"National Academy of Sports Medicine","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["A floor-based press can remove the need for a bench but still requires safe transfer to and from the floor and controlled handling of the implement.","Offer written steps, still frames, a coach demonstration, lighter or single-implement options, longer transition time, alternate floor padding, and a non-floor press when floor access or transfer is not appropriate."]},
    {"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/34198674/","sourceTitle":"The Effect of Grip Width on Muscle Strength and Electromyographic Activity in Bench Press among Novice- and Resistance-Trained Men","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Grip changes can alter the exact pressing demand without changing the floor-limited press identity when the action and repetition boundary remain intact.","Bench Press, push-up, landmine floor press, floor fly, bridge floor press, dead-bug press, and fixed-angle isometric testing change support, kinetic chain, action, arc, range, or objective and require separate identities."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five exact-title candidates have current oEmbed link and iframe health only; full playback, exact identity and variant, captions, cue safety, accessibility, demonstration quality, reviewer identity, and approval remain unresolved."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"videoId":"9vcKpv45aeE","title":"Dumbbell Floor Press","channel":"Marcus Filly","query":"dumbbell floor press"},
    {"videoId":"77gWg_ZA8Kg","title":"How To Do Barbell Floor Press | John Rusin, PT, DPT, CSCS","channel":"Bodybuilding.com","query":"barbell floor press tutorial"},
    {"videoId":"T0Y3OBF1bNI","title":"How To Do A Dumbbell Floor Press","channel":"PureGym","query":"dumbbell floor press tutorial"},
    {"videoId":"uUGDRwge4F8","title":"How To: Dumbbell Floor Press","channel":"ScottHermanFitness","query":"dumbbell floor press technique"},
    {"videoId":"i1yoygDuZlA","title":"Floor Press","channel":"TrainingPeaks","query":"floor press exercise"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"name":"Dumbbell, Kettlebell, Barbell, or Sandbag Loading","class":"new_variant","why":"Implement geometry, quantity, increments, grip, path, pickup, set-down, and failure response change while the supine floor-limited press remains.","dimensions":{"implement":"exact_and_required","quantity":"exact_and_required"}},
    {"name":"Single-Arm, Simultaneous, or Alternating Pressing","class":"new_variant","why":"Arm pattern changes side dose, anti-rotation, stabilization, timing, and duration while preserving the press identity.","dimensions":{"armPattern":"unilateral_simultaneous_or_alternating","sideDose":"declared"}},
    {"name":"Close, Neutral, or Crush Grip","class":"new_variant","why":"Grip and implement relationship materially change wrist, elbow, triceps, pectoral, and grip demands and must be explicit.","dimensions":{"grip":"declared","implementRelationship":"independent_or_crushed_together"}},
    {"name":"Bent-Knee or Legs-Extended Setup","class":"modifier_annotation","why":"Lower-body setup changes base-of-support and possible leg contribution but does not change the floor-limited horizontal press action.","dimensions":{"lowerBodySetup":"declared","legDrivePolicy":"declared"}},
    {"name":"Pause, Tempo, and Range Ceiling","class":"modifier_annotation","why":"Tempo, pause duration, and a symptom-guided ceiling change dose and fatigue, not exercise identity, when upper-arm floor contact remains the terminal eccentric boundary.","dimensions":{"tempo":"declared","pause":"declared","range":"floor_limited"}},
    {"name":"Bands or Chains Overlay","class":"modifier_annotation","why":"Accommodating resistance changes the load curve and anchoring logistics but can remain an annotation only when the base press and safety contract are unchanged.","dimensions":{"resistanceOverlay":"band_or_chain","anchorSafety":"required"}},
    {"name":"Concentric Dead-Start Pin Floor Press","class":"new_definition","why":"A dead-start press from rack pins removes the standard eccentric-to-floor repetition sequence and adds exact pin-height and rack-failure constraints.","dimensions":{"start":"dead_start_on_pins","eccentric":"not_required_each_rep"}},
    {"name":"Isometric Floor Press Test","class":"new_definition","why":"A fixed-angle maximal or submaximal force test has no dynamic repetition and a measurement objective distinct from training repetitions.","dimensions":{"contraction":"isometric","jointAngle":"fixed","measurement":"force_plate_or_dynamometer"}},
    {"name":"Glute-Bridge Floor Press","class":"new_definition","why":"Sustained hip extension adds a bridge action, posterior-chain fatigue, spinal and pelvic constraints, and a combined validity contract.","dimensions":{"addedAction":"sustained_hip_extension"}},
    {"name":"Dead-Bug Floor Press","class":"new_definition","why":"Contralateral limb motion and anti-extension control add an ordered trunk task that a standard Floor Press does not require.","dimensions":{"addedAction":"dead_bug_limb_sequence"}},
    {"name":"Dumbbell Floor Fly","class":"new_definition","why":"A fly emphasizes shoulder horizontal abduction and adduction with limited elbow extension rather than the press action.","dimensions":{"action":"fly_not_press"}},
    {"name":"Bench Press, Push-Up, and One-Arm Landmine Floor Press","class":"new_definition","why":"Elevated bench support, closed-chain prone support, and anchored fixed-arc loading respectively change range, kinetic chain, setup, and force path.","dimensions":{"identityBoundary":"support_and_force_path"}}
  ]
  $json$::JSONB;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=canonical_id
        AND provenance_json->>'floorPressCompletionMigration'=migration_key)=1 THEN
    UPDATE coaching.exercise_definition_source_v1
    SET definition_id=canonical_id,source_kind='legacy_migration',
        provenance_json=provenance_json||jsonb_build_object(
          'floorPressIdentityMigration',migration_key,
          'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
    WHERE legacy_exercise_id=ANY(source_ids);
    UPDATE coaching.exercise SET skill_level=NULL WHERE id=ANY(source_ids);
    UPDATE coaching.exercise_safety_profile SET minimum_skill_level=NULL
    WHERE exercise_id=ANY(source_ids);
    INSERT INTO coaching.exercise_identity_resolution_v1(
      facility_id,survivor_definition_id,resolved_definition_id,decision,
      rationale,evidence_json,resolution_source,reviewed_by)
    VALUES
      (1,'f0cd9a6f-27c4-4285-a75c-c13f6b9e3162',canonical_id,'distinct_exercises','Close-Grip Bench Press uses elevated bench support and a bench-defined range; Floor Press is supine on the floor and ends eccentric travel at upper-arm floor contact.',jsonb_build_object('migration',migration_key,'identityBoundary','close_grip_elevated_bench_press_vs_floor_limited_press','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
      (1,canonical_id,'e75b37a5-e73e-46ca-a7f4-b1632e16bd57','distinct_exercises','Half-Kneeling Single-Arm Press is a vertical overhead press from a half-kneeling base; Floor Press is a supine horizontal press with an upper-arm floor boundary.',jsonb_build_object('migration',migration_key,'identityBoundary','supine_floor_limited_horizontal_press_vs_half_kneeling_vertical_press','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
      (1,canonical_id,'e768f302-a920-4aeb-8627-957fd7a96f00','distinct_exercises','One-Arm Row is a bench-supported horizontal pull with shoulder extension and elbow flexion; Floor Press is a supine horizontal push with elbow extension.',jsonb_build_object('migration',migration_key,'identityBoundary','supine_horizontal_push_vs_bench_supported_horizontal_pull','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL)
    ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
      decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
      evidence_json=EXCLUDED.evidence_json,
      resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
      resolved_at=now()
    WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
      AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';
    RETURN;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=canonical_id)<>1
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(archive_definition_ids))<>cardinality(archive_definition_ids)
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(variant_ids))<>cardinality(variant_ids)
    OR (SELECT count(*) FROM coaching.exercise
      WHERE id=ANY(source_ids))<>cardinality(source_ids) THEN
    RAISE EXCEPTION '% requires the protected Floor Press definition, variants, archived definitions, and legacy rows',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND (card_version<>1 OR status<>'review'
        OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL
        OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ANY(archive_definition_ids)
        AND (card_version<>1 OR status<>'archived' OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL
          OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE reviewed_by IS NOT NULL
        AND (survivor_definition_id=ANY(archive_definition_ids||ARRAY[canonical_id])
          OR resolved_definition_id=ANY(archive_definition_ids||ARRAY[canonical_id])))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(variant_ids) AND reviewed_by IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(variant_ids) OR to_variant_id=ANY(variant_ids))
        AND reviewed_by IS NOT NULL) THEN
    RAISE EXCEPTION '% refuses to overwrite human-reviewed or approved Floor Press state',migration_key;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND reviewed_card_version<2
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND reviewed_card_version<2
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',updated_at=now()
  WHERE definition_id=canonical_id AND reviewed_card_version<2
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived',updated_at=now()
  WHERE variant_id=ANY(variant_ids);

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id=canonical_id,source_kind='legacy_migration',
      provenance_json=provenance_json||jsonb_build_object(
        'floorPressIdentityMigration',migration_key,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_definition_v1
  SET canonical_name='Floor Press',display_name='Floor Press',
    aliases=ARRAY[
      'Barbell Floor Press','Barbell Close-Grip Floor Press',
      'Close Grip DB Floor Press','Close Grip Dumbbell Floor Press',
      'Close-Grip DB Floor Press','Close-Grip Dumbbell Floor Press',
      'CloseGrip DB Floor Press','CloseGrip Dumbbell Floor Press',
      'DB / KB Floor Press','DB / Kettlebell Floor Press','DB Floor Press',
      'Double KB Floor Press','Double Kettlebell Floor Press',
      'Dumbbell / KB Floor Press','Dumbbell / Kettlebell Floor Press',
      'Dumbbell Floor Press','Two-Dumbbell Floor Press',
      'Single-Arm Dumbbell Floor Press','One-Arm Dumbbell Floor Press',
      'KB Alternating Floor Press','Alternating Kettlebell Floor Press',
      'KB Crush Grip Floor Press','KB Crush-Grip Floor Press',
      'KB CrushGrip Floor Press','KB Floor Press',
      'Kettlebell Alternating Floor Press','Kettlebell Crush Grip Floor Press',
      'Kettlebell Crush-Grip Floor Press','Kettlebell CrushGrip Floor Press',
      'Kettlebell Floor Press','Single-Arm Kettlebell Floor Press',
      'One-Arm Kettlebell Floor Press','Sandbag Floor Press'],
    description='A supine external-load horizontal press performed from the floor: the athlete safely establishes the exact implement, grip, arm pattern, and lower-body setup; lowers under control until the upper arm contacts the floor without bouncing; then presses to the declared finish before a controlled reset and set-down.',
    family_key='supine_floor_limited_horizontal_press',schema_version='2.0.0',
    card_version=2,status='review',content_confidence=84,
    scoring_confidence=58,media_confidence=32,
    movement_patterns=ARRAY['push','brace'],
    body_regions=ARRAY['shoulder','elbow','wrist','hand','core','spine'],
    required_equipment=ARRAY[]::TEXT[],
    optional_equipment=ARRAY['dumbbell','kettlebell','barbell','plates','sandbag','squat_rack','mat'],
    environment_json=jsonb_build_object(
      'surface','stable_level_non_slip_floor_or_mat',
      'space',jsonb_build_array('clear_supine_body_space','clear_arm_and_implement_path','clear_pickup_set_down_and_emergency_exit_zone'),
      'rackPolicy','Barbell variants require a verified rack height and safety or spotting plan appropriate to the load; no solo maximal attempt is assumed.',
      'floorTransfer','Confirm the athlete can get to and from the floor and can establish and return the exact implements without uncontrolled loading.',
      'lighting','hands_wrists_elbows_shoulders_load_and_rack_visible',
      'coachSightline',jsonb_build_array('head_or_foot_end_for_symmetry','side_oblique_for_upper_arm_contact_and_wrist_elbow_stack'),
      'equipmentChecks',jsonb_build_array('implement_and_quantity_match','load_is_secure','floor_and_mat_do_not_slip','rack_and_safeties_match_variant','pickup_and_set_down_are_rehearsed')),
    population_json=jsonb_build_object(
      'screen',jsonb_build_array('pain_free_declared_press_range','safe_floor_transfer','safe_grip_and_load_control','tolerates_supine_position','no_unresolved_neurologic_dizziness_breathing_or_pressure_symptoms'),
      'individualize',jsonb_build_array('implement','quantity','arm_pattern','grip','lower_body_setup','external_load','range_ceiling','tempo','sets','repetitions_or_repetitions_per_side','rest','session_and_weekly_press_exposure'),
      'referOrModify',jsonb_build_array('acute_shoulder_elbow_wrist_hand_chest_or_back_symptoms','unexplained_neurologic_or_cardiopulmonary_symptoms','unsafe_floor_transfer','pregnancy_or_postpartum_supine_or_pressure_symptoms','unsafe_load_handling_or_spotting')),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('pectoralis_major','triceps_brachii','anterior_deltoid'),
      'secondaryMuscles',jsonb_build_array('serratus_anterior','rotator_cuff','scapular_stabilizers','forearm_and_hand_muscles','abdominal_wall_and_spinal_stabilizers'),
      'joints',jsonb_build_array('glenohumeral_joint','scapulothoracic_articulation','elbow','wrist_and_hand','thorax_and_spine'),
      'jointActions',jsonb_build_array('controlled_shoulder_horizontal_abduction_to_floor_boundary','shoulder_horizontal_adduction_during_press','elbow_flexion_during_lowering','elbow_extension_during_press','scapular_and_humeral_stabilization','wrist_and_hand_stabilization','ribcage_pelvis_and_spinal_stabilization'),
      'planes',jsonb_build_array('transverse_primary','sagittal_contribution','frontal_stabilization'),
      'laterality','bilateral_simultaneous_unilateral_or_bilateral_alternating_as_declared',
      'repetitionBoundary',jsonb_build_array('stable_supine_start_with_load_controlled','controlled_lower_until_upper_arm_contacts_floor_without_bounce','press_to_declared_elbow_extension','controlled_reset_or_safe_set_down'),
      'validitySignals',jsonb_build_array('exact_implement_quantity_arm_pattern_and_grip','safe_start','stable_supine_base','controlled_upper_arm_floor_contact','wrist_over_elbow_load_path','declared_press_finish','side_and_timing_match','no_bounce_or_unplanned_bridge','safe_reset_and_set_down'),
      'evidenceLimit','Direct dynamic Floor Press research is sparse. Bench-press range, grip, and muscle-excitation studies are adjacent evidence and do not prove a universal Floor Press load conversion, activation ranking, or clinical benefit.'),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','Builds measurable horizontal pressing strength and local chest, triceps, and shoulder capacity through a floor-limited range without requiring a bench.',
      'beforeYouStart',jsonb_build_array('Confirm the exact implement and count, working arm or arm pattern, grip, lower-body setup, load, repetitions, tempo, rest, and stop signal.','Clear the floor, test the rack or pickup, and rehearse the set-down before loading the working set.'),
      'steps',jsonb_build_array('Set up supine with the assigned lower-body position and the loads controlled over the elbows.','Brace and keep the wrists stacked over the elbows.','Lower smoothly until the upper arm meets the floor; do not bounce.','Press to the assigned finish while keeping the load path controlled.','Reset each repetition and return every implement safely after the set.'),
      'primaryCue','Stack wrist over elbow, touch the upper arm quietly, press evenly.',
      'expectedSensations',jsonb_build_array('chest_triceps_and_front_shoulder_effort','hand_and_wrist_stabilization','trunk_brace','increasing_local_effort_without_joint_symptoms'),
      'unexpectedSensations',jsonb_build_array('sharp_or_increasing_pain','joint_pinching','numbness_or_tingling','dizziness','breathing_or_pressure_symptoms','loss_of_grip_or_load_control'),
      'painGuidance','Stop with the load controlled, use the rehearsed set-down or coach assistance, and report the symptom; do not force another repetition.',
      'accessibility',jsonb_build_array('single_dumbbell_or_kettlebell','lighter_load','reduced_repetitions','longer_rest','alternate_floor_padding','written_steps','still_frames','coach_assisted_setup','non_floor_horizontal_press_when_floor_transfer_or_supine_tolerance_is_not_appropriate'),
      'reportImmediately',jsonb_build_array('pain','numbness_or_tingling','dizziness','breathing_or_pressure_symptoms','unsafe_floor_transfer','loss_of_load_control','rack_or_spotting_problem')),
    coach_support_json=jsonb_build_object(
      'setupChecklist',jsonb_build_array('Confirm exact variant, implement count, arm pattern and side dose, grip, lower-body setup, pickup, rack or spotting plan, load, range, tempo, sets, repetitions, rest, and set-down.','Inspect floor, mat, clearance, implement security, rack, safeties, spotter position, and emergency exit.','Confirm cumulative horizontal-press, triceps, anterior-shoulder, grip, and recovery budgets.'),
      'observationChecklist',jsonb_build_array('safe_start_and_floor_transfer','wrist_over_elbow','upper_arm_contact_is_quiet','shoulder_and_ribcage_control','load_path','elbow_extension_and_declared_finish','bilateral_symmetry_or_exact_side','alternating_timing','tempo','unplanned_bridge_or_leg_drive','grip','symptoms_and_fatigue','safe_set_down'),
      'observationViews',jsonb_build_array('head_or_foot_end_for_symmetry_and_load_path','side_oblique_for_contact_wrist_elbow_shoulders_and_ribcage','close_for_grip_rack_pickup_and_set_down'),
      'validRep',jsonb_build_array('correct_variant_and_setup','load_controlled_at_start','controlled_floor_contact','no_bounce','stacked_wrist_and_elbow','declared_press_finish','correct_side_or_timing','controlled_reset'),
      'faultCorrections',jsonb_build_object('hardFloorContact','Reduce load or eccentric speed and end the set if control does not return.','wristOrLoadDrift','Reduce load and restore wrist-over-elbow stacking.','asymmetricPress','Verify load and setup; regress to independent side work if appropriate.','unplannedBridge','Reduce load and restore the declared lower-body and pelvis contract.','unsafeSetup','Stop and rebuild the pickup, rack, safety, spotter, and set-down plan.','grinding','End the set before another repetition changes path or safety.'),
      'groupManagement',jsonb_build_object('station','one active athlete per clear floor and load lane','traffic','no crossing the head hand load or set-down zones','loadReturn','outside active lanes and never rolled toward another athlete','recording','record exact variant, side, valid and failed repetitions, load, fault, symptom, duration, and substitution'),
      'record',jsonb_build_array('definition_id','variant_id','profile_key','implement_and_quantity','arm_pattern_and_side','grip','lower_body_setup','rack_and_spotting_plan','external_load','range','tempo','sets','repetitions_or_repetitions_per_side','rest','RPE_or_RIR','valid_and_failed_repetitions','faults','symptoms','duration','substitution')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_variant_mismatch','implement_quantity_grip_or_side_mismatch','rack_pickup_set_down_or_floor_transfer_problem','dose_tempo_duration_or_recovery_mismatch','fatigue_symptom_or_load_control_event','media_caption_or_accessibility_issue','rendering_validation_or_persistence_issue'),
      'supportEscalation',jsonb_build_object('immediate',jsonb_build_array('pain','numbness_or_tingling','dizziness','breathing_or_pressure_symptoms','dropped_or_uncontrolled_load','rack_safety_or_spotter_failure'),'coachReview',jsonb_build_array('repeated_path_contact_or_symmetry_failure','setup_or_floor_transfer_difficulty','substitution_request','load_or_recovery_conflict'),'contentReview',jsonb_build_array('identity_confusion','media_mismatch','caption_or_accessibility_gap')),
      'retentionPolicy',jsonb_build_object('store',jsonb_build_array('definition_id','variant_id','profile_key','equipment','arm_pattern','side','grip','setup','load','range','tempo','dose','rest','duration','quality_result','stop_reason','symptoms','substitution','rendered_instructions'),'preserveHumanReviewHistory',TRUE,'neverOverwriteApprovedReview',TRUE),
      'changeImpactPolicy',jsonb_build_object('onVariantEquipmentArmPatternSideGripSetupLoadRangeTempoDoseOrProfileChange',jsonb_build_array('revalidate_selection','recompute_fatigue_recovery_and_impact','recompute_duration','recheck_logistics_and_spotting','rerender_coach_and_athlete_instructions','persist_new_validation'),'neverSilent',TRUE)),
    provenance_json=(provenance_json-'researchSource'-'researchSources')||jsonb_build_object(
      'floorPressCompletionMigration',migration_key,'researchVersion',research_version,
      'canonicalAuditContract','canonical-card-audit-v1','canonicalAuthoredFromResearch',TRUE,
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'overallDifficultyFormula','max(exercise_complexity,physical_difficulty)',
      'primaryIdentitySource','https://barbend.com/floor-press/',
      'supersededUnrelatedSource','https://pubmed.ncbi.nlm.nih.gov/23096062/',
      'supersededSourceReason','study_is_overhead_shoulder_press_not_floor_press',
      'directDynamicResearchLimit','sparse',
      'mediaVerificationScope','youtube_oembed_link_and_embed_health_only',
      'legacyCardsAudited',9,'activeVariantsAuthored',9,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,updated_at=now()
  WHERE id=canonical_id;

  UPDATE coaching.exercise_definition_v1
  SET status='archived',updated_at=now(),
      provenance_json=provenance_json||jsonb_build_object(
        'consolidatedIntoDefinitionId',canonical_id,
        'floorPressCompletionMigration',migration_key,
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
      'impact',1,'workCapacityDemand',spec.work_capacity,
      'baseOverallDifficulty',GREATEST(spec.technical,spec.physical),
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'overallFormula','max(exercise_complexity,physical_difficulty)'),
    requirements_json=jsonb_build_object(
      'selectable',TRUE,'bodyPosition','supine_on_floor',
      'implement',spec.implement,'implementQuantity',spec.quantity,
      'armPattern',spec.arm_pattern,'sideDose',spec.side_dose,'grip',spec.grip,
      'lowerBodySetup','knees_bent_feet_planted_or_legs_extended_as_declared',
      'legDrivePolicy','declared_and_consistent_no_unplanned_bridge',
      'rangeBoundary','upper_arm_contacts_floor_without_bounce',
      'pressFinish','declared_elbow_extension_with_load_control',
      'tempo','controlled_eccentric_and_press','surface','stable_level_non_slip',
      'pickupAndSetDown',spec.pickup,'rackAndSpotting',spec.rack_policy,
      'invalid',jsonb_build_array('wrong_implement_quantity_arm_pattern_side_or_grip','unsafe_start_or_set_down','hard_or_bouncing_upper_arm_contact','wrist_collapse_or_load_drift','uncontrolled_shoulder_or_ribcage_position','unplanned_bridge_or_leg_drive','wrong_alternating_sequence','missed_tempo','grinding_or_load_control_loss')),
    load_profile_json=jsonb_build_object(
      'loadingType',spec.loading_type,'externalLoadMethod',spec.load_method,
      'externalLoadRecorded',TRUE,'gripDemand',spec.grip_demand,
      'spinalLoading',spec.spinal,'eccentricStress',spec.eccentric_stress,
      'landingContactsPerRep',0,
      'primaryStress',jsonb_build_array('horizontal_press_force','elbow_extension','anterior_shoulder_and_pectoral_loading','grip_and_load_stabilization'),
      'loadAccounting',jsonb_build_object('recordImplementAndQuantity',TRUE,'recordExternalLoad',TRUE,'recordArmPatternAndSideDose',TRUE,'recordGrip',TRUE,'recordLowerBodySetup',TRUE,'recordValidAndFailedRepetitions',TRUE,'recordRangeTempoRestAndEffort',TRUE,'recordRackSpottingPickupAndSetDown',TRUE)),
    fatigue_profile_json=jsonb_build_object(
      'localMuscleFatigue',spec.local_fatigue,'gripFatigue',spec.grip_demand,
      'technicalFatigueSensitivity',spec.technical_fatigue,
      'impactAccumulation',1,'recoveryHours',spec.recovery_hours,
      'qualityLossSignals',jsonb_build_array('harder_floor_contact','wrist_or_load_path_drift','asymmetric_press_or_lockout','unplanned_bridge_or_leg_drive','range_shortening','timing_error','grip_loss','grinding','unsafe_reset_or_set_down'),
      'cumulativeRules',jsonb_build_array('count_valid_and_failed_repetitions_and_each_unilateral_side','include_implement_quantity_external_load_grip_tempo_effort_and_rest','include_same_session_bench_pushup_dip_overhead_press_fly_triceps_and_throwing_work','increase_recovery_after_high_effort_high_volume_or_slow_eccentric_pressing')),
    programming_profile_json=jsonb_build_object(
      'preferredBlock','capacity_or_resilience_before_material_upper_body_press_fatigue',
      'primaryObjectives',jsonb_build_array('horizontal_press_strength','chest_triceps_and_anterior_shoulder_capacity','load_path_and_symmetry_control'),
      'cumulativeFatigueBudget','sum valid and failed repetitions, unilateral side dose, implement quantity, external load, grip, eccentric time, effort, press overlap, symptoms, and recovery',
      'impactBudget','zero direct landing contacts; preserve the workout impact budget for other exercises',
      'weeklyExposure',jsonb_build_object('frequency','individualized_from_objective_load_effort_symptoms_recovery_and_total_press_plan','minimumRecoveryHours',spec.recovery_hours),
      'sequenceRules',jsonb_build_array('confirm_exact_variant_setup_and_safe_exit','perform_before_fatigue_changes_contact_path_grip_or_symmetry','preserve_floor_boundary_and_declared_finish','stop_before_grinding_or_load_control_loss'),
      'pairingCompatibility',jsonb_build_array('low_fatigue_lower_body_mobility_or_breathing_during_full_rest'),
      'interferenceRules',jsonb_build_array('do_not_pre_fatigue_grip_triceps_or_anterior_shoulders_before_priority_press_or_throw_work','do_not_treat_floor_contact_as_permission_to_bounce_or_overload','recompute_load_fatigue_duration_logistics_spotting_and_rendering_after_substitution')),
    status='review',updated_at=now()
  FROM (VALUES
    (db_pair_variant,'dumbbell-pair-simultaneous','Floor Press — Two Dumbbells',ARRAY['dumbbell','two_implements','simultaneous','standard_grip']::TEXT[],42,58,44,38,40,56,'dumbbell','two','bilateral_simultaneous','both_arms_each_repetition','neutral_or_pronated_as_declared','controlled_roll_or_coach_assisted_floor_setup','no_rack_spotter_optional_by_load','independent_free_weights','dumbbell_increment',46,20,45,62,48,36),
    (db_single_variant,'dumbbell-single-arm','Floor Press — Single-Arm Dumbbell',ARRAY['dumbbell','one_implement','unilateral']::TEXT[],52,52,58,40,40,52,'dumbbell','one','unilateral','repetitions_per_side_declared_and_balanced','neutral_or_pronated_as_declared','two_hand_assisted_positioning_and_controlled_set_down','no_rack_coach_assistance_as_needed','independent_unilateral_free_weight','dumbbell_increment',32,24,45,56,58,36),
    (db_close_variant,'dumbbell-pair-close-neutral','Floor Press — Two Dumbbells, Close Neutral Grip',ARRAY['dumbbell','two_implements','simultaneous','close_neutral_grip']::TEXT[],46,60,48,40,42,56,'dumbbell','two','bilateral_simultaneous','both_arms_each_repetition','close_neutral','controlled_roll_or_coach_assisted_floor_setup','no_rack_spotter_optional_by_load','independent_close_neutral_free_weights','dumbbell_increment',48,20,46,64,52,36),
    (kb_single_variant,'kettlebell-single-arm','Floor Press — Single-Arm Kettlebell',ARRAY['kettlebell','one_implement','unilateral']::TEXT[],56,54,62,44,44,52,'kettlebell','one','unilateral','repetitions_per_side_declared_and_balanced','neutral_with_bell_stacked_on_forearm','two_hand_assisted_roll_to_rack_and_controlled_return','no_rack_coach_assistance_as_needed','offset_unilateral_free_weight','kettlebell_increment',38,26,46,58,62,36),
    (kb_pair_variant,'kettlebell-pair-simultaneous','Floor Press — Two Kettlebells',ARRAY['kettlebell','two_implements','simultaneous']::TEXT[],50,62,54,46,48,58,'kettlebell','two','bilateral_simultaneous','both_arms_each_repetition','neutral_with_bells_stacked_on_forearms','controlled_roll_to_rack_or_coach_assisted_setup','no_rack_spotter_optional_by_load','offset_bilateral_free_weights','kettlebell_increment',54,24,48,66,56,42),
    (kb_alternating_variant,'kettlebell-pair-alternating','Floor Press — Two Kettlebells, Alternating',ARRAY['kettlebell','two_implements','alternating']::TEXT[],62,60,70,50,48,62,'kettlebell','two','bilateral_alternating','equal_repetitions_per_side_and_sequence_declared','neutral_with_bells_stacked_on_forearms','controlled_roll_to_rack_or_coach_assisted_setup','no_rack_spotter_optional_by_load','offset_alternating_free_weights','kettlebell_increment',54,28,50,66,68,42),
    (kb_crush_variant,'kettlebell-crush-grip','Floor Press — Kettlebell Crush Grip',ARRAY['kettlebell','crush_grip','simultaneous']::TEXT[],56,58,62,46,46,58,'kettlebell','one_or_two_as_declared','bilateral_simultaneous','both_arms_each_repetition','continuous_crush_grip','two_hand_controlled_positioning_and_set_down','no_rack_coach_assistance_as_needed','crush_grip_centered_free_weight','kettlebell_increment',62,24,46,64,62,42),
    (barbell_variant,'barbell-standard','Floor Press — Barbell',ARRAY['barbell','bilateral','simultaneous','rack_setup']::TEXT[],52,72,56,66,72,62,'barbell','one_bar','bilateral_simultaneous','both_arms_each_repetition','pronated_width_declared','rack_unrack_and_rerack_only','verified_squat_rack_safeties_and_spotter_plan','plate_loaded_long_bar','barbell_and_plates',44,24,52,72,56,48),
    (sandbag_variant,'sandbag-bilateral','Floor Press — Sandbag',ARRAY['sandbag','bilateral','simultaneous']::TEXT[],56,64,62,54,58,64,'sandbag','one','bilateral_simultaneous','both_arms_each_repetition','bag_handles_or_body_as_declared','controlled_roll_or_coach_assisted_positioning','no_rack_coach_assistance_as_needed','shifting_odd_object','sandbag_total_mass',66,28,50,70,64,48)
  ) AS spec(id,variant_key,display_name,modifier_keys,technical,physical,
    coordination,supervision,failure,work_capacity,implement,quantity,
    arm_pattern,side_dose,grip,pickup,rack_policy,loading_type,load_method,
    grip_demand,spinal,eccentric_stress,local_fatigue,technical_fatigue,
    recovery_hours)
  WHERE variant.id=spec.id;

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT variant.id,'capacity-strength','capacity','primary',
    'Build measurable floor-limited horizontal pressing strength with the exact implement, arm pattern, grip, and setup.',
    92,92,
    jsonb_build_object('horizontalPressStrength',5,'localPressCapacity',5,'symmetryAndPathControl',4,'impactContribution',0),
    CASE WHEN variant.requirements_json->>'sideDose' LIKE '%repetitions_per_side%'
      THEN jsonb_build_object('doseType','repetitions_per_side','sets',3,'repetitionsPerSide',CASE WHEN variant.id=kb_alternating_variant THEN 5 ELSE 6 END,'tempo','controlled_lower_no_bounce_then_press','effort','leave_two_or_more_clean_repetitions_in_reserve','restSeconds',CASE WHEN variant.id=barbell_variant THEN 150 ELSE 120 END,'sideOrder','declared_and_balanced')
      ELSE jsonb_build_object('doseType','repetitions','sets',3,'repetitions',CASE WHEN variant.id=barbell_variant THEN 5 ELSE 6 END,'tempo','controlled_lower_no_bounce_then_press','effort','leave_two_or_more_clean_repetitions_in_reserve','restSeconds',CASE WHEN variant.id=barbell_variant THEN 150 ELSE 120 END)
    END,
    'Every counted repetition matches the exact implement, quantity, arm pattern, side, grip, and lower-body setup; begins with control; touches the upper arm quietly to the floor; preserves wrist-over-elbow load path; reaches the declared finish; and resets safely without bounce, unplanned bridge, grinding, or spotting failure.',
    ARRAY['pain_or_neurologic_symptom','dizziness_breathing_or_pressure_symptom','unsafe_floor_transfer_pickup_unrack_rerack_or_set_down','rack_safety_or_spotter_failure','hard_or_bouncing_floor_contact','wrist_collapse_or_load_path_drift','repeated_asymmetry_or_timing_error','unplanned_bridge_or_leg_drive','grip_loss','grinding_or_load_control_loss'],
    ARRAY['Verify exact variant, load, floor transfer, pickup or rack, spotting, dose, and set-down.','Observe floor contact and path from side-oblique and symmetry from the head or foot end.','Count valid and failed work, including each unilateral side.','Stop before contact, path, grip, symmetry, or safety changes.'],
    ARRAY['Set the exact equipment and body position.','Stack wrist over elbow and brace.','Touch the upper arm quietly to the floor.','Press evenly to the assigned finish.','Reset and set every load down with control.'],
    'Improved floor-limited horizontal pressing strength, local chest and triceps capacity, and repeatable load-path control.',
    equipment.required,
    jsonb_build_object('athletesPerStation',1,'clearance','full_supine_body_arm_load_and_exit_zone','setupSeconds',CASE WHEN variant.id=barbell_variant THEN 75 ELSE 45 END,'transitionSeconds',CASE WHEN variant.id=barbell_variant THEN 60 ELSE 30 END,'sideChangeSeconds',CASE WHEN variant.requirements_json->>'sideDose' LIKE '%repetitions_per_side%' THEN 20 ELSE 0 END,'pickupAndSetDown',variant.requirements_json->>'pickupAndSetDown','rackAndSpotting',variant.requirements_json->>'rackAndSpotting','coachSightline',jsonb_build_array('head_or_foot_end','side_oblique'),'substitutionRevalidation',jsonb_build_array('equipment','arm_pattern','side_dose','grip','setup','load','fatigue','duration','rack_and_spotting','population_constraints')),
    ARRAY[]::UUID[],'review',
    jsonb_build_object('setupSeconds',CASE WHEN variant.id=barbell_variant THEN 75 ELSE 45 END,'secondsPerRep',6,'sideChangeSeconds',CASE WHEN variant.requirements_json->>'sideDose' LIKE '%repetitions_per_side%' THEN 20 ELSE 0 END,'transitionSeconds',CASE WHEN variant.id=barbell_variant THEN 60 ELSE 30 END,'durationFormula','setup + sets * (repetitions_or_repetitions_per_side * seconds_per_rep * applicable_sides + side_change + rest) + transition','countBothSides',variant.requirements_json->>'sideDose' LIKE '%repetitions_per_side%'),
    jsonb_build_object('reduce',jsonb_build_array('reduce_load','reduce_repetitions','increase_rest','use_single_implement_with_balanced_side_dose','simplify_grip_or_arm_pattern','use_coach_assisted_setup'),'increase',jsonb_build_array('increase_load_in_small_increment','add_repetition_within_cap','increase_set_only_after_recovery_review','change_grip_arm_pattern_or_implement_only_as_a_revalidated_variant'),'revalidateAfterChange',TRUE),
    jsonb_build_object('record',jsonb_build_array('variant_id','profile_key','implement_and_quantity','arm_pattern_and_side','grip','lower_body_setup','rack_and_spotting','load','range','tempo','valid_repetitions','failed_repetitions','RPE_or_RIR','rest','faults','symptoms','duration'),'validity','all exact setup, floor-contact, load-path, finish, timing, and reset gates pass'),
    jsonb_build_object('before','Which implement, quantity, arm pattern, side, grip, setup, load, dose, rest, and safety plan were assigned?','during','Are floor contact, wrist and elbow stack, load path, symmetry or timing, grip, and symptoms still valid?','after','Record valid and failed work, each side, load, effort, symptoms, duration, set-down, and any substitution before continuing.')
  FROM coaching.exercise_variant_v1 variant
  JOIN (VALUES
    (db_pair_variant,ARRAY['dumbbell']::TEXT[]),
    (db_single_variant,ARRAY['dumbbell']::TEXT[]),
    (db_close_variant,ARRAY['dumbbell']::TEXT[]),
    (kb_single_variant,ARRAY['kettlebell']::TEXT[]),
    (kb_pair_variant,ARRAY['kettlebell']::TEXT[]),
    (kb_alternating_variant,ARRAY['kettlebell']::TEXT[]),
    (kb_crush_variant,ARRAY['kettlebell']::TEXT[]),
    (barbell_variant,ARRAY['barbell','plates','squat_rack']::TEXT[]),
    (sandbag_variant,ARRAY['sandbag']::TEXT[])
  ) equipment(variant_id,required) ON equipment.variant_id=variant.id
  WHERE variant.id=ANY(variant_ids)
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

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT variant.id,'resilience-controlled-volume','resilience','secondary',
    'Build repeatable floor-contact, press-path, and local tissue capacity under controlled submaximal volume.',
    84,88,
    jsonb_build_object('localPressCapacity',5,'pathAndSymmetryControl',5,'strengthEndurance',4,'impactContribution',0),
    CASE WHEN variant.requirements_json->>'sideDose' LIKE '%repetitions_per_side%'
      THEN jsonb_build_object('doseType','repetitions_per_side','sets',2,'repetitionsPerSide',8,'tempo','three_second_lower_quiet_contact_controlled_press','effort','end_before_contact_path_timing_or_grip_changes','restSeconds',90,'sideOrder','declared_and_balanced')
      ELSE jsonb_build_object('doseType','repetitions','sets',2,'repetitions',8,'tempo','three_second_lower_quiet_contact_controlled_press','effort','end_before_contact_path_symmetry_or_grip_changes','restSeconds',90)
    END,
    'The final valid repetition matches the first for implement, setup, quiet floor contact, wrist-over-elbow path, declared finish, symmetry or timing, and controlled reset; the set ends before fatigue changes the exercise.',
    ARRAY['pain_or_neurologic_symptom','dizziness_breathing_or_pressure_symptom','unsafe_setup_or_set_down','hard_or_bouncing_floor_contact','path_or_wrist_drift','side_asymmetry_or_sequence_error','unplanned_bridge_or_leg_drive','missed_eccentric_time','grip_loss','fatigue_changes_validity'],
    ARRAY['Use a submaximal load that preserves the exact contact and path standard.','Count failed repetitions in the cumulative budget.','End the set at the first repeated contact, path, symmetry, timing, grip, or tempo fault.','Revalidate recovery before adding another press exposure.'],
    ARRAY['Lower slowly and touch the upper arm quietly.','Keep wrist over elbow and the body setup unchanged.','Press with the assigned arm pattern.','Stop while every repetition still matches.'],
    'Improved repeatable floor-limited pressing control and local upper-body capacity at a submaximal load.',
    equipment.required,
    jsonb_build_object('athletesPerStation',1,'clearance','full_supine_body_arm_load_and_exit_zone','setupSeconds',CASE WHEN variant.id=barbell_variant THEN 75 ELSE 45 END,'transitionSeconds',CASE WHEN variant.id=barbell_variant THEN 60 ELSE 30 END,'sideChangeSeconds',CASE WHEN variant.requirements_json->>'sideDose' LIKE '%repetitions_per_side%' THEN 20 ELSE 0 END,'pickupAndSetDown',variant.requirements_json->>'pickupAndSetDown','rackAndSpotting',variant.requirements_json->>'rackAndSpotting','coachSightline',jsonb_build_array('head_or_foot_end','side_oblique'),'substitutionRevalidation',jsonb_build_array('equipment','arm_pattern','side_dose','grip','setup','load','fatigue','recovery','duration','rack_and_spotting','population_constraints')),
    ARRAY[]::UUID[],'review',
    jsonb_build_object('setupSeconds',CASE WHEN variant.id=barbell_variant THEN 75 ELSE 45 END,'secondsPerRep',8,'sideChangeSeconds',CASE WHEN variant.requirements_json->>'sideDose' LIKE '%repetitions_per_side%' THEN 20 ELSE 0 END,'transitionSeconds',CASE WHEN variant.id=barbell_variant THEN 60 ELSE 30 END,'durationFormula','setup + sets * (repetitions_or_repetitions_per_side * seconds_per_rep * applicable_sides + side_change + rest) + transition','countBothSides',variant.requirements_json->>'sideDose' LIKE '%repetitions_per_side%'),
    jsonb_build_object('reduce',jsonb_build_array('reduce_load','reduce_repetitions','increase_rest','simplify_arm_pattern_or_grip','use_single_implement_with_balanced_side_dose'),'increase',jsonb_build_array('add_repetition_within_quality_cap','increase_load_smallest_increment','increase_eccentric_time_only_after_duration_and_recovery_review'),'revalidateAfterChange',TRUE),
    jsonb_build_object('record',jsonb_build_array('variant_id','profile_key','implement_and_quantity','arm_pattern_and_side','grip','setup','load','range','tempo','valid_repetitions','failed_repetitions','RPE_or_RIR','rest','quality_stop','symptoms','duration'),'validity','last valid repetition preserves the first-repetition contact, path, timing, and setup'),
    jsonb_build_object('before','Show the submaximal load, exact variant, side dose, tempo, rest, and quality stop.','during','Stop when contact, path, symmetry, timing, grip, tempo, or symptoms change.','after','Store completed and failed work, stop reason, effort, symptoms, duration, and recovery effect.')
  FROM coaching.exercise_variant_v1 variant
  JOIN (VALUES
    (db_pair_variant,ARRAY['dumbbell']::TEXT[]),
    (db_single_variant,ARRAY['dumbbell']::TEXT[]),
    (db_close_variant,ARRAY['dumbbell']::TEXT[]),
    (kb_single_variant,ARRAY['kettlebell']::TEXT[]),
    (kb_pair_variant,ARRAY['kettlebell']::TEXT[]),
    (kb_alternating_variant,ARRAY['kettlebell']::TEXT[]),
    (kb_crush_variant,ARRAY['kettlebell']::TEXT[]),
    (barbell_variant,ARRAY['barbell','plates','squat_rack']::TEXT[]),
    (sandbag_variant,ARRAY['sandbag']::TEXT[])
  ) equipment(variant_id,required) ON equipment.variant_id=variant.id
  WHERE variant.id=ANY(variant_ids)
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
    'Public YouTube oEmbed link and iframe health rechecked 2026-08-02. Full playback must verify exact Floor Press identity and variant, implement and quantity, arm pattern and side, grip, setup, range, tempo, rack or pickup and set-down, cue safety, captions, accessibility, demonstration quality, and conflicts. No content verification, exact match, reviewer, or approval is inferred.'
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
    (db_pair_variant,db_single_variant,'lateral_substitution',86,ARRAY['load','complexity','stability'],'Single-arm loading changes side dose and anti-rotation while preserving dumbbell Floor Press identity.',$json$ {"revalidate":["side_dose","load","duration","fatigue","rendering"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_single_variant,db_pair_variant,'lateral_substitution',86,ARRAY['load','complexity','stability'],'Two-dumbbell simultaneous loading changes total load, setup, symmetry, and duration.',$json$ {"revalidate":["equipment_quantity","side_dose","load","duration","fatigue","rendering"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_pair_variant,db_close_variant,'lateral_substitution',90,ARRAY['complexity','stability','load'],'Close neutral grip changes wrist, elbow, load path, and local demand without changing the floor boundary.',$json$ {"revalidate":["grip","load","symptoms","fatigue","rendering"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_close_variant,db_pair_variant,'lateral_substitution',90,ARRAY['complexity','stability','load'],'Standard declared grip restores independent dumbbell path and changes local demand.',$json$ {"revalidate":["grip","load","symptoms","fatigue","rendering"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_single_variant,kb_single_variant,'equipment_equivalent',91,ARRAY['load','stability','complexity'],'Single-arm dumbbell and kettlebell variants preserve side-specific Floor Press action but change center of mass, wrist position, grip, increments, pickup, and set-down.',$json$ {"revalidate":["equipment","load","grip","pickup_set_down","duration","rendering"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (kb_single_variant,db_single_variant,'equipment_equivalent',91,ARRAY['load','stability','complexity'],'Changing from kettlebell to dumbbell preserves the unilateral press while changing implement geometry and handling.',$json$ {"revalidate":["equipment","load","grip","pickup_set_down","duration","rendering"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_pair_variant,kb_pair_variant,'equipment_equivalent',90,ARRAY['load','stability','complexity'],'Two-dumbbell and two-kettlebell simultaneous presses share the repetition boundary but not implement geometry, wrist demand, setup, increments, or fatigue.',$json$ {"revalidate":["equipment","load","grip","setup","fatigue","rendering"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (kb_pair_variant,db_pair_variant,'equipment_equivalent',90,ARRAY['load','stability','complexity'],'Two dumbbells replace two kettlebells while preserving bilateral simultaneous Floor Press action.',$json$ {"revalidate":["equipment","load","grip","setup","fatigue","rendering"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (kb_pair_variant,kb_alternating_variant,'progression',84,ARRAY['complexity','stability','fatigue'],'Alternating sides adds sequencing, unilateral hold time, side-dose accounting, and anti-rotation demand.',$json$ {"requires":["owns_simultaneous_kettlebell_path","equal_side_dose_is_declared"],"recompute":["duration","fatigue","side_dose"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (kb_alternating_variant,kb_pair_variant,'regression',84,ARRAY['complexity','stability','fatigue'],'Simultaneous pressing removes alternating sequence and unilateral hold time while retaining two kettlebells.',$json$ {"useWhen":["alternating_timing_or_hold_demand_exceeds_objective"],"recompute":["duration","fatigue","side_dose"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (kb_pair_variant,kb_crush_variant,'lateral_substitution',82,ARRAY['load','stability','complexity'],'Crush grip changes continuous inward force, hand relationship, grip fatigue, and load handling.',$json$ {"revalidate":["implement_quantity","grip","load","fatigue","rendering"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (kb_crush_variant,kb_pair_variant,'lateral_substitution',82,ARRAY['load','stability','complexity'],'Independent kettlebells remove the crush-grip contract and change path and stabilization.',$json$ {"revalidate":["implement_quantity","grip","load","fatigue","rendering"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_pair_variant,barbell_variant,'equipment_equivalent',78,ARRAY['load','complexity','stability'],'Barbell loading adds a long shared implement, rack, safeties, spotting, higher load capacity, and distinct failure response.',$json$ {"requires":["verified_rack_safeties_and_spotter_plan"],"recompute":["load","fatigue","duration","logistics","rendering"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (barbell_variant,db_pair_variant,'equipment_equivalent',78,ARRAY['load','complexity','stability'],'Two dumbbells remove the shared bar and rack contract but add independent load paths and floor handling.',$json$ {"requires":["safe_two_dumbbell_pickup_and_set_down"],"recompute":["load","fatigue","duration","logistics","rendering"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_pair_variant,sandbag_variant,'equipment_equivalent',76,ARRAY['load','complexity','stability'],'Sandbag loading adds an odd-object center of mass, grip, pickup, set-down, and shifting-load behavior.',$json$ {"requires":["safe_sandbag_positioning_and_set_down"],"recompute":["load","grip","fatigue","duration","logistics","rendering"]}$json$::JSONB,'review',NULL,NULL,NULL),
    (sandbag_variant,db_pair_variant,'equipment_equivalent',76,ARRAY['load','complexity','stability'],'Two dumbbells replace the shifting sandbag with independent fixed implements while preserving the press boundary.',$json$ {"requires":["safe_two_dumbbell_pickup_and_set_down"],"recompute":["load","grip","fatigue","duration","logistics","rendering"]}$json$::JSONB,'review',NULL,NULL,NULL)
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
    'The source preserves the same supine floor-limited external-load press; its implement, quantity, arm pattern, grip, setup, load, tempo, or context remains an exact variant or delivery annotation.',
    jsonb_build_object('migration',migration_key,
      'resolution','same_floor_limited_horizontal_press_with_exact_variant_or_modifier',
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
    (1,'bf46fc94-2b8a-4a21-871f-c5cdd15ae33b',canonical_id,'distinct_exercises','Bench Press uses elevated bench support and permits shoulder-extension range below the torso plane; Floor Press ends eccentric travel at upper-arm floor contact.',jsonb_build_object('migration',migration_key,'identityBoundary','elevated_bench_full_range_vs_floor_limited_range','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'46c7611a-e107-4e32-9c81-d688e509fe73','distinct_exercises','Push-Up is a prone closed-chain task that moves the body relative to fixed hands; Floor Press is supine and moves external implements.',jsonb_build_object('migration',migration_key,'identityBoundary','closed_chain_body_motion_vs_supine_external_load_press','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'8305427c-f56b-48a5-b7ff-6bd9a11c65c6','distinct_exercises','One-Arm Landmine Floor Press uses an anchored bar and fixed arc with unilateral landmine setup; free-weight Floor Press variants have unanchored load paths.',jsonb_build_object('migration',migration_key,'identityBoundary','anchored_fixed_arc_vs_unanchored_free_weight_path','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'45e955d5-8e87-4833-89b7-da0d76b99fb4','distinct_exercises','Z Press is a seated overhead press; Floor Press is a supine horizontal press with an upper-arm floor boundary.',jsonb_build_object('migration',migration_key,'identityBoundary','seated_overhead_press_vs_supine_floor_limited_horizontal_press','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'24bc986e-f732-40d8-9401-9d36e4e75b91','distinct_exercises','Kettlebell Crush-Grip Curl is elbow flexion; Kettlebell Crush-Grip Floor Press is a horizontal press with elbow extension.',jsonb_build_object('migration',migration_key,'identityBoundary','elbow_flexion_curl_vs_horizontal_press','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,'f0cd9a6f-27c4-4285-a75c-c13f6b9e3162',canonical_id,'distinct_exercises','Close-Grip Bench Press uses elevated bench support and a bench-defined range; Floor Press is supine on the floor and ends eccentric travel at upper-arm floor contact.',jsonb_build_object('migration',migration_key,'identityBoundary','close_grip_elevated_bench_press_vs_floor_limited_press','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'e75b37a5-e73e-46ca-a7f4-b1632e16bd57','distinct_exercises','Half-Kneeling Single-Arm Press is a vertical overhead press from a half-kneeling base; Floor Press is a supine horizontal press with an upper-arm floor boundary.',jsonb_build_object('migration',migration_key,'identityBoundary','supine_floor_limited_horizontal_press_vs_half_kneeling_vertical_press','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'e768f302-a920-4aeb-8627-957fd7a96f00','distinct_exercises','One-Arm Row is a bench-supported horizontal pull with shoulder extension and elbow flexion; Floor Press is a supine horizontal push with elbow extension.',jsonb_build_object('migration',migration_key,'identityBoundary','supine_horizontal_push_vs_bench_supported_horizontal_pull','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL)
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
      WHEN 'technicalComplexity' THEN 'Review-only exercise-complexity anchor for exact implement and count, floor transfer or rack, arm pattern and side dose, grip, load path, floor contact, timing, pickup, spotting, and set-down of '
      ELSE 'Review-only physical-difficulty anchor for external load, press volume, unilateral hold time, grip, eccentric demand, local fatigue, and recovery of ' END
      ||variant.display_name||'. No athlete proficiency classification is represented.',
    'review',1,NULL,NULL,NULL,NULL
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(key)
  WHERE variant.id=ANY(variant_ids)
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
      'logisticsAndSpottingComplete',TRUE,'measurementAndValidityComplete',TRUE,
      'substitutionValidationComplete',TRUE,'athleteSupportComplete',TRUE,
      'coachSupportComplete',TRUE,'supportOperationsComplete',TRUE,
      'stopRulesComplete',TRUE,'evidenceCandidateSetComplete',TRUE,
      'mediaCandidateSetComplete',TRUE,'mediaApprovalComplete',FALSE,
      'graphReviewComplete',FALSE,'calibrationReviewComplete',FALSE,
      'exerciseSkillLevelAbsent',TRUE,'publicationApproved',FALSE),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must review full playback for exact Floor Press identity and variant, equipment, arm pattern and side, grip, setup, floor contact, load path, rack or pickup and set-down, captions, safety, accessibility, conflicts, and demonstration quality.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must review every progression, regression, substitution, and equipment-equivalence proposal.'),
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
        AND provenance_json->>'floorPressCompletionMigration'=migration_key
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL AND approved_video_url IS NULL)<>1
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(archive_definition_ids) AND status='archived')<>8 THEN
    RAISE EXCEPTION '% found invalid final definition states',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(variant_ids) AND definition_id=canonical_id AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=
          GREATEST((difficulty_json->>'technicalComplexity')::INTEGER,
            (difficulty_json->>'absoluteLoadDemand')::INTEGER)
        AND difficulty_json->>'physicalDifficulty'=difficulty_json->>'absoluteLoadDemand'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND fatigue_profile_json->>'recoveryHours' IS NOT NULL
        AND programming_profile_json->'weeklyExposure' IS NOT NULL)<>9 THEN
    RAISE EXCEPTION '% created invalid variant difficulty, load, fatigue, or programming state',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=canonical_id
        AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=canonical_id
        AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(
        definition.required_equipment||definition.optional_equipment) key
      WHERE definition.id=canonical_id
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed
          WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(variant_ids) AND status='review')<>18
    OR EXISTS(SELECT 1 FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(variant_ids) AND status='review'
        AND (cardinality(equipment_required)=0 OR dosage_json='{}'::JSONB
          OR logistics_json='{}'::JSONB OR time_model_json='{}'::JSONB
          OR dose_scaling_json='{}'::JSONB OR measurement_json='{}'::JSONB
          OR support_prompts_json='{}'::JSONB)) THEN
    RAISE EXCEPTION '% created incomplete contextual delivery profiles',migration_key;
  END IF;

  IF (SELECT count(DISTINCT section_key)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate')<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND video_id=ANY(current_video_ids) AND link_status='healthy'
        AND embedding_allowed IS TRUE AND review_status='candidate'
        AND exact_variant_match IS NULL AND captions_available IS NULL
        AND demonstration_quality_score IS NULL AND reviewer_user_id IS NULL
        AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate')<>12 THEN
    RAISE EXCEPTION '% created incomplete evidence, media, or alternate review packets',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(variant_ids) AND review_status='review'
        AND reviewed_by IS NULL AND reviewed_at IS NULL)<16
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(variant_ids) AND status='review'
        AND reviewed_by IS NULL AND reviewed_at IS NULL)<>18
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_id
        AND resolved_definition_id=ANY(archive_definition_ids)
        AND decision='duplicate_consolidated' AND reviewed_by IS NULL)<>8 THEN
    RAISE EXCEPTION '% created incomplete review-only graph, identity, or calibration records',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=canonical_id)<>9
    OR EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=ANY(source_ids) AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(source_ids) AND minimum_skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=canonical_id
        AND coaching.exercise_json_has_level_classification(jsonb_build_array(
          definition.provenance_json,definition.environment_json,
          definition.population_json,definition.anatomy_json,
          definition.athlete_support_json,definition.coach_support_json,
          definition.support_operations_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
      WHERE variant.id=ANY(variant_ids)
        AND coaching.exercise_json_has_level_classification(jsonb_build_array(
          variant.difficulty_json,variant.requirements_json,
          variant.load_profile_json,variant.fatigue_profile_json,
          variant.programming_profile_json))) THEN
    RAISE EXCEPTION '% created forbidden exercise proficiency metadata or lost source mappings',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id
        AND (jsonb_typeof(anatomy_json->'jointActions')<>'array'
          OR jsonb_array_length(anatomy_json->'jointActions')=0
          OR athlete_support_json->>'whyItMatters' IS NULL
          OR coach_support_json->'observationChecklist' IS NULL
          OR support_operations_json->'issueCategories' IS NULL))
    OR (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_id AND status='quarantined'
        AND human_review_required IS TRUE
        AND jsonb_array_length(blocking_issues_json)=4)<>1 THEN
    RAISE EXCEPTION '% did not complete anatomy, support, or the four-gate quarantine packet',migration_key;
  END IF;
END $$;
