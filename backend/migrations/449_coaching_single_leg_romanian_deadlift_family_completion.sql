-- Complete the Single-Leg Romanian Deadlift family after resolving twelve
-- legacy cards into one stable exercise identity, exact variants, and
-- contextual delivery profiles. YouTube oEmbed checks establish current
-- link/embed health only; all content review and approvals remain human gates.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '449_coaching_single_leg_romanian_deadlift_family_completion';
  research_version CONSTANT TEXT := '2026-08-02.63';
  canonical_id CONSTANT UUID := 'fc7be015-7005-42fe-acda-26fda330000d';
  bodyweight_variant CONSTANT UUID := 'ebc1e5c9-75d1-4de7-93ac-1e349595656d';
  reach_variant CONSTANT UUID := '89200f2e-72d6-4f06-abab-bff0253b5d69';
  supported_variant CONSTANT UUID := 'b626fd34-e68b-4864-880a-aa5e78a8c36d';
  db_contralateral_variant CONSTANT UUID := 'cbf565a0-44d8-4b32-bbde-8c39954682a6';
  db_ipsilateral_variant CONSTANT UUID := 'e751e9b3-00e3-45fe-89b8-1484c20a6fd9';
  db_bilateral_variant CONSTANT UUID := '25866c7d-b410-4a0d-91b7-4f4a36a44b4d';
  kb_contralateral_variant CONSTANT UUID := '927b5cf5-6ae1-423d-b189-6aaf5a34548a';
  kb_ipsilateral_variant CONSTANT UUID := '89ffa37d-ca63-4fbc-b285-936847786fcb';
  barbell_variant CONSTANT UUID := 'd1f22bb2-7bfa-43c9-adc1-3881d4d54146';
  eccentric_variant CONSTANT UUID := 'da50c614-e1a6-47da-b46c-e06ae776ef0d';
  duplicate_reach_variant CONSTANT UUID := '75e03a71-2bf6-4867-9830-b6d0ac80a572';
  duplicate_context_variant CONSTANT UUID := 'cef7a1c2-7f91-4125-98dc-8def8e7a44ca';
  variant_ids CONSTANT UUID[] := ARRAY[
    bodyweight_variant,reach_variant,supported_variant,
    db_contralateral_variant,db_ipsilateral_variant,db_bilateral_variant,
    kb_contralateral_variant,kb_ipsilateral_variant,barbell_variant,
    eccentric_variant];
  duplicate_variant_ids CONSTANT UUID[] := ARRAY[
    duplicate_reach_variant,duplicate_context_variant];
  source_ids CONSTANT BIGINT[] := ARRAY[
    8,179,230,386,425,483,523,759,1059,1148,1329,1387];
  archive_definition_ids CONSTANT UUID[] := ARRAY[
    'efa7d096-ac01-44e2-af1b-70a0a7fe9bb2'::UUID,
    '786df7b7-ee11-4c21-94de-557c3fada23d'::UUID,
    '4fcbe4aa-de11-4c9f-b4d8-c25c42a2b644'::UUID,
    '40822078-88e7-4faa-98aa-4fa148f51aa2'::UUID,
    'bdb9f3dd-7757-4707-b9a1-8f57f1f0469c'::UUID,
    'bf8f4566-7372-4c06-9768-b7f0f9d774cd'::UUID,
    '45a3e90a-7828-4601-a221-1622ce5bbffd'::UUID,
    '8ae1707a-cbd7-497f-99dd-1271151bffb7'::UUID,
    '90650afd-b0c5-4740-9b02-97e34d45a43f'::UUID,
    '5180e9da-0fbc-40c3-abbe-ae49f73df544'::UUID,
    '14efcb2a-9a29-4b06-b4fa-eb02f4f7d0f9'::UUID];
  all_variant_ids CONSTANT UUID[] := variant_ids||duplicate_variant_ids;
  evidence_payload JSONB := $json$
  [
    {"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/38093908/","sourceTitle":"Effects of loading positions on the activation of trunk and hip muscles during flywheel and dumbbell single-leg Romanian deadlift exercises","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["The studied task is a single-leg Romanian deadlift performed through a unilateral hip hinge with ipsilateral or contralateral external loading.","Bodyweight, support, hand target, implement, implement count, load side, range, tempo, rest, and dose preserve the base exercise identity when the single-leg hinge and square-pelvis return remain required."]},
    {"sectionKey":"taxonomy","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/127/single-arm-single-leg-romanian-dead-lift/","sourceTitle":"Single-Arm Single-Leg Romanian Deadlift","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["ACE describes balance on one leg, a softly bent support knee, a hip hinge, a long trailing leg, a straight load arm, and a return to balanced standing.","The controlled taxonomy is unilateral hinge plus brace; staggered support, deliberate pelvic rotation, an external catch, a knee-dominant target, and a ballistic hinge remain separate identities."]},
    {"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/38093908/","sourceTitle":"Effects of loading positions on the activation of trunk and hip muscles during flywheel and dumbbell single-leg Romanian deadlift exercises","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["The study measured gluteus maximus, gluteus medius, biceps femoris, erector spinae, external oblique, and adductor longus during single-leg RDL conditions.","The card declares hip flexion and extension with foot, ankle, knee, pelvic, spinal, shoulder, elbow, wrist, and hand stabilization without claiming one universal activation ranking."]},
    {"sectionKey":"biomechanics","sourceUrl":"https://www.nsca.com/contentassets/9dab08fc28274f3ba1d76af31bbbe40b/coach3.1-screening_and_preventing_common_injuries_in_division_i_basketball_players.pdf","sourceTitle":"Methods for Screening and Preventing Common Injuries in Division I Basketball Players","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["The NSCA example uses a single-leg stance, controlled hip flexion, square hips, close dumbbells, a rigid torso, and controlled return.","Valid repetitions preserve the named stance side, foot pressure, soft knee, hip-led motion, square pelvis, long spine, declared load path, owned range, controlled return, and balanced reset."]},
    {"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/38093908/","sourceTitle":"Effects of loading positions on the activation of trunk and hip muscles during flywheel and dumbbell single-leg Romanian deadlift exercises","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Changing load side changed measured trunk and hip muscle activity in trained participants, supporting exact complexity scoring for ipsilateral and contralateral variants.","Difficulty is exercise complexity and physical difficulty only; overall difficulty is their maximum and does not classify the athlete."]},
    {"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/35162219/","sourceTitle":"Effects of Six Weeks of Flywheel Single-Leg Romanian Deadlift Training on Speed, Jumping and Change of Direction Performance","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["The intervention prescribed work to both dominant and nondominant legs and used explicit sets, repetitions, inertial load, weekly frequency, and between-set recovery.","Cumulative accounting must include valid and failed repetitions per side, external load or inertia, load side, eccentric duration, effort, grip, balance failures, and same-session hinge, sprint, jump, and hamstring work."]},
    {"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/contentassets/9dab08fc28274f3ba1d76af31bbbe40b/coach3.1-screening_and_preventing_common_injuries_in_division_i_basketball_players.pdf","sourceTitle":"Methods for Screening and Preventing Common Injuries in Division I Basketball Players","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["The exercise needs stable single-leg footing, clear trailing-leg and load space, controlled handheld load paths, and a safe start and finish.","Delivery must declare surface, footwear policy, support availability, implement and count, load side, pickup and set-down, range, side order, coach sightline, and symptom constraints."]},
    {"sectionKey":"dosage","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/40322523/","sourceTitle":"The Effect of Single Leg Romanian Deadlift on the Risk of Hamstring Strain Injuries in Track and Field Athletes: A Cohort Study","sourcePublisher":"International Journal of Sports Physical Therapy","sourceKind":"peer_reviewed_research","evidenceQuality":78,"claims":["The cohort intervention used three sets of three repetitions in a warm-up context and reported high compliance; the design does not establish a universal dose.","Profiles therefore declare context, repetitions per side, load or effort, tempo, rest, quality limits, and recovery rather than copying one research protocol into every workout."]},
    {"sectionKey":"instructions","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/127/single-arm-single-leg-romanian-dead-lift/","sourceTitle":"Single-Arm Single-Leg Romanian Deadlift","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["ACE instructs a softly bent stance knee, hip-led forward lean, straight trailing leg, controlled dumbbell path, foot drive, and balanced pause before the next repetition.","The athlete instruction must name support side, hand or hands, load side, target, range, tempo, return method, rest, and stop signal."]},
    {"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/contentassets/9dab08fc28274f3ba1d76af31bbbe40b/coach3.1-screening_and_preventing_common_injuries_in_division_i_basketball_players.pdf","sourceTitle":"Methods for Screening and Preventing Common Injuries in Division I Basketball Players","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["The NSCA example emphasizes slow control, square hips, close loads, a flat back, and a rigid torso.","Stop for pain, numbness or tingling, dizziness, unsafe grip or load path, repeated balance loss, foot collapse, knee drift, pelvic rotation, spinal substitution, missed eccentric time, grinding, or an unsafe pickup or set-down."]},
    {"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/35162219/","sourceTitle":"Effects of Six Weeks of Flywheel Single-Leg Romanian Deadlift Training on Speed, Jumping and Change of Direction Performance","sourcePublisher":"International Journal of Environmental Research and Public Health","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["The flywheel study used bilateral side exposure with substantial between-set recovery and found that adding volume did not simply improve every performance outcome.","Place quality unilateral hinge work before fatigue compromises balance or load control, and recompute posterior-chain, grip, duration, and recovery budgets whenever the exact variant or profile changes."]},
    {"sectionKey":"athlete_support","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/127/single-arm-single-leg-romanian-dead-lift/","sourceTitle":"Single-Arm Single-Leg Romanian Deadlift","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["Athlete-facing support can reduce range or load, add stable hand support, and preserve a deliberate balanced reset.","Plain-language rendering must expose the named side, load and hand, target, tempo, repetitions, rest, expected sensations, quality standard, stop signal, and substitution reason."]},
    {"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/38093908/","sourceTitle":"Effects of loading positions on the activation of trunk and hip muscles during flywheel and dumbbell single-leg Romanian deadlift exercises","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Ipsilateral and contralateral loading are not interchangeable hidden details because loading position can change muscular demand.","Coach support must expose stance side, load side and count, support or target, foot and knee behavior, pelvic rotation, torso and load path, range, tempo, side dose, fatigue, symptoms, pickup, set-down, and the exact substitution effect."]},
    {"sectionKey":"accessibility","sourceUrl":"https://www.acefitness.org/resources/everyone/exercise-library/127/single-arm-single-leg-romanian-dead-lift/","sourceTitle":"Single-Arm Single-Leg Romanian Deadlift","sourcePublisher":"American Council on Exercise","sourceKind":"expert_instruction","evidenceQuality":76,"claims":["The movement can be made more accessible through stable hand support, reduced range, bodyweight or lighter load, fewer repetitions, deliberate resets, and longer rest while preserving the unilateral hip hinge.","Provide written steps, still frames, a coach demonstration, tactile or visual range targets, extra transition time, and a non-single-leg alternative when safe unilateral support is unavailable."]},
    {"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/38093908/","sourceTitle":"Effects of loading positions on the activation of trunk and hip muscles during flywheel and dumbbell single-leg Romanian deadlift exercises","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Ipsilateral and contralateral dumbbell or flywheel loading preserve the single-leg RDL identity while changing the exact loading contract.","Staggered-stance RDL, RDL airplane, reach plus catch, single-leg squat to box, cone-reach task, bilateral RDL, and kettlebell swing change support, action, target, knee demand, perception, or velocity and require separate identities."]},
    {"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates have current oEmbed link and embed health only; full playback, exact variant match, captions, instruction and safety quality, accessibility, reviewer identity, and approval remain unresolved."]}
  ]
  $json$::JSONB;
  media_payload JSONB := $json$
  [
    {"videoId":"6pEL3KxnlEo","title":"How to do a Single-Leg Romanian Deadlift","channel":"National Academy of Sports Medicine (NASM)","query":"single-leg Romanian deadlift technique"},
    {"videoId":"Zfr6wizR8rs","title":"The BEST Single-Leg RDL Tutorial (Romanian Deadlift)","channel":"Squat University","query":"single-leg Romanian deadlift tutorial"},
    {"videoId":"i75JkVNBTJw","title":"Single leg Romanian deadlift (RDL)","channel":"The Rotherham NHS Foundation Trust","query":"single-leg Romanian deadlift exercise"},
    {"videoId":"5XhVvufQcKQ","title":"Single Leg RDL Reach","channel":"TeamBuildr","query":"bodyweight single-leg RDL reach"},
    {"videoId":"0oFPq_a3NJU","title":"Eccentric 1 Leg RDL","channel":"Ben Bruno","query":"eccentric single-leg RDL"}
  ]
  $json$::JSONB;
  alternate_payload JSONB := $json$
  [
    {"name":"Ipsilateral or Contralateral Single-Arm Load","class":"new_variant","why":"Load side changes trunk and hip demand while preserving the unilateral hinge action.","dimensions":{"implement":"dumbbell_or_kettlebell","loadSide":"ipsilateral_or_contralateral"}},
    {"name":"Two-Dumbbell or Barbell Single-Leg RDL","class":"new_variant","why":"Two-hand loading preserves the identity but changes load capacity, grip, balance, pickup, and set-down.","dimensions":{"implement":"two_dumbbells_or_barbell","loadPosition":"bilateral_front"}},
    {"name":"Support, Reach Target, Range, and Tempo","class":"modifier_annotation","why":"Stable hand support, hand target, reach direction, owned range, and tempo must be declared without creating a new identity.","dimensions":{"support":"declared","handTarget":"declared","range":"declared","tempo":"declared"}},
    {"name":"Single-Leg RDL Airplane","class":"new_definition","why":"Deliberate pelvic opening and closing adds transverse-plane action that the square-pelvis RDL forbids.","dimensions":{"orderedAction":"pelvic_open_close"}},
    {"name":"Single-Leg RDL Reach plus Catch","class":"new_definition","why":"An externally timed catch adds perception, hand action, perturbation, partner timing, and distinct failure modes.","dimensions":{"externalTask":"timed_object_catch"}}
  ]
  $json$::JSONB;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=canonical_id
        AND provenance_json->>'singleLegRdlCompletionMigration'=migration_key)=1 THEN
    UPDATE coaching.exercise_definition_source_v1 SET definition_id=canonical_id,
      source_kind='legacy_migration',
      provenance_json=provenance_json||jsonb_build_object(
        'singleLegRdlIdentityMigration',migration_key,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
    WHERE legacy_exercise_id=ANY(source_ids);
    UPDATE coaching.exercise SET skill_level=NULL WHERE id=ANY(source_ids);
    UPDATE coaching.exercise_safety_profile SET minimum_skill_level=NULL
    WHERE exercise_id=ANY(source_ids);
    UPDATE coaching.exercise_relationship_v1 SET
      dimensions=array_remove(dimensions,'grip'),updated_at=now()
    WHERE reviewed_by IS NULL
      AND (from_variant_id=ANY(variant_ids) OR to_variant_id=ANY(variant_ids));
    RETURN;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=canonical_id)<>1
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(archive_definition_ids))<>cardinality(archive_definition_ids)
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(all_variant_ids))<>cardinality(all_variant_ids)
    OR (SELECT count(*) FROM coaching.exercise
      WHERE id=ANY(source_ids))<>cardinality(source_ids) THEN
    RAISE EXCEPTION '% requires the protected definition, variants, archived source definitions, and legacy rows',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND (card_version<>1 OR reviewed_by IS NOT NULL
        OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL
        OR approved_video_url IS NOT NULL OR status<>'review'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ANY(archive_definition_ids)
        AND (card_version<>1 OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL
          OR approved_video_url IS NOT NULL OR status<>'archived')) THEN
    RAISE EXCEPTION '% refuses to overwrite reviewed, approved, published, or unexpected cards',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE reviewed_by IS NOT NULL
        AND (survivor_definition_id=ANY(archive_definition_ids||ARRAY[canonical_id])
          OR resolved_definition_id=ANY(archive_definition_ids||ARRAY[canonical_id])))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_variant_ids) AND reviewed_by IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_variant_ids) OR to_variant_id=ANY(all_variant_ids))
        AND reviewed_by IS NOT NULL) THEN
    RAISE EXCEPTION '% refuses to overwrite human identity, graph, or calibration review',migration_key;
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=ANY(all_variant_ids);
  UPDATE coaching.exercise_variant_v1 SET status='archived',
    requirements_json=requirements_json||jsonb_build_object(
      'selectable',FALSE,'identityQuarantine',TRUE,'migration',migration_key),
    updated_at=now()
  WHERE id=ANY(all_variant_ids);
  UPDATE coaching.exercise_variant_v1 SET
    requirements_json=requirements_json||jsonb_build_object(
      'survivorVariantId',CASE id
        WHEN duplicate_reach_variant THEN reach_variant
        ELSE bodyweight_variant END),
    updated_at=now()
  WHERE id=ANY(duplicate_variant_ids);

  UPDATE coaching.exercise_definition_v1 SET status='archived',
    provenance_json=provenance_json||jsonb_build_object(
      'singleLegRdlIdentityMigration',migration_key,'selectable',FALSE,
      'survivorDefinitionId',canonical_id,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),updated_at=now()
  WHERE id=ANY(archive_definition_ids);
  UPDATE coaching.exercise_definition_source_v1 SET definition_id=canonical_id,
    source_kind='legacy_migration',
    provenance_json=provenance_json||jsonb_build_object(
      'singleLegRdlIdentityMigration',migration_key,
      'resolution',CASE
        WHEN legacy_exercise_id=ANY(ARRAY[1148,1329,1387]::BIGINT[])
          THEN 'sport_label_preserved_as_contextual_delivery_profile'
        WHEN legacy_exercise_id=759 THEN 'eccentric_emphasis_preserved_as_exact_variant'
        WHEN legacy_exercise_id=ANY(ARRAY[386,425,483]::BIGINT[])
          THEN 'implement_and_load_side_preserved_as_exact_variant'
        WHEN legacy_exercise_id=ANY(ARRAY[230,523,1059]::BIGINT[])
          THEN 'reach_support_and_target_preserved_as_exact_variant_dimensions'
        ELSE 'duplicate_name_mapped_to_stable_identity' END,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_definition_v1 SET
    schema_version='1.0.0',card_version=2,status='review',
    canonical_name='Single-Leg Romanian Deadlift',
    display_name='Single-Leg Romanian Deadlift',
    aliases=ARRAY['Single Leg Romanian Deadlift','Single-Leg RDL','Single Leg RDL',
      'Single-Leg Dumbbell RDL','Single-Leg Kettlebell RDL',
      'Barbell Single-Leg Romanian Deadlift','Single-Leg RDL Reach',
      'Bodyweight Single-Leg RDL Reach','Single-Leg RDL Negative'],
    description='A controlled unilateral hip hinge: the named stance leg stays softly flexed while the pelvis travels backward, the free leg counterbalances, the declared hand position or load follows its exact path through owned range, and the athlete returns to a balanced stacked stance.',
    family_key='single_leg_hip_hinge_strength',
    content_confidence=86,scoring_confidence=58,media_confidence=28,
    movement_patterns=ARRAY['hinge','brace'],
    body_regions=ARRAY['foot','ankle','knee','hip','pelvis','hamstring','core','spine','shoulder','elbow','wrist','hand'],
    required_equipment=ARRAY[]::TEXT[],
    optional_equipment=ARRAY['dumbbell','kettlebell','barbell','plates','rack','wall','dowel'],
    environment_json=jsonb_build_object(
      'surface','stable_level_non_slip','space',jsonb_build_array('clear_trailing_leg_arc','clear_hand_and_load_path','clear_pickup_and_set_down_zone'),
      'footwearPolicy','declared_for_surface_and_load','support','stable_wall_or_dowel_when_prescribed',
      'lighting','stance_foot_load_and_pelvis_visible','coachSightline',jsonb_build_array('front_oblique','side'),
      'equipmentChecks',jsonb_build_array('implement_and_quantity_match','load_is_secure','rack_or_floor_start_is_safe','support_does_not_move')),
    population_json=jsonb_build_object(
      'screen',jsonb_build_array('pain_free_single_leg_support','pain_free_hip_hinge','safe_balance_and_recovery','safe_grip_and_load_control','no_unresolved_dizziness_or_pressure_symptoms'),
      'individualize',jsonb_build_array('support','range','implement','load_side','external_load','tempo','repetitions_per_side','rest','session_and_weekly_posterior_chain_exposure'),
      'referOrModify',jsonb_build_array('acute_lower_limb_or_back_symptoms','unexplained_balance_loss','neurologic_symptoms','unsafe_fall_risk','pregnancy_or_postpartum_pressure_or_balance_symptoms')),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('hamstrings','gluteus_maximus','gluteus_medius_and_minimus','adductor_magnus_posterior_fibers'),
      'secondaryMuscles',jsonb_build_array('adductor_longus','erector_spinae_and_multifidus','abdominal_wall_and_obliques','latissimus_dorsi','forearm_and_hand_flexors','foot_and_ankle_stabilizers'),
      'joints',jsonb_build_array('foot','ankle','knee','hip','pelvis','spine','shoulder','elbow','wrist_and_hand'),
      'jointActions',jsonb_build_array('stance_foot_and_ankle_stabilization','controlled_stance_knee_position','eccentric_hip_flexion','concentric_hip_extension','frontal_and_transverse_pelvic_stabilization','spinal_and_ribcage_stabilization','scapular_grip_and_load_path_stabilization'),
      'planes',jsonb_build_array('sagittal_primary','frontal_stabilization','transverse_stabilization'),
      'laterality','unilateral_stance_with_named_side_and_declared_ipsilateral_contralateral_or_bilateral_hand_load',
      'repetitionBoundary',jsonb_build_array('balanced_stacked_start','controlled_hinge_to_owned_range','hip_driven_return','balanced_reset_before_next_rep'),
      'validitySignals',jsonb_build_array('named_stance_side','tripod_foot_pressure','soft_stable_knee','square_pelvis','hip_led_range','long_spine','declared_hand_or_load_path','controlled_return','balanced_reset')),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','Builds side-specific hip-extension strength, hamstring capacity, foot-to-hip control, and repeatable balance without impact contacts.',
      'beforeYouStart',jsonb_build_array('Confirm the stance side, hand position or load side, support or target, repetitions per side, range, tempo, and rest.','Clear the free-leg and load path and rehearse how to stop and set down safely.'),
      'steps',jsonb_build_array('Stand tall on the named leg with a soft knee and full-foot pressure.','Brace, then send the hips back as the free leg reaches long behind.','Keep the pelvis square and the declared hand or load path controlled.','Stop at the deepest range you can own.','Drive the stance hip forward, finish stacked, and regain balance before the next repetition.'),
      'primaryCue','Hips back, back heel long, hips square, stand tall.',
      'expectedSensations',jsonb_build_array('stance_leg_hamstring_and_glute_effort','foot_and_ankle_balance_work','trunk_brace','increasing_local_effort_without_loss_of_position'),
      'unexpectedSensations',jsonb_build_array('sharp_or_increasing_pain','joint_pinching','numbness_or_tingling','dizziness','unsafe_pressure_symptoms','hamstring_cramp_that_changes_motion'),
      'painGuidance','Stop, regain stable support, secure the load, and tell the coach; do not continue through symptoms.',
      'accessibility',jsonb_build_array('stable_hand_support','shorter_range','bodyweight_or_lighter_load','ipsilateral_load_before_contralateral_when_appropriate','fewer_repetitions','longer_rest','written_steps','still_frames','bilateral_hinge_alternative'),
      'reportImmediately',jsonb_build_array('pain','numbness_or_tingling','dizziness','unsafe_pressure_symptoms','repeated_balance_loss','unsafe_load_or_grip')),
    coach_support_json=jsonb_build_object(
      'setupChecklist',jsonb_build_array('Confirm exact variant, stance side, support or target, hand and load side, implement count, pickup, range, tempo, repetitions, side order, rest, and set-down.','Inspect surface, clearance, support, implement, load, footwear, and emergency exit.','Confirm cumulative hinge, hamstring, sprint, jump, grip, and low-back budgets.'),
      'observationChecklist',jsonb_build_array('stance_foot_pressure','stance_knee_position','hip_led_motion','pelvis_stays_square','trailing_leg_path','ribcage_and_spine','declared_hand_or_load_path','owned_range','eccentric_time','controlled_return','balanced_reset','side_asymmetry','symptoms_and_fatigue'),
      'observationViews',jsonb_build_array('front_oblique_for_foot_knee_pelvis_and_load_side','side_for_hinge_range_spine_and_trailing_leg','close_for_grip_support_and_pickup'),
      'validRep',jsonb_build_array('correct_variant_and_side','stable_start','hip_led_hinge','square_pelvis','declared_path_and_range','prescribed_tempo','controlled_return','balanced_reset'),
      'faultCorrections',jsonb_build_object('balanceLoss','Add stable hand support or reduce range and load.','pelvisOpens','Reduce range and load; cue the free heel straight back.','kneeDrifts','Restore foot pressure and reduce the demand.','spinalSubstitution','Shorten range and reestablish brace.','loadDrifts','Reduce load and restore the declared path.','missedTempo','End or regress the set rather than hiding fatigue.'),
      'groupManagement',jsonb_build_object('station','one active athlete per clear hinge and load lane','traffic','no crossing the trailing-leg or set-down path','loadReturn','outside active lanes','recording','record every side, valid and failed repetition, support, load, fault, symptom, and substitution'),
      'record',jsonb_build_array('definition_id','variant_id','profile_key','stance_side','support_or_target','hand_and_load_side','implement_and_quantity','external_load','range','tempo','sets','repetitions_per_side','rest','RPE_or_RIR','valid_and_failed_reps','faults','symptoms','substitution')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_variant_mismatch','side_support_or_target_mismatch','equipment_load_or_grip_mismatch','dose_tempo_or_duration_mismatch','fatigue_balance_or_symptom_event','media_or_accessibility_issue','rendering_or_persistence_issue'),
      'supportEscalation',jsonb_build_object('immediate',jsonb_build_array('pain','numbness_or_tingling','dizziness','unsafe_pressure_symptoms','fall_or_near_fall','unsafe_load_control'),'coachReview',jsonb_build_array('repeated_balance_or_alignment_failure','side_asymmetry','substitution_request','load_side_or_support_question','recovery_conflict'),'contentReview',jsonb_build_array('identity_confusion','media_mismatch','accessibility_gap')),
      'retentionPolicy',jsonb_build_object('store',jsonb_build_array('definition_id','variant_id','profile_key','stance_side','support_or_target','load_side','implement','load','range','tempo','dose','duration','quality_result','stop_reason','symptoms','substitution','rendered_instructions'),'preserveHumanReviewHistory',TRUE,'neverOverwriteApprovedReview',TRUE),
      'changeImpactPolicy',jsonb_build_object('onVariantSideSupportTargetImplementLoadRangeTempoDoseOrProfileChange',jsonb_build_array('revalidate_selection','recompute_fatigue_recovery_and_impact','recompute_duration','recheck_logistics','rerender_coach_and_athlete_instructions','persist_new_validation'),'neverSilent',TRUE)),
    provenance_json=provenance_json-'researchSources'||jsonb_build_object(
      'singleLegRdlCompletionMigration',migration_key,'researchVersion',research_version,
      'canonicalAuditContract','canonical-card-audit-v1','canonicalAuthoredFromResearch',TRUE,
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'overallDifficultyFormula','max(exercise_complexity,physical_difficulty)',
      'primaryIdentitySource','https://pubmed.ncbi.nlm.nih.gov/38093908/',
      'supersededUnrelatedSource','https://pubmed.ncbi.nlm.nih.gov/24978835/',
      'supersededSourceReason','stiff_leg_deadlift_vs_leg_curl_not_single_leg_romanian_deadlift',
      'mediaVerificationScope','youtube_oembed_link_and_embed_health_only',
      'legacyCardsAudited',12,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,updated_at=now()
  WHERE id=canonical_id;

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
      'selectable',TRUE,'stance','unilateral','stanceSide','declared_and_dosed',
      'support',spec.support,'implement',spec.implement,
      'implementQuantity',spec.quantity,'loadSide',spec.load_side,
      'handTarget',spec.hand_target,'range','owned_declared',
      'tempo',spec.tempo,'concentricReturn',spec.concentric_return,
      'surface','stable_level_non_slip','pelvisPolicy','square',
      'invalid',jsonb_build_array('wrong_stance_or_load_side','foot_collapse','uncontrolled_knee_drift','pelvis_opens','spinal_substitution','undeclared_load_path','balance_loss_without_reset','missed_tempo','unsafe_pickup_or_set_down')),
    load_profile_json=jsonb_build_object(
      'loadingType',spec.loading_type,'externalLoadMethod',spec.load_method,
      'externalLoadRecorded',spec.external_load,'gripDemand',spec.grip,
      'spinalLoading',spec.spinal,'eccentricStress',spec.eccentric_stress,
      'landingContactsPerRep',0,
      'primaryStress',jsonb_build_array('unilateral_hip_extension','hamstring_lengthening_and_force','pelvic_and_trunk_stabilization','stance_foot_balance'),
      'loadAccounting',jsonb_build_object('recordStanceSide',TRUE,'recordValidAndFailedRepetitionsPerSide',TRUE,'recordImplementAndQuantity',TRUE,'recordLoadSide',TRUE,'recordExternalLoad',spec.external_load,'recordRangeAndTempo',TRUE,'recordSupportAndTarget',TRUE)),
    fatigue_profile_json=jsonb_build_object(
      'localMuscleFatigue',spec.local_fatigue,'gripFatigue',spec.grip,
      'technicalFatigueSensitivity',spec.technical_fatigue,
      'impactAccumulation',1,'recoveryHours',spec.recovery_hours,
      'qualityLossSignals',jsonb_build_array('balance_loss','foot_or_knee_drift','pelvic_rotation','range_shortening','spinal_substitution','load_path_drift','missed_eccentric_time','grip_loss','unsafe_reset'),
      'cumulativeRules',jsonb_build_array('count_valid_and_failed_repetitions_for_each_side','include_external_load_load_side_and_eccentric_duration','include_same_session_bilateral_and_unilateral_hinges_sprints_jumps_curls_and_hip_extensions','increase_recovery_after_high_effort_loaded_or_slow_eccentric_work')),
    programming_profile_json=jsonb_build_object(
      'preferredBlock',CASE WHEN spec.tempo='slow_eccentric_declared' THEN 'resilience_or_capacity_before_material_posterior_chain_fatigue' ELSE 'capacity_or_movement_control_before_fatiguing_conditioning' END,
      'primaryObjectives',CASE WHEN spec.external_load THEN jsonb_build_array('unilateral_posterior_chain_strength','pelvic_and_trunk_control','side_specific_capacity') ELSE jsonb_build_array('unilateral_hinge_control','balance','posterior_chain_capacity') END,
      'cumulativeFatigueBudget','sum valid and failed repetitions per side, external load, load side, eccentric duration, effort, grip, balance failures, and same-session posterior-chain exposures',
      'impactBudget','zero direct landing contacts; still account for all other same-session impact',
      'weeklyExposure',jsonb_build_object('frequency','individualized_from_objective_load_effort_symptoms_recovery_and_total_hamstring_plan','minimumRecoveryHours',spec.recovery_hours),
      'sequenceRules',jsonb_build_array('confirm_exact_side_load_support_target_and_exit','perform_before_fatigue_prevents_balance_or_load_control','preserve_square_pelvis_and_owned_range','stop_before_grip_balance_tempo_or_alignment_changes'),
      'pairingCompatibility',jsonb_build_array('low_fatigue_upper_body_mobility_or_breathing_during_full_rest'),
      'interferenceRules',jsonb_build_array('do_not_pre_fatigue_hamstrings_before_quality_sprint_jump_or_heavy_hinge_work','do_not_turn_balance_or_eccentric_quality_into_fatigue_chasing','recompute_load_fatigue_duration_logistics_and_side_dose_after_substitution')),
    status='review',updated_at=now()
  FROM (VALUES
    (bodyweight_variant,'bodyweight-standard','Single-Leg Romanian Deadlift — Bodyweight',ARRAY['bodyweight','unilateral','standard_tempo']::TEXT[],62,46,66,46,40,50,'none','bodyweight','one','none','hands_on_hips_or_declared','standard_controlled','active_unassisted','bodyweight_unilateral','bodyweight',FALSE,8,26,46,56,60,30),
    (reach_variant,'bodyweight-target-reach','Single-Leg Romanian Deadlift — Bodyweight Target Reach',ARRAY['bodyweight','unilateral','target_reach']::TEXT[],66,44,70,48,42,48,'none','bodyweight','one','none','declared_reachable_target','standard_controlled','active_unassisted','bodyweight_unilateral_target_reach','bodyweight',FALSE,8,26,44,60,64,30),
    (supported_variant,'bodyweight-supported','Single-Leg Romanian Deadlift — Supported Bodyweight',ARRAY['bodyweight','unilateral','supported']::TEXT[],50,42,52,34,30,44,'stable_wall_or_dowel','bodyweight','one','none','support_hand_fixed','standard_controlled','active_unassisted','bodyweight_unilateral_supported','bodyweight',FALSE,8,24,42,42,48,24),
    (db_contralateral_variant,'dumbbell-contralateral','Single-Leg Romanian Deadlift — Contralateral Dumbbell',ARRAY['dumbbell','unilateral','contralateral_load']::TEXT[],68,58,72,56,52,58,'none','dumbbell','one','contralateral_to_stance','none','standard_controlled','active_unassisted','dumbbell_unilateral_contralateral','dumbbell_increment',TRUE,44,38,54,68,72,42),
    (db_ipsilateral_variant,'dumbbell-ipsilateral','Single-Leg Romanian Deadlift — Ipsilateral Dumbbell',ARRAY['dumbbell','unilateral','ipsilateral_load']::TEXT[],64,58,68,52,48,58,'none','dumbbell','one','ipsilateral_to_stance','none','standard_controlled','active_unassisted','dumbbell_unilateral_ipsilateral','dumbbell_increment',TRUE,44,38,54,64,68,42),
    (db_bilateral_variant,'two-dumbbell-bilateral-load','Single-Leg Romanian Deadlift — Two Dumbbells',ARRAY['dumbbell','unilateral','bilateral_hand_load']::TEXT[],62,66,68,58,58,64,'none','dumbbell','two','bilateral_hands','none','standard_controlled','active_unassisted','two_dumbbells_unilateral_stance','dumbbell_increment',TRUE,58,46,60,66,68,48),
    (kb_contralateral_variant,'kettlebell-contralateral','Single-Leg Romanian Deadlift — Contralateral Kettlebell',ARRAY['kettlebell','unilateral','contralateral_load']::TEXT[],68,58,72,56,52,58,'none','kettlebell','one','contralateral_to_stance','none','standard_controlled','active_unassisted','kettlebell_unilateral_contralateral','kettlebell_increment',TRUE,46,38,54,68,72,42),
    (kb_ipsilateral_variant,'kettlebell-ipsilateral','Single-Leg Romanian Deadlift — Ipsilateral Kettlebell',ARRAY['kettlebell','unilateral','ipsilateral_load']::TEXT[],64,58,68,52,48,58,'none','kettlebell','one','ipsilateral_to_stance','none','standard_controlled','active_unassisted','kettlebell_unilateral_ipsilateral','kettlebell_increment',TRUE,46,38,54,64,68,42),
    (barbell_variant,'barbell-bilateral-load','Single-Leg Romanian Deadlift — Barbell',ARRAY['barbell','unilateral','bilateral_hand_load']::TEXT[],72,72,76,68,68,66,'none','barbell','one','bilateral_hands','none','standard_controlled','active_unassisted','barbell_unilateral_stance','plate_loaded_barbell',TRUE,64,54,64,74,78,48),
    (eccentric_variant,'bodyweight-slow-eccentric-assisted-return','Single-Leg Romanian Deadlift — Slow Eccentric',ARRAY['bodyweight','unilateral','slow_eccentric','assisted_return']::TEXT[],70,56,72,52,46,62,'stable_wall_or_dowel_for_return','bodyweight','one','none','none','slow_eccentric_declared','assisted_or_bilateral_reset','bodyweight_unilateral_eccentric','bodyweight',FALSE,8,28,76,72,76,42)
  ) AS spec(id,variant_key,display_name,modifier_keys,technical,physical,
    coordination,supervision,failure,work_capacity,support,implement,quantity,load_side,
    hand_target,tempo,concentric_return,loading_type,load_method,external_load,
    grip,spinal,eccentric_stress,local_fatigue,technical_fatigue,recovery_hours)
  WHERE variant.id=spec.id;

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT variant.id,
    CASE WHEN variant.id=eccentric_variant THEN 'resilience-eccentric' ELSE 'capacity-strength' END,
    CASE WHEN variant.id=eccentric_variant THEN 'resilience' ELSE 'capacity' END,
    'primary',
    CASE WHEN variant.id=eccentric_variant THEN 'Build controlled unilateral eccentric hamstring and hip capacity.' ELSE 'Build unilateral posterior-chain strength and repeatable pelvic control.' END,
    88,90,
    jsonb_build_object('hingeStrength',5,'posteriorChainCapacity',5,'balanceControl',4,'impactContribution',0),
    jsonb_build_object('doseType','repetitions_per_side','sets',CASE WHEN variant.id=eccentric_variant THEN 2 ELSE 3 END,'repetitionsPerSide',CASE WHEN variant.id=eccentric_variant THEN 4 ELSE 6 END,'tempo',CASE WHEN variant.id=eccentric_variant THEN '4_to_5_second_eccentric_assisted_or_bilateral_return' ELSE '3_second_lower_controlled_return' END,'effort','leave_two_or_more_clean_repetitions_in_reserve','restSeconds',CASE WHEN variant.load_profile_json->>'externalLoadRecorded'='true' THEN 120 ELSE 75 END,'sideOrder','declared_and_recorded'),
    'Every counted repetition preserves the exact side, support, hand and load path, foot pressure, soft knee, square pelvis, long spine, owned range, prescribed tempo, controlled return, and balanced reset.',
    ARRAY['pain_or_neurologic_symptom','dizziness_or_pressure_symptom','unsafe_grip_pickup_or_set_down','repeated_balance_loss','foot_collapse_or_knee_drift','pelvis_opens','spinal_substitution','load_path_drift','missed_tempo','grinding'],
    ARRAY['Verify exact variant and both side prescriptions.','Observe from front-oblique and side.','Count only valid repetitions and record failed work.','Stop before balance, load control, or tempo changes.'],
    ARRAY['Set the named stance leg and the exact hand or load.','Hips back and free heel long.','Keep hips square and stop at your owned range.','Stand tall and regain balance before the next rep.'],
    CASE WHEN variant.id=eccentric_variant THEN 'Improved slow-lowering control and unilateral posterior-chain tolerance.' ELSE 'Improved unilateral hip-extension force, posterior-chain capacity, and pelvic control.' END,
    equipment.required,
    jsonb_build_object('athletesPerStation',1,'clearance','full_trailing_leg_and_load_arc','setupSeconds',45,'transitionSeconds',30,'sideChangeSeconds',20,'pickupAndSetDown','declared_and_rehearsed','coachSightline',jsonb_build_array('front_oblique','side')),
    ARRAY[]::UUID[],'review',
    jsonb_build_object('setupSeconds',45,'secondsPerRep',CASE WHEN variant.id=eccentric_variant THEN 8 ELSE 6 END,'sideChangeSeconds',20,'transitionSeconds',30,'durationFormula','setup + sets * (repetitions_per_side * seconds_per_rep * sides + side_change + rest) + transition','countBothSides',TRUE),
    jsonb_build_object('reduce',jsonb_build_array('add_stable_support','reduce_range','reduce_or_remove_load','use_ipsilateral_before_contralateral_when_objective_allows','fewer_repetitions','longer_rest'),'increase',jsonb_build_array('remove_support','increase_owned_range','add_load','change_load_side_after_review','add_slow_eccentric','add_repetition_only_if_quality_and_recovery_hold')),
    jsonb_build_object('record',jsonb_build_array('variant_id','profile_key','stance_side','support_or_target','hand_and_load_side','implement_and_quantity','load','range','tempo','valid_repetitions','failed_repetitions','RPE_or_RIR','rest','faults','symptoms','duration'),'validity','all exact position, path, tempo, and reset gates pass'),
    jsonb_build_object('before','Which leg, hand or load side, support or target, range, tempo, repetitions, and rest were assigned?','during','Are foot pressure, knee, pelvis, spine, load path, tempo, and balance still valid?','after','Record each side, failed work, symptoms, duration, and any substitution before continuing.')
  FROM coaching.exercise_variant_v1 variant
  JOIN (VALUES
    (bodyweight_variant,ARRAY['none']::TEXT[]),(reach_variant,ARRAY['none']::TEXT[]),
    (supported_variant,ARRAY['wall']::TEXT[]),(db_contralateral_variant,ARRAY['dumbbell']::TEXT[]),
    (db_ipsilateral_variant,ARRAY['dumbbell']::TEXT[]),(db_bilateral_variant,ARRAY['dumbbell']::TEXT[]),
    (kb_contralateral_variant,ARRAY['kettlebell']::TEXT[]),(kb_ipsilateral_variant,ARRAY['kettlebell']::TEXT[]),
    (barbell_variant,ARRAY['barbell','plates']::TEXT[]),(eccentric_variant,ARRAY['wall']::TEXT[])
  ) equipment(variant_id,required) ON equipment.variant_id=variant.id
  WHERE variant.id=ANY(variant_ids)
  ON CONFLICT(variant_id,profile_key) DO UPDATE SET
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,dosage_json=EXCLUDED.dosage_json,
    quality_gate=EXCLUDED.quality_gate,stop_rules=EXCLUDED.stop_rules,
    coach_instructions=EXCLUDED.coach_instructions,athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,substitution_ids=EXCLUDED.substitution_ids,
    status='review',time_model_json=EXCLUDED.time_model_json,dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT bodyweight_variant,context.profile_key,'capacity','primary',
    context.purpose,84,88,
    jsonb_build_object('posteriorChainCapacity',4,'balanceControl',5,'sportSupport',4,'impactContribution',0),
    jsonb_build_object('doseType','repetitions_per_side','sets',2,'repetitionsPerSide',context.reps,'tempo','controlled_three_second_lower','effort','quality_first_not_fatigue','restSeconds',context.rest,'sideOrder','declared_and_recorded'),
    'Every repetition preserves the base Single-Leg Romanian Deadlift validity gates; sport transfer language never permits a changed exercise action.',
    ARRAY['pain_or_neurologic_symptom','dizziness_or_pressure_symptom','repeated_balance_loss','foot_knee_pelvis_or_spine_fault','tempo_or_output_drop'],
    ARRAY['Name the sport objective without promising direct transfer.','Preserve the exact bodyweight hinge and both side doses.','Place the drill where posterior-chain fatigue will not degrade the priority sport work.'],
    ARRAY['Use the same clean single-leg hinge.','Your sport context changes why it is scheduled, not how a valid repetition looks.','Stop before balance or shape changes.'],
    context.adaptation,ARRAY['none']::TEXT[],
    jsonb_build_object('athletesPerStation',1,'clearance','full_trailing_leg_arc','setupSeconds',35,'transitionSeconds',25,'sideChangeSeconds',15,'coachSightline',jsonb_build_array('front_oblique','side')),
    ARRAY[]::UUID[],'review',
    jsonb_build_object('setupSeconds',35,'secondsPerRep',6,'sideChangeSeconds',15,'transitionSeconds',25,'durationFormula','setup + sets * (repetitions_per_side * seconds_per_rep * sides + side_change + rest) + transition','countBothSides',TRUE),
    jsonb_build_object('reduce',jsonb_build_array('add_support','reduce_range','fewer_repetitions','longer_rest'),'increase',jsonb_build_array('increase_owned_range','add_small_load_only_after_profile_and_budget_review')),
    jsonb_build_object('record',jsonb_build_array('variant_id','profile_key','sport_context','stance_side','range','tempo','valid_and_failed_repetitions','rest','quality_result','symptoms','duration'),'validity','base exercise gates remain unchanged'),
    jsonb_build_object('before','What is the contextual objective and which side, dose, and rest are assigned?','during','Does the repetition still match the base exercise rather than imitating a sport action?','after','Record quality, side asymmetry, fatigue, duration, and any effect on priority sport work.')
  FROM (VALUES
    ('distance-jump-support','horizontal_jump_support','Support unilateral posterior-chain capacity and pelvic control without adding landing contacts.',4,90,'Improved side-specific hinge capacity available to a broader jump program without a claim of automatic skill transfer.'),
    ('throwing-support','throwing_kinetic_chain_support','Support lower-body and trunk control within a throwing workload without changing the hinge action.',5,75,'Improved unilateral posterior-chain and pelvic-control capacity within the total throwing plan.'),
    ('kicking-support','kicking_stance_leg_support','Support stance-leg posterior-chain capacity and balance within a kicking workload without simulating a kick.',4,90,'Improved stance-side hinge and balance capacity within the total kicking plan.')
  ) context(profile_key,role,purpose,reps,rest,adaptation)
  ON CONFLICT(variant_id,profile_key) DO UPDATE SET
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,dosage_json=EXCLUDED.dosage_json,
    quality_gate=EXCLUDED.quality_gate,stop_rules=EXCLUDED.stop_rules,
    coach_instructions=EXCLUDED.coach_instructions,athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,substitution_ids=EXCLUDED.substitution_ids,
    status='review',time_model_json=EXCLUDED.time_model_json,dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

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
  DO UPDATE SET source_title=EXCLUDED.source_title,source_publisher=EXCLUDED.source_publisher,
    source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
    evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

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
    'Public YouTube oEmbed link and embed health rechecked 2026-08-02. Title-level definition candidate only. Full playback must verify the exact identity and variant, stance and load side, support or target, implement and quantity, pickup and set-down, range, tempo, cue quality, safety, captions, accessibility, and demonstration quality. No exact variant match, content verification, reviewer, or approval is inferred.'
  FROM jsonb_array_elements(media_payload) item
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,title=EXCLUDED.title,
    channel_name=EXCLUDED.channel_name,language_code='en',captions_available=NULL,
    embedding_allowed=TRUE,exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='healthy',review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,reviewed_at)
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
    (supported_variant,bodyweight_variant,'progression',90,ARRAY['complexity','stability'],'Removes stable hand support while preserving bodyweight unilateral hinge identity.',$json$ {"requires":["owns_supported_range_without_balance_or_pelvic_fault"],"revalidateDoseDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (bodyweight_variant,supported_variant,'regression',90,ARRAY['complexity','stability'],'Adds stable hand support when balance prevents the intended hinge exposure.',$json$ {"useWhen":["balance_not_hinge_is_limiting"],"revalidateRangeAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (bodyweight_variant,reach_variant,'progression',86,ARRAY['complexity','stability'],'Adds an exact hand target and reach path while preserving the single-leg hinge.',$json$ {"requires":["owns_bodyweight_hinge_and_balanced_reset"],"revalidateTargetRangeDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (reach_variant,bodyweight_variant,'regression',86,ARRAY['complexity','stability'],'Removes the hand target when reach demand distorts the hinge or balance objective.',$json$ {"useWhen":["target_reach_changes_pelvis_spine_or_balance"],"revalidateRangeAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (bodyweight_variant,db_ipsilateral_variant,'progression',84,ARRAY['load','complexity','stability'],'Adds an ipsilateral dumbbell while preserving stance, hinge, and square-pelvis requirements.',$json$ {"requires":["owns_bodyweight_variant","safe_dumbbell_pickup_and_set_down"],"recomputeAllBudgets":true,"rerenderInstructions":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_ipsilateral_variant,bodyweight_variant,'regression',84,ARRAY['load','complexity','stability'],'Removes external load while preserving the same unilateral hinge.',$json$ {"useWhen":["load_or_grip_exceeds_objective"],"recomputeAllBudgets":true,"rerenderInstructions":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_ipsilateral_variant,db_contralateral_variant,'progression',82,ARRAY['complexity','stability'],'Moves a single dumbbell across the stance line; load-side demand must be revalidated.',$json$ {"requires":["owns_ipsilateral_load","contralateral_load_matches_objective"],"revalidateLoadSideAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_contralateral_variant,db_ipsilateral_variant,'regression',82,ARRAY['complexity','stability'],'Moves load to the stance side when contralateral stabilization demand exceeds the objective.',$json$ {"useWhen":["contralateral_load_distorts_pelvis_or_trunk"],"revalidateLoadSideAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_contralateral_variant,kb_contralateral_variant,'equipment_equivalent',91,ARRAY['load','stability'],'Preserves contralateral single-hand loading but changes implement geometry, grip, increments, pickup, and set-down.',$json$ {"requires":["exact_implement_available","safe_pickup_and_set_down"],"revalidateLoadLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (kb_contralateral_variant,db_contralateral_variant,'equipment_equivalent',91,ARRAY['load','stability'],'Preserves contralateral single-hand loading while changing the exact implement contract.',$json$ {"requires":["exact_implement_available"],"revalidateLoadLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_ipsilateral_variant,kb_ipsilateral_variant,'equipment_equivalent',91,ARRAY['load','stability'],'Preserves ipsilateral single-hand loading while changing implement geometry and handling.',$json$ {"requires":["exact_implement_available"],"revalidateLoadLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (kb_ipsilateral_variant,db_ipsilateral_variant,'equipment_equivalent',91,ARRAY['load','stability'],'Preserves ipsilateral loading while changing the exact implement contract.',$json$ {"requires":["exact_implement_available"],"revalidateLoadLogisticsDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_ipsilateral_variant,db_bilateral_variant,'progression',80,ARRAY['load','complexity','stability'],'Adds a second dumbbell and bilateral hand load, increasing load and grip while changing stabilization demand.',$json$ {"requires":["owns_single_dumbbell_variant","safe_two_load_pickup_and_set_down"],"recomputeAllBudgets":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_bilateral_variant,db_ipsilateral_variant,'regression',80,ARRAY['load','complexity','stability'],'Removes one dumbbell and returns to a single ipsilateral load.',$json$ {"useWhen":["two_hand_load_or_grip_exceeds_objective"],"recomputeAllBudgets":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (db_bilateral_variant,barbell_variant,'progression',76,ARRAY['load','complexity','stability'],'Changes two independent loads to a long bar with greater loading, path, pickup, and set-down consequences.',$json$ {"requires":["owns_bilateral_hand_load","safe_barbell_setup_and_set_down"],"recomputeAllBudgets":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (barbell_variant,db_bilateral_variant,'regression',76,ARRAY['load','complexity','stability'],'Replaces the long bar with two dumbbells when bar path or setup exceeds the objective.',$json$ {"useWhen":["barbell_setup_path_or_load_exceeds_objective"],"recomputeAllBudgets":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (bodyweight_variant,eccentric_variant,'progression',78,ARRAY['load','complexity','stability'],'Adds a declared slow eccentric and assisted return, changing time under tension and fatigue.',$json$ {"requires":["owns_standard_bodyweight_range","eccentric_objective_is_appropriate"],"recomputeFatigueRecoveryDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL),
    (eccentric_variant,bodyweight_variant,'regression',78,ARRAY['load','complexity','stability'],'Returns to standard controlled tempo when slow-eccentric duration or recovery exceeds the objective.',$json$ {"useWhen":["missed_eccentric_time_or_recovery_conflict"],"recomputeFatigueRecoveryDurationAndRendering":true}$json$::JSONB,'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  SELECT 1,canonical_id,archived_id,'duplicate_consolidated',
    'The source preserves the same single-leg hip-hinge identity; its implement, load side, support, reach, range, eccentric tempo, dose, or sport context remains an exact variant or delivery profile.',
    jsonb_build_object('migration',migration_key,'resolution','same_single_leg_hip_hinge_with_exact_variant_or_context_profile','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL
  FROM unnest(archive_definition_ids) archived_id
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
    (1,'ff9573b2-903c-46ea-ab71-3211f2350240',canonical_id,'distinct_exercises','Romanian Deadlift uses bilateral support; Single-Leg Romanian Deadlift uses one stance leg and side-specific balance and dosage.',jsonb_build_object('migration',migration_key,'identityBoundary','bilateral_support_hinge_vs_unilateral_support_hinge','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'21ee0ec4-cad3-403e-852f-d5d46687d1e2','distinct_exercises','A staggered-stance RDL retains two-foot support and different load distribution; the single-leg RDL unloads the trailing leg.',jsonb_build_object('migration',migration_key,'identityBoundary','unilateral_support_vs_staggered_two_foot_support','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'5f31cc17-f845-4086-a06d-782ea4ce4955','distinct_exercises','RDL Airplane deliberately opens and closes the pelvis; the Single-Leg Romanian Deadlift requires a square pelvis through the hinge.',jsonb_build_object('migration',migration_key,'identityBoundary','square_pelvis_hinge_vs_deliberate_pelvic_rotation','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'127d6bc9-6004-42a8-9738-0222ecda5f29','distinct_exercises','Reach plus Catch adds an externally timed object catch, perception, hand action, and perturbation.',jsonb_build_object('migration',migration_key,'identityBoundary','hinge_only_vs_hinge_plus_external_catch','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,canonical_id,'f27a294a-799e-4620-8a8a-63dfab68e6c1','distinct_exercises','Single-Leg Squat to Box is knee-dominant and reaches the pelvis to a target; the Single-Leg RDL is hip-hinge dominant with a trailing-leg counterbalance.',jsonb_build_object('migration',migration_key,'identityBoundary','single_leg_hip_hinge_vs_single_leg_squat_to_box','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,'e92ea7e1-3f79-4a2e-885d-cfb9e6dc3bf2',canonical_id,'distinct_exercises','Single-Leg Cone Reach Stick uses a target sequence and may change free-foot or hand action; the Single-Leg RDL requires the stable hip-hinge repetition contract.',jsonb_build_object('migration',migration_key,'identityBoundary','multi_target_balance_task_vs_single_leg_hip_hinge','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL),
    (1,'f0f47f37-e892-4689-99a0-16cba58a3f40',canonical_id,'distinct_exercises','Kettlebell Swing is a ballistic bilateral hinge; Single-Leg Romanian Deadlift is a controlled unilateral hinge.',jsonb_build_object('migration',migration_key,'identityBoundary','ballistic_bilateral_hinge_vs_controlled_unilateral_hinge','humanReviewRequired',TRUE,'approvalsCreated',FALSE),'deterministic_identity_equivalence',NULL)
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
    CASE WHEN (variant.difficulty_json->>dimension.key)::INTEGER<50 THEN 40 ELSE 60 END,
    CASE dimension.key
      WHEN 'technicalComplexity' THEN 'Review-only exercise-complexity anchor for unilateral stance, support or reach, implement count, load side, balance, coordination, tempo, pickup, and set-down of '
      ELSE 'Review-only physical-difficulty anchor for bodyweight or external load, side dose, eccentric duration, local fatigue, grip, and recovery of ' END
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
      'taxonomyControlled',TRUE,'anatomyComplete',TRUE,'difficultyComplete',TRUE,
      'loadComplete',TRUE,'fatigueRecoveryComplete',TRUE,'constraintsComplete',TRUE,
      'deliveryComplete',TRUE,'durationComplete',TRUE,
      'cumulativeFatigueAndImpactBudgetComplete',TRUE,'logisticsComplete',TRUE,
      'measurementAndValidityComplete',TRUE,'substitutionValidationComplete',TRUE,
      'athleteSupportComplete',TRUE,'coachSupportComplete',TRUE,'stopRulesComplete',TRUE,
      'evidenceCandidateSetComplete',TRUE,'mediaCandidateSetComplete',TRUE,
      'mediaApprovalComplete',FALSE,'graphReviewComplete',FALSE,
      'calibrationReviewComplete',FALSE,'exerciseSkillLevelAbsent',TRUE,
      'publicationApproved',FALSE),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must review full playback for exact identity and variant, side, support or target, implement and quantity, pickup and set-down, load path, range, tempo, captions, safety, accessibility, and demonstration quality.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must review every progression, regression, substitution, and equipment-equivalence proposal.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','Independent calibration and review are required for exercise complexity and physical difficulty.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Publication remains blocked until evidence, media, graph, calibration, and card-review gates pass.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=1,card_version=2,
    schema_version='1.0.0',audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  UPDATE coaching.exercise SET skill_level=NULL WHERE id=ANY(source_ids);
  UPDATE coaching.exercise_safety_profile SET minimum_skill_level=NULL
  WHERE exercise_id=ANY(source_ids);

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND card_version=2 AND status='review'
        AND provenance_json->>'singleLegRdlCompletionMigration'=migration_key
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL AND approved_video_url IS NULL)<>1
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(archive_definition_ids) AND status='archived')<>11 THEN
    RAISE EXCEPTION '% found invalid final definition states',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(variant_ids) AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=
          GREATEST((difficulty_json->>'technicalComplexity')::INTEGER,
            (difficulty_json->>'absoluteLoadDemand')::INTEGER)
        AND difficulty_json->>'physicalDifficulty'=difficulty_json->>'absoluteLoadDemand'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND fatigue_profile_json->>'recoveryHours' IS NOT NULL
        AND programming_profile_json->'weeklyExposure' IS NOT NULL)<>10
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(duplicate_variant_ids) AND status='archived'
        AND requirements_json->>'selectable'='false')<>2 THEN
    RAISE EXCEPTION '% created invalid variant difficulty, load, fatigue, programming, or duplicate states',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=canonical_id
        AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=canonical_id
        AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.required_equipment||definition.optional_equipment) key
      WHERE definition.id=canonical_id
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(variant_ids) AND status='review')<>13
    OR EXISTS(SELECT 1 FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(variant_ids) AND status='review'
        AND (cardinality(equipment_required)=0 OR time_model_json='{}'::JSONB
          OR dose_scaling_json='{}'::JSONB OR measurement_json='{}'::JSONB
          OR support_prompts_json='{}'::JSONB)) THEN
    RAISE EXCEPTION '% created incomplete contextual delivery profiles',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND (jsonb_typeof(anatomy_json->'jointActions')<>'array'
        OR jsonb_array_length(anatomy_json->'jointActions')=0
        OR athlete_support_json->>'whyItMatters' IS NULL
        OR coach_support_json->'observationChecklist' IS NULL
        OR support_operations_json->'issueCategories' IS NULL)) THEN
    RAISE EXCEPTION '% did not complete anatomy and support',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
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
          variant.programming_profile_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=ANY(source_ids) AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(source_ids) AND minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% created forbidden exercise proficiency metadata',migration_key;
  END IF;
  IF (SELECT count(DISTINCT section_key)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate')<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate' AND link_status='healthy'
        AND embedding_allowed IS TRUE AND exact_variant_match IS NULL
        AND reviewer_user_id IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate')<>5 THEN
    RAISE EXCEPTION '% did not create complete research packets',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(variant_ids) AND to_variant_id=ANY(variant_ids)
        AND review_status='review' AND reviewed_by IS NULL)<18 THEN
    RAISE EXCEPTION '% did not create the review-only relationship graph',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(variant_ids) AND status='review' AND version=1
        AND dimension=ANY(ARRAY['technicalComplexity','absoluteLoadDemand'])
        AND reviewed_by IS NULL AND reviewed_at IS NULL)<>20 THEN
    RAISE EXCEPTION '% did not create 20 review-only calibration anchors',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=canonical_id)<>12 THEN
    RAISE EXCEPTION '% did not map all twelve legacy source rows',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_id AND card_version=2
        AND status='quarantined' AND human_review_required IS TRUE
        AND checks_json->>'exerciseSkillLevelAbsent'='true'
        AND checks_json->>'publicationApproved'='false'
        AND jsonb_array_length(blocking_issues_json)=4)<>1 THEN
    RAISE EXCEPTION '% did not preserve the four-gate review quarantine',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL
        OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND (review_status<>'candidate' OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL)) THEN
    RAISE EXCEPTION '% fabricated an approval or external content verification',migration_key;
  END IF;
END;
$$;
